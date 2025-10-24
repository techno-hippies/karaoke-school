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
import { join } from 'path';
import { paths } from '../../lib/config.js';
import { readJson, writeJson, ensureDir } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { GroveService } from '../../services/grove.js';
import { ElevenLabsService, ElevenLabsWord } from '../../services/elevenlabs.js';
import { OpenRouterService } from '../../services/openrouter.js';
import { CreatorVideoManifestSchema } from '../../lib/schemas/creator.js';
import { segmentExists, buildTikTokMusicUrl } from '../../lib/segment-helpers.js';
import { getSongMetadata } from '../../lib/subgraph.js';
import type {
  TranscriptionData,
  TranscriptionSegment,
  VideoTranscription,
} from '../../lib/types/transcription.js';

interface IdentifiedVideo {
  id: string;
  desc: string;
  video: {
    downloadAddr: string;
    duration: number;
    cover: string; // TikTok thumbnail URL
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
    mlcData?: any;
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
  transcription?: VideoTranscription;
  song: {
    title: string;
    artist: string;
    copyrightType: 'copyrighted' | 'copyright-free';
    spotifyId?: string;
    isrc?: string;
    geniusId?: number;
    coverUri?: string; // Album art URI from song metadata
  };
  mlc?: any;
  match?: {
    startTime: number;
    endTime: number;
    confidence: number;
  };
  files: {
    video: string;
    audio?: string;
    vocals?: string;
    instrumental?: string;
  };
  grove: {
    video: string; // lens:// URI
    videoGateway: string; // https://api.grove.storage/... URL
    thumbnail?: string; // lens:// URI
    thumbnailGateway?: string; // https://api.grove.storage/... URL
    vocals?: string;
    vocalsGateway?: string;
    instrumental?: string;
    instrumentalGateway?: string;
  };
  storyMintable: boolean;
  createdAt: string;
}

/**
 * Group words into natural karaoke segments/lines
 * Based on pauses, punctuation, and duration limits
 */
function groupWordsIntoSegments(words: ElevenLabsWord[]): TranscriptionSegment[] {
  if (words.length === 0) return [];

  const segments: TranscriptionSegment[] = [];
  let currentLine: Array<{ word: string; start: number; end: number }> = [];

  const MAX_LINE_DURATION = 5.0; // Max 5 seconds per line
  const MAX_WORDS_PER_LINE = 10; // Max 10 words per line

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordData = {
      word: word.text,
      start: word.start,
      end: word.end,
    };

    currentLine.push(wordData);

    // Check if we should end this line
    const lineStart = currentLine[0].start;
    const lineEnd = word.end;
    const lineDuration = lineEnd - lineStart;
    const isLastWord = i === words.length - 1;
    const nextWordHasPause =
      !isLastWord && words[i + 1].start - word.end > 0.3; // 300ms pause

    const shouldEndLine =
      isLastWord ||
      currentLine.length >= MAX_WORDS_PER_LINE ||
      lineDuration >= MAX_LINE_DURATION ||
      nextWordHasPause ||
      word.text.endsWith('.') ||
      word.text.endsWith('!') ||
      word.text.endsWith('?');

    if (shouldEndLine && currentLine.length > 0) {
      const lineText = currentLine.map((w) => w.word).join(' ');
      segments.push({
        start: currentLine[0].start,
        end: currentLine[currentLine.length - 1].end,
        text: lineText,
        words: currentLine,
      });
      currentLine = [];
    }
  }

  return segments;
}

/**
 * Translate text using OpenRouter/Gemini
 */
async function translateText(
  text: string,
  targetLang: string,
  openRouterService: OpenRouterService
): Promise<string> {
  const languageNames: Record<string, string> = {
    vi: 'Vietnamese',
    zh: 'Mandarin Chinese (Simplified)',
  };

  const prompt = `Translate the following English text to ${languageNames[targetLang]}.
Preserve the meaning and tone as accurately as possible.
Only return the translated text, nothing else.

English text:
${text}`;

  const response = await openRouterService.chat([
    {
      role: 'user',
      content: prompt,
    },
  ]);

  const translatedText = response.choices[0]?.message?.content?.trim();

  if (!translatedText) {
    throw new Error('Empty translation response');
  }

  return translatedText;
}

