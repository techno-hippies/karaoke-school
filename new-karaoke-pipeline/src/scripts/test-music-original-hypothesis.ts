#!/usr/bin/env bun
/**
 * Test music.original Hypothesis
 *
 * Checks if videos with wrong spotify_track_id have music.original = true
 *
 * Hypothesis: TikTok's tt2dsp mapping is only reliable when music.original = false
 *
 * Usage:
 *   bun src/scripts/test-music-original-hypothesis.ts
 */

import { TikTokScraper } from '../services/tiktok-scraper';
import { query } from '../db/connection';
import type { TikTokVideo } from '../types';

interface VideoToTest {
  video_id: string;
  creator_username: string;
  music_title: string;
  spotify_track_id: string | null;
  track_title: string | null;
  artist_name: string | null;
}

async function main() {
  console.log('\n🔬 Testing music.original Hypothesis\n');
  console.log('Hypothesis: Videos with wrong Spotify IDs have music.original = true\n');
  console.log('='.repeat(80) + '\n');

  // Get all videos with spotify_track_id
  const videos = await query<VideoToTest>(`
    SELECT
      tv.video_id,
      tv.creator_username,
      tv.music_title,
      tv.spotify_track_id,
      t.title as track_title,
      t.primary_artist_name as artist_name
    FROM tiktok_videos tv
    LEFT JOIN tracks t ON tv.spotify_track_id = t.spotify_track_id
    WHERE tv.spotify_track_id IS NOT NULL
    ORDER BY tv.created_at DESC
    LIMIT 20
  `);

  console.log(`📊 Testing ${videos.length} videos\n`);

  const scraper = new TikTokScraper();
  const creatorCache = new Map<string, TikTokVideo[]>();
  const results: Array<{
    video_id: string;
    creator: string;
    music_title: string;
    spotify_track: string;
    original_flag: boolean | null;
    likely_mismatch: boolean;
  }> = [];

  let successCount = 0;
  let failCount = 0;

  for (const video of videos) {
    try {
      console.log(`\n📹 Video: ${video.video_id}`);
      console.log(`   Creator: @${video.creator_username}`);
      console.log(`   TikTok Music: "${video.music_title}"`);
      console.log(`   DB Spotify: "${video.track_title}" by ${video.artist_name}`);

      const tiktokVideos = await loadCreatorVideos(scraper, creatorCache, video.creator_username);
      const targetVideo = tiktokVideos.find(v => v.id === video.video_id);

      if (!targetVideo) {
        console.log(`   ❌ Video not found in recent videos`);
        failCount++;
        continue;
      }

      const musicOriginal = targetVideo.music?.original ?? null;
      const isGenericTitle = /original sound|som original|sonido original|suono originale|áudio original/i.test(video.music_title || '');

      console.log(`   ✅ music.original = ${musicOriginal}`);
      console.log(`   Generic title: ${isGenericTitle ? 'YES' : 'NO'}`);

      results.push({
        video_id: video.video_id,
        creator: video.creator_username,
        music_title: video.music_title,
        spotify_track: `${video.track_title} - ${video.artist_name}`,
        original_flag: musicOriginal,
        likely_mismatch: isGenericTitle,
      });

      successCount++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS SUMMARY');
  console.log('='.repeat(80) + '\n');

  console.log(`Total tested: ${successCount}`);
  console.log(`Failed: ${failCount}\n`);

  // Analyze correlation
  const originalTrue = results.filter(r => r.original_flag === true);
  const originalFalse = results.filter(r => r.original_flag === false);
  const withMismatch = results.filter(r => r.likely_mismatch);

  console.log(`Videos with music.original = true: ${originalTrue.length}`);
  console.log(`Videos with music.original = false: ${originalFalse.length}\n`);

  console.log(`Videos with generic titles (likely mismatch): ${withMismatch.length}`);
  console.log(`  - music.original = true: ${withMismatch.filter(r => r.original_flag === true).length}`);
  console.log(`  - music.original = false: ${withMismatch.filter(r => r.original_flag === false).length}\n`);

  // Show detailed table
  console.log('📋 DETAILED RESULTS:\n');
  console.log('Video ID'.padEnd(20) + ' | ' +
              'Original?'.padEnd(10) + ' | ' +
              'Generic?'.padEnd(10) + ' | ' +
              'Music Title');
  console.log('-'.repeat(80));

  for (const result of results) {
    const originalStr = result.original_flag === null ? 'unknown' : result.original_flag.toString();
    console.log(
      result.video_id.padEnd(20) + ' | ' +
      originalStr.padEnd(10) + ' | ' +
      (result.likely_mismatch ? 'YES' : 'NO').padEnd(10) + ' | ' +
      result.music_title.substring(0, 40)
    );
  }

  console.log('\n' + '='.repeat(80));
  console.log('💡 CONCLUSION:');
  console.log('='.repeat(80) + '\n');

  const mismatchesWithOriginalTrue = withMismatch.filter(r => r.original_flag === true).length;
  const mismatchesTotal = withMismatch.length;

  if (mismatchesTotal > 0 && mismatchesWithOriginalTrue === mismatchesTotal) {
    console.log('✅ HYPOTHESIS CONFIRMED:');
    console.log('   ALL videos with generic titles have music.original = true');
    console.log('   → TikTok\'s spotify_track_id should be IGNORED when music.original = true\n');
  } else if (mismatchesTotal > 0 && mismatchesWithOriginalTrue > mismatchesTotal * 0.8) {
    console.log('⚠️  HYPOTHESIS MOSTLY CONFIRMED:');
    console.log(`   ${mismatchesWithOriginalTrue}/${mismatchesTotal} videos with generic titles have music.original = true`);
    console.log('   → Strong correlation, but not perfect\n');
  } else {
    console.log('❌ HYPOTHESIS NOT CONFIRMED:');
    console.log('   No strong correlation between music.original and generic titles\n');
  }

  console.log('🔧 RECOMMENDED FIX:');
  console.log('   1. Add music_original BOOLEAN column to tiktok_videos');
  console.log('   2. Capture music.original during ingestion');
  console.log('   3. Set spotify_track_id = NULL when music.original = true');
  console.log('   4. Use audio fingerprinting (AcoustID/Shazam) for original audio videos\n');
}

async function loadCreatorVideos(
  scraper: TikTokScraper,
  cache: Map<string, TikTokVideo[]>,
  username: string
): Promise<TikTokVideo[]> {
  if (cache.has(username)) {
    return cache.get(username)!;
  }

  const { videos } = await scraper.scrapeUser(username, 150);
  cache.set(username, videos);
  return videos;
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
