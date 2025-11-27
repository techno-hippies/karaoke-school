#!/usr/bin/env bun
/**
 * Align specific ZH lyrics to a clip audio file.
 * Creates/updates ZH lyrics for the exact line indices that fall within the clip range.
 */

import { parseArgs } from 'util';
import { query } from '../db/connection';
import { getSongByISWC } from '../db/queries';
import { type ElevenLabsWord } from '../services/elevenlabs';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv, ELEVENLABS_API_KEY } from '../config';
import * as fs from 'fs';
import * as path from 'path';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    clip: { type: 'string' }, // path to clip audio
    lyrics: { type: 'string' }, // ZH lyrics (newline separated)
    'start-line': { type: 'string' }, // starting line_index for these lyrics
  },
  strict: true,
});

function parseLinesFromAlignment(words: ElevenLabsWord[]) {
  const lines: { words: ElevenLabsWord[]; start_ms: number; end_ms: number }[] = [];
  let currentLineWords: ElevenLabsWord[] = [];

  for (const word of words) {
    if (word.text === '\n') {
      if (currentLineWords.length > 0) {
        const contentWords = currentLineWords.filter((w) => w.text.trim().length > 0);
        if (contentWords.length > 0) {
          lines.push({
            words: currentLineWords,
            start_ms: Math.round(contentWords[0].start * 1000),
            end_ms: Math.round(contentWords[contentWords.length - 1].end * 1000),
          });
        }
        currentLineWords = [];
      }
      continue;
    }
    currentLineWords.push(word);
  }

  if (currentLineWords.length > 0) {
    const contentWords = currentLineWords.filter((w) => w.text.trim().length > 0);
    if (contentWords.length > 0) {
      lines.push({
        words: currentLineWords,
        start_ms: Math.round(contentWords[0].start * 1000),
        end_ms: Math.round(contentWords[contentWords.length - 1].end * 1000),
      });
    }
  }

  return lines;
}

async function main() {
  validateEnv(['DATABASE_URL', 'ELEVENLABS_API_KEY']);

  if (!values.iswc || !values.clip || !values.lyrics || !values['start-line']) {
    console.error('❌ Missing required arguments');
    console.log('\nUsage:');
    console.log('  bun src/scripts/align-clip-zh.ts --iswc=T0112199333 --clip=path/to/clip.mp3 --lyrics="line1\\nline2" --start-line=22');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const clipPath = values.clip;
  const zhLines = values.lyrics.split('\\n');
  const startLineIndex = parseInt(values['start-line'], 10);

  console.log('\n🎤 Aligning ZH Clip');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Clip: ${clipPath}`);
  console.log(`   Lines: ${zhLines.length}`);
  console.log(`   Start index: ${startLineIndex}`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }

  // Read clip file
  const clipBuffer = fs.readFileSync(clipPath);

  // Parse clip timing from filename (e.g., 1.33.548-1.43.548.mp3)
  const filename = path.basename(clipPath);
  const match = filename.match(/(\d+)\.(\d+)\.(\d+)-(\d+)\.(\d+)\.(\d+)/);
  let clipStartMs = 0;
  if (match) {
    const [, m1, s1, ms1] = match;
    clipStartMs = parseInt(m1) * 60000 + parseInt(s1) * 1000 + parseInt(ms1);
    console.log(`   Clip starts at: ${clipStartMs}ms`);
  }

  // Run alignment with local file
  const fullText = zhLines.join('\n');
  console.log('\n⏳ Running ElevenLabs forced alignment...');
  console.log(`   Text: ${fullText}`);

  // Build multipart request directly
  const boundary = '----ElevenLabsBoundary' + Math.random().toString(36);
  const textEncoder = new TextEncoder();
  const bodyParts: Uint8Array[] = [];

  // Part 1: Audio file
  bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
  bodyParts.push(textEncoder.encode('Content-Disposition: form-data; name="file"; filename="audio.mp3"\r\n'));
  bodyParts.push(textEncoder.encode('Content-Type: audio/mpeg\r\n\r\n'));
  bodyParts.push(new Uint8Array(clipBuffer));
  bodyParts.push(textEncoder.encode('\r\n'));

  // Part 2: Lyrics text
  bodyParts.push(textEncoder.encode(`--${boundary}\r\n`));
  bodyParts.push(textEncoder.encode('Content-Disposition: form-data; name="text"\r\n\r\n'));
  bodyParts.push(textEncoder.encode(fullText));
  bodyParts.push(textEncoder.encode('\r\n'));

  // End boundary
  bodyParts.push(textEncoder.encode(`--${boundary}--\r\n`));

  // Combine all parts
  const totalLength = bodyParts.reduce((sum, part) => sum + part.length, 0);
  const combinedBody = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of bodyParts) {
    combinedBody.set(part, offset);
    offset += part.length;
  }

  // Call ElevenLabs API
  const response = await fetch('https://api.elevenlabs.io/v1/forced-alignment', {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVENLABS_API_KEY!,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: combinedBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
  }

  const alignment = await response.json() as { words: ElevenLabsWord[]; loss: number };
  console.log(`   Words: ${alignment.words.length}`);
  console.log(`   Loss: ${alignment.loss.toFixed(4)}`);

  // Parse aligned lines
  const parsedLines = parseLinesFromAlignment(alignment.words);
  console.log(`   Parsed lines: ${parsedLines.length}`);

  // Update/insert ZH lyrics
  for (let i = 0; i < zhLines.length && i < parsedLines.length; i++) {
    const lineIndex = startLineIndex + i;
    const text = zhLines[i];
    const parsed = parsedLines[i];

    // Offset timing by clip start position
    const startMs = clipStartMs + parsed.start_ms;
    const endMs = clipStartMs + parsed.end_ms;

    // Check if ZH line exists
    const existing = await query<{ id: string }>(
      `SELECT id FROM lyrics WHERE song_id = $1 AND language = 'zh' AND line_index = $2`,
      [song.id, lineIndex]
    );

    if (existing.length > 0) {
      // Update existing
      await query(
        `UPDATE lyrics SET text = $1, start_ms = $2, end_ms = $3, word_timings = $4 WHERE id = $5`,
        [text, startMs, endMs, JSON.stringify(parsed.words), existing[0].id]
      );
      console.log(`   Updated line ${lineIndex}: "${text}" (${startMs}-${endMs}ms)`);
    } else {
      // Insert new
      await query(
        `INSERT INTO lyrics (song_id, language, line_index, text, start_ms, end_ms, word_timings)
         VALUES ($1, 'zh', $2, $3, $4, $5, $6)`,
        [song.id, lineIndex, text, startMs, endMs, JSON.stringify(parsed.words)]
      );
      console.log(`   Inserted line ${lineIndex}: "${text}" (${startMs}-${endMs}ms)`);
    }
  }

  console.log('\n✅ ZH clip alignment complete');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
