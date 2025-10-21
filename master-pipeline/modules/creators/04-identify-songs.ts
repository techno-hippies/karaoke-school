#!/usr/bin/env bun
/**
 * Creator Module 04: Identify Songs
 *
 * Identifies songs in TikTok videos using SongIdentificationService
 * Handles both copyrighted and copyright-free content
 *
 * Usage:
 *   bun run creators/04-identify-songs.ts --tiktok-handle @brookemonk_
 *   bun run creators/04-identify-songs.ts --tiktok-handle @karaokeking99 --max 10
 */

import { parseArgs } from 'util';
import { requireEnv, paths } from '../../lib/config.js';
import { readJson, writeJson, ensureDir } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { SongIdentificationService } from '../../services/song-identification.js';

interface TikTokVideo {
  id: string;
  desc: string;
  createTime: number;
  video: {
    duration: number;
    cover: string;
  };
  music: {
    title: string;
    authorName?: string;
    isCopyrighted?: boolean;
    tt2dsp?: {
      tt_to_dsp_song_infos?: Array<{
        platform: number;
        song_id: string;
      }>;
    };
  };
  stats: {
    playCount: number;
  };
}

interface RawVideosData {
  copyrighted: TikTokVideo[];
  copyright_free: TikTokVideo[];
  scrapedAt: string;
}

interface IdentifiedVideo extends TikTokVideo {
  identification?: {
    title: string;
    artist: string;
    copyrightType: 'copyrighted' | 'copyright-free';
    spotifyId?: string;
    spotifyUrl?: string;
    isrc?: string;
    album?: string;
    geniusId?: number;
    mlcData?: any;
    storyMintable: boolean;
    identifiedAt: string;
  };
}

