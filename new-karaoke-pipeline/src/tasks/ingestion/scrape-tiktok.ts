#!/usr/bin/env bun
/**
 * TikTok Scraping Task Processor
 * Fetches creator profile + videos and stores in database
 *
 * Usage:
 *   bun src/tasks/ingestion/scrape-tiktok.ts @gioscottii [maxVideos]
 */

import { TikTokScraper } from '../../services/tiktok-scraper';
import {
  upsertCreatorSQL,
  upsertVideoSQL,
  convertTikTokVideo
} from '../../db/tiktok';
import { query } from '../../db/connection';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: bun src/tasks/ingestion/scrape-tiktok.ts <@username> [maxVideos]');
    console.error('Example: bun src/tasks/ingestion/scrape-tiktok.ts @gioscottii 5');
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

  // Step 1: Scrape profile + videos in ONE browser session
  console.log(`⏳ Scraping @${username} (max ${maxVideos === Infinity ? 'all' : maxVideos} videos)...`);
  console.log('');

  const { profile, videos } = await scraper.scrapeUser(username, maxVideos);

  if (!profile) {
    console.error('❌ Failed to fetch profile');
    process.exit(1);
  }

  console.log('');
  console.log(`✅ Profile: ${profile.nickname} (@${profile.username})`);
  console.log(`   - Followers: ${profile.stats.followerCount.toLocaleString()}`);
  console.log(`   - Videos: ${profile.stats.videoCount.toLocaleString()}`);
  console.log(`✅ Videos: ${videos.length} captured`);
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

  // Step 4: Process and store videos
  console.log('💾 Storing videos in database...');

  const videoSQLs: string[] = [];

  for (const video of videos) {
    const convertedVideo = convertTikTokVideo(video, username);
    const videoSQL = upsertVideoSQL(convertedVideo);

    videoSQLs.push(videoSQL);

    console.log(`  - ${video.id}: ${video.desc?.slice(0, 50) || '(no description)'}...`);
    console.log(`    Music: ${video.music?.title || 'unknown'} by ${video.music?.authorName || 'unknown'}`);
    console.log(`    Stats: ${(video.stats?.playCount || 0).toLocaleString()} plays, ${(video.stats?.diggCount || 0).toLocaleString()} likes`);
  }

  console.log('');

  // Step 5: Execute batch insertion
  try {
    for (const videoSQL of videoSQLs) {
      await query(videoSQL);
    }
    console.log(`✅ Stored ${videoSQLs.length} videos in database`);
  } catch (error) {
    console.error('❌ Failed to store videos:', error);
    process.exit(1);
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Total videos: ${videos.length}`);
  console.log(`   - Creator: @${username}`);
  console.log(`   - Followers: ${profile.stats.followerCount.toLocaleString()}`);
  console.log('');
  console.log('✅ Done! All data stored in database.');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
