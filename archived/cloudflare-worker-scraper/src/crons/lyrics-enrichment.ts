/**
 * Lyrics Enrichment Cron (runs every 15 minutes)
 *
 * Multi-source lyrics + AI normalization for karaoke production.
 * ONLY processes tracks with ISWC (viable for licensing).
 *
 * Flow:
 * 1. Fetch from multiple sources (LRCLIB, Lyrics.ovh)
 * 2. Calculate similarity (Jaccard + Levenshtein)
 * 3. If corroborated (>80% similarity) → AI normalize with OpenRouter
 * 4. Store in spotify_track_lyrics for production use
 * 5. Store validation results and raw sources for audit
 */

import { NeonDB } from '../neon';
import { LyricsValidationService } from '../services/lyrics-validation';
import { OpenRouterService } from '../services/openrouter';
import type { Env } from '../types';

export default async function runLyricsEnrichment(env: Env): Promise<void> {
  console.log('🎵 Lyrics Enrichment Cron: Starting...');

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const validationService = new LyricsValidationService();
  const openrouter = env.OPENROUTER_API_KEY ? new OpenRouterService(env.OPENROUTER_API_KEY) : null;

  try {
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
      LIMIT 10
    `;

    if (tracksNeedingLyrics.length === 0) {
      console.log('No tracks need lyrics enrichment');
      return;
    }

    console.log(`Fetching lyrics for ${tracksNeedingLyrics.length} tracks (from tracks with ISWC)...`);
    let enrichedLyrics = 0;
    let normalizedLyrics = 0;

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

        if (!validation.lrclib_lyrics && !validation.lyrics_ovh_lyrics) {
          continue;
        }

        let finalLyrics: string;
        let finalSource: string;
        let confidenceScore: number;
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

          // Store AI normalized source
          await db.sql`
            INSERT INTO lyrics_sources (spotify_track_id, source, plain_lyrics, char_count, line_count)
            VALUES (${track.spotify_track_id}, 'ai_normalized', ${finalLyrics}, ${finalLyrics.length}, ${finalLyrics.split('\n').length})
            ON CONFLICT (spotify_track_id, source) DO UPDATE SET
              plain_lyrics = EXCLUDED.plain_lyrics, char_count = EXCLUDED.char_count,
              line_count = EXCLUDED.line_count, fetched_at = NOW()
          `;

          normalizedLyrics++;
          console.log(`✓ AI normalized: ${track.title} (similarity: ${(validation.similarity_score * 100).toFixed(1)}%)`);
        } else {
          // Single source or low confidence
          finalLyrics = validation.lrclib_lyrics || validation.lyrics_ovh_lyrics!;
          finalSource = validation.primary_source || 'lrclib';
          confidenceScore = validation.similarity_score || 0.5;
          console.log(`✓ Single source: ${track.title} (${finalSource})`);
        }

        // Store in production table
        await db.sql`
          INSERT INTO spotify_track_lyrics (
            spotify_track_id, plain_lyrics, source, confidence_score, fetched_at, updated_at
          ) VALUES (
            ${track.spotify_track_id}, ${finalLyrics}, ${finalSource}, ${confidenceScore}, NOW(), NOW()
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
            ON CONFLICT (spotify_track_id, source) DO UPDATE SET plain_lyrics = EXCLUDED.plain_lyrics, fetched_at = NOW()
          `;
        }
        if (validation.lyrics_ovh_lyrics) {
          await db.sql`
            INSERT INTO lyrics_sources (spotify_track_id, source, plain_lyrics, char_count, line_count)
            VALUES (${track.spotify_track_id}, 'lyrics_ovh', ${validation.lyrics_ovh_lyrics}, ${validation.lyrics_ovh_lyrics.length}, ${validation.lyrics_ovh_lyrics.split('\n').length})
            ON CONFLICT (spotify_track_id, source) DO UPDATE SET plain_lyrics = EXCLUDED.plain_lyrics, fetched_at = NOW()
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

        enrichedLyrics++;
      } catch (error) {
        console.error(`Failed to fetch lyrics for ${track.title}:`, error);
      }
    }

    console.log(`✅ Lyrics Enrichment: ${enrichedLyrics} tracks enriched (${normalizedLyrics} AI normalized)`);
  } catch (error) {
    console.error('❌ Lyrics Enrichment failed:', error);
    throw error;
  }
}