interface IdentifiedVideosData {
  copyrighted: IdentifiedVideo[];
  copyright_free: IdentifiedVideo[];
  identifiedAt: string;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      max: { type: 'string' }, // Optional: max videos to process
      'skip-copyrighted': { type: 'boolean', default: false },
      'skip-copyright-free': { type: 'boolean', default: false },
    },
  });

  if (!values['tiktok-handle']) {
    logger.error('Missing required parameter: --tiktok-handle');
    console.log('\nUsage:');
    console.log('  bun run creators/04-identify-songs.ts --tiktok-handle @brookemonk_');
    console.log('  bun run creators/04-identify-songs.ts --tiktok-handle @karaokeking99 --max 10\n');
    console.log('Options:');
    console.log('  --tiktok-handle         TikTok username (with or without @)');
    console.log('  --max                   Max videos to identify (optional)');
    console.log('  --skip-copyrighted      Skip copyrighted videos');
    console.log('  --skip-copyright-free   Skip copyright-free videos\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const maxVideos = values.max ? parseInt(values.max) : undefined;
  const skipCopyrighted = values['skip-copyrighted'];
  const skipCopyrightFree = values['skip-copyright-free'];

  logger.header(`Identify Songs: @${tiktokHandle}`);

  try {
    // Load raw videos
    const videosDir = paths.creator(tiktokHandle);
    const rawVideosPath = `${videosDir}/raw_videos.json`;
    const rawVideos = readJson<RawVideosData>(rawVideosPath);

    const totalVideos =
      rawVideos.copyrighted.length + rawVideos.copyright_free.length;
    logger.info(`Loaded ${totalVideos} videos`);
    logger.info(`  Copyrighted: ${rawVideos.copyrighted.length}`);
    logger.info(`  Copyright-free: ${rawVideos.copyright_free.length}`);

    // Initialize song identification service
    const spotifyConfig = {
      clientId: requireEnv('SPOTIFY_CLIENT_ID'),
      clientSecret: requireEnv('SPOTIFY_CLIENT_SECRET'),
    };

    const geniusConfig = {
      apiKey: process.env.GENIUS_API_KEY || '',
    };

    const identificationService = new SongIdentificationService(
      spotifyConfig,
      geniusConfig
    );

    // Process copyrighted videos
    const identifiedCopyrighted: IdentifiedVideo[] = [];
    if (!skipCopyrighted && rawVideos.copyrighted.length > 0) {
      console.log(`\n🎵 Identifying copyrighted songs...\n`);

      const toProcess = maxVideos
        ? rawVideos.copyrighted.slice(0, maxVideos)
        : rawVideos.copyrighted;

      for (let i = 0; i < toProcess.length; i++) {
        const video = toProcess[i];
        console.log(
          `[${i + 1}/${toProcess.length}] ${video.music.title} - ${video.music.authorName || 'Unknown'}`
        );

        try {
          // Extract Spotify data from TikTok video metadata
          const spotifyInfo = video.music.tt2dsp?.tt_to_dsp_song_infos?.find(
            (info) => info.platform === 3
          );

          const spotifyTrackId = spotifyInfo?.song_id;
          const spotifyUrl = spotifyTrackId
            ? `https://open.spotify.com/track/${spotifyTrackId}`
            : null;

          const result = await identificationService.identifyFromTikTok({
            title: video.music.title,
            artist: video.music.authorName,
            spotifyUrl: spotifyUrl || undefined,
            spotifyTrackId: spotifyTrackId || undefined,
          });

          identifiedCopyrighted.push({
            ...video,
            identification: {
              ...result,
              identifiedAt: new Date().toISOString(),
            },
          });

          console.log(
            `   ✓ ${result.title} by ${result.artist} (${result.copyrightType})`
          );
          if (result.storyMintable) {
            console.log(`   ✓ Story Protocol mintable`);
          }

          // Rate limit
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error: any) {
          console.log(`   ✗ Failed: ${error.message}`);
          // Still add the video but without full identification
          identifiedCopyrighted.push({
            ...video,
            identification: {
              title: video.music.title,
              artist: video.music.authorName || 'Unknown',
              copyrightType: 'copyrighted',
              storyMintable: false,
              identifiedAt: new Date().toISOString(),
            },
          });
        }
      }
    }

    // Process copyright-free videos
    const identifiedCopyrightFree: IdentifiedVideo[] = [];
    if (!skipCopyrightFree && rawVideos.copyright_free.length > 0) {
      console.log(`\n🆓 Processing copyright-free videos...\n`);

      const toProcess = maxVideos
        ? rawVideos.copyright_free.slice(0, maxVideos)
        : rawVideos.copyright_free;

      for (let i = 0; i < toProcess.length; i++) {
        const video = toProcess[i];
        console.log(`[${i + 1}/${toProcess.length}] ${video.music.title}`);

        try {
          const result = await identificationService.identifyFromTikTok({
            title: video.music.title,
            artist: video.music.authorName,
            spotifyUrl: null,
            spotifyTrackId: null,
          });

          identifiedCopyrightFree.push({
            ...video,
            identification: {
              ...result,
              identifiedAt: new Date().toISOString(),
            },
          });

          console.log(
            `   ✓ ${result.title} (${result.copyrightType}, Story mintable: ${result.storyMintable})`
          );
        } catch (error: any) {
          console.log(`   ✗ Failed: ${error.message}`);
          identifiedCopyrightFree.push({
            ...video,
            identification: {
              title: video.music.title,
              artist: 'Original Sound',
              copyrightType: 'copyright-free',
              storyMintable: true,
              identifiedAt: new Date().toISOString(),
            },
          });
        }
      }
    }

    // Save identified videos
    const identifiedData: IdentifiedVideosData = {
      copyrighted: identifiedCopyrighted,
      copyright_free: identifiedCopyrightFree,
      identifiedAt: new Date().toISOString(),
    };

    const identifiedPath = `${videosDir}/identified_videos.json`;
    writeJson(identifiedPath, identifiedData);

    console.log('\n✅ Song identification complete!');
    logger.success(`Identified videos saved to: ${identifiedPath}`);

    console.log('\n📊 Summary:');
    console.log(`   Copyrighted identified: ${identifiedCopyrighted.length}`);
    console.log(`   Copyright-free identified: ${identifiedCopyrightFree.length}`);
    console.log(`   Total: ${identifiedCopyrighted.length + identifiedCopyrightFree.length}`);

    // Count Story mintable
    const storyMintable = [
      ...identifiedCopyrighted,
      ...identifiedCopyrightFree,
    ].filter((v) => v.identification?.storyMintable).length;
    console.log(`   Story Protocol mintable: ${storyMintable}`);

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/05-process-video.ts --tiktok-handle @${tiktokHandle} --video-id <video_id>\n`);
  } catch (error: any) {
    logger.error(`Failed to identify songs: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
