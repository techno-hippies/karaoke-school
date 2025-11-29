#!/usr/bin/env bun
/**
 * Insert Clip Script
 *
 * Creates a clip record in the database for a song.
 *
 * Usage:
 *   bun src/scripts/insert-clip.ts --iswc=T0112199333 --start=93548 --end=103548
 */

import { parseArgs } from 'util';
import { query, queryOne } from '../db/connection';
import { getSongByISWC } from '../db/queries';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    start: { type: 'string' },
    end: { type: 'string' },
  },
  strict: true,
});

async function main() {
  validateEnv(['DATABASE_URL']);

  if (!values.iswc || !values.start || !values.end) {
    console.error('Usage: bun src/scripts/insert-clip.ts --iswc=T0112199333 --start=93548 --end=103548');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const startMs = parseInt(values.start);
  const endMs = parseInt(values.end);

  console.log('\n📎 Inserting Clip');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Range: ${startMs}ms - ${endMs}ms (${(endMs - startMs) / 1000}s)`);

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error(`❌ Song not found: ${iswc}`);
    process.exit(1);
  }

  console.log(`   Song: ${song.title}`);

  // Check if clip already exists
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM clips WHERE song_id = $1 AND start_ms = $2 AND end_ms = $3`,
    [song.id, startMs, endMs]
  );

  if (existing) {
    console.log(`\n⚠️  Clip already exists: ${existing.id}`);
    process.exit(0);
  }

  // Insert clip
  const result = await queryOne<{ id: string }>(
    `INSERT INTO clips (song_id, start_ms, end_ms)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [song.id, startMs, endMs]
  );

  console.log(`\n✅ Clip created: ${result?.id}`);
  console.log('\n💡 Next steps:');
  console.log(`   • Emit to chain: bun src/scripts/emit-clip.ts --clip-id=${result?.id}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
