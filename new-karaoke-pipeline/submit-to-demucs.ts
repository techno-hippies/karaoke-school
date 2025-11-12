#!/usr/bin/env bun

/**
 * One-off script to submit a FLAC file to the Demucs RunPod endpoint
 * Usage: bun submit-to-demucs.ts <path-to-audio-file>
 */

import { readFileSync } from 'fs';
import { basename } from 'path';

// RunPod Configuration
const RUNPOD_ENDPOINT_ID = process.env.RUNPOD_DEMUCS_ENDPOINT_ID;
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY;

if (!RUNPOD_ENDPOINT_ID || !RUNPOD_API_KEY) {
  console.error('❌ Missing RunPod credentials in .env:');
  console.error('   RUNPOD_DEMUCS_ENDPOINT_ID');
  console.error('   RUNPOD_API_KEY');
  process.exit(1);
}

const DEMUCS_ENDPOINT = `https://api.runpod.ai/v2/${RUNPOD_ENDPOINT_ID}`;

async function submitToDemucs(audioFilePath: string) {
  console.log(`\n🎵 Submitting to Demucs RunPod...`);
  console.log(`   File: ${audioFilePath}`);

  // Read the audio file
  const audioBuffer = readFileSync(audioFilePath);
  const fileName = basename(audioFilePath);
  const jobId = `manual-${Date.now()}`;

  console.log(`   Size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)}MB`);
  console.log(`   Job ID: ${jobId}`);

  // Create form data with base64 encoded audio for sync processing
  const base64Audio = audioBuffer.toString('base64');
  const mimeType = fileName.endsWith('.flac') ? 'audio/flac' :
                   fileName.endsWith('.mp3') ? 'audio/mpeg' :
                   'audio/wav';

  console.log(`\n📤 Sending to ${DEMUCS_ENDPOINT}/runsync...`);

  const requestBody = {
    input: {
      audio_base64: `data:${mimeType};base64,${base64Audio}`,
      model: 'htdemucs',
      output_format: 'mp3',
      mp3_bitrate: 192
    }
  };

  const response = await fetch(`${DEMUCS_ENDPOINT}/runsync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RUNPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  console.log(`\n✅ Separation complete!`);
  console.log(JSON.stringify(result, null, 2));

  // If we got base64 results, save them
  if (result.output?.vocals_base64) {
    const outputDir = `/media/t42/th42/Code/karaoke-school-v1`;
    const baseName = fileName.replace(/\.[^.]+$/, '');

    // Save vocals
    const vocalsBuffer = Buffer.from(result.output.vocals_base64, 'base64');
    const vocalsPath = `${outputDir}/${baseName}-vocals.mp3`;
    await Bun.write(vocalsPath, vocalsBuffer);
    console.log(`\n🎤 Vocals saved: ${vocalsPath}`);
    console.log(`   Size: ${(vocalsBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // Save instrumental
    const instBuffer = Buffer.from(result.output.instrumental_base64, 'base64');
    const instPath = `${outputDir}/${baseName}-instrumental.mp3`;
    await Bun.write(instPath, instBuffer);
    console.log(`\n🎹 Instrumental saved: ${instPath}`);
    console.log(`   Size: ${(instBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    console.log(`\n⏱️  Processing time: ${result.output.duration?.toFixed(1)}s`);
    console.log(`   GPU time: ${result.output.gpu_time?.toFixed(1)}s`);
  }
}

// Main execution
const audioFilePath = process.argv[2];

if (!audioFilePath) {
  console.error('Usage: bun submit-to-demucs.ts <path-to-audio-file>');
  console.error('Example: bun submit-to-demucs.ts "/media/t42/th42/Code/karaoke-school-v1/JENNIE - Mantra.flac"');
  process.exit(1);
}

try {
  await submitToDemucs(audioFilePath);
  console.log('\n✨ Done!\n');
} catch (error) {
  console.error('\n❌ Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}
