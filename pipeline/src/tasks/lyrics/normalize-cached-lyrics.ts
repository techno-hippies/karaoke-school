#!/usr/bin/env bun
/**
 * Normalize Cached Lyrics
 *
 * Runs AI cleaning on tracks that already have plain_lyrics but missing normalized_lyrics.
 * This is needed when tracks were processed with the basic discovery script.
 *
 * Usage:
 *   bun src/tasks/lyrics/normalize-cached-lyrics.ts --limit=10
 *   bun src/tasks/lyrics/normalize-cached-lyrics.ts --trackId=SPOTIFY_ID
 */

import { query } from '../../db/connection';
import { cleanLyrics } from '../../services/openrouter';

interface TrackToNormalize {
  spotify_track_id: string;
  title: string;
  artists: Array<{ name: string }>;
  plain_lyrics: string;
  enrichment_task_id: number | null;
  enrichment_task_status: string | null;
}

async function normalizeCachedLyrics(limit: number = 10, trackId?: string): Promise<void> {
  console.log(`\n🧹 Normalizing Cached Lyrics (limit: ${limit})\n`);

  // Find tracks with plain_lyrics but no normalized_lyrics
  const params: Array<string | number> = [limit];
  let filterClause = '';

  if (trackId) {
    filterClause = 'AND t.spotify_track_id = $2';
    params.push(trackId);
  }

  const tracks = await query<TrackToNormalize>(
    `SELECT
      t.spotify_track_id,
      t.title,
      t.artists,
      sl.plain_lyrics,
      et.id AS enrichment_task_id,
      et.status AS enrichment_task_status
    FROM tracks t
    JOIN song_lyrics sl ON t.spotify_track_id = sl.spotify_track_id
    LEFT JOIN enrichment_tasks et
      ON et.spotify_track_id = t.spotify_track_id
     AND et.task_type = 'lyrics_discovery'
    WHERE sl.plain_lyrics IS NOT NULL
      AND sl.normalized_lyrics IS NULL
      ${filterClause}
    ORDER BY t.updated_at DESC
    LIMIT $1`,
    params
  );

  if (tracks.length === 0) {
    console.log('✅ All tracks with lyrics already have normalized_lyrics\n');
    return;
  }

  console.log(`Found ${tracks.length} tracks needing normalization\n`);

  let completedCount = 0;
  let failedCount = 0;

  for (const track of tracks) {
    const artistName = track.artists[0]?.name || 'Unknown';
    console.log(`   🎵 "${track.title}" by ${artistName}`);

    try {
      console.log(`      🤖 Cleaning with AI...`);
      const cleanedLyrics = await cleanLyrics(
        track.plain_lyrics,
        track.title,
        artistName
      );

      // Update song_lyrics with normalized version
      await query(
        `UPDATE song_lyrics
         SET normalized_lyrics = $1,
             updated_at = NOW()
         WHERE spotify_track_id = $2`,
        [cleanedLyrics, track.spotify_track_id]
      );

      console.log(`      ✅ Normalized (${cleanedLyrics.length} chars)`);
      completedCount++;

      if (track.enrichment_task_id && track.enrichment_task_status !== 'completed') {
        await query(
          `UPDATE enrichment_tasks
             SET status = 'completed',
                 source = COALESCE(source, 'normalize_cached_lyrics'),
                 result_data = COALESCE(result_data, '{}'::jsonb) || jsonb_build_object('normalized_by', 'normalize-cached-lyrics.ts'),
                 completed_at = NOW(),
                 last_attempt_at = NOW()
           WHERE id = $1`,
          [track.enrichment_task_id]
        );
      }

      // Small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
      failedCount++;

      if (track.enrichment_task_id) {
        await query(
          `UPDATE enrichment_tasks
             SET status = 'failed',
                 error_message = $2,
                 last_attempt_at = NOW()
           WHERE id = $1`,
          [track.enrichment_task_id, error.message ?? 'normalize-cached-lyrics failure']
        );
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Completed: ${completedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log('');
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  let limit = 10;
  let trackId: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--trackId=')) {
      trackId = arg.split('=')[1];
    } else if (!arg.startsWith('--')) {
      limit = parseInt(arg);
    }
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY environment variable required');
    process.exit(1);
  }

  normalizeCachedLyrics(limit, trackId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Normalization failed:', error);
      process.exit(1);
    });
}
