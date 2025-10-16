#!/usr/bin/env bun
/**
 * Step 6: Re-upload Enriched Metadata to Grove
 *
 * Re-uploads video metadata with ISRC and MLC licensing data
 * Updates groveUris.metadata with new URIs
 *
 * Prerequisites:
 * - Manifest with ISRC data (from Step 4)
 * - Manifest with MLC data (from Step 5)
 * - Existing Grove URIs for videos/thumbnails
 *
 * Usage:
 *   bun run reupload-metadata --creator @charlidamelio
 *
 * Output:
 *   Updated manifest with new metadata URIs including licensing data
 */

import { StorageClient, lensAccountOnly } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
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
  description: string;
  stats: any;
  music: {
    title: string;
    spotifyUrl?: string | null;
    spotifyTrackId?: string | null;
    spotify?: {
      isrc?: string;
      metadata?: any;
      fetchedAt?: string;
    };
    mlc?: {
      songCode?: string;
      title?: string;
      writers?: any[];
      originalPublishers?: any[];
      matchedRecording?: any;
      fetchedAt?: string;
    };
  };
  groveUris: {
    video: string | null;
    thumbnail: string | null;
    metadata: string | null;
  };
  [key: string]: any;
}

interface Manifest {
  tiktokHandle: string;
  lensHandle: string;
  lensAccountAddress: string;
  scrapedAt: string;
  profile: any;
  videos: VideoData[];
}

async function reuploadMetadata(tiktokHandle: string): Promise<void> {
  console.log('\n☁️  Step 6: Re-upload Enriched Metadata to Grove');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  console.log(`   Lens Account: ${manifest.lensHandle}`);
  console.log(`   Videos: ${manifest.videos.length}\n`);

  // 2. Check for enriched data
  const videosWithISRC = manifest.videos.filter(v => v.music.spotify?.isrc).length;
  const videosWithMLC = manifest.videos.filter(v => v.music.mlc?.songCode).length;

  console.log(`📊 Enriched Data:`);
  console.log(`   Videos with ISRC: ${videosWithISRC}/${manifest.videos.length}`);
  console.log(`   Videos with MLC codes: ${videosWithMLC}/${manifest.videos.length}\n`);

  if (videosWithISRC === 0 && videosWithMLC === 0) {
    console.log('⚠️  No enriched data found. Run fetch-isrc and fetch-mlc first.\n');
    return;
  }

  // 3. Create Storage Client
  console.log('🔗 Creating Grove storage client...');
  const storageClient = StorageClient.create();
  console.log('✅ Connected to Grove\n');

  // 4. Setup ACL
  const lensAccount = manifest.lensAccountAddress as `0x${string}`;
  const chainId = chains.testnet.id;
  const acl = lensAccountOnly(lensAccount, chainId);

  console.log(`🔐 ACL Configuration:`);
  console.log(`   Type: lensAccountOnly`);
  console.log(`   Account: ${lensAccount}`);
  console.log(`   Chain ID: ${chainId}\n`);

  // 5. Re-upload video metadata with enriched data
  console.log(`🎬 Re-uploading metadata for ${manifest.videos.length} videos...\n`);

  let updatedCount = 0;

  for (let i = 0; i < manifest.videos.length; i++) {
    const video = manifest.videos[i];
    console.log(`   Video ${i + 1}/${manifest.videos.length}: ${video.music.title}`);

    // Check if this video has enriched data
    const hasISRC = !!video.music.spotify?.isrc;
    const hasMLC = !!video.music.mlc?.songCode;

    if (!hasISRC && !hasMLC) {
      console.log(`      ⚠️  No enriched data to upload\n`);
      continue;
    }

    // Show what we're adding
    if (hasISRC) {
      console.log(`      • ISRC: ${video.music.spotify.isrc}`);
    }
    if (hasMLC) {
      console.log(`      • MLC Song Code: ${video.music.mlc.songCode}`);
    }

    // Upload enriched metadata
    const videoMetadata = {
      postId: video.postId,
      postUrl: video.postUrl,
      description: video.description,
      stats: video.stats,
      music: video.music,
      groveUris: video.groveUris,
      uploadedAt: new Date().toISOString(),
      enrichedAt: new Date().toISOString(),
    };

    console.log(`      • Uploading enriched metadata...`);
    const metadataResult = await storageClient.uploadAsJson(videoMetadata, {
      name: `video-${video.postId}-metadata-enriched.json`,
      acl,
    });

    const oldUri = video.groveUris.metadata;
    video.groveUris.metadata = metadataResult.uri;

    console.log(`      ✅ New metadata URI: ${metadataResult.uri}`);
    if (oldUri) {
      console.log(`      ℹ️  Replaced: ${oldUri}`);
    }
    console.log('');

    updatedCount++;

    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // 6. Save updated manifest
  console.log('💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // 7. Summary
  console.log('═══════════════════════════════════════════');
  console.log('✨ Metadata Re-upload Complete!');
  console.log(`\n📊 Summary:`);
  console.log(`   Metadata updated: ${updatedCount}/${manifest.videos.length}`);
  console.log(`   Videos with ISRC: ${videosWithISRC}`);
  console.log(`   Videos with MLC codes: ${videosWithMLC}`);
  console.log('');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run reupload-metadata --creator @charlidamelio\n');
      process.exit(1);
    }

    await reuploadMetadata(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
