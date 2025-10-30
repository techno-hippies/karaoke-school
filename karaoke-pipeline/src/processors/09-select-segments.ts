/**
 * Step 9: AI Segment Selection
 *
 * Analyzes lyrics with word-level timing to select optimal segments:
 * 1. Optimal 190s karaoke segment (songs ≥190s only)
 * 2. Best 20-50s clip (ALL songs)
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
import { SegmentSelectorService, type WordTiming } from '../services/segment-selector';
import type { Env } from '../types';

export async function processSegmentSelection(env: Env, limit: number = 50): Promise<void> {
  console.log(`\n[Step 9] AI Segment Selection (limit: ${limit})`);

  if (!env.OPENROUTER_API_KEY) {
    console.log('⚠️ OPENROUTER_API_KEY not configured, skipping');
    return;
  }

  const segmentSelector = new SegmentSelectorService(env.OPENROUTER_API_KEY);

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
        console.log(`\n📍 Selecting segments: ${track.spotify_track_id}`);
        console.log(`   Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);
        console.log(`   Words: ${track.word_alignments.length}`);

        // Ensure karaoke_segments record exists
        await ensureKaraokeSegment(env.DATABASE_URL, track.spotify_track_id);

        // Convert word alignments to expected format
        const words: WordTiming[] = track.word_alignments.map((w: any) => ({
          text: w.text,
          start: w.start,
          end: w.end
        }));

        // Select segments using AI
        const result = await segmentSelector.selectSegments(words, track.duration_ms);

        // Update database
        await updateSelectedSegments(env.DATABASE_URL, track.spotify_track_id, {
          optimalSegmentStartMs: result.optimalSegment?.startMs,
          optimalSegmentEndMs: result.optimalSegment?.endMs,
          clipStartMs: result.clip.startMs,
          clipEndMs: result.clip.endMs
        });

        // Log results
        if (result.optimalSegment) {
          console.log(`   ✓ Optimal 190s: ${result.optimalSegment.startMs}ms - ${result.optimalSegment.endMs}ms`);
        } else {
          console.log(`   ✓ Song <190s: Using full track`);
        }
        console.log(`   ✓ Best clip: ${result.clip.startMs}ms - ${result.clip.endMs}ms (${result.clip.durationMs}ms)`);

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
