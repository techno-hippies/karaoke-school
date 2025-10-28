#!/usr/bin/env bun
/**
 * Creator Module 11: Process Single Video URL
 *
 * Complete workflow for testing a single TikTok video:
 * 1. Scrape just this video
 * 2. Identify the song
 * 3. Check if copyrighted (exit if not)
 * 4. Auto-create artist if needed
 * 5. Run full video upload flow
 *
 * Usage:
 *   bun modules/creators/11-process-single-video-url.ts --url https://www.tiktok.com/@emilija_harman/video/7449812468500548896
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../lib/logger.js';
import { paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

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
      url: { type: 'string' },
    },
  });

  const url = values.url;

  if (!url) {
    console.error('Error: --url is required');
    console.log('\nUsage:');
    console.log('  bun modules/creators/11-process-single-video-url.ts --url https://www.tiktok.com/@user/video/123');
    process.exit(1);
  }

  // Extract handle and video ID from URL
  const urlMatch = url.match(/@([^/]+)\/video\/(\d+)/);
  if (!urlMatch) {
    console.error('Error: Invalid TikTok URL format');
    console.error('Expected format: https://www.tiktok.com/@user/video/123');
    process.exit(1);
  }

  const tiktokHandle = urlMatch[1];
  const videoId = urlMatch[2];

  logger.header(`Process Single Video: ${videoId}`);
  console.log(`Creator: @${tiktokHandle}`);
  console.log(`Video ID: ${videoId}`);
  console.log(`URL: ${url}\n`);

  try {
    const creatorDir = paths.creator(tiktokHandle);
    const rawVideosPath = `${creatorDir}/raw_videos.json`;
    const identifiedPath = `${creatorDir}/identified_videos.json`;

    // Step 1: Scrape recent videos to find target (limit 50)
    console.log('📥 Scraping videos...');
    const scrapeCmd = `bun modules/creators/03-scrape-videos.ts --tiktok-handle ${tiktokHandle} --limit 50`;
    await runCommand(scrapeCmd, 'Scrape videos');

    // Load scraped video data
    if (!existsSync(rawVideosPath)) {
      throw new Error('Scraping failed - no raw_videos.json created');
    }

    const rawVideos = readJson<any>(rawVideosPath);
    const allVideos = [...(rawVideos.copyrighted || []), ...(rawVideos.copyright_free || [])];
    const video = allVideos.find((v: any) => v.id === videoId);

    if (!video) {
      throw new Error('Video not found in scraped data');
    }

    console.log(`✅ Video scraped: ${video.music?.title || 'Unknown'}`);
    console.log(`   Has Spotify link: ${video.music?.spotify_link ? 'Yes' : 'No'}`);

    // Step 2: Identify song for this video
    console.log('\n🎵 Identifying song...');

    // Create a minimal identified_videos.json with just this video if it doesn't exist
    let identifiedData: any = {
      copyrighted: [],
      copyright_free: [],
    };

    if (existsSync(identifiedPath)) {
      identifiedData = readJson<any>(identifiedPath);
    }

    // Run song identification
    const identifyCmd = `bun modules/creators/04-identify-songs.ts --tiktok-handle ${tiktokHandle}`;
    await runCommand(identifyCmd, 'Identify song');

    // Reload identified data
    identifiedData = readJson<any>(identifiedPath);
    const allIdentifiedVideos = [
      ...(identifiedData.copyrighted || []),
      ...(identifiedData.copyright_free || []),
    ];
    const identifiedVideo = allIdentifiedVideos.find((v: any) => v.id === videoId);

    if (!identifiedVideo) {
      throw new Error('Video identification failed');
    }

    // Step 3: Check if copyrighted
    const geniusId = identifiedVideo.identification?.geniusData?.id;
    const artistId = identifiedVideo.identification?.geniusData?.primary_artist?.id;
    const artistName = identifiedVideo.identification?.geniusData?.primary_artist?.name;

    if (!geniusId) {
      console.log('\n❌ Video has no copyrighted song');
      console.log('   This is copyright-free content');
      console.log('   Cannot process (no karaoke segment possible)\n');
      process.exit(0);
    }

    console.log(`✅ Song identified: ${identifiedVideo.identification.geniusData.title}`);
    console.log(`   Artist: ${artistName}`);
    console.log(`   Genius Song ID: ${geniusId}`);
    console.log(`   Genius Artist ID: ${artistId}`);

    // Step 4: Auto-create artist if needed
    console.log('\n👤 Checking if artist account exists...');
    const artistAccountPath = paths.account(artistName.toLowerCase().replace(/\s+/g, ''));

    if (!existsSync(artistAccountPath)) {
      console.log(`   Artist account not found, creating...`);
      const createArtistCmd = `bun modules/creators/10-auto-create-artist.ts --genius-id ${artistId} --genius-artist-name "${artistName}"`;
      await runCommand(createArtistCmd, 'Create artist account');
    } else {
      console.log(`   ✅ Artist account exists`);
    }

    // Step 5: Run complete video upload flow
    console.log('\n🚀 Running complete video upload flow...\n');
    const uploadCmd = `bun modules/creators/09-video-upload-flow.ts --tiktok-handle ${tiktokHandle} --video-id ${videoId}`;
    await runCommand(uploadCmd, 'Video upload flow');

    // Success!
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('✨ Single Video Processing Complete!\n');
    console.log(`Creator: @${tiktokHandle}`);
    console.log(`Video ID: ${videoId}`);
    console.log(`Song: ${identifiedVideo.identification.geniusData.title} by ${artistName}`);
    console.log('\n✅ Video is now live!');
    console.log(`   View at: http://localhost:5173/u/${tiktokHandle}`);
    console.log('════════════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('\n════════════════════════════════════════════════════════════');
    console.error('❌ Single Video Processing Failed\n');
    console.error(`Error: ${error.message}`);
    console.error('════════════════════════════════════════════════════════════\n');
    process.exit(1);
  }
}

main();
