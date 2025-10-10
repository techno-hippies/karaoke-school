#!/usr/bin/env node

/**
 * Quick test to verify fal.ai synchronous API works (no queue polling)
 *
 * Tests the fal.run endpoint for audio-to-audio enhancement
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function testFalSync() {
  console.log('🎵 Testing fal.ai Synchronous API\n');
  console.log('Testing: Audio-to-audio drum enhancement');
  console.log('Endpoint: https://fal.run/fal-ai/stable-audio-25/audio-to-audio\n');

  const falApiKey = process.env.FAL_API_KEY;
  if (!falApiKey || falApiKey.startsWith('encrypted:')) {
    console.error('❌ FAL_API_KEY not found or still encrypted');
    console.error('   Set it with: export FAL_API_KEY=your_key_here');
    process.exit(1);
  }

  console.log('✅ API key loaded');

  // Download a test audio file first
  console.log('\n📥 Downloading test audio...');
  const audioUrl = 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';

  try {
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      throw new Error(`Failed to download test audio: ${audioResp.status}`);
    }

    const audioBytes = new Uint8Array(await audioResp.arrayBuffer());
    console.log(`✅ Downloaded ${(audioBytes.length / 1024).toFixed(1)}KB audio file`);

    // Convert to base64
    const base64Audio = Buffer.from(audioBytes).toString('base64');
    const dataUrl = `data:audio/wav;base64,${base64Audio}`;

    console.log('⏱️  Starting synchronous request to fal.ai...\n');

    const startTime = Date.now();
    const response = await fetch('https://fal.run/fal-ai/stable-audio-25/audio-to-audio', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: dataUrl,
        prompt: 'high quality drums, enhanced clarity, professional mixing',
        seconds_total: 10, // Short test
        cfg_scale: 7
      })
    });

    const duration = (Date.now() - startTime) / 1000;

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Request failed (${response.status}): ${error}`);
      process.exit(1);
    }

    const result = await response.json();
    console.log('✅ Synchronous response received!');
    console.log(`⏱️  Duration: ${duration.toFixed(1)}s`);
    console.log('\n📊 Response structure:');
    console.log(JSON.stringify(result, null, 2));

    if (result.audio_file?.url) {
      console.log('\n✅ SUCCESS! Enhanced audio URL:', result.audio_file.url);
      console.log('\n💡 fal.ai synchronous API confirmed working!');
      console.log('   No queue polling needed - perfect for Lit Actions');
      return true;
    } else {
      console.error('\n❌ No audio_file.url in response');
      console.error('   Response:', JSON.stringify(result, null, 2));
      return false;
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
}

const success = await testFalSync();
process.exit(success ? 0 : 1);
