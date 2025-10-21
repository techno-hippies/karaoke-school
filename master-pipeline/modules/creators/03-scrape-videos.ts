#!/usr/bin/env bun
/**
 * Creator Module 03: Scrape Videos
 *
 * Scrapes TikTok videos for a creator using Python hrequests library
 * Fetches BOTH copyrighted and copyright-free content
 *
 * Usage:
 *   bun run creators/03-scrape-videos.ts --tiktok-handle @brookemonk_
 *   bun run creators/03-scrape-videos.ts --tiktok-handle @karaokeking99 --limit 100
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import { paths } from '../../lib/config.js';
import { readJson, writeJson, ensureDir } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import type { CreatorPKP, CreatorLens } from '../../lib/schemas/index.js';

interface TikTokUserProfile {
  username: string;
  secUid: string;
  userId: string;
  nickname: string;
  bio: string;
  avatar: string;
  stats: {
    followerCount: number;
    followingCount: number;
    videoCount: number;
  };
}

interface TikTokVideo {
  id: string;
  desc: string;
  createTime: number;
  video: {
    playAddr: string;
    downloadAddr: string;
    cover: string;
    duration: number;
  };
  author: {
    id: string;
    uniqueId: string;
    nickname: string;
  };
  music: {
    title: string;
    authorName?: string;
    playUrl: string;
    coverMedium: string;
    isCopyrighted?: boolean;
    tt2dsp?: {
      tt_to_dsp_song_infos?: Array<{
        platform: number; // 3 = Spotify
        song_id: string;
      }>;
    };
  };
  stats: {
    playCount: number;
    shareCount: number;
    commentCount: number;
    diggCount: number;
  };
}

interface ScraperResult {
  handle: string;
  profile: TikTokUserProfile;
  copyrighted_count: number;
  copyright_free_count: number;
  videos: {
    copyrighted: TikTokVideo[];
    copyright_free: TikTokVideo[];
  };
}

interface CreatorManifest {
  handle: string;
  displayName: string;
  identifiers: {
    tiktokHandle: string;
    lensHandle: string;
    pkpAddress: string;
    lensAccountAddress: string;
  };
  profile: TikTokUserProfile & {
    bioTranslations?: Record<string, string>;
  };
  pkp: CreatorPKP;
  lens: CreatorLens;
  videos: string[]; // Array of video hashes
  createdAt: string;
  updatedAt: string;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      limit: { type: 'string', default: '50' },
      'no-copyright-free': { type: 'boolean', default: false },
    },
  });

  if (!values['tiktok-handle']) {
    logger.error('Missing required parameter: --tiktok-handle');
    console.log('\nUsage:');
    console.log('  bun run creators/03-scrape-videos.ts --tiktok-handle @brookemonk_');
    console.log('  bun run creators/03-scrape-videos.ts --tiktok-handle @karaokeking99 --limit 100\n');
    console.log('Options:');
    console.log('  --tiktok-handle       TikTok username (with or without @)');
    console.log('  --limit               Max videos to fetch (default: 50)');
    console.log('  --no-copyright-free   Skip copyright-free videos\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const limit = parseInt(values.limit!);
  const skipCopyrightFree = values['no-copyright-free'];

  logger.header(`Scrape Videos: @${tiktokHandle}`);

  try {
    // Load existing PKP and Lens data
    const pkpPath = paths.creatorPkp(tiktokHandle);
    const lensPath = paths.creatorLens(tiktokHandle);

    const pkpData = readJson<CreatorPKP>(pkpPath);
    const lensData = readJson<CreatorLens>(lensPath);

    logger.info(`PKP: ${pkpData.pkpEthAddress}`);
    logger.info(`Lens: @${lensData.lensHandle}`);

    // Run Python scraper
    console.log(`\n🎬 Scraping TikTok videos for @${tiktokHandle}...`);
    console.log(`   Limit: ${limit} videos`);
    console.log(`   Include copyright-free: ${!skipCopyrightFree}\n`);

    const scraperPath = 'lib/tiktok_video_scraper.py';
    const args = [
      scraperPath,
      `@${tiktokHandle}`,
      '--limit',
      limit.toString(),
    ];

    if (skipCopyrightFree) {
      args.push('--no-copyright-free');
    }

    // Run Python scraper and capture JSON output
    const result = await $`python3 ${args}`.quiet();
    const output = result.stdout.toString();

    // Parse JSON output (scraper outputs JSON to stdout)
    let scraperResult: ScraperResult;
    try {
      scraperResult = JSON.parse(output);
    } catch (error) {
      console.error('Failed to parse scraper output:');
      console.error(output);
      throw new Error('Invalid JSON from TikTok scraper');
    }

    console.log(`\n✅ Scraping complete!`);
    console.log(`   Copyrighted videos: ${scraperResult.copyrighted_count}`);
    console.log(`   Copyright-free videos: ${scraperResult.copyright_free_count}`);
    console.log(`   Total: ${scraperResult.copyrighted_count + scraperResult.copyright_free_count}\n`);

    // Create or update manifest
    const manifestPath = paths.creatorManifest(tiktokHandle);
    let manifest: CreatorManifest;

    // Check if manifest exists
    try {
      manifest = readJson<CreatorManifest>(manifestPath);
      logger.info('Updating existing manifest...');
      manifest.updatedAt = new Date().toISOString();
      manifest.profile = scraperResult.profile;
    } catch {
      logger.info('Creating new manifest...');
      manifest = {
        handle: `@${tiktokHandle}`,
        displayName: scraperResult.profile.nickname || `@${tiktokHandle}`,
        identifiers: {
          tiktokHandle: `@${tiktokHandle}`,
          lensHandle: lensData.lensHandle,
          pkpAddress: pkpData.pkpEthAddress,
          lensAccountAddress: lensData.lensAccountAddress,
        },
        profile: scraperResult.profile,
        pkp: pkpData,
        lens: lensData,
        videos: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Save raw video data for processing in next steps
    const videosDir = paths.creator(tiktokHandle);
    ensureDir(videosDir);

    const rawVideosPath = `${videosDir}/raw_videos.json`;
    writeJson(rawVideosPath, {
      copyrighted: scraperResult.videos.copyrighted,
      copyright_free: scraperResult.videos.copyright_free,
      scrapedAt: new Date().toISOString(),
    });

    logger.success(`Raw video data saved to: ${rawVideosPath}`);

    // Save manifest
    writeJson(manifestPath, manifest);
    logger.success(`Manifest saved to: ${manifestPath}`);

    console.log('\n📊 Summary:');
    console.log(`   TikTok Handle: ${manifest.handle}`);
    console.log(`   Display Name: ${manifest.displayName}`);
    console.log(`   Followers: ${manifest.profile.stats.followerCount.toLocaleString()}`);
    console.log(`   Total Videos: ${manifest.profile.stats.videoCount.toLocaleString()}`);
    console.log(`   Scraped: ${scraperResult.copyrighted_count + scraperResult.copyright_free_count}`);

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/04-identify-songs.ts --tiktok-handle @${tiktokHandle}\n`);
  } catch (error: any) {
    logger.error(`Failed to scrape videos: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
