/**
 * FFmpeg Service
 * Simple Hono + Bun + ffmpeg server for audio cropping
 * Deploys on Akash for ~$2/month
 */

import { Hono } from 'hono';
import { $ } from 'bun';

const app = new Hono();

interface CropRequest {
  job_id: string;
  audio_url: string;
  start_ms: string;
  end_ms: string;
  webhook_url: string;
  output_format?: string;
  mp3_bitrate?: string;
}

/**
 * POST /crop-async
 * Crop audio segment and send result to webhook
 */
app.post('/crop-async', async (c) => {
  const formData = await c.req.formData();
  const req: CropRequest = {
    job_id: formData.get('job_id') as string,
    audio_url: formData.get('audio_url') as string,
    start_ms: formData.get('start_ms') as string,
    end_ms: formData.get('end_ms') as string,
    webhook_url: formData.get('webhook_url') as string,
    output_format: formData.get('output_format') as string || 'mp3',
    mp3_bitrate: formData.get('mp3_bitrate') as string || '192',
  };

  console.log(`📥 Crop job ${req.job_id}: ${req.start_ms}ms - ${req.end_ms}ms`);

  // Start async processing
  processCropJob(req).catch(err => {
    console.error(`❌ Job ${req.job_id} failed:`, err);
  });

  return c.json({
    job_id: req.job_id,
    status: 'processing',
    message: 'Crop job submitted'
  });
});

/**
 * Process crop job asynchronously
 */
async function processCropJob(req: CropRequest) {
  const tmpDir = `/tmp/ffmpeg-${req.job_id}`;
  const inputFile = `${tmpDir}/input.mp3`;
  const outputFile = `${tmpDir}/output.mp3`;

  try {
    // Create temp directory
    await $`mkdir -p ${tmpDir}`;

    // Convert lens:// URI to HTTP gateway URL if needed
    let downloadUrl = req.audio_url;
    if (req.audio_url.startsWith('lens://')) {
      const cid = req.audio_url.replace('lens://', '');
      downloadUrl = `https://api.grove.storage/${cid}`;
      console.log(`🔄 Converting lens:// to gateway: ${downloadUrl}`);
    }

    // Download audio
    console.log(`⬇️ Downloading: ${downloadUrl}`);
    const audioResponse = await fetch(downloadUrl);
    if (!audioResponse.ok) {
      throw new Error(`Download failed: ${audioResponse.status}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    await Bun.write(inputFile, audioBuffer);

    // Calculate ffmpeg parameters
    const startMs = parseInt(req.start_ms);
    const endMs = parseInt(req.end_ms);
    const durationMs = endMs - startMs;

    const startSec = (startMs / 1000).toFixed(3);
    const durationSec = (durationMs / 1000).toFixed(3);

    console.log(`✂️ Cropping: -ss ${startSec}s -t ${durationSec}s`);

    // Crop with ffmpeg (transcode to MP3 if needed)
    const bitrate = req.mp3_bitrate || '192';
    await $`ffmpeg -y -ss ${startSec} -t ${durationSec} -i ${inputFile} -c:a libmp3lame -b:a ${bitrate}k ${outputFile}`;

    // Read output and convert to base64
    const outputBuffer = await Bun.file(outputFile).arrayBuffer();
    const base64 = Buffer.from(outputBuffer).toString('base64');
    const outputSize = outputBuffer.byteLength;

    console.log(`✓ Cropped: ${(outputSize / 1024 / 1024).toFixed(2)}MB`);

    // Send to webhook
    console.log(`📤 Sending to webhook: ${req.webhook_url}`);
    const webhookResponse = await fetch(req.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: req.job_id,
        status: 'completed',
        cropped_base64: base64,
        cropped_size: outputSize,
        start_ms: startMs,
        end_ms: endMs,
        duration_ms: durationMs,
      }),
    });

    if (!webhookResponse.ok) {
      throw new Error(`Webhook failed: ${webhookResponse.status}`);
    }

    console.log(`✅ Job ${req.job_id} complete`);
  } catch (error: any) {
    console.error(`❌ Job ${req.job_id} error:`, error);

    // Send error to webhook
    try {
      await fetch(req.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: req.job_id,
          status: 'failed',
          error: error.message,
        }),
      });
    } catch (webhookError) {
      console.error(`Failed to send error to webhook:`, webhookError);
    }
  } finally {
    // Cleanup
    try {
      await $`rm -rf ${tmpDir}`;
    } catch {}
  }
}

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'ffmpeg-service' });
});

/**
 * GET /
 * Service info
 */
app.get('/', (c) => {
  return c.json({
    service: 'ffmpeg-service',
    version: '1.0.0',
    endpoints: {
      'POST /crop-async': 'Crop audio segment asynchronously',
      'GET /health': 'Health check',
    },
  });
});

const port = parseInt(process.env.PORT || '3000');
console.log(`🚀 FFmpeg service running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
