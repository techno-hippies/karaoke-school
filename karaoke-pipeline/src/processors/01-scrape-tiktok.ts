#!/usr/bin/env bun
/**
 * Processor: Scrape TikTok Creator
 * Fetches creator profile + videos and stores in database
 *
 * Usage:
 *   bun src/processors/01-scrape-tiktok.ts @gioscottii [maxVideos]
 */

import { TikTokScraper } from '../services/tiktok-scraper';
import {
  upsertCreatorSQL,
  upsertVideoSQL,
  convertTikTokVideo
} from '../db/tiktok';
import { query, transaction, close } from '../db/neon';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bun src/processors/01-scrape-tiktok.ts <@username> [maxVideos]');
    console.error('Example: bun src/processors/01-scrape-tiktok.ts @gioscottii 5');
    process.exit(1);
  }

  let username = args[0];
  const maxVideos = args[1] ? parseInt(args[1]) : Infinity;

  // Remove @ if present
  if (username.startsWith('@')) {
    username = username.slice(1);
  }

  console.log(`🎯 Scraping TikTok creator: @${username}`);
  console.log(`📊 Max videos: ${maxVideos === Infinity ? 'all' : maxVideos}`);
  console.log('');

  const scraper = new TikTokScraper();

  // Step 1: Fetch profile
  console.log('⏳ Fetching profile...');
  const profile = await scraper.getUserProfile(username);

  if (!profile) {
    console.error('❌ Failed to fetch profile');
    process.exit(1);
  }

  console.log(`✅ Profile fetched: ${profile.nickname} (@${profile.username})`);
  console.log(`   - Followers: ${profile.stats.followerCount.toLocaleString()}`);
  console.log(`   - Videos: ${profile.stats.videoCount.toLocaleString()}`);
  console.log('');

  // Step 2: Store creator in DB
  console.log('💾 Storing creator in database...');
  const creatorSQL = upsertCreatorSQL(profile);

  try {
    await query(creatorSQL);
    console.log(`✅ Creator stored: @${username}`);
  } catch (error) {
    console.error('❌ Failed to store creator:', error);
    process.exit(1);
  }
  console.log('');

  // Step 3: Fetch videos
  console.log(`⏳ Fetching videos (max: ${maxVideos})...`);
  const videos = await scraper.getUserVideos(profile.secUid, maxVideos);

  console.log(`✅ Fetched ${videos.length} videos`);
  console.log('');

  // Step 4: Process and store videos
  console.log('💾 Storing videos in database...');

  const videoSQLs: string[] = [];
  let copyrightedCount = 0;
  let spotifyCount = 0;

  for (const video of videos) {
    const convertedVideo = convertTikTokVideo(video, username);
    const videoSQL = upsertVideoSQL(convertedVideo);

    videoSQLs.push(videoSQL);

    if (convertedVideo.is_copyrighted) copyrightedCount++;
    if (convertedVideo.spotify_track_id) spotifyCount++;

    console.log(`  - ${video.id}: ${video.desc?.slice(0, 50) || '(no description)'}...`);
    console.log(`    Music: ${video.music?.title || 'unknown'}`);
    console.log(`    Copyright: ${convertedVideo.is_copyrighted ? '✅' : '❌'} | Spotify: ${convertedVideo.spotify_track_id ? '✅ ' + convertedVideo.spotify_track_id : '❌'}`);
    console.log(`    Stats: ${(video.stats?.playCount || 0).toLocaleString()} plays, ${(video.stats?.diggCount || 0).toLocaleString()} likes`);
  }

  console.log('');

  // Step 5: Execute batch insertion
  try {
    const results = await transaction(videoSQLs);
    console.log(`✅ Stored ${results.length} videos in database`);
  } catch (error) {
    console.error('❌ Failed to store videos:', error);
    process.exit(1);
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Total videos: ${videos.length}`);
  console.log(`   - Copyrighted: ${copyrightedCount}`);
  console.log(`   - With Spotify ID: ${spotifyCount}`);
  console.log('');
  console.log('✅ Done! All data stored in database.');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await close();
  });
