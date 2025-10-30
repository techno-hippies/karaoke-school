/**
 * Lyrics Enrichment Routes
 * Multi-source lyrics fetching (LRCLIB + Lyrics.ovh) with automatic AI normalization
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { LyricsValidationService } from '../services/lyrics-validation';
import { OpenRouterService } from '../services/openrouter';
import type { Env } from '../types';

const lyrics = new Hono<{ Bindings: Env }>();

/**
 * POST /enrich-lyrics
 * Fetch lyrics for tracks with ISWC (filtered by has_iswc = true)
 * Automatically validates multi-source lyrics and normalizes with AI when corroborated
 */
lyrics.post('/enrich-lyrics', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const validationService = new LyricsValidationService();
  const openrouter = c.env.OPENROUTER_API_KEY ? new OpenRouterService(c.env.OPENROUTER_API_KEY) : null;
  const limit = parseInt(c.req.query('limit') || '20');

  // Only fetch lyrics for tracks with ISWC (viable for karaoke)
  const tracksNeedingLyrics = await db.sql`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists[1] as artist,
      st.album as album_name,
      st.duration_ms
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl
      ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true
      AND st.duration_ms IS NOT NULL
      AND st.artists IS NOT NULL
      AND st.album IS NOT NULL
      AND stl.spotify_track_id IS NULL
    LIMIT ${limit}
  `;

  if (tracksNeedingLyrics.length === 0) {
    return c.json({ message: 'No tracks need lyrics enrichment' });
  }

  console.log(`Enriching lyrics for ${tracksNeedingLyrics.length} tracks with multi-source validation...`);

  let enriched = 0;
  let normalized = 0;
  let instrumental = 0;
  let notFound = 0;
  const results = [];

  for (const track of tracksNeedingLyrics) {
    try {
      // Fetch from both LRCLIB + Lyrics.ovh
      const validation = await validationService.validateTrack({
        spotify_track_id: track.spotify_track_id,
        title: track.title,
        artist: track.artist,
        album: track.album_name,
        duration_ms: track.duration_ms,
      });

      // No lyrics found
      if (!validation.lrclib_lyrics && !validation.lyrics_ovh_lyrics) {
        notFound++;
        continue;
      }

      let finalLyrics: string;
      let finalSource: string;
      let confidenceScore: number;
      let syncedLyrics: string | null = null;
      let lrclibId: number | null = null;
      let normalizationReasoning: string | null = null;

      // Both sources + high similarity → AI normalize
      if (
        openrouter &&
        validation.lrclib_lyrics &&
        validation.lyrics_ovh_lyrics &&
        validation.corroborated &&
        validation.similarity_score &&
        validation.similarity_score >= 0.80
      ) {
        const aiResult = await openrouter.normalizeLyrics(
          validation.lrclib_lyrics,
          validation.lyrics_ovh_lyrics,
          track.title,
          track.artist
        );

        finalLyrics = aiResult.normalizedLyrics;
        finalSource = 'ai_normalized';
        confidenceScore = validation.similarity_score;
        normalizationReasoning = aiResult.reasoning;

        // Store AI normalized as source
        await db.sql`
          INSERT INTO lyrics_sources (spotify_track_id, source, plain_lyrics, char_count, line_count)
          VALUES (${track.spotify_track_id}, 'ai_normalized', ${finalLyrics}, ${finalLyrics.length}, ${finalLyrics.split('\n').length})
          ON CONFLICT (spotify_track_id, source) DO UPDATE SET
            plain_lyrics = EXCLUDED.plain_lyrics, char_count = EXCLUDED.char_count,
            line_count = EXCLUDED.line_count, fetched_at = NOW()
        `;

        normalized++;
      }
      // Single source or low confidence → use best available
      else {
        finalLyrics = validation.lrclib_lyrics || validation.lyrics_ovh_lyrics!;
        finalSource = validation.primary_source || 'lrclib';
        confidenceScore = validation.similarity_score || 0.5;
      }

      // Store in production table
      await db.sql`
        INSERT INTO spotify_track_lyrics (
          spotify_track_id, lrclib_id, plain_lyrics, synced_lyrics,
          instrumental, source, confidence_score, fetched_at, updated_at
        ) VALUES (
          ${track.spotify_track_id}, ${lrclibId}, ${finalLyrics}, ${syncedLyrics},
          false, ${finalSource}, ${confidenceScore}, NOW(), NOW()
        )
        ON CONFLICT (spotify_track_id) DO UPDATE SET
          plain_lyrics = EXCLUDED.plain_lyrics, source = EXCLUDED.source,
          confidence_score = EXCLUDED.confidence_score, updated_at = NOW()
      `;

      // Store raw sources for audit
      if (validation.lrclib_lyrics) {
        await db.sql`
          INSERT INTO lyrics_sources (spotify_track_id, source, plain_lyrics, char_count, line_count)
          VALUES (${track.spotify_track_id}, 'lrclib', ${validation.lrclib_lyrics}, ${validation.lrclib_lyrics.length}, ${validation.lrclib_lyrics.split('\n').length})
          ON CONFLICT (spotify_track_id, source) DO UPDATE SET
            plain_lyrics = EXCLUDED.plain_lyrics, fetched_at = NOW()
        `;
      }
      if (validation.lyrics_ovh_lyrics) {
        await db.sql`
          INSERT INTO lyrics_sources (spotify_track_id, source, plain_lyrics, char_count, line_count)
          VALUES (${track.spotify_track_id}, 'lyrics_ovh', ${validation.lyrics_ovh_lyrics}, ${validation.lyrics_ovh_lyrics.length}, ${validation.lyrics_ovh_lyrics.split('\n').length})
          ON CONFLICT (spotify_track_id, source) DO UPDATE SET
            plain_lyrics = EXCLUDED.plain_lyrics, fetched_at = NOW()
        `;
      }

      // Store validation
      if (validation.similarity_score !== null) {
        await db.sql`
          INSERT INTO lyrics_validations (
            spotify_track_id, sources_compared, primary_source, similarity_score,
            jaccard_similarity, corroborated, validation_status, validation_notes,
            ai_normalized, normalized_at, normalization_reasoning
          ) VALUES (
            ${track.spotify_track_id}, ${[validation.primary_source]}, ${validation.primary_source},
            ${validation.similarity_score}, ${validation.similarity_score}, ${validation.corroborated},
            ${validation.validation_status}, ${validation.notes}, ${normalizationReasoning !== null},
            ${normalizationReasoning ? db.sql`NOW()` : null}, ${normalizationReasoning}
          )
          ON CONFLICT (spotify_track_id) DO UPDATE SET
            similarity_score = EXCLUDED.similarity_score, corroborated = EXCLUDED.corroborated,
            ai_normalized = EXCLUDED.ai_normalized, normalized_at = EXCLUDED.normalized_at,
            normalization_reasoning = EXCLUDED.normalization_reasoning
        `;
      }

      enriched++;
      results.push({
        track: track.title,
        artist: track.artist,
        source: finalSource,
        confidence: confidenceScore,
        normalized: normalizationReasoning !== null,
        similarity: validation.similarity_score,
      });

    } catch (error) {
      console.error(`Failed to enrich lyrics for ${track.title}:`, error);
      notFound++;
    }
  }

  return c.json({
    success: true,
    service: 'multi-source-lyrics',
    enriched,
    normalized,
    instrumental,
    notFound,
    total: tracksNeedingLyrics.length,
    sample: results.slice(0, 5),
  });
});

