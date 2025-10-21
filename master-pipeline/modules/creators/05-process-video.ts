#!/usr/bin/env bun
/**
 * Creator Module 05: Process Video
 *
 * Complete processing pipeline for a single TikTok video:
 * 1. Download video from TikTok
 * 2. Extract audio
 * 3. Match to full song (if copyrighted)
 * 4. Crop segment
 * 5. Demucs vocal separation
 * 6. fal.ai audio enhancement
 * 7. Upload to Grove storage
 * 8. Create video manifest
 *
 * Usage:
 *   bun run creators/05-process-video.ts --tiktok-handle @brookemonk_ --video-id 7123456789
 *   bun run creators/05-process-video.ts --tiktok-handle @brookemonk_ --video-id 7123456789 --skip-fal
 */

import { parseArgs } from 'util';
import { $ } from 'bun';
import { createHash } from 'crypto';
import { paths } from '../../lib/config.js';
import { readJson, writeJson, ensureDir } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { AudioMatchingService } from '../../services/audio-matching.js';
import { AudioProcessingService } from '../../services/audio-processing.js';
import { DemucsModalService } from '../../services/demucs-modal.js';
import { FalAIService } from '../../services/fal-audio.js';
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
      'skip-demucs': { type: 'boolean', default: false },
      'skip-fal': { type: 'boolean', default: false },
      'music-dir': { type: 'string' },
    },
  });

  if (!values['tiktok-handle'] || !values['video-id']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun run creators/05-process-video.ts --tiktok-handle @brookemonk_ --video-id 7123456789');
    console.log('  bun run creators/05-process-video.ts --tiktok-handle @brookemonk_ --video-id 7123456789 --skip-fal\n');
    console.log('Options:');
    console.log('  --tiktok-handle  TikTok username (with or without @)');
    console.log('  --video-id       TikTok video ID');
    console.log('  --skip-demucs    Skip Demucs vocal separation');
    console.log('  --skip-fal       Skip fal.ai audio enhancement');
    console.log('  --music-dir      Path to music library (default: /media/t42/me/Music)\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const videoId = values['video-id']!;
  const skipDemucs = values['skip-demucs'] || false;
  const skipFal = values['skip-fal'] || false;
  const musicDir = values['music-dir'] || '/media/t42/me/Music';

  logger.header(`Process Video: ${videoId}`);

  try {
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

    // Create video hash
    const videoHash = createHash('sha256')
      .update(`${tiktokHandle}-${videoId}`)
      .digest('hex')
      .slice(0, 16);

    // Create working directory
    const videoDir = paths.creatorVideo(tiktokHandle, videoHash);
    ensureDir(videoDir);

    const videoPath = `${videoDir}/video.mp4`;
    const audioPath = `${videoDir}/audio.wav`;

    // Step 1: Download video
    console.log('\n📥 Downloading TikTok video...');
    const videoUrl = `https://www.tiktok.com/@${tiktokHandle}/video/${videoId}`;
    console.log(`   URL: ${videoUrl}`);

    await $`yt-dlp --no-warnings --quiet -o ${videoPath} ${videoUrl}`;
    console.log(`   ✓ Downloaded: ${videoPath}`);

    // Step 2: Extract audio
    console.log('\n🎵 Extracting audio...');
    await $`ffmpeg -y -i ${videoPath} -ar 44100 -ac 1 ${audioPath}`.quiet();
    console.log(`   ✓ Extracted: ${audioPath}`);

    let match: { startTime: number; endTime: number; confidence: number } | undefined;
    let croppedAudioPath = audioPath;

    // Step 3: Match to full song (copyrighted only)
    if (video.identification.copyrightType === 'copyrighted' && video.identification.geniusId) {
      console.log('\n🎯 Matching audio to full song...');

      const matchingService = new AudioMatchingService({
        musicLibraryPath: musicDir,
      });

      try {
        const matchResult = await matchingService.matchTikTokToSong({
          tiktokClipPath: audioPath,
          geniusId: video.identification.geniusId,
          spotifyId: video.identification.spotifyId,
        });

        match = {
          startTime: matchResult.startTime,
          endTime: matchResult.endTime,
          confidence: matchResult.confidence,
        };

        console.log(`   ✓ Matched: ${match.startTime.toFixed(2)}s - ${match.endTime.toFixed(2)}s`);
        console.log(`   ✓ Confidence: ${match.confidence}%`);

        // Crop to matched segment
        croppedAudioPath = `${videoDir}/cropped.wav`;
        const processingService = new AudioProcessingService();
        await processingService.cropAudio({
          inputPath: matchResult.fullSongPath,
          outputPath: croppedAudioPath,
          startTime: match.startTime,
          endTime: match.endTime,
        });

        console.log(`   ✓ Cropped audio: ${croppedAudioPath}`);
      } catch (error: any) {
        logger.warn(`Audio matching failed: ${error.message}`);
        logger.warn('Continuing with original TikTok audio...');
      }
    }

    let vocalsPath: string | undefined;
    let instrumentalPath: string | undefined;

    // Step 4: Demucs vocal separation
    if (!skipDemucs) {
      console.log('\n🎤 Separating vocals with Demucs...');

      const demucsService = new DemucsModalService();
      const demucsResult = await demucsService.separate({
        audioPath: croppedAudioPath,
        model: 'htdemucs_ft',
      });

      vocalsPath = `${videoDir}/vocals.wav`;
      instrumentalPath = `${videoDir}/instrumental.wav`;

      // Save separated tracks
      await Bun.write(vocalsPath, Buffer.from(demucsResult.vocals, 'base64'));
      await Bun.write(instrumentalPath, Buffer.from(demucsResult.instrumental, 'base64'));

      console.log(`   ✓ Vocals: ${vocalsPath} (${demucsResult.vocalsSize} bytes)`);
      console.log(`   ✓ Instrumental: ${instrumentalPath} (${demucsResult.instrumentalSize} bytes)`);

      // Step 5: fal.ai audio enhancement
      if (!skipFal && vocalsPath && instrumentalPath) {
        console.log('\n✨ Enhancing audio with fal.ai...');

        const falService = new FalAIService();

        try {
          const enhancedVocals = await falService.enhance({
            audioPath: vocalsPath,
            audioType: 'vocals',
          });

          const enhancedInstrumental = await falService.enhance({
            audioPath: instrumentalPath,
            audioType: 'instrumental',
          });

          vocalsPath = `${videoDir}/vocals_enhanced.wav`;
          instrumentalPath = `${videoDir}/instrumental_enhanced.wav`;

          await Bun.write(vocalsPath, Buffer.from(enhancedVocals, 'base64'));
          await Bun.write(instrumentalPath, Buffer.from(enhancedInstrumental, 'base64'));

          console.log(`   ✓ Enhanced vocals: ${vocalsPath}`);
          console.log(`   ✓ Enhanced instrumental: ${instrumentalPath}`);
        } catch (error: any) {
          logger.warn(`fal.ai enhancement failed: ${error.message}`);
          logger.warn('Continuing with unenhanced audio...');
        }
      }
    }

    // Step 6: Upload to Grove
    console.log('\n☁️  Uploading to Grove...');
    const groveService = new GroveService();

    const videoUri = await groveService.uploadFile({
      filePath: videoPath,
      contentType: 'video/mp4',
    });
    console.log(`   ✓ Video: ${videoUri}`);

    let vocalsUri: string | undefined;
    let instrumentalUri: string | undefined;

    if (vocalsPath) {
      vocalsUri = await groveService.uploadFile({
        filePath: vocalsPath,
        contentType: 'audio/wav',
      });
      console.log(`   ✓ Vocals: ${vocalsUri}`);
    }

    if (instrumentalPath) {
      instrumentalUri = await groveService.uploadFile({
        filePath: instrumentalPath,
        contentType: 'audio/wav',
      });
      console.log(`   ✓ Instrumental: ${instrumentalUri}`);
    }

    // Step 7: Create video manifest
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
      match,
      files: {
        video: videoPath,
        vocals: vocalsPath,
        instrumental: instrumentalPath,
      },
      grove: {
        video: videoUri,
        vocals: vocalsUri,
        instrumental: instrumentalUri,
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
    if (match) {
      console.log(`   Match: ${match.startTime.toFixed(2)}s - ${match.endTime.toFixed(2)}s`);
    }
    console.log(`   Grove Video: ${videoUri}`);
    if (vocalsUri) {
      console.log(`   Grove Vocals: ${vocalsUri}`);
    }
    if (instrumentalUri) {
      console.log(`   Grove Instrumental: ${instrumentalUri}`);
    }

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/06-mint-derivative.ts --tiktok-handle @${tiktokHandle} --video-hash ${videoHash}\n`);
  } catch (error: any) {
    logger.error(`Failed to process video: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
