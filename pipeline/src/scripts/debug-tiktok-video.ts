#!/usr/bin/env bun
/**
 * Debug TikTok Video - Rescrape and inspect raw data
 *
 * Usage:
 *   bun src/scripts/debug-tiktok-video.ts 7565931111373622550 [@creator]
 */

import { TikTokScraper } from '../services/tiktok-scraper';
import { query } from '../db/connection';

async function main() {
  const videoId = process.argv[2];
  let creatorArg = process.argv[3];

  if (!videoId) {
    console.error('Usage: bun src/scripts/debug-tiktok-video.ts <video_id> [@creator]');
    process.exit(1);
  }

  console.log(`\n🔍 Debug TikTok Video: ${videoId}\n`);

  if (creatorArg?.startsWith('@')) {
    creatorArg = creatorArg.slice(1);
  }

  const username = await resolveCreatorUsername(videoId, creatorArg);
  if (!username) {
    console.error('❌ Unable to determine creator username. Pass @username explicitly or ensure video exists in DB.');
    process.exit(1);
  }

  const scraper = new TikTokScraper();

  console.log(`⏳ Fetching @${username} from TikTok...\n`);

  try {
    const { videos } = await scraper.scrapeUser(username, 150);
    const targetVideo = videos.find(v => v.id === videoId);

    if (!targetVideo) {
      console.error(`❌ Video ${videoId} not found in latest scrape for @${username}`);
      process.exit(1);
    }

    console.log('✅ Video found!\n');
    console.log('='.repeat(60));
    console.log('RAW VIDEO DATA:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(targetVideo, null, 2));
    console.log('='.repeat(60));

    console.log('\n📋 EXTRACTED FIELDS:\n');
    console.log(`Video ID: ${targetVideo.id}`);
    console.log(`Description: ${targetVideo.desc || '(none)'}`);
    console.log(`Duration: ${targetVideo.video?.duration}s`);
    console.log(`\nMusic Info:`);
    console.log(`  Title: ${targetVideo.music?.title || '(none)'}`);
    console.log(`  Author: ${targetVideo.music?.authorName || '(none)'}`);
    console.log(`  Original flag: ${targetVideo.music?.original ? 'true' : 'false'}`);

    console.log(`\ntt2dsp (DSP Mapping):`);
    if (targetVideo.music?.tt2dsp?.tt_to_dsp_song_infos) {
      const dspInfos = targetVideo.music.tt2dsp.tt_to_dsp_song_infos;
      console.log(`  Found ${dspInfos.length} DSP mapping(s):`);

      for (const info of dspInfos) {
        const platformName = info.platform === 3 ? 'Spotify' :
                            info.platform === 1 ? 'Apple Music' :
                            `Platform ${info.platform}`;
        console.log(`\n  ${platformName}:`);
        console.log(`    Song ID: ${info.song_id}`);
        console.log(`    Song Name: ${info.song_name || '(none)'}`);
        console.log(`    Author: ${info.author || '(none)'}`);
      }

      // Show what would be extracted
      const spotifyInfo = dspInfos.find(i => i.platform === 3);
      if (spotifyInfo) {
        console.log(`\n✅ SPOTIFY TRACK ID (would be stored): ${spotifyInfo.song_id}`);
      } else {
        console.log(`\n⚠️  NO SPOTIFY MAPPING FOUND`);
      }
    } else {
      console.log(`  ⚠️  No tt2dsp data found`);
    }

    console.log(`\nStats:`);
    console.log(`  Plays: ${(targetVideo.stats?.playCount || 0).toLocaleString()}`);
    console.log(`  Likes: ${(targetVideo.stats?.diggCount || 0).toLocaleString()}`);
    console.log(`  Comments: ${(targetVideo.stats?.commentCount || 0).toLocaleString()}`);
    console.log(`  Shares: ${(targetVideo.stats?.shareCount || 0).toLocaleString()}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function resolveCreatorUsername(videoId: string, override?: string): Promise<string | null> {
  if (override) {
    return override;
  }

  try {
    const rows = await query<{ creator_username: string }>(
      'SELECT creator_username FROM tiktok_videos WHERE video_id = $1 LIMIT 1',
      [videoId]
    );
    return rows[0]?.creator_username ?? null;
  } catch (error) {
    console.warn('⚠️  Could not read creator from database:', error);
    return null;
  }
}

main();
