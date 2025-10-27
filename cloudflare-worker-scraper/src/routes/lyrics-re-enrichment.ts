/**
 * Lyrics Re-Enrichment Route
 *
 * Re-process existing single-source lyrics to attempt:
 * 1. Finding second source (Lyrics.ovh)
 * 2. AI normalization if both sources found with ≥80% similarity
 *
 * This handles the case where tracks were enriched before the AI normalization
 * feature was implemented.
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { LyricsValidationService } from '../services/lyrics-validation';
import { OpenRouterService } from '../services/openrouter';
import type { Env } from '../types';

const lyricsReEnrichment = new Hono<{ Bindings: Env }>();

/**
 * POST /lyrics/re-enrich?limit=10
 * Re-process existing single-source lyrics for normalization
 */
lyricsReEnrichment.post('/lyrics/re-enrich', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const validationService = new LyricsValidationService();
  const openrouter = c.env.OPENROUTER_API_KEY ? new OpenRouterService(c.env.OPENROUTER_API_KEY) : null;

  if (!openrouter) {
    return c.json({
      success: false,
      error: 'OPENROUTER_API_KEY not configured',
    }, 500);
  }

  try {
    // Get tracks that have BOTH lrclib AND lyrics_ovh sources (not AI normalized yet)
    const tracksToReEnrich = await db.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists[1] as artist,
        st.album as album_name,
        st.duration_ms,
        stl.source as current_source
      FROM spotify_tracks st
      INNER JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
      INNER JOIN lyrics_sources ls ON st.spotify_track_id = ls.spotify_track_id
      WHERE stl.source != 'ai_normalized'
        AND st.duration_ms IS NOT NULL
        AND st.artists IS NOT NULL
        AND st.album IS NOT NULL
        AND ls.source IN ('lrclib', 'lyrics_ovh')
      GROUP BY st.spotify_track_id, st.title, st.artists, st.album, st.duration_ms, stl.source
      HAVING COUNT(DISTINCT ls.source) = 2
      ORDER BY st.spotify_track_id
      LIMIT ${limit}
    `;

    if (tracksToReEnrich.length === 0) {
      return c.json({
        success: true,
        message: 'No tracks need re-enrichment',
        normalized: 0,
        skipped: 0,
      });
    }

    console.log(`Re-enriching ${tracksToReEnrich.length} tracks...`);
    let normalizedCount = 0;
    let skippedCount = 0;

    for (const track of tracksToReEnrich) {
      try {
        // Fetch stored lyrics from lyrics_sources table
        const storedLyrics = await db.sql`
          SELECT source, plain_lyrics
          FROM lyrics_sources
          WHERE spotify_track_id = ${track.spotify_track_id}
            AND source IN ('lrclib', 'lyrics_ovh')
        `;

        if (storedLyrics.length !== 2) {
          skippedCount++;
          console.log(`  Skipped: ${track.title} (missing stored lyrics)`);
          continue;
        }

        const lrclibLyrics = storedLyrics.find(l => l.source === 'lrclib')?.plain_lyrics;
        const lyricsOvhLyrics = storedLyrics.find(l => l.source === 'lyrics_ovh')?.plain_lyrics;

        if (!lrclibLyrics || !lyricsOvhLyrics) {
          skippedCount++;
          console.log(`  Skipped: ${track.title} (empty stored lyrics)`);
          continue;
        }

        // Calculate Jaccard similarity
        const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
        const set1 = new Set(normalize(lrclibLyrics));
        const set2 = new Set(normalize(lyricsOvhLyrics));
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        const similarity = intersection.size / union.size;

        if (similarity >= 0.80) {
          // AI normalize
          const aiResult = await openrouter.normalizeLyrics(
            lrclibLyrics,
            lyricsOvhLyrics,
            track.title,
            track.artist
          );

          // Update the production table
          await db.sql`
            UPDATE spotify_track_lyrics
            SET
              plain_lyrics = ${aiResult.normalizedLyrics},
              source = 'ai_normalized',
              confidence_score = ${similarity},
              updated_at = NOW()
            WHERE spotify_track_id = ${track.spotify_track_id}
          `;

          // Store AI normalized source
          await db.sql`
            INSERT INTO lyrics_sources (spotify_track_id, source, plain_lyrics, char_count, line_count)
            VALUES (${track.spotify_track_id}, 'ai_normalized', ${aiResult.normalizedLyrics}, ${aiResult.normalizedLyrics.length}, ${aiResult.normalizedLyrics.split('\n').length})
            ON CONFLICT (spotify_track_id, source) DO UPDATE SET
              plain_lyrics = EXCLUDED.plain_lyrics, char_count = EXCLUDED.char_count,
              line_count = EXCLUDED.line_count, fetched_at = NOW()
          `;

          // Store validation
          await db.sql`
            INSERT INTO lyrics_validations (
              spotify_track_id, sources_compared, primary_source, similarity_score,
              jaccard_similarity, corroborated, validation_status, validation_notes,
              ai_normalized, normalized_at, normalization_reasoning
            ) VALUES (
              ${track.spotify_track_id}, ${['lrclib', 'lyrics_ovh']}, 'ai_normalized',
              ${similarity}, ${similarity}, true,
              'high_confidence', 'AI normalized from stored sources', true,
              NOW(), ${aiResult.reasoning}
            )
            ON CONFLICT (spotify_track_id) DO UPDATE SET
              similarity_score = EXCLUDED.similarity_score, corroborated = EXCLUDED.corroborated,
              ai_normalized = EXCLUDED.ai_normalized, normalized_at = EXCLUDED.normalized_at,
              normalization_reasoning = EXCLUDED.normalization_reasoning
          `;

          normalizedCount++;
          console.log(`✓ Normalized: ${track.title} (${(similarity * 100).toFixed(1)}%)`);
        } else {
          skippedCount++;
          console.log(`  Skipped: ${track.title} (low similarity: ${(similarity * 100).toFixed(1)}%)`);
        }
      } catch (error: any) {
        console.error(`Failed to re-enrich ${track.title}:`, error);
        skippedCount++;
      }
    }

    return c.json({
      success: true,
      message: `Re-enrichment complete`,
      processed: tracksToReEnrich.length,
      normalized: normalizedCount,
      skipped: skippedCount,
    });
  } catch (error: any) {
    console.error('Re-enrichment failed:', error);
    return c.json({
      success: false,
      error: error.message,
    }, 500);
  }
});

export default lyricsReEnrichment;
