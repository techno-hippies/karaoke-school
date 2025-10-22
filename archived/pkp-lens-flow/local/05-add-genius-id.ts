#!/usr/bin/env bun
/**
 * Step 5: Add Genius Artist ID to Manifest
 *
 * Automatically adds the Genius artist ID to the manifest
 *
 * Usage:
 *   bun run local/05-add-genius-id.ts --creator @madisonbeer --genius-id 154127
 */

import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
    'genius-id': { type: 'string', short: 'g' },
  },
});

async function addGeniusId(tiktokHandle: string, geniusId: number): Promise<void> {
  console.log('\n🎵 Step 5: Adding Genius Artist ID');
  console.log('═══════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw);

  // Add Genius ID to profile
  if (!manifest.profile) {
    manifest.profile = {};
  }

  manifest.profile.geniusArtistId = geniusId;

  // Save updated manifest
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`✅ Added Genius Artist ID: ${geniusId}`);
  console.log(`   Profile: ${manifest.profile.nickname || cleanHandle}`);
  console.log(`   Genius URL: https://genius.com/artists/-${geniusId}\n`);

  console.log('✨ Done!\n');
}

async function main() {
  const creator = values.creator;
  const geniusIdStr = values['genius-id'];

  if (!creator || !geniusIdStr) {
    console.error('\n❌ Error: --creator and --genius-id arguments required\n');
    console.log('Usage: bun run local/05-add-genius-id.ts --creator @madisonbeer --genius-id 154127\n');
    process.exit(1);
  }

  const geniusId = parseInt(geniusIdStr);
  if (isNaN(geniusId)) {
    console.error('\n❌ Error: --genius-id must be a number\n');
    process.exit(1);
  }

  await addGeniusId(creator, geniusId);
}

main();
