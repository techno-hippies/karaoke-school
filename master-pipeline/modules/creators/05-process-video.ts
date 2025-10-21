#!/usr/bin/env bun
/**
 * Creator Module 05: Process Video
 *
 * Complete processing pipeline for a single TikTok video:
 * 1. Download video from TikTok
 * 2. Upload to Grove storage
 * 3. Create video manifest
 *
 * Note: Audio processing (Demucs, fal.ai) is only for the ARTIST flow.
 * Creator videos are posted as-is.
 *
 * Usage:
 *   bun run creators/05-process-video.ts --tiktok-handle @brookemonk_ --video-id 7123456789
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import { createHash } from 'crypto';
import { paths } from '../../lib/config.js';
import { readJson, writeJson, ensureDir } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { GroveService } from '../../services/grove.js';

interface IdentifiedVideo {
  id: string;
  desc: string;
  video: {
    downloadAddr: string;
    duration: number;
  };
  music: {
    title: string;
    authorName?: string;
  };
  identification?: {
    title: string;
    artist: string;
    copyrightType: 'copyrighted' | 'copyright-free';
    spotifyId?: string;
    isrc?: string;
    geniusId?: number;
    storyMintable: boolean;
  };
}

interface VideoManifest {
  videoHash: string;
  creatorHandle: string;
  tiktokVideoId: string;
  tiktokUrl: string;
  description: string;
  descriptionTranslations?: Record<string, string>;
  song: {
    title: string;
    artist: string;
    copyrightType: 'copyrighted' | 'copyright-free';
    spotifyId?: string;
    geniusId?: number;
  };
  match?: {
    startTime: number;
    endTime: number;
    confidence: number;
  };
  files: {
    video: string;
    vocals?: string;
    instrumental?: string;
  };
  grove: {
    video: string;
    vocals?: string;
    instrumental?: string;
  };
  storyMintable: boolean;
  createdAt: string;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'video-id': { type: 'string' },
    },
  });

  if (!values['tiktok-handle'] || !values['video-id']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun run creators/05-process-video.ts --tiktok-handle @brookemonk_ --video-id 7123456789\n');
    console.log('Options:');
    console.log('  --tiktok-handle  TikTok username (with or without @)');
    console.log('  --video-id       TikTok video ID\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const videoId = values['video-id']!;

  logger.header(`Process Video: ${videoId}`);

  try {
    // Create video hash first (to check if already processed)
    const videoHash = createHash('sha256')
      .update(`${tiktokHandle}-${videoId}`)
      .digest('hex')
      .slice(0, 16);

    // Check if video already processed
    const videoManifestPath = paths.creatorVideoManifest(tiktokHandle, videoHash);
    try {
      const existingManifest = readJson<VideoManifest>(videoManifestPath);

      // Check if fully processed (has Grove URIs)
      if (existingManifest.grove?.video) {
        logger.warn('Video already processed');
        console.log(`   Video Hash: ${videoHash}`);
        console.log(`   Song: ${existingManifest.song.title}`);
        console.log(`   Grove Video: ${existingManifest.grove.video}\n`);
        console.log('✅ Skipping processing (already complete)');
        console.log(`   Delete ${videoManifestPath} to reprocess\n`);
        return;
      } else {
        logger.info('Video partially processed, continuing...');
      }
    } catch {
      // Manifest doesn't exist, continue with processing
    }

    // Load identified videos
    const creatorDir = paths.creator(tiktokHandle);
    const identifiedPath = `${creatorDir}/identified_videos.json`;
    const identifiedData = readJson<{
      copyrighted: IdentifiedVideo[];
      copyright_free: IdentifiedVideo[];
    }>(identifiedPath);

    // Find video
    const allVideos = [
      ...identifiedData.copyrighted,
      ...identifiedData.copyright_free,
    ];
    const video = allVideos.find((v) => v.id === videoId);

    if (!video) {
      throw new Error(`Video ${videoId} not found in identified videos`);
    }

    if (!video.identification) {
      throw new Error(`Video ${videoId} has not been identified yet`);
    }

    logger.info(`Found video: ${video.music.title}`);
    logger.info(`Copyright type: ${video.identification.copyrightType}`);
    logger.info(`Story mintable: ${video.identification.storyMintable}`);

    // Create working directory
    const videoDir = paths.creatorVideo(tiktokHandle, videoHash);
    ensureDir(videoDir);

    const videoPath = `${videoDir}/video.mp4`;

    // Step 1: Download video
    console.log('\n📥 Downloading TikTok video...');
    const videoUrl = `https://www.tiktok.com/@${tiktokHandle}/video/${videoId}`;
    console.log(`   URL: ${videoUrl}`);

    await $`yt-dlp --no-warnings --quiet -o ${videoPath} ${videoUrl}`;
    console.log(`   ✓ Downloaded: ${videoPath}`);

    // Step 2: Upload to Grove
    console.log('\n☁️  Uploading to Grove...');
    const groveService = new GroveService();

    const videoResult = await groveService.upload(videoPath, 'video/mp4');
    const videoUri = videoResult.uri;
    console.log(`   ✓ Video: ${videoUri}`);

    // Step 3: Create video manifest
    const manifest: VideoManifest = {
      videoHash,
      creatorHandle: `@${tiktokHandle}`,
      tiktokVideoId: videoId,
      tiktokUrl: videoUrl,
      description: video.desc || '',
      song: {
        title: video.identification.title,
        artist: video.identification.artist,
        copyrightType: video.identification.copyrightType,
        spotifyId: video.identification.spotifyId,
        geniusId: video.identification.geniusId,
      },
      files: {
        video: videoPath,
      },
      grove: {
        video: videoUri,
      },
      storyMintable: video.identification.storyMintable,
      createdAt: new Date().toISOString(),
    };

    const manifestPath = paths.creatorVideoManifest(tiktokHandle, videoHash);
    writeJson(manifestPath, manifest);

    console.log('\n✅ Video processing complete!');
    logger.success(`Manifest saved to: ${manifestPath}`);

    console.log('\n📊 Summary:');
    console.log(`   Video Hash: ${videoHash}`);
    console.log(`   Song: ${manifest.song.title} by ${manifest.song.artist}`);
    console.log(`   Copyright Type: ${manifest.song.copyrightType}`);
    console.log(`   Story Mintable: ${manifest.storyMintable}`);
    console.log(`   Grove Video: ${videoUri}`);

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/07-post-lens.ts --tiktok-handle @${tiktokHandle} --video-hash ${videoHash}\n`);
  } catch (error: any) {
    logger.error(`Failed to process video: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