/**
 * GET /lyrics/:spotify_track_id
 * Get lyrics for a specific track
 */
lyrics.get('/lyrics/:spotify_track_id', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const spotifyTrackId = c.req.param('spotify_track_id');

  const result = await db.sql`
    SELECT
      stl.*,
      st.title,
      st.artists,
      st.album_name
    FROM spotify_track_lyrics stl
    JOIN spotify_tracks st ON stl.spotify_track_id = st.spotify_track_id
    WHERE stl.spotify_track_id = ${spotifyTrackId}
  `;

  if (result.length === 0) {
    return c.json({ error: 'Lyrics not found' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /lyrics-stats
 * Get lyrics enrichment statistics
 */
lyrics.get('/lyrics-stats', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  const stats = await db.sql`
    SELECT
      COUNT(*) FILTER (WHERE stl.spotify_track_id IS NOT NULL) as total_with_lyrics,
      COUNT(*) FILTER (WHERE stl.source = 'ai_normalized') as total_ai_normalized,
      COUNT(*) FILTER (WHERE stl.source = 'lrclib') as total_lrclib_only,
      COUNT(*) FILTER (WHERE stl.source = 'lyrics_ovh') as total_lyrics_ovh_only,
      COUNT(*) FILTER (WHERE stl.synced_lyrics IS NOT NULL) as total_synced,
      COUNT(*) FILTER (WHERE stl.instrumental = true) as total_instrumental,
      COUNT(*) FILTER (WHERE stl.confidence_score < 1.0) as total_fuzzy_match,
      AVG(stl.confidence_score) as avg_confidence
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true
  `;

  const validation_stats = await db.sql`
    SELECT
      validation_status,
      COUNT(*) as count,
      AVG(similarity_score) as avg_similarity
    FROM lyrics_validations
    GROUP BY validation_status
  `;

  const pending = await db.sql`
    SELECT COUNT(*) as count
    FROM spotify_tracks st
    LEFT JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
    WHERE st.has_iswc = true
      AND st.duration_ms IS NOT NULL
      AND stl.spotify_track_id IS NULL
  `;

  return c.json({
    stats: stats[0],
    validation_stats,
    pending: pending[0].count,
  });
});

export default lyrics;
