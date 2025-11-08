#!/usr/bin/env bun
/**
 * Audio Separation Task
 * Stage: translated → separated
 *
 * Uses Demucs (via RunPod) to separate vocals and instrumental stems
 * Polling-based (no webhook), uploads results to Grove
 *
 * Prerequisites:
 * - song_audio.grove_url (original audio)
 *
 * Output:
 * - song_audio.instrumental_grove_url/cid (instrumental stem)
 * - song_audio.vocals_grove_url/cid (vocals stem)
 * - Updates tracks.stage to 'separated'
 *
 * Usage:
 *   bun src/tasks/audio/separate-audio.ts [--limit=N]
 */

import { query } from '../../db/connection';
import { createDemucsService } from '../../services/demucs';
import { ensureAudioTask, startTask, completeTask, failTask, updateTrackStage } from '../../db/audio-tasks';
import { TrackStage } from '../../db/task-stages';

interface TrackForSeparation {
  spotify_track_id: string;
  title: string;
  artists: any;
  duration_ms: number;
  grove_url: string;
}

async function separateAudio(limit: number = 10) {
  console.log(`\n🎵 Audio Separation (Demucs via RunPod)`);
  console.log(`Limit: ${limit}`);

  // Check for RunPod credentials
  if (!process.env.RUNPOD_DEMUCS_ENDPOINT_ID || !process.env.RUNPOD_API_KEY) {
    console.error('❌ RUNPOD_DEMUCS_ENDPOINT_ID and RUNPOD_API_KEY required');
    process.exit(1);
  }

  const demucs = createDemucsService();

  try {
    // Find tracks at 'translated' stage with audio but no instrumental yet
    const tracks = await query<TrackForSeparation>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        t.duration_ms,
        sa.grove_url
      FROM tracks t
      JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
      WHERE t.stage = $1
        AND sa.grove_url IS NOT NULL
        AND sa.instrumental_grove_url IS NULL
      ORDER BY t.updated_at ASC
      LIMIT $2`,
      [TrackStage.Translated, limit]
    );

    if (tracks.length === 0) {
      console.log('✓ No tracks need separation (all caught up!)');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing separation\n`);

    let separatedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      const startTime = Date.now();

      try {
        // Ensure audio_tasks record exists
        await ensureAudioTask(track.spotify_track_id, 'separate');
        await startTask(track.spotify_track_id, 'separate');

        const artistName = Array.isArray(track.artists) && track.artists.length > 0
          ? track.artists[0].name
          : 'Unknown Artist';

        console.log(`\n🎵 Separating: ${track.title} - ${artistName}`);
        console.log(`   Duration: ${(track.duration_ms / 1000 / 60).toFixed(1)}m`);
        console.log(`   Audio: ${track.grove_url}`);

        // Submit to Demucs and poll for completion
        const result = await demucs.separate(
          track.spotify_track_id,
          track.grove_url
        );

        console.log(`   ✓ Vocals: ${result.vocals_grove_cid}`);
        console.log(`   ✓ Instrumental: ${result.instrumental_grove_cid}`);
        console.log(`   ✓ GPU time: ${result.gpu_time.toFixed(1)}s`);

        // Update song_audio with stem URLs
        await query(
          `UPDATE song_audio
           SET vocals_grove_cid = $1,
               vocals_grove_url = $2,
               instrumental_grove_cid = $3,
               instrumental_grove_url = $4,
               updated_at = NOW()
           WHERE spotify_track_id = $5`,
          [
            result.vocals_grove_cid,
            result.vocals_grove_url,
            result.instrumental_grove_cid,
            result.instrumental_grove_url,
            track.spotify_track_id
          ]
        );

        const processingTime = Date.now() - startTime;

        // Mark audio_tasks as completed
        await completeTask(track.spotify_track_id, 'separate', {
          grove_cid: result.instrumental_grove_cid,
          grove_url: result.instrumental_grove_url,
          metadata: {
            vocals_grove_cid: result.vocals_grove_cid,
            vocals_grove_url: result.vocals_grove_url,
            gpu_time: result.gpu_time,
            duration: result.duration
          },
          duration_ms: processingTime
        });

        // Update track stage based on completed tasks
        await updateTrackStage(track.spotify_track_id);
        console.log(`   ✓ Stage updated: translated → separated`);

        separatedCount++;
      } catch (error: any) {
        failedCount++;
        console.error(`   ✗ Failed to separate ${track.spotify_track_id}:`, error.message);

        // Mark audio_tasks as failed
        await failTask(track.spotify_track_id, 'separate', error.message, {
          error_type: error.name,
          stack: error.stack
        });
      }
    }

    console.log(
      `\n✅ Separation Complete: ${separatedCount} tracks separated, ${failedCount} failed`
    );
  } catch (error: any) {
    console.error('❌ Separation task failed:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  separateAudio(limit).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { separateAudio };
