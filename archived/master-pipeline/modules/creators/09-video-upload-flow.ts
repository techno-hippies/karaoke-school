#!/usr/bin/env bun
/**
 * Creator Module 09: Video Upload Flow
 *
 * Complete workflow orchestrator for uploading a video:
 * 1. Process video (download, transcode, transcribe, translate)
 * 2. Register song to subgraph (if not already registered)
 * 3. Process segment (match, demucs vocal separation, upload to Grove)
 * 4. Post video to Lens feed
 *
 * This is a workflow orchestrator - it calls individual utilities
 * and doesn't contain business logic itself.
 *
 * Usage:
 *   bun modules/creators/09-video-upload-flow.ts --tiktok-handle @klarahellqvistt --video-id 7350789333793738017
 *   bun modules/creators/09-video-upload-flow.ts --tiktok-handle @brookemonk_ --video-id 7536678632975043870
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../lib/logger.js';
import { paths } from '../../lib/config.js';
import { readJson } from '../../lib/fs.js';

const execAsync = promisify(exec);

interface VideoManifest {
  song: {
    geniusId?: number;
    title: string;
    artist: string;
    spotifyId?: string;
  };
  videoHash: string;
}

interface IdentifiedVideo {
  identification?: {
    geniusData?: {
      primary_artist?: {
        id: number;
      };
    };
  };
}

async function runCommand(command: string, stepName: string): Promise<string> {
  try {
    console.log(`\n→ ${stepName}...`);
    const { stdout, stderr } = await execAsync(command);

    if (stderr && stderr.includes('Error:')) {
      throw new Error(`Command failed: ${stderr}`);
    }

    console.log(`✅ ${stepName} completed`);
    return stdout;
  } catch (error: any) {
    console.error(`❌ ${stepName} failed: ${error.message}`);
    throw error;
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'video-id': { type: 'string' },
      'skip-song': { type: 'boolean', default: false },
      'skip-segment': { type: 'boolean', default: false },
      'skip-lens': { type: 'boolean', default: false },
    },
  });

  const tiktokHandle = values['tiktok-handle']?.replace('@', '');
  const videoId = values['video-id'];
  const skipSong = values['skip-song'];
  const skipSegment = values['skip-segment'];
  const skipLens = values['skip-lens'];

  if (!tiktokHandle || !videoId) {
    console.error('Error: --tiktok-handle and --video-id are required');
    process.exit(1);
  }

  logger.header(`Video Upload Flow: ${videoId}`);
  console.log(`Creator: @${tiktokHandle}`);
  console.log(`Video ID: ${videoId}`);

  try {
    // Step 1: Process video (download, transcode, transcribe, translate)
    const processCmd = `bun modules/creators/05-process-video.ts --tiktok-handle ${tiktokHandle} --video-id ${videoId}`;
    await runCommand(processCmd, 'Process video');

    // Find video hash by matching the video ID in manifest files
    const creatorDir = paths.creator(tiktokHandle);
    const videoDirs = await import('fs').then(fs =>
      fs.promises.readdir(`${creatorDir}/videos`, { withFileTypes: true })
    );

    let videoHash: string | null = null;

    // Search through video directories to find the one matching our video ID
    for (const dir of videoDirs.filter(d => d.isDirectory())) {
      const manifestPath = `${creatorDir}/videos/${dir.name}/manifest.json`;
      try {
        const manifestData = readJson<{ tiktokVideoId: string }>(manifestPath);
        if (manifestData.tiktokVideoId === videoId) {
          videoHash = dir.name;
          break;
        }
      } catch (error) {
        // Skip directories without valid manifests
        continue;
      }
    }

    if (!videoHash) {
      throw new Error(`Could not find video directory for video ID ${videoId}`);
    }

    console.log(`\n📝 Video Hash: ${videoHash}`);

    // Load video manifest to get song metadata
    const manifestPath = paths.creatorVideoManifest(tiktokHandle, videoHash);
    const manifest = readJson<VideoManifest>(manifestPath);

    // Step 2: Register song to subgraph (if not skipped and has genius ID)
    if (!skipSong && manifest.song.geniusId) {
      console.log(`\n🎵 Song: ${manifest.song.title} by ${manifest.song.artist}`);
      console.log(`   Genius ID: ${manifest.song.geniusId}`);

      // Get genius artist ID from identification data
      const identifiedPath = `${creatorDir}/identified_videos.json`;
      let geniusArtistId: number | string = 'unknown';

      try {
        const identifiedVideos = readJson<any>(identifiedPath);
        const allVideos = [
          ...(identifiedVideos.copyrighted || []),
          ...(identifiedVideos.copyright_free || []),
        ];
        const video = allVideos.find((v: any) => v.id === videoId);

        if (video?.identification?.geniusArtistId) {
          geniusArtistId = video.identification.geniusArtistId;
          console.log(`   Genius Artist ID: ${geniusArtistId}`);
        } else {
          console.log('   ⚠️  No genius artist ID found in identification data');
        }
      } catch (error) {
        console.log('   ⚠️  Could not read identification data');
      }

      const spotifyArg = manifest.song.spotifyId ? `--spotify-id ${manifest.song.spotifyId}` : '';
      const registerCmd = `bun modules/songs/01-register-song.ts --genius-id ${manifest.song.geniusId} --genius-artist-id ${geniusArtistId} ${spotifyArg}`;

      try {
        const output = await runCommand(registerCmd, 'Register song');
        if (output.includes('already registered')) {
          console.log('   ℹ️  Song was already registered');
        }
      } catch (error: any) {
        if (error.message?.includes('already registered')) {
          console.log('   ℹ️  Song already registered, continuing...');
        } else {
          console.log('   ⚠️  Song registration failed, continuing anyway...');
          console.log(`   Error: ${error.message}`);
        }
      }
    } else if (skipSong) {
      console.log('\n⊘ Skipping song registration (--skip-song)');
    } else {
      console.log('\n⊘ Skipping song registration (no genius ID)');
    }

    // Step 3: Process segment (match, demucs, upload)
    if (!skipSegment && manifest.song.geniusId) {
      console.log(`\n🎤 Processing segment for karaoke playback...`);

      // Get TikTok music ID from raw videos data
      const rawVideosPath = `${creatorDir}/raw_videos.json`;
      let tiktokMusicId: string | null = null;
      let tiktokMusicTitle: string | null = null;

      try {
        const rawVideos = readJson<any>(rawVideosPath);
        const allVideos = [...(rawVideos.copyrighted || []), ...(rawVideos.copyright_free || [])];
        const video = allVideos.find((v: any) => v.id === videoId);

        if (video?.music?.id) {
          tiktokMusicId = video.music.id;
          tiktokMusicTitle = video.music.title;
        }
      } catch (error) {
        console.log('   ⚠️  Could not find TikTok music ID');
      }

      if (tiktokMusicId && tiktokMusicTitle) {
        // Build TikTok music URL
        const musicSlug = tiktokMusicTitle.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
        const tiktokUrl = `https://www.tiktok.com/music/${musicSlug}-${tiktokMusicId}`;
        console.log(`   TikTok Music: ${tiktokUrl}`);

        const segmentCmd = `bun modules/segments/01-match-and-process.ts --genius-id ${manifest.song.geniusId} --tiktok-url "${tiktokUrl}"`;

        try {
          await runCommand(segmentCmd, 'Process segment');
        } catch (error: any) {
          console.log('   ⚠️  Segment processing failed, continuing anyway...');
          console.log(`   Error: ${error.message}`);
        }
      } else {
        console.log('   ⚠️  No TikTok music ID found, skipping segment processing');
      }
    } else if (skipSegment) {
      console.log('\n⊘ Skipping segment processing (--skip-segment)');
    } else {
      console.log('\n⊘ Skipping segment processing (no genius ID)');
    }

    // Step 4: Post to Lens
    if (!skipLens) {
      const lensCmd = `bun modules/creators/07-post-lens.ts --tiktok-handle ${tiktokHandle} --video-hash ${videoHash}`;
      await runCommand(lensCmd, 'Post to Lens');
    } else {
      console.log('\n⊘ Skipping Lens post (--skip-lens)');
    }

    // Success summary
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✨ Video Upload Flow Complete!\n');
    console.log(`Creator: @${tiktokHandle}`);
    console.log(`Video Hash: ${videoHash}`);
    console.log(`Song: ${manifest.song.title} by ${manifest.song.artist}`);
    console.log('\n✅ Video is now live!');
    console.log(`   View at: http://localhost:5173/u/${tiktokHandle}`);
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n════════════════════════════════════════════════════════════');
    console.error('❌ Video Upload Flow Failed\n');
    console.error(`Error: ${error.message}`);
    console.error('════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main();
