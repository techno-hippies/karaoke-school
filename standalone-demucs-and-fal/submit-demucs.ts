#!/usr/bin/env bun

/**
 * One-off script to submit audio files to Demucs via Grove + RunPod
 * Usage: bun submit-demucs.ts <path-to-audio-file>
 *
 * Independent script - can be run from anywhere
 * Requires: new-karaoke-pipeline/.env with RUNPOD_DEMUCS_ENDPOINT_ID and RUNPOD_API_KEY
 */

import { readFileSync } from 'fs';
import { basename, join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from new-karaoke-pipeline/
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, 'new-karaoke-pipeline', '.env');

// Simple .env parser
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  });
} catch (err) {
  console.warn(`⚠️  Could not load ${envPath} - using existing env vars`);
}

// Configuration
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_DEMUCS_ENDPOINT_ID;
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;
const GROVE_API_KEY = process.env.GROVE_API_KEY;
const GROVE_CHAIN_ID = '37111'; // Lens testnet

if (!RUNPOD_ENDPOINT_ID || !RUNPOD_API_KEY) {
  console.error('❌ Missing RunPod credentials in .env');
  process.exit(1);
}

const DEMUCS_ENDPOINT = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

async function uploadToGrove(audioBuffer: Buffer, fileName: string): Promise<string> {
  console.log(`\n📤 Uploading to Grove IPFS...`);
  console.log(`   Size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);

  const response = await fetch(`https://api.grove.storage/?chain_id=${GROVE_CHAIN_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'audio/flac',
      ...(GROVE_API_KEY && { 'Authorization': `Bearer ${GROVE_API_KEY}` })
    },
    body: audioBuffer
  });

  if (!response.ok) {
    throw new Error(`Grove upload failed: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const cid = Array.isArray(result) ? result[0].storage_key : result.storage_key;
  const groveUrl = `https://api.grove.storage/${cid}`;

  console.log(`✅ Uploaded to Grove: ${cid}`);
  console.log(`   URL: ${groveUrl}`);

  return groveUrl;
}

async function submitToDemucsAsync(groveUrl: string, jobId: string) {
  console.log(`\n🎵 Submitting to Demucs RunPod (async)...`);
  console.log(`   Audio URL: ${groveUrl}`);
  console.log(`   Job ID: ${jobId}`);

  // Create a simple webhook server to receive the result
  const webhookPort = 9876;
  let webhookResult: any = null;

  const server = Bun.serve({
    port: webhookPort,
    async fetch(req) {
      if (req.method === 'POST') {
        webhookResult = await req.json();
        console.log(`\n📥 Webhook received!`);
        return new Response('OK');
      }
      return new Response('Not Found', { status: 404 });
    }
  });

  console.log(`\n🎧 Webhook server listening on http://localhost:${webhookPort}/webhook`);

  // Use RunPod's standard /run endpoint with proper input format
  // Pass a dummy spotify_track_id to trigger Grove upload
  const requestBody = {
    input: {
      job_id: jobId,
      audio_url: groveUrl,
      webhook_url: `http://host.docker.internal:${webhookPort}/webhook`,
      model: 'htdemucs',
      output_format: 'mp3',
      mp3_bitrate: 192,
      spotify_track_id: 'manual-upload' // Triggers Grove upload in handler
    }
  };

  console.log(`\n📤 Sending to ${DEMUCS_ENDPOINT}/run...`);

  const response = await fetch(`${DEMUCS_ENDPOINT}/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    server.stop();
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const submitResult = await response.json();
  console.log(`\n✅ Job queued!`);
  console.log(JSON.stringify(submitResult, null, 2));

  // Get the RunPod job ID from response
  const runpodJobId = submitResult.id;
  if (!runpodJobId) {
    server.stop();
    throw new Error('No job ID returned from RunPod');
  }

  // Poll for status using RunPod's status endpoint
  console.log(`\n⏳ Waiting for job to complete (RunPod ID: ${runpodJobId})...`);
  const statusUrl = `${DEMUCS_ENDPOINT}/status/${runpodJobId}`;

  let attempts = 0;
  const maxAttempts = 120; // 10 minutes (5s intervals)

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

    try {
      const statusResponse = await fetch(statusUrl, {
        headers: { 'Authorization': `Bearer ${RUNPOD_API_KEY}` }
      });

      if (statusResponse.ok) {
        const status = await statusResponse.json();
        const jobStatus = status.status;

        console.log(`   [${attempts + 1}/${maxAttempts}] Status: ${jobStatus}`);

        if (jobStatus === 'COMPLETED') {
          console.log(`\n✅ Job completed!`);
          console.log(`\n📦 Result:`);
          console.log(JSON.stringify(status.output, null, 2));

          // Display Grove URLs if present
          if (status.output?.vocals_grove_url) {
            console.log(`\n🎤 Vocals: ${status.output.vocals_grove_url}`);
          }
          if (status.output?.instrumental_grove_url) {
            console.log(`🎹 Instrumental: ${status.output.instrumental_grove_url}`);
          }

          server.stop();
          return status.output;
        } else if (jobStatus === 'FAILED') {
          console.error(`\n❌ Job failed:`, status.error || status.output?.error);
          server.stop();
          throw new Error(status.error || status.output?.error || 'Unknown error');
        }
      } else {
        console.log(`   [${attempts + 1}/${maxAttempts}] Waiting for status...`);
      }
    } catch (err) {
      console.log(`   [${attempts + 1}/${maxAttempts}] Polling... (${err instanceof Error ? err.message : 'checking'})`);
    }

    attempts++;
  }

  server.stop();
  throw new Error('Job timeout - exceeded 10 minutes');
}

// Main execution
const audioFilePath = process.argv[2];

if (!audioFilePath) {
  console.error('Usage: bun submit-demucs.ts <path-to-audio-file>');
  console.error('Example: bun submit-demucs.ts "/path/to/audio.flac"');
  console.error('');
  console.error('Supports: .flac, .mp3, .wav, etc.');
  process.exit(1);
}

try {
  console.log(`\n🎬 Starting Demucs processing...`);
  console.log(`   File: ${audioFilePath}`);

  const audioBuffer = readFileSync(audioFilePath);
  const fileName = basename(audioFilePath);
  const jobId = `manual-${Date.now()}`;

  // Step 1: Upload to Grove
  const groveUrl = await uploadToGrove(audioBuffer, fileName);

  // Step 2: Submit to Demucs
  await submitToDemucsAsync(groveUrl, jobId);

  console.log('\n✨ Done! Check the webhook output above for Grove URLs.\n');
} catch (error) {
  console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
