/**
 * Database operations for TikTok video transcriptions
 */

import { query, queryOne } from './neon';

export interface TikTokTranscription {
  id: number;
  video_id: string;
  transcription_text: string;
  detected_language: string;
  duration_seconds: number | null;
  confidence_score: number | null;
  voxtral_model: string;
  processing_time_ms: number | null;
  embedding: number[] | null;
  status: string;
  error_message: string | null;
  retry_count: number;
  transcribed_at: Date;
  updated_at: Date;
}

export interface TikTokTranscriptionTranslation {
  id: number;
  transcription_id: number;
  language_code: string;
  translated_text: string;
  translation_source: string;
  confidence_score: number | null;
  embedding: number[] | null;
  translated_at: Date;
}

export interface TargetLanguage {
  language_code: string;
  language_name: string;
  enabled: boolean;
  priority: number;
}

/**
 * Get enabled target languages for translation (ordered by priority)
 */
export async function getEnabledTargetLanguages(): Promise<TargetLanguage[]> {
  const sql = `
    SELECT language_code, language_name, enabled, priority
    FROM tiktok_translation_languages
    WHERE enabled = TRUE
    ORDER BY priority DESC
  `;

  return query<TargetLanguage>(sql);
}

/**
 * Get videos ready for transcription (not yet processed)
 */
export async function getVideosReadyForTranscription(limit = 10): Promise<any[]> {
  const sql = `
    SELECT * FROM videos_ready_for_transcription
    LIMIT $1
  `;

  return query(sql, [limit]);
}

/**
 * Create new transcription record (status = 'processing')
 */
export async function createTranscription(
  videoId: string,
  model: string = 'voxtral-mini-latest'
): Promise<number> {
  const sql = `
    INSERT INTO tiktok_video_transcriptions (
      video_id,
      transcription_text,
      detected_language,
      voxtral_model,
      status
    ) VALUES ($1, '', 'en', $2, 'processing')
    ON CONFLICT (video_id) DO UPDATE
      SET status = 'processing',
          retry_count = tiktok_video_transcriptions.retry_count + 1,
          updated_at = NOW()
    RETURNING id
  `;

  const result = await queryOne<{ id: number }>(sql, [videoId, model]);
  return result.id;
}

/**
 * Update transcription with Voxtral result
 */
export async function updateTranscriptionResult(
  transcriptionId: number,
  data: {
    transcriptionText: string;
    detectedLanguage: string;
    confidenceScore: number;
    processingTimeMs: number;
    durationSeconds?: number;
    embedding: number[];
    wordTimestamps?: any[];  // Word-level timestamps from Voxtral
  }
): Promise<void> {
  // Convert embedding array to pgvector format
  const embeddingString = `[${data.embedding.join(',')}]`;

  const sql = `
    UPDATE tiktok_video_transcriptions
    SET transcription_text = $1,
        detected_language = $2,
        confidence_score = $3,
        processing_time_ms = $4,
        duration_seconds = $5,
        embedding = $6::vector,
        word_timestamps = $7::jsonb,
        status = 'transcribed',
        transcribed_at = NOW(),
        updated_at = NOW()
    WHERE id = $8
  `;

  await query(sql, [
    data.transcriptionText,
    data.detectedLanguage,
    data.confidenceScore,
    data.processingTimeMs,
    data.durationSeconds || null,
    embeddingString,
    data.wordTimestamps ? JSON.stringify(data.wordTimestamps) : null,
    transcriptionId,
  ]);
}

/**
 * Mark transcription as failed
 */
export async function markTranscriptionFailed(
  transcriptionId: number,
  errorMessage: string
): Promise<void> {
  const sql = `
    UPDATE tiktok_video_transcriptions
    SET status = 'failed',
        error_message = $1,
        updated_at = NOW()
    WHERE id = $2
  `;

  await query(sql, [errorMessage, transcriptionId]);
}

/**
 * Create translation record
 */
export async function createTranslation(
  transcriptionId: number,
  data: {
    languageCode: string;
    translatedText: string;
    translationSource: string;
    confidenceScore: number;
    embedding: number[];
  }
): Promise<void> {
  // Convert embedding array to pgvector format
  const embeddingString = `[${data.embedding.join(',')}]`;

  const sql = `
    INSERT INTO tiktok_video_transcription_translations (
      transcription_id,
      language_code,
      translated_text,
      translation_source,
      confidence_score,
      embedding
    ) VALUES ($1, $2, $3, $4, $5, $6::vector)
    ON CONFLICT (transcription_id, language_code)
    DO UPDATE SET
      translated_text = EXCLUDED.translated_text,
      translation_source = EXCLUDED.translation_source,
      confidence_score = EXCLUDED.confidence_score,
      embedding = EXCLUDED.embedding,
      translated_at = NOW()
  `;

  await query(sql, [
    transcriptionId,
    data.languageCode,
    data.translatedText,
    data.translationSource,
    data.confidenceScore,
    embeddingString,
  ]);
}

/**
 * Get transcription by video ID
 */
export async function getTranscriptionByVideoId(
  videoId: string
): Promise<TikTokTranscription | null> {
  const sql = `
    SELECT * FROM tiktok_video_transcriptions
    WHERE video_id = $1
  `;

  try {
    return await queryOne<TikTokTranscription>(sql, [videoId]);
  } catch (error) {
    return null;
  }
}

/**
 * Get translations for transcription
 */
export async function getTranslationsForTranscription(
  transcriptionId: number
): Promise<TikTokTranscriptionTranslation[]> {
  const sql = `
    SELECT * FROM tiktok_video_transcription_translations
    WHERE transcription_id = $1
    ORDER BY language_code
  `;

  return query<TikTokTranscriptionTranslation>(sql, [transcriptionId]);
}

/**
 * Get transcription summary stats
 */
export async function getTranscriptionSummary(): Promise<any[]> {
  const sql = `SELECT * FROM tiktok_transcription_summary`;
  return query(sql);
}

/**
 * Check if transcription exists for video
 */
export async function transcriptionExists(videoId: string): Promise<boolean> {
  const sql = `
    SELECT EXISTS(
      SELECT 1 FROM tiktok_video_transcriptions
      WHERE video_id = $1
    ) as exists
  `;

  const result = await queryOne<{ exists: boolean }>(sql, [videoId]);
  return result.exists;
}

/**
 * Get fully processed videos (transcribed + translated)
 */
export async function getFullyProcessedVideos(limit = 10): Promise<any[]> {
  const sql = `
    SELECT * FROM tiktok_videos_fully_transcribed
    LIMIT $1
  `;

  return query(sql, [limit]);
}
