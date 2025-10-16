#!/usr/bin/env bun
/**
 * Step 8.1: Clear Post Hashes from Manifest
 *
 * Clears lensPostHash entries from manifest so posts can be recreated
 * with enhanced metadata (does not delete on-chain)
 *
 * Prerequisites:
 * - Manifest with lensPostHash entries
 *
 * Usage:
 *   bun run clear-post-hashes --creator @brookemonk_
 *
 * Output:
 *   Manifest updated with cleared post hashes
 */

import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

interface VideoData {
  postId: string;
  postUrl: string;
  lensPostId?: string;
  lensPostHash?: string;
}

interface Manifest {
  tiktokHandle: string;
  lensHandle: string;
  lensAccountAddress: string;
  videos: VideoData[];
}

async function clearPostHashes(tiktokHandle: string): Promise<void> {
  console.log('\n🗑️  Step 8.1: Clearing Post Hashes from Manifest');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  console.log(`   Lens Account: ${manifest.lensHandle}`);
  console.log(`   Videos: ${manifest.videos.length}\n`);

  // Count posts to clear
  const postsToClear = manifest.videos.filter(v => v.lensPostHash);
  console.log(`   Posts with hashes: ${postsToClear.length}/${manifest.videos.length}\n`);

  if (postsToClear.length === 0) {
    console.log('   ℹ️  No post hashes to clear\n');
    return;
  }

  // 2. Clear post hashes
  console.log(`🧹 Clearing ${postsToClear.length} post hashes...\n`);

  let clearedCount = 0;
  for (const videoData of postsToClear) {
    console.log(`   Clearing: ${videoData.postUrl}`);
    console.log(`   Hash: ${videoData.lensPostHash}`);

    delete videoData.lensPostHash;
    delete videoData.lensPostId;
    clearedCount++;
    console.log(`   ✅ Cleared\n`);
  }

  // 3. Save updated manifest
  console.log('💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // 4. Summary
  console.log('═══════════════════════════════════════════');
  console.log('✅ Post Hashes Cleared!\n');

  console.log(`📊 Summary:`);
  console.log(`   Hashes cleared: ${clearedCount}/${postsToClear.length}`);
  console.log(`\n⚠️  Note: Old posts remain on Lens blockchain.`);
  console.log(`   You can now recreate posts with enhanced metadata.\n`);
  console.log(`📝 Next step: bun run create-lens-posts --creator ${tiktokHandle}\n`);
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run clear-post-hashes --creator @brookemonk_\n');
      process.exit(1);
    }

    await clearPostHashes(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
