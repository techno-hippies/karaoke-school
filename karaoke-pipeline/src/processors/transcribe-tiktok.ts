#!/usr/bin/env bun
/**
 * Pipeline Step 10: Transcribe TikTok Videos
 *
 * Transcribes TikTok creator videos (what they SAY, not song lyrics) using:
 * - Voxtral (Mistral STT) for transcription
 * - Gemini Flash 2.5-lite (via OpenRouter) for multi-language translation
 * - Ollama EmbeddingGemma for vector embeddings (future lrclib VSS)
 *
 * This is separate from song lyrics - it captures creator speech for
 * context matching against music lyrics corpus.
 *
 * Usage:
 *   bun src/processors/transcribe-tiktok.ts --limit=10
 */

import { VideoTranscriptionService, LANGUAGE_NAMES } from '../services/video-transcription';
import {
  getVideosReadyForTranscription,
  getEnabledTargetLanguages,
  createTranscription,
  updateTranscriptionResult,
  markTranscriptionFailed,
  createTranslation,
  getTranscriptionSummary,
} from '../db/transcriptions';

interface ProcessorOptions {
  limit?: number;
  videoId?: string; // Process specific video
}

/**
 * Process a single TikTok video for transcription + translation
 */
async function processVideo(
  video: any,
  service: VideoTranscriptionService,
  targetLanguages: Array<{ code: string; name: string }>
): Promise<void> {
  console.log(`\n[Step 10] Processing video: ${video.video_id}`);
  console.log(`  Creator: @${video.creator_username}`);
  console.log(`  Duration: ${video.duration_seconds}s`);
  console.log(`  URL: ${video.video_url}`);

  // Create transcription record (status = 'processing')
  let transcriptionId: number;
  try {
    transcriptionId = await createTranscription(video.video_id);
    console.log(`  Created transcription record (ID: ${transcriptionId})`);
  } catch (error: any) {
    console.error(`  ❌ Failed to create transcription record: ${error.message}`);
    return;
  }

  try {
    // Process video: transcribe + translate
    const result = await service.processVideo(
      video.video_url,
      video.video_id,
      targetLanguages
    );

    // Store transcription result
    await updateTranscriptionResult(transcriptionId, {
      transcriptionText: result.transcription.transcriptionText,
      detectedLanguage: result.transcription.detectedLanguage,
      confidenceScore: result.transcription.confidence,
      processingTimeMs: result.transcription.processingTimeMs,
      durationSeconds: video.duration_seconds,
      embedding: result.transcription.embedding,
      wordTimestamps: result.transcription.wordTimestamps,  // Word-level timestamps
    });

    console.log(`  ✅ Transcription stored`);
    console.log(`     Language: ${result.transcription.detectedLanguage}`);
    console.log(`     Confidence: ${(result.transcription.confidence * 100).toFixed(1)}%`);
    console.log(`     Text preview: "${result.transcription.transcriptionText.substring(0, 80)}..."`);

    // Store translations
    for (const translation of result.translations) {
      await createTranslation(transcriptionId, {
        languageCode: translation.languageCode,
        translatedText: translation.translatedText,
        translationSource: 'gemini-flash-2.5-lite',
        confidenceScore: translation.confidence,
        embedding: translation.embedding,
      });

      console.log(`  ✅ Translation stored: ${translation.languageCode}`);
      console.log(`     Preview: "${translation.translatedText.substring(0, 60)}..."`);
    }

    console.log(`  ✨ Video fully processed with ${result.translations.length} translations`);
  } catch (error: any) {
    console.error(`  ❌ Processing failed: ${error.message}`);
    await markTranscriptionFailed(transcriptionId, error.message);
  }
}

/**
 * Main processor function
 */
export async function processTranscribeVideos(options: ProcessorOptions = {}): Promise<void> {
  const limit = options.limit ?? 10;

  console.log('═══════════════════════════════════════════════════════');
  console.log('Step 10: Transcribe TikTok Videos');
  console.log('═══════════════════════════════════════════════════════\n');

  // Check environment variables
  const cartesiaApiKey = process.env.CARTESIA_API_KEY;
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!cartesiaApiKey) {
    throw new Error('CARTESIA_API_KEY environment variable required');
  }

  if (!openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable required');
  }

  // Initialize service (Cartesia STT - 66% cheaper + DeepInfra embeddings!)
  const service = new VideoTranscriptionService(cartesiaApiKey, openRouterApiKey);

  // Get enabled target languages
  const enabledLanguages = await getEnabledTargetLanguages();
  const targetLanguages = enabledLanguages.map((lang) => ({
    code: lang.language_code,
    name: lang.language_name,
  }));

  console.log(`Target languages (${targetLanguages.length}):`);
  targetLanguages.forEach((lang) => {
    console.log(`  - ${lang.name} (${lang.code})`);
  });
  console.log('');

  // Get videos to process
  let videos: any[];

  if (options.videoId) {
    // Process specific video
    const { query } = await import('../db/neon');
    videos = await query(
      'SELECT * FROM tiktok_videos WHERE video_id = $1',
      [options.videoId]
    );

    if (videos.length === 0) {
      console.log(`Video ${options.videoId} not found`);
      return;
    }
  } else {
    // Get batch of videos ready for transcription
    videos = await getVideosReadyForTranscription(limit);
  }

  if (videos.length === 0) {
    console.log('No videos ready for transcription');
    console.log('All available videos have been processed!\n');
    return;
  }

  console.log(`Found ${videos.length} video(s) to process\n`);

  // Process each video
  for (const video of videos) {
    await processVideo(video, service, targetLanguages);
  }

  // Show summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Processing Summary');
  console.log('═══════════════════════════════════════════════════════\n');

  const summary = await getTranscriptionSummary();
  console.table(summary);
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  const options: ProcessorOptions = {};

  // Parse CLI arguments
  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--video-id=')) {
      options.videoId = arg.split('=')[1];
    }
  }

  processTranscribeVideos(options)
    .then(() => {
      console.log('\n✅ Step 10 complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Step 10 failed:', error);
      process.exit(1);
    });
}
