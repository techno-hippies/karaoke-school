#!/usr/bin/env node

/**
 * Simple test to verify Voxstral API key works
 */

import { readFile } from 'fs/promises';

const VOXSTRAL_API_KEY = 'rZ3svkM0mkGIqjaJLWSYwUC1EEKn90nR';
const TEST_AUDIO_PATH = '/media/t42/th42/Code/site/root/lit-actions/text-fixtures/audio/verse-1.mp3';

console.log('🎤 Testing Voxstral API\n');
console.log('API Key:', VOXSTRAL_API_KEY);
console.log('Audio:', TEST_AUDIO_PATH);

// Load audio file
const audioBuffer = await readFile(TEST_AUDIO_PATH);
console.log(`✅ Loaded audio: ${audioBuffer.length} bytes\n`);

// Create multipart form data
const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2, 15);
const encoder = new TextEncoder();
const parts = [];

// File field
parts.push(encoder.encode('--' + boundary + '\r\n'));
parts.push(encoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
parts.push(encoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
parts.push(audioBuffer);
parts.push(encoder.encode('\r\n'));

// Model field
parts.push(encoder.encode('--' + boundary + '\r\n'));
parts.push(encoder.encode('Content-Disposition: form-data; name="model"\r\n\r\n'));
parts.push(encoder.encode('voxtral-mini-latest\r\n'));

// Language field
parts.push(encoder.encode('--' + boundary + '\r\n'));
parts.push(encoder.encode('Content-Disposition: form-data; name="language"\r\n\r\n'));
parts.push(encoder.encode('en\r\n'));

// End boundary
parts.push(encoder.encode('--' + boundary + '--\r\n'));

// Calculate total length
const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
const bodyBytes = new Uint8Array(totalLength);
let offset = 0;
for (const part of parts) {
  bodyBytes.set(part, offset);
  offset += part.length;
}

console.log('📤 Calling Voxstral API...\n');

try {
  const response = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VOXSTRAL_API_KEY}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: bodyBytes
  });

  console.log('📡 Response Status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    console.log('❌ Error Response:', errorText);
    process.exit(1);
  }

  const result = await response.json();
  console.log('\n✅ SUCCESS!\n');
  console.log('Transcript:', result.text);
  console.log('Language:', result.language);
  console.log('\nFull response:', JSON.stringify(result, null, 2));

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