/**
 * Distribute timing proportionally for translated segment
 * Since different languages have different word counts, we scale timing
 */
function distributeTranslatedTiming(
  originalSegment: TranscriptionSegment,
  translatedText: string
): TranscriptionSegment {
  const translatedWords = translatedText.trim().split(/\s+/);
  const segmentDuration = originalSegment.end - originalSegment.start;
  const timePerWord = segmentDuration / translatedWords.length;

  return {
    start: originalSegment.start,
    end: originalSegment.end,
    text: translatedText,
    words: translatedWords.map((word, index) => ({
      word,
      start: originalSegment.start + index * timePerWord,
      end: originalSegment.start + (index + 1) * timePerWord,
    })),
  };
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'video-id': { type: 'string' },
      'create-segment': { type: 'boolean', default: false },
    },
  });

  if (!values['tiktok-handle'] || !values['video-id']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun run creators/05-process-video.ts --tiktok-handle @brookemonk_ --video-id 7123456789\n');
    console.log('Options:');
    console.log('  --tiktok-handle   TikTok username (with or without @)');
    console.log('  --video-id        TikTok video ID');
    console.log('  --create-segment  Auto-create segment if song doesn\'t have one (optional)\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const videoId = values['video-id']!;
  const createSegment = values['create-segment'] || false;

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

    // Step 1.5: Convert video to H.264 for Chrome compatibility
    console.log('\n🔄 Converting video to H.264 (Chrome compatibility)...');
    const tempVideoPath = `${videoDir}/video_h264.mp4`;

    try {
      // Check current codec
      const codecCheck = await $`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 ${videoPath}`.text();
      const currentCodec = codecCheck.trim();
      console.log(`   Current codec: ${currentCodec}`);

      if (currentCodec !== 'h264') {
        console.log(`   Converting ${currentCodec} → H.264...`);
        // Convert to H.264 with settings optimized for web playback
        await $`ffmpeg -i ${videoPath} -c:v libx264 -crf 23 -preset medium -profile:v high -c:a aac -b:a 128k -movflags +faststart -y ${tempVideoPath}`;

        // Replace original with converted version
        await $`mv ${tempVideoPath} ${videoPath}`;
        console.log(`   ✓ Converted to H.264`);
      } else {
        console.log(`   ✓ Already H.264, no conversion needed`);
      }
    } catch (error) {
      console.log(`   ⚠️ Codec detection failed, encoding anyway to be safe`);
      // If codec check fails, convert anyway to ensure H.264
      await $`ffmpeg -i ${videoPath} -c:v libx264 -crf 23 -preset medium -profile:v high -c:a aac -b:a 128k -movflags +faststart -y ${tempVideoPath}`;
      await $`mv ${tempVideoPath} ${videoPath}`;
      console.log(`   ✓ Converted to H.264`);
    }

    // Step 1.6: Download TikTok thumbnail (creator-chosen cover image)
    const thumbnailPath = `${videoDir}/thumbnail.jpg`;
    console.log('\n🖼️  Downloading TikTok thumbnail...');
    await $`curl -s -o ${thumbnailPath} "${video.video.cover}"`;
    console.log(`   ✓ Downloaded: ${thumbnailPath}`);

    // Step 1.6: Extract audio for STT
    const audioPath = `${videoDir}/audio.mp3`;
    console.log('\n🎤 Extracting audio from video...');
    await $`ffmpeg -i ${videoPath} -vn -ar 16000 -ac 1 -b:a 128k -y ${audioPath}`;
    console.log(`   ✓ Extracted: ${audioPath}`);

    // Step 1.7: Speech-to-Text with ElevenLabs (word-level timestamps)
    console.log('\n💬 Transcribing audio with word-level timing (ElevenLabs STT)...');
    const elevenLabsService = new ElevenLabsService();
    const transcriptionResult = await elevenLabsService.transcribe(audioPath, 'en');
    console.log(`   ✓ Transcribed: ${transcriptionResult.words.length} words`);
    console.log(`   ✓ Text: "${transcriptionResult.text.substring(0, 80)}..."`);

    // Step 1.8: Group words into karaoke segments
    console.log('\n📊 Grouping words into karaoke segments...');
    const englishSegments = groupWordsIntoSegments(transcriptionResult.words);
    console.log(`   ✓ Created ${englishSegments.length} segments from ${transcriptionResult.words.length} words`);

    const englishData: TranscriptionData = {
      language: 'en',
      text: transcriptionResult.text,
      segments: englishSegments,
    };

    // Step 1.9: Translate segments to Vietnamese + Mandarin
    console.log('\n🌐 Translating segments with timing distribution...');
    const openRouterService = new OpenRouterService();
    const targetLanguages = ['vi', 'zh'] as const;

    const translatedData: Record<string, TranscriptionData> = {};

    for (const targetLang of targetLanguages) {
      console.log(`   → ${targetLang === 'vi' ? 'Vietnamese' : 'Mandarin'}...`);
      const translatedSegments: TranscriptionSegment[] = [];

      for (let i = 0; i < englishSegments.length; i++) {
        const segment = englishSegments[i];
        try {
          const translatedText = await translateText(
            segment.text,
            targetLang,
            openRouterService
          );
          const translatedSegment = distributeTranslatedTiming(segment, translatedText);
          translatedSegments.push(translatedSegment);

          // Rate limit: wait 500ms between requests
          if (i < englishSegments.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.warn(`      ⚠️  Translation failed for segment ${i + 1}, using placeholder`);
          translatedSegments.push({
            ...segment,
            text: `[Translation failed: ${segment.text}]`,
          });
        }
      }

      const fullTranslatedText = translatedSegments.map((s) => s.text).join(' ');
      translatedData[targetLang] = {
        language: targetLang,
        text: fullTranslatedText,
        segments: translatedSegments,
      };

      console.log(`   ✓ ${targetLang}: ${translatedSegments.length} segments translated`);
    }

    // Create VideoTranscription object
    const videoTranscription: VideoTranscription = {
      languages: {
        en: englishData,
        vi: translatedData.vi,
        zh: translatedData.zh,
      },
      generatedAt: new Date().toISOString(),
      elevenLabsModel: 'scribe_v1',
      translationModel: 'google/gemini-2.5-flash-lite-preview-09-2025',
    };

    // Step 1.10: Translate video description
    let descriptionTranslations: Record<string, string> = {};
    if (video.desc && video.desc.trim()) {
      console.log('\n🌐 Translating video description...');
      console.log(`   Original: ${video.desc.substring(0, 60)}...`);

      for (const targetLang of targetLanguages) {
        try {
          console.log(`   → ${targetLang === 'vi' ? 'Vietnamese' : 'Mandarin'}...`);
          const translation = await translateText(video.desc, targetLang, openRouterService);
          descriptionTranslations[targetLang] = translation;
          console.log(`   ✓ ${targetLang}: ${translation.substring(0, 60)}...`);

          // Rate limit
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.warn(`   ⚠️  Description translation to ${targetLang} failed`);
        }
      }
    }

    // Step 2: Upload to Grove
    console.log('\n☁️  Uploading to Grove...');
    const groveService = new GroveService();

    const videoResult = await groveService.upload(videoPath, 'video/mp4');
    console.log(`   ✓ Video: ${videoResult.uri}`);
    console.log(`   ✓ Gateway: ${videoResult.gatewayUrl}`);

    const thumbnailResult = await groveService.upload(thumbnailPath, 'image/jpeg');
    console.log(`   ✓ Thumbnail: ${thumbnailResult.uri}`);
    console.log(`   ✓ Gateway: ${thumbnailResult.gatewayUrl}`);

    // Fetch song cover image from The Graph if geniusId is available
    let songCoverUri: string | undefined;
    if (video.identification.geniusId) {
      console.log(`\n📀 Fetching song metadata from The Graph...`);
      try {
        const songMetadata = await getSongMetadata(video.identification.geniusId);
        songCoverUri = songMetadata?.coverUri;
        if (songCoverUri) {
          console.log(`   ✓ Found album art: ${songCoverUri}`);
        }
      } catch (error) {
        console.warn(`   ⚠ Failed to fetch song metadata:`, error);
      }
    }

    // Step 3: Create video manifest
    const manifest: VideoManifest = {
      videoHash,
      creatorHandle: `@${tiktokHandle}`,
      tiktokVideoId: videoId,
      tiktokUrl: videoUrl,
      description: video.desc || '',
      descriptionTranslations: Object.keys(descriptionTranslations).length > 0 ? descriptionTranslations : undefined,
      transcription: videoTranscription,
      song: {
        title: video.identification.title,
        artist: video.identification.artist,
        copyrightType: video.identification.copyrightType,
        spotifyId: video.identification.spotifyId,
        isrc: video.identification.isrc,
        geniusId: video.identification.geniusId,
        coverUri: songCoverUri,
      },
      mlc: video.identification.mlcData,
      files: {
        video: videoPath,
        audio: audioPath,
      },
      grove: {
        video: videoResult.uri,
        videoGateway: videoResult.gatewayUrl,
        thumbnail: thumbnailResult.uri,
        thumbnailGateway: thumbnailResult.gatewayUrl,
      },
      storyMintable: video.identification.storyMintable,
      createdAt: new Date().toISOString(),
    };

    // Validate manifest against schema
    const validationResult = CreatorVideoManifestSchema.safeParse(manifest);
    if (!validationResult.success) {
      throw new Error(
        `Invalid video manifest: ${validationResult.error.message}`
      );
    }

    const manifestPath = paths.creatorVideoManifest(tiktokHandle, videoHash);
    writeJson(manifestPath, manifest);

    console.log('\n✅ Video processing complete!');
    logger.success(`Manifest saved to: ${manifestPath}`);

    console.log('\n📊 Summary:');
    console.log(`   Video Hash: ${videoHash}`);
    console.log(`   Song: ${manifest.song.title} by ${manifest.song.artist}`);
    console.log(`   Copyright Type: ${manifest.song.copyrightType}`);
    console.log(`   Story Mintable: ${manifest.storyMintable}`);
    console.log(`   Grove Video: ${manifest.grove.video}`);

    // Optional: Auto-create segment if requested and song has geniusId
    if (createSegment && manifest.song.geniusId && video.music?.id) {
      console.log('\n🎵 Checking if segment exists for this song...');

      const hasSegment = await segmentExists(manifest.song.geniusId);

      if (hasSegment) {
        console.log(`   ✓ Segment already exists for genius ID ${manifest.song.geniusId}`);
      } else {
        console.log(`   ⚠️  No segment found for genius ID ${manifest.song.geniusId}`);
        console.log('   📝 Creating segment...');

        // Build TikTok music URL
        const musicUrl = buildTikTokMusicUrl(manifest.song.title, video.music.id);
        console.log(`   Music URL: ${musicUrl}`);

        try {
          // Run segment pipeline
          const segmentScript = join(process.cwd(), 'modules', 'segments', '01-match-and-process.ts');
          const result = await $`bun ${segmentScript} --genius-id ${manifest.song.geniusId} --tiktok-url ${musicUrl}`.quiet();

          console.log('   ✅ Segment created successfully!');
          console.log(`   📂 Segment saved to: data/songs/${manifest.song.geniusId}/`);
        } catch (error: any) {
          console.warn(`   ⚠️  Failed to create segment: ${error.message}`);
          console.warn('   You can manually create it later with:');
          console.warn(`   bun modules/segments/01-match-and-process.ts --genius-id ${manifest.song.geniusId} --tiktok-url "${musicUrl}"`);
        }
      }
    }

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/07-post-lens.ts --tiktok-handle @${tiktokHandle} --video-hash ${videoHash}\n`);
  } catch (error: any) {
    logger.error(`Failed to process video: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
