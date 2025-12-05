#!/usr/bin/env bun
/**
 * Apply LRCLIB timing to lyrics
 *
 * Fetches synced lyrics from LRCLIB and updates the DB with start_ms/end_ms
 */

import { parseArgs } from 'util';
import { neon } from '@neondatabase/serverless';
import { DATABASE_URL } from '../config';
import { getSongByISWC } from '../db/queries';
import { normalizeISWC } from '../lib/lyrics-parser';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    'lrclib-id': { type: 'string' },
  },
  strict: true,
});

if (!values.iswc || !values['lrclib-id']) {
  console.error('Usage: bun src/scripts/apply-lrclib-timing.ts --iswc=T0123456789 --lrclib-id=12345');
  process.exit(1);
}

const iswc = normalizeISWC(values.iswc);
const lrclibId = values['lrclib-id'];

const song = await getSongByISWC(iswc);
if (!song) {
  console.error(`Song not found: ${iswc}`);
  process.exit(1);
}

console.log(`Applying LRCLIB timing to "${song.title}"`);

const sql = neon(DATABASE_URL);

// Fetch synced lyrics from LRCLIB
const response = await fetch(`https://lrclib.net/api/get/${lrclibId}`);
const data = await response.json();

if (!data.syncedLyrics) {
  console.error('No synced lyrics found in LRCLIB');
  process.exit(1);
}

// Parse LRC format: [MM:SS.MS] text
const lines = data.syncedLyrics.split('\n').filter((l: string) => l.trim());
const parsed: Array<{ startMs: number; text: string }> = [];

for (const line of lines) {
  const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/);
  if (!match) continue;
  const [, min, sec, ms, text] = match;
  const startMs = parseInt(min) * 60000 + parseInt(sec) * 1000 + parseInt(ms.padEnd(3, '0'));
  parsed.push({ startMs, text: text.trim() });
}

console.log(`Parsed ${parsed.length} synced lines from LRCLIB`);

// Get existing lyrics
const lyrics = await sql`
  SELECT id, line_index, text FROM lyrics
  WHERE song_id = ${song.id} AND language = 'en'
  ORDER BY line_index
`;

console.log(`Found ${lyrics.length} lyrics in DB`);

// Match by text content and update
let updated = 0;
for (const lyric of lyrics) {
  // Find matching line (case-insensitive, trimmed)
  const lrcLine = parsed.find(p =>
    p.text.toLowerCase().trim() === (lyric.text as string).toLowerCase().trim()
  );
  if (lrcLine) {
    await sql`UPDATE lyrics SET start_ms = ${lrcLine.startMs} WHERE id = ${lyric.id}`;
    updated++;
  }
}

console.log(`Updated ${updated} lyrics with start_ms`);

// Calculate end_ms (next line's start - 1)
const updatedLyrics = await sql`
  SELECT id, line_index, start_ms FROM lyrics
  WHERE song_id = ${song.id} AND language = 'en' AND start_ms IS NOT NULL
  ORDER BY start_ms
`;

for (let i = 0; i < updatedLyrics.length - 1; i++) {
  const current = updatedLyrics[i];
  const next = updatedLyrics[i + 1];
  if (next.start_ms) {
    await sql`UPDATE lyrics SET end_ms = ${(next.start_ms as number) - 1} WHERE id = ${current.id}`;
  }
}

// Last line ends at song duration
if (updatedLyrics.length > 0) {
  const lastId = updatedLyrics[updatedLyrics.length - 1].id;
  const durationMs = Math.round((song.duration_seconds || 200) * 1000);
  await sql`UPDATE lyrics SET end_ms = ${durationMs} WHERE id = ${lastId}`;
}

console.log('✅ Timing data applied successfully');
