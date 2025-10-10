#!/usr/bin/env node

/**
 * Simplest test: Does fal.ai return synchronously or queue?
 */

import dotenv from 'dotenv';
dotenv.config();

const falApiKey = process.env.FAL_API_KEY;

if (!falApiKey || falApiKey.startsWith('encrypted:')) {
  console.error('❌ FAL_API_KEY not found or encrypted');
  process.exit(1);
}

console.log('🧪 Testing if fal.ai is synchronous or queued\n');

// Make a simple request
const startTime = Date.now();

try {
  const response = await fetch('https://fal.run/fal-ai/stable-audio-25/audio-to-audio', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${falApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audio_url: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_0625c1539c.mp3',
      prompt: 'test',
      seconds_total: 5
    })
  });

  const duration = (Date.now() - startTime) / 1000;
  const result = await response.json();

  console.log(`Status: ${response.status}`);
  console.log(`Duration: ${duration.toFixed(1)}s`);
  console.log('\nResponse:', JSON.stringify(result, null, 2));

  // Check if it's a queue response
  if (result.request_id || result.queue_position !== undefined) {
    console.log('\n❌ QUEUED - Cannot use in Lit Actions');
    process.exit(1);
  }

  // Check if it's an immediate response with audio
  if (result.audio?.url || result.audio_file?.url) {
    console.log('\n✅ SYNCHRONOUS - Can use in Lit Actions!');
    console.log(`   Returned in ${duration.toFixed(1)}s with audio URL`);
    console.log(`   Audio: ${result.audio?.url || result.audio_file?.url}`);
    process.exit(0);
  }

  // If error response, still synchronous
  if (response.status >= 400) {
    console.log('\n✅ SYNCHRONOUS (error response) - Can use in Lit Actions!');
    process.exit(0);
  }

  console.log('\n❓ Unknown response format');
  process.exit(1);

} catch (error) {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
}
