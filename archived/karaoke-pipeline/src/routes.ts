/**
 * Manual Trigger Routes & Webhooks
 * Simple HTTP endpoints to manually trigger pipeline steps
 * Webhook receivers for async processing results
 */

import { Hono } from 'hono';
import type { Env } from './types';
import { runUnifiedPipeline } from './processors/orchestrator';
import { createGroveService } from './services/grove';

export const routes = new Hono<{ Bindings: Env }>();

/**
 * POST /trigger?step=8&limit=50
 * Manually trigger pipeline (all steps or specific step)
 */
routes.post('/trigger', async (c) => {
  const step = c.req.query('step') ? parseInt(c.req.query('step')!) : undefined;
  const limit = parseInt(c.req.query('limit') || '50');

  await runUnifiedPipeline(c.env, { step, limit });

  return c.json({
    success: true,
    message: step ? `Step ${step} completed` : 'All steps completed',
    step,
    limit,
  });
});

/**
 * POST /webhooks/demucs-complete
 *
 * Receives completion callback from Demucs service (local or remote)
 * Uploads instrumental to Grove and updates database
 *
 * Webhook Payload:
 * {
 *   job_id: "spotify_track_id",  // Same as submitted
 *   status: "completed" | "failed",
 *   instrumental_base64?: "...",  // Base64 audio (if completed)
 *   instrumental_size?: 4500000,
 *   vocals_base64?: "...",        // Backup vocals (if requested)
 *   vocals_size?: 3200000,
 *   model?: "mdx_extra",
 *   format?: "mp3",
 *   duration?: 15.3,              // Processing time in seconds
 *   error?: "..."                 // Error message (if failed)
 * }
 */
routes.post('/webhooks/demucs-complete', async (c) => {
  // Create fresh postgres connection for THIS request
  const postgres = (await import('postgres')).default;
  const sql = postgres(c.env.DATABASE_URL || process.env.DATABASE_URL!, {
    connect_timeout: 10,
  });

  try {
    const payload = (await c.req.json()) as any;

    const {
      job_id: jobId,
      status,
      instrumental_base64: instrumentalBase64,
      instrumental_size: instrumentalSize,
      vocals_base64: vocalsBase64,
      vocals_size: vocalsSize,
      duration: processingDuration,
      error: errorMessage,
    } = payload;

    // Validate required fields
    if (!jobId || !status) {
      return c.json(
        { error: 'Missing job_id or status' },
        { status: 400 }
      );
    }

    console.log(
      `[Webhook] Received demucs-complete callback for ${jobId}: ${status}`
    );

    if (status === 'failed') {
      console.log(`[Webhook] ❌ Demucs failed: ${errorMessage}`);

      // Update song_pipeline to mark as failed
      await sql`
        UPDATE song_pipeline
        SET
          status = 'failed',
          error_message = ${errorMessage || 'Separation failed'},
          updated_at = NOW()
        WHERE spotify_track_id = ${jobId}
      `;

      return c.json({
        success: true,
        jobId,
        status: 'failed',
        message: 'Separation marked as failed',
      });
    }

    if (status !== 'completed') {
      return c.json(
        { error: `Unknown status: ${status}` },
        { status: 400 }
      );
    }

    // Separation completed - upload instrumental (and vocals) to Grove
    if (!instrumentalBase64) {
      console.error(`[Webhook] ❌ No instrumental_base64 in payload`);
      return c.json(
        { error: 'Missing instrumental_base64' },
        { status: 400 }
      );
    }

    const groveService = createGroveService();

    // Upload instrumental
    console.log(
      `[Webhook] 📦 Uploading instrumental to Grove (${(
        instrumentalSize / 1024 / 1024
      ).toFixed(2)} MB)...`
    );
    const instrumentalResult = await groveService.uploadAudio(
      instrumentalBase64,
      `${jobId}-instrumental.mp3`,
      'instrumental'
    );
    console.log(`[Webhook] ✓ Instrumental uploaded: ${instrumentalResult.cid}`);

    // Upload vocals if provided
    let vocalsResult = null;
    if (vocalsBase64) {
      console.log(
        `[Webhook] 📦 Uploading vocals to Grove (${(
          vocalsSize / 1024 / 1024
        ).toFixed(2)} MB)...`
      );
      vocalsResult = await groveService.uploadAudio(
        vocalsBase64,
        `${jobId}-vocals.mp3`,
        'vocal'
      );
      console.log(`[Webhook] ✓ Vocals uploaded: ${vocalsResult.cid}`);
    }

    // Update song_audio with separation results
    await sql`
      UPDATE song_audio
      SET
        instrumental_grove_cid = ${instrumentalResult.cid},
        instrumental_grove_url = ${instrumentalResult.url},
        vocals_grove_cid = ${vocalsResult?.cid || null},
        vocals_grove_url = ${vocalsResult?.url || null},
        separation_duration_seconds = ${processingDuration || null},
        separation_mode = ${payload.mode || 'local'},
        separated_at = NOW(),
        updated_at = NOW()
      WHERE spotify_track_id = ${jobId}
    `;

    // Update song_pipeline status to 'stems_separated'
    await sql`
      UPDATE song_pipeline
      SET status = 'stems_separated', updated_at = NOW()
      WHERE spotify_track_id = ${jobId}
    `;

    console.log(`[Webhook] ✓ Database updated for ${jobId}`);

    return c.json({
      success: true,
      jobId,
      status: 'completed',
      instrumentalUrl: instrumentalResult.url,
      vocalsUrl: vocalsResult?.url,
      message: 'Separation complete and uploaded to Grove',
    });
  } catch (error: any) {
    console.error(
      `[Webhook] ❌ Error processing demucs webhook: ${error.message}`
    );

    return c.json(
      { error: error.message },
      { status: 500 }
    );
  }
});
