/**
 * Step 9: Full-Song Segment Selection (Simplified)
 *
 * Sets segments to use the full song (up to 190s max):
 * - Start: 0ms
 * - End: min(song_duration, 190000ms)
 *
 * Why simplified? AI-selected segments caused broken line breaks.
 * Full songs provide better learning context and natural lyric structure.
 *
 * Processes tracks that have:
 * - Separated instrumentals (song_audio.instrumental_grove_url)
 * - Word alignments (elevenlabs_word_alignments)
 * - NO segment selection yet (karaoke_segments.clip_start_ms IS NULL)
 */

import {
  ensureKaraokeSegment,
  updateSelectedSegments,
  getTracksNeedingSegmentSelection
} from '../db/karaoke-segments';
import type { Env } from '../types';

export async function processSegmentSelection(env: Env, limit: number = 50): Promise<void> {
  console.log(`\n[Step 9] Full-Song Segment Selection (limit: ${limit})`);

  try {
    // Find tracks needing segment selection
    const tracks = await getTracksNeedingSegmentSelection(env.DATABASE_URL, limit);

    if (tracks.length === 0) {
      console.log('✓ No tracks need segment selection (all caught up!)');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing segment selection`);

    let selectedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      try {
        console.log(`\n📍 Setting full-song segment: ${track.spotify_track_id}`);
        console.log(`   Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

        // Ensure karaoke_segments record exists
        await ensureKaraokeSegment(env.DATABASE_URL, track.spotify_track_id);

        // Simple logic: use full song up to 190s
        const segmentEndMs = Math.min(track.duration_ms, 190000);

        // Update database with full-song boundaries
        await updateSelectedSegments(env.DATABASE_URL, track.spotify_track_id, {
          optimalSegmentStartMs: 0,
          optimalSegmentEndMs: segmentEndMs,
          clipStartMs: 0,
          clipEndMs: segmentEndMs
        });

        // Log results
        const durationSeconds = (segmentEndMs / 1000).toFixed(1);
        if (segmentEndMs < track.duration_ms) {
          console.log(`   ✓ Segment: 0ms - ${segmentEndMs}ms (${durationSeconds}s, 190s limit)`);
        } else {
          console.log(`   ✓ Segment: 0ms - ${segmentEndMs}ms (${durationSeconds}s, full song)`);
        }

        selectedCount++;
      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        failedCount++;
      }
    }

    console.log(`\n✓ Step 9 complete: ${selectedCount} selected, ${failedCount} failed`);
  } catch (error: any) {
    console.error(`[Step 9] Fatal error: ${error.message}`);
    throw error;
  }
}
