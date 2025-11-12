/**
 * Task: Upload TikTok Video to Grove
 *
 * Downloads TikTok videos via audio-download-service (yt-dlp) and uploads to Grove IPFS.
 * This is the first step in the TikTok→Lens publishing pipeline.
 *
 * Flow:
 * 1. Select TikTok videos without Grove URLs
 * 2. Call audio-download-service /download-tiktok-video endpoint
 * 3. Store Grove CID/URL in audio_tasks.grove_cid/grove_url
 * 4. Update tiktok_videos.grove_video_url, grove_thumbnail_url
 *
 * Usage:
 *   bun src/tasks/tiktok/upload-grove.ts --limit=10
 *   bun src/tasks/tiktok/upload-grove.ts --videoId=7565931111373622550
 */

import { BaseTask, type BaseSubjectInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { AudioTaskType } from '../../db/task-stages';
import { query } from '../../db/connection';

const AUDIO_DOWNLOAD_SERVICE_URL = process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001';
const CHAIN_ID = 37111; // Lens Testnet

interface TikTokVideoInput extends BaseSubjectInput {
  video_id: string;
  creator_username: string;
  video_url: string;
  subject_type: 'tiktok_video';
  subject_id: string;  // Same as video_id
}

interface UploadResult extends TaskResult {
  grove_cid: string;
  grove_url: string;
  grove_thumbnail_cid?: string;
  grove_thumbnail_url?: string;
  metadata: {
    download_method: string;
  };
}

export class UploadTikTokGroveTask extends BaseTask<TikTokVideoInput, UploadResult> {
  readonly taskType = AudioTaskType.UploadTikTokGrove;
  readonly subjectType = 'tiktok_video' as const;

  async selectTracks(limit: number, videoId?: string): Promise<TikTokVideoInput[]> {
    const filter = buildAudioTasksFilter(this.taskType, this.subjectType, 'video_id');

    if (videoId) {
      const results = await query<TikTokVideoInput>(
        `SELECT
          video_id,
          creator_username,
          video_url,
          'tiktok_video' as subject_type,
          video_id as subject_id
         FROM tiktok_videos t
         WHERE video_id = $1
           ${filter}
         LIMIT 1`,
        [videoId]
      );
      return results;
    }

    const results = await query<TikTokVideoInput>(
      `SELECT
        video_id,
        creator_username,
        video_url,
        'tiktok_video' as subject_type,
        video_id as subject_id
       FROM tiktok_videos t
       WHERE grove_video_url IS NULL
         ${filter}
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return results;
  }

  async processTrack(video: TikTokVideoInput): Promise<UploadResult> {
    console.log(`  📤 Uploading ${video.video_id} to Grove...`);

    // Call audio-download-service /download-tiktok-video endpoint
    const response = await fetch(`${AUDIO_DOWNLOAD_SERVICE_URL}/download-tiktok-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        video_id: video.video_id,
        tiktok_url: video.video_url,
        chain_id: CHAIN_ID,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed (${response.status}): ${text}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(`Upload failed: ${JSON.stringify(data)}`);
    }

    // Update tiktok_videos table with Grove URLs
    await query(
      `UPDATE tiktok_videos
       SET grove_video_url = $1,
           grove_video_cid = $2,
           grove_thumbnail_url = $3,
           grove_thumbnail_cid = $4,
           updated_at = NOW()
       WHERE video_id = $5`,
      [
        data.grove_video_url,
        data.grove_video_cid,
        data.grove_thumbnail_url || null,
        data.grove_thumbnail_cid || null,
        video.video_id,
      ]
    );

    console.log(`  ✅ Uploaded: ${data.grove_video_cid}`);

    return {
      grove_cid: data.grove_video_cid,
      grove_url: data.grove_video_url,
      grove_thumbnail_cid: data.grove_thumbnail_cid,
      grove_thumbnail_url: data.grove_thumbnail_url,
      metadata: {
        download_method: data.download_method || 'yt-dlp-tiktok',
      },
    };
  }
}

// CLI wrapper
if (import.meta.main) {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const videoIdArg = args.find(arg => arg.startsWith('--videoId='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  const videoId = videoIdArg ? videoIdArg.split('=')[1] : undefined;

  const task = new UploadTikTokGroveTask();
  await task.run({ limit, trackId: videoId });
}
