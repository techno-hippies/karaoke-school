#!/usr/bin/env bun
/**
 * Step 3: Upload TikTok Content to Grove Storage
 *
 * Uploads videos, thumbnails, and metadata to Grove with lensAccountOnly ACL
 * Updates manifest with Grove URIs
 *
 * Prerequisites:
 * - Manifest from Step 2 (data/videos/{handle}/manifest.json)
 * - Lens account data (data/lens/{handle}.json)
 *
 * Usage:
 *   bun run upload-grove --creator @charlidamelio
 *
 * Output:
 *   Updated manifest with Grove URIs
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
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  music: {
    title: string;
    spotifyUrl: string | null;
    spotifyTrackId: string | null;
  };
  localFiles: {
    video: string | null;
    thumbnail: string | null;
  };
  groveUris: {
    video: string | null;
    thumbnail: string | null;
    metadata: string | null;
  };
}

interface Manifest {
  tiktokHandle: string;
  lensHandle: string;
  lensAccountAddress: string;
  scrapedAt: string;
  profile: {
    nickname: string;
    bio: string;
    stats: any;
    localFiles: {
      avatar: string | null;
    };
    groveUris: {
      metadata: string | null;
      avatar: string | null;
    };
  };
  videos: VideoData[];
}

async function uploadToGrove(tiktokHandle: string): Promise<void> {
  console.log('\n☁️  Step 3: Uploading to Grove Storage');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  console.log(`   Lens Account: ${manifest.lensHandle}`);
  console.log(`   Videos: ${manifest.videos.length}\n`);

  // 2. Create Storage Client
  console.log('🔗 Creating Grove storage client...');
  const storageClient = StorageClient.create();
  console.log('✅ Connected to Grove\n');

  // 3. Setup ACL (lensAccountOnly - account owns the content)
  const lensAccount = manifest.lensAccountAddress as `0x${string}`;
  const chainId = chains.testnet.id;
  const acl = lensAccountOnly(lensAccount, chainId);

  console.log(`🔐 ACL Configuration:`);
  console.log(`   Type: lensAccountOnly`);
  console.log(`   Account: ${lensAccount}`);
  console.log(`   Chain ID: ${chainId}\n`);

  // 4. Upload profile data
  console.log('📊 Uploading profile metadata...');
  const profileMetadata = {
    tiktokHandle: manifest.tiktokHandle,
    lensHandle: manifest.lensHandle,
    nickname: manifest.profile.nickname,
    bio: manifest.profile.bio,
    bioTranslations: manifest.profile.bioTranslations || {},
    stats: manifest.profile.stats,
    uploadedAt: new Date().toISOString(),
  };

  const profileResult = await storageClient.uploadAsJson(profileMetadata, {
    name: `${cleanHandle}-profile.json`,
    acl,
  });

  manifest.profile.groveUris.metadata = profileResult.uri;
  console.log(`   ✅ Profile metadata: ${profileResult.uri}\n`);

  // 5. Upload avatar (if exists)
  const avatarPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'avatar.jpg');
  const avatarFile = Bun.file(avatarPath);

  if (await avatarFile.exists()) {
    console.log('🖼️  Uploading profile avatar...');
    try {
      const avatarResult = await storageClient.uploadFile(avatarFile, {
        name: `${cleanHandle}-avatar.jpg`,
        acl,
      });
      manifest.profile.groveUris.avatar = avatarResult.uri;
      console.log(`   ✅ Avatar: ${avatarResult.uri}\n`);
    } catch (e) {
      console.log(`   ⚠️  Avatar upload failed: ${e}\n`);
    }
  } else if (manifest.profile.localFiles.avatar) {
    console.log('⚠️  Avatar file not found but listed in manifest\n');
  }

  // 6. Upload videos
  console.log(`🎬 Uploading ${manifest.videos.length} videos...\n`);

  for (let i = 0; i < manifest.videos.length; i++) {
    const video = manifest.videos[i];
    console.log(`   Video ${i + 1}/${manifest.videos.length}: ${video.music.title}`);

    // Upload video file
    if (video.localFiles.video) {
      // Fix path - remove ../../ prefix and use absolute path
      const videoFilename = path.basename(video.localFiles.video);
      const videoPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, videoFilename);

      try {
        const videoFile = Bun.file(videoPath);
        if (await videoFile.exists()) {
          console.log(`      • Uploading video (${(videoFile.size / 1024 / 1024).toFixed(2)} MB)...`);
          const videoResult = await storageClient.uploadFile(videoFile, {
            acl,
          });
          video.groveUris.video = videoResult.uri;
          console.log(`      ✅ Video: ${videoResult.uri}`);
        } else {
          console.log(`      ⚠️  Video file not found: ${videoPath}`);
        }
      } catch (e) {
        console.log(`      ⚠️  Video upload failed: ${e}`);
      }
    }

    // Upload thumbnail
    if (video.localFiles.thumbnail) {
      // Fix path - remove ../../ prefix and use absolute path
      const thumbFilename = path.basename(video.localFiles.thumbnail);
      const thumbPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, thumbFilename);

      try {
        const thumbFile = Bun.file(thumbPath);
        if (await thumbFile.exists()) {
          console.log(`      • Uploading thumbnail...`);
          const thumbResult = await storageClient.uploadFile(thumbFile, {
            acl,
          });
          video.groveUris.thumbnail = thumbResult.uri;
          console.log(`      ✅ Thumbnail: ${thumbResult.uri}`);
        } else {
          console.log(`      ⚠️  Thumbnail file not found: ${thumbPath}`);
        }
      } catch (e) {
        console.log(`      ⚠️  Thumbnail upload failed: ${e}`);
      }
    }

    // Upload video metadata
    const videoMetadata = {
      postId: video.postId,
      postUrl: video.postUrl,
      description: video.description,
      stats: video.stats,
      music: video.music,
      groveUris: video.groveUris,
      uploadedAt: new Date().toISOString(),
    };

    console.log(`      • Uploading metadata...`);
    const metadataResult = await storageClient.uploadAsJson(videoMetadata, {
      name: `video-${video.postId}-metadata.json`,
      acl,
    });
    video.groveUris.metadata = metadataResult.uri;
    console.log(`      ✅ Metadata: ${metadataResult.uri}\n`);
  }

  // 7. Save updated manifest
  console.log('💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // 8. Summary
  console.log('═══════════════════════════════════════════');
  console.log('[bold green]✨ Upload Complete![/bold green]');
  console.log(`\n📊 Summary:`);
  console.log(`   Profile metadata: ${manifest.profile.groveUris.metadata}`);
  console.log(`   Videos uploaded: ${manifest.videos.filter(v => v.groveUris.video).length}/${manifest.videos.length}`);
  console.log(`\n⚠️  Next Steps:`);
  console.log(`   • Run MLC scraper to get song codes`);
  console.log(`   • Create Lens posts with Grove URIs`);
  console.log('');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run upload-grove --creator @charlidamelio\n');
      process.exit(1);
    }

    await uploadToGrove(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
