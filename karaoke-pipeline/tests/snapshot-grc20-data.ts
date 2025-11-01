/**
 * Snapshot GRC-20 Data
 *
 * Creates a JSON snapshot of current GRC-20 tables for comparison.
 *
 * Usage:
 *   bun tests/snapshot-grc20-data.ts [output-file]
 *
 * Default output: /tmp/grc20-snapshot-{timestamp}.json
 */

import { query } from '../src/db/neon';
import * as fs from 'fs';

async function main() {
  const outputFile = process.argv[2] || `/tmp/grc20-snapshot-${Date.now()}.json`;

  console.log('📸 Creating GRC-20 snapshot...\n');

  const artists = await query(`
    SELECT * FROM grc20_artists
    ORDER BY id
  `);

  const works = await query(`
    SELECT * FROM grc20_works
    ORDER BY id
  `);

  const recordings = await query(`
    SELECT * FROM grc20_work_recordings
    ORDER BY id
  `);

  const snapshot = {
    artists,
    works,
    recordings,
    timestamp: new Date().toISOString(),
    counts: {
      artists: artists.length,
      works: works.length,
      recordings: recordings.length
    }
  };

  fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2));

  console.log('✅ Snapshot created successfully!\n');
  console.log('Summary:');
  console.log(`  - Artists: ${artists.length}`);
  console.log(`  - Works: ${works.length}`);
  console.log(`  - Recordings: ${recordings.length}`);
  console.log(`\n📁 Saved to: ${outputFile}`);
  console.log(`📊 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(2)} KB\n`);
}

main().catch(err => {
  console.error('❌ Error creating snapshot:', err);
  process.exit(1);
});
