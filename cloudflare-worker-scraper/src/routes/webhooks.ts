/**
 * Webhook Routes
 * Handles callbacks from external services (Modal, etc.)
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { GroveService } from '../services/grove';
import type { Env } from '../types';
import type { FFmpegWebhookPayload } from '../services/ffmpeg';

const webhooks = new Hono<{ Bindings: Env }>();

/**
 * POST /webhook/ffmpeg-crop
 * Handle FFmpeg crop completion from Modal (for full 190s segments)
 */
webhooks.post('/webhook/ffmpeg-crop', async (c) => {
  try {
    const payload: FFmpegWebhookPayload = await c.req.json();
    const { job_id, status, cropped_base64, cropped_size, start_ms, end_ms, error } = payload;

    console.log(`📨 FFmpeg webhook: job ${job_id}, status: ${status}`);

    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    if (status === 'failed') {
      console.error(`❌ FFmpeg job ${job_id} failed: ${error}`);
      return c.json({ success: false, error }, 500);
    }

    if (!cropped_base64) {
      console.error(`❌ FFmpeg job ${job_id}: no cropped audio returned`);
      return c.json({ success: false, error: 'No cropped audio' }, 400);
    }

    // Upload cropped segment to Grove
    console.log(`📤 Uploading cropped segment to Grove (${(cropped_size! / 1024 / 1024).toFixed(2)}MB)`);
    const grove = new GroveService();
    const groveResult = await grove.uploadBase64(cropped_base64, 'audio/mp3');

    console.log(`✓ Uploaded to Grove: ${groveResult.cid}`);

    // Save to database (job_id = spotify_track_id)
    await db.sql`
      UPDATE karaoke_segments
      SET
        fal_segment_grove_cid = ${groveResult.cid},
        fal_segment_grove_url = ${groveResult.gatewayUrl},
        updated_at = NOW()
      WHERE spotify_track_id = ${job_id}
    `;

    console.log(`✓ Updated karaoke_segments for ${job_id}`);

    return c.json({
      success: true,
      spotify_track_id: job_id,
      grove_cid: groveResult.cid,
      grove_url: groveResult.gatewayUrl,
      cropped_size,
      segment: { start_ms, end_ms }
    });
  } catch (error: any) {
    console.error('FFmpeg webhook error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /webhook/tiktok-crop
 * Handle FFmpeg TikTok clip crop completion (for 20-50s iconic clips)
 */
webhooks.post('/webhook/tiktok-crop', async (c) => {
  try {
    const payload: FFmpegWebhookPayload = await c.req.json();
    const { job_id, status, cropped_base64, cropped_size, start_ms, end_ms, error } = payload;

    console.log(`📨 TikTok crop webhook: job ${job_id}, status: ${status}`);

    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    if (status === 'failed') {
      console.error(`❌ TikTok crop job ${job_id} failed: ${error}`);
      return c.json({ success: false, error }, 500);
    }

    if (!cropped_base64) {
      console.error(`❌ TikTok crop job ${job_id}: no cropped audio returned`);
      return c.json({ success: false, error: 'No cropped audio' }, 400);
    }

    // Upload TikTok clip to Grove
    console.log(`📤 Uploading TikTok clip to Grove (${(cropped_size! / 1024 / 1024).toFixed(2)}MB)`);
    const grove = new GroveService();
    const groveResult = await grove.uploadBase64(cropped_base64, 'audio/mp3');

    console.log(`✓ Uploaded TikTok clip to Grove: ${groveResult.cid}`);

    // Save to database (job_id = spotify_track_id)
    await db.sql`
      UPDATE karaoke_segments
      SET
        tiktok_clip_grove_cid = ${groveResult.cid},
        tiktok_clip_grove_url = ${groveResult.gatewayUrl},
        updated_at = NOW()
      WHERE spotify_track_id = ${job_id}
    `;

    console.log(`✓ Updated TikTok clip for ${job_id}`);

    return c.json({
      success: true,
      spotify_track_id: job_id,
      grove_cid: groveResult.cid,
      grove_url: groveResult.gatewayUrl,
      cropped_size,
      clip_duration_ms: end_ms! - start_ms!
    });
  } catch (error: any) {
    console.error('TikTok crop webhook error:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default webhooks;
