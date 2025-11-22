/**
 * Audio Download Task Processor
 *
 * Triggers audio downloads via the audio-download-service API
 * Workflow:
 * 1. Get pending audio_download tasks
 * 2. POST to audio-download-service endpoint
 * 3. Service handles: local search → yt-dlp → Soulseek → AcoustID → Grove → Database
 */

import "../../env";

import {
  getPendingAudioTasks,
  updateAudioTask,
  updateTrackFlags,
} from '../../db/queries';
import { query } from '../../db/connection';

const AUDIO_SERVICE_URL = process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001';
const ACOUSTID_API_KEY = process.env.ACOUSTID_API_KEY;

interface DownloadResponse {
  success?: boolean;
  status?: string;
  workflow_id?: string;
  error?: string;
  message?: string;
}

/**
 * Trigger audio download via service
 */
async function triggerAudioDownload(
  spotifyTrackId: string,
  title: string,
  artist: string
): Promise<DownloadResponse> {
  try {
    console.log(`  🎵 Triggering download: "${title}" by ${artist}`);

    const response = await fetch(`${AUDIO_SERVICE_URL}/download-and-store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spotify_track_id: spotifyTrackId,
        expected_title: title,
        expected_artist: artist,
        acoustid_api_key: ACOUSTID_API_KEY,
        chain_id: 37111, // Lens testnet
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Service returned ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error: any) {
    console.error(`  ❌ Download trigger failed: ${error.message}`);
    throw error;
  }
}

/**
 * Main audio download processor
 */
export async function processAudioDownloads(limit: number = 10): Promise<void> {
  console.log(`\n🎵 Audio Download Task Processor (limit: ${limit})\n`);

  // Get pending tasks
  const tasks = await getPendingAudioTasks('download', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending audio download tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let triggeredCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track details
    const tracks = await query<{
      title: string;
      artists: Array<{ name: string }>;
    }>(`
      SELECT title, artists
      FROM tracks
      WHERE spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (tracks.length === 0) {
      console.log(`   ⚠️ Track ${task.spotify_track_id} not found, skipping`);
      await updateAudioTask(task.id, {
        status: 'failed',
        error_message: 'Track not found in database'
      });
      skippedCount++;
      continue;
    }

    const track = tracks[0];
    const artistName = track.artists[0]?.name || 'Unknown';

    console.log(`   🎵 ${track.title} by ${artistName}`);

    try {
      // Trigger download via service (fire-and-forget)
      const result = await triggerAudioDownload(
        task.spotify_track_id,
        track.title,
        artistName
      );

      if (result.status === 'processing' || result.status === 'already_processing') {
        console.log(`      ✅ Download triggered (workflow: ${result.workflow_id})`);

        // Mark task as running (service will update on completion)
        await updateAudioTask(task.id, {
          status: 'running',
          metadata: { workflow_id: result.workflow_id }
        });

        triggeredCount++;
      } else if (result.success) {
        console.log(`      ✅ Download completed immediately`);
        await updateAudioTask(task.id, { status: 'completed' });
        await updateTrackFlags(task.spotify_track_id, { has_audio: true });
        triggeredCount++;
      } else {
        throw new Error(result.error || result.message || 'Unknown error');
      }

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
      await updateAudioTask(task.id, {
        status: 'failed',
        error_message: error.message
      });
      failedCount++;
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Triggered: ${triggeredCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log('');
}

// Run if called directly
if (import.meta.main) {
  const limit = parseInt(process.argv[2]) || 10;
  processAudioDownloads(limit)
    .catch(error => {
      console.error('❌ Audio download processor failed:', error);
      process.exit(1);
    });
}
