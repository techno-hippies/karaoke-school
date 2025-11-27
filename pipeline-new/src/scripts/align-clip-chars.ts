#!/usr/bin/env bun
/**
 * Align clip with ElevenLabs and get CHARACTER-level timing.
 * Saves alignment JSON for ASS generation.
 */

import { parseArgs } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { ELEVENLABS_API_KEY } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    clip: { type: 'string' },
    lyrics: { type: 'string' },
    output: { type: 'string' },
  },
  strict: true,
});

async function main() {
  if (!values.clip || !values.lyrics) {
    console.log('Usage: bun src/scripts/align-clip-chars.ts --clip=path.mp3 --lyrics="line1\\nline2"');
    process.exit(1);
  }

  const clipPath = values.clip;
  const lyricsText = values.lyrics.replace(/\\n/g, '\n');
  const outputPath = values.output || clipPath.replace(/\.\w+$/, '-alignment.json');

  console.log('\n🎤 Character-Level Alignment');
  console.log(`   Clip: ${clipPath}`);
  console.log(`   Lyrics:\n${lyricsText.split('\n').map(l => '     ' + l).join('\n')}`);

  // Read clip
  const clipBuffer = fs.readFileSync(clipPath);
  console.log(`   Size: ${(clipBuffer.length / 1024).toFixed(1)} KB`);

  // Build multipart request
  const boundary = '----ElevenLabsBoundary' + Math.random().toString(36);
  const textEncoder = new TextEncoder();
  const bodyParts: Uint8Array[] = [];

  bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
  bodyParts.push(textEncoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
  bodyParts.push(textEncoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
  bodyParts.push(new Uint8Array(clipBuffer));
  bodyParts.push(textEncoder.encode('\r\n'));

  bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
  bodyParts.push(textEncoder.encode('Content-Disposition: form-data; name="text"\r\n\r\n'));
  bodyParts.push(textEncoder.encode(lyricsText));
  bodyParts.push(textEncoder.encode('\r\n'));

  bodyParts.push(textEncoder.encode(`--${boundary}--\r\n`));

  const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
  const combinedBody = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of bodyParts) {
    combinedBody.set(part, offset);
    offset += part.length;
  }

  console.log('\n⏳ Calling ElevenLabs...');
  const response = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY!,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: combinedBody,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  console.log(`   Characters: ${data.characters?.length || 0}`);
  console.log(`   Words: ${data.words?.length || 0}`);
  console.log(`   Loss: ${data.loss?.toFixed(4) || 'N/A'}`);

  // Save alignment
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\n✅ Saved: ${outputPath}`);
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
