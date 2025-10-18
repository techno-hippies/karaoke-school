#!/usr/bin/env bun
/**
 * Step 4: Upload HLS Segments + Content to Grove Storage
 *
 * Uploads HLS segments, playlists, thumbnails, and metadata to Grove
 * with lensAccountOnly ACL. Updates manifest with Grove URIs.
 *
 * Prerequisites:
 * - Videos converted & segmented (step 2.9)
 * - Videos encrypted (step 3)
 * - Manifest from crawler (data/videos/{handle}/manifest.json)
 * - Lens account data (data/lens/{handle}.json)
 *
 * Usage:
 *   bun run upload-grove --creator @charlidamelio
 *
 * Output:
 *   Updated manifest with Grove URIs for segments, playlists, metadata
 */

import { StorageClient, lensAccountOnly } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
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
  hls?: {
    segmented: boolean;
    segmentedAt: string;
    segmentDuration: number;
    segmentCount: number;
    playlistFile: string;
    segmentsDir: string;
  };
  encryption?: {
    encryptedSymmetricKey: string;
    dataToEncryptHash: string;
    unifiedAccessControlConditions: any[];
    segments: Array<{ filename: string; iv: string; authTag: string }>;
    encryptedAt: string;
  };
  groveUris: {
    video: string | null; // Deprecated - use playlist instead
    thumbnail: string | null;
    metadata: string | null;
    playlist?: string; // HLS playlist URI
    segments?: { [filename: string]: string }; // Map of segment filename → URI
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
  console.log('\n☁️  Step 4: Uploading HLS Segments to Grove Storage');
  console.log('═══════════════════════════════════════════════════════\n');

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

  // 6. Upload videos (HLS segments or single files)
  console.log(`🎬 Uploading ${manifest.videos.length} videos...\n`);

  for (let i = 0; i < manifest.videos.length; i++) {
    const video = manifest.videos[i];
    console.log(`   Video ${i + 1}/${manifest.videos.length}: ${video.music.title}`);

    // Check if video has HLS segments
    if (video.hls?.segmented) {
      const segmentsDir = path.join(process.cwd(), 'data', 'videos', cleanHandle, video.hls.segmentsDir);

      if (!existsSync(segmentsDir)) {
        console.log(`      ⚠️  Segments directory not found: ${segmentsDir}\n`);
        continue;
      }

      console.log(`      📦 Uploading HLS segments...`);

      // Upload playlist file
      const playlistPath = path.join(segmentsDir, video.hls.playlistFile);
      try {
        const playlistFile = Bun.file(playlistPath);
        if (await playlistFile.exists()) {
          const playlistResult = await storageClient.uploadFile(playlistFile, {
            name: `${video.postId}-playlist.m3u8`,
            acl,
          });
          video.groveUris.playlist = playlistResult.uri;
          console.log(`         ✅ Playlist: ${playlistResult.uri}`);
        }
      } catch (e) {
        console.log(`         ⚠️  Playlist upload failed: ${e}`);
      }

      // Upload all .ts segments
      try {
        const files = await readdir(segmentsDir);
        const segmentFiles = files.filter(f => f.endsWith('.ts')).sort();

        if (!video.groveUris.segments) {
          video.groveUris.segments = {};
        }

        for (let j = 0; j < segmentFiles.length; j++) {
          const filename = segmentFiles[j];
          const segmentPath = path.join(segmentsDir, filename);
          const segmentFile = Bun.file(segmentPath);

          if (await segmentFile.exists()) {
            const segmentResult = await storageClient.uploadFile(segmentFile, {
              name: `${video.postId}-${filename}`,
              acl,
            });
            video.groveUris.segments[filename] = segmentResult.uri;

            // Progress indicator
            if ((j + 1) % 5 === 0 || j === segmentFiles.length - 1) {
              console.log(`         🔗 Uploaded ${j + 1}/${segmentFiles.length} segments`);
            }
          }
        }

        console.log(`         ✅ All segments uploaded`);
      } catch (e) {
        console.log(`         ⚠️  Segment upload failed: ${e}`);
      }

    } else if (video.localFiles.video) {
      // Fallback: Upload single video file (for non-segmented videos)
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

    // Upload video metadata (including encryption info)
    const videoMetadata = {
      postId: video.postId,
      postUrl: video.postUrl,
      description: video.description,
      stats: video.stats,
      music: video.music,
      groveUris: video.groveUris,
      hls: video.hls,
      encryption: video.encryption,
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
  console.log('✨ Upload Complete!\n');
  console.log(`📊 Summary:`);
  console.log(`   Profile metadata: ${manifest.profile.groveUris.metadata}`);
  console.log(`   Videos with HLS: ${manifest.videos.filter(v => v.hls?.segmented).length}/${manifest.videos.length}`);
  console.log(`   Videos with playlists: ${manifest.videos.filter(v => v.groveUris.playlist).length}/${manifest.videos.length}`);
  console.log(`   Total segments uploaded: ${manifest.videos.reduce((sum, v) => sum + Object.keys(v.groveUris.segments || {}).length, 0)}`);
  console.log(`\n📱 Next Steps:`);
  console.log(`   1. Run ISRC fetcher: bun run fetch-isrc --creator ${tiktokHandle}`);
  console.log(`   2. Run MLC scraper: bun run fetch-mlc --creator ${tiktokHandle}`);
  console.log(`   3. Re-upload metadata: bun run reupload-metadata --creator ${tiktokHandle}`);
  console.log(`   4. Create Lens posts: bun run create-lens-posts --creator ${tiktokHandle}\n`);
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
