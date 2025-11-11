/**
 * Strict TypeScript Types for Task Metadata
 *
 * Replaces loose `any` types in audio_tasks.metadata with proper interfaces.
 * Provides type safety and autocomplete for task result metadata.
 *
 * Benefits:
 * - Type safety: Catch errors at compile time
 * - Autocomplete: IDE suggestions for metadata fields
 * - Documentation: Self-documenting interfaces
 * - Validation: Ensure correct data shapes
 */

/**
 * Download task metadata
 */
export interface DownloadMetadata {
  source: 'spotify' | 'youtube' | 'p2p';
  duration_seconds: number;
  file_size_bytes?: number;
  audio_format: 'mp3' | 'wav' | 'flac';
  sample_rate?: number;
  bitrate?: number;
}

/**
 * Align task metadata (ElevenLabs forced alignment)
 */
export interface AlignMetadata {
  provider: 'elevenlabs';
  word_count: number;
  total_duration_ms: number;
  average_word_duration_ms: number;
  confidence_score?: number;
}

/**
 * Translate task metadata
 */
export interface TranslateMetadata {
  translator: 'gemini-flash-2.5-lite' | 'gpt-4o-mini';
  languages: string[];  // Language codes: ['zh', 'vi', 'id']
  total_translations: number;
  lines_translated: number;
  skipped?: boolean;  // True if translations already existed
}

/**
 * Translation quiz metadata
 */
export interface TranslationQuizMetadata {
  questions_generated: number;
  target_languages: string[];
  difficulty_distribution: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
}

/**
 * Trivia quiz metadata
 */
export interface TriviaMetadata {
  questions_generated: number;
  source: 'genius_annotations' | 'artist_bio' | 'song_facts';
  difficulty_distribution: {
    easy?: number;
    medium?: number;
    hard?: number;
  };
}

/**
 * Separate task metadata (Demucs stem separation)
 */
export interface SeparateMetadata {
  provider: 'demucs_runpod';
  model: 'htdemucs' | 'htdemucs_ft';
  stems_created: ('vocals' | 'drums' | 'bass' | 'other')[];
  processing_time_seconds: number;
}

/**
 * Segment task metadata (viral clip selection)
 */
export interface SegmentMetadata {
  method: 'hybrid' | 'ai' | 'deterministic';
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  confidence_score?: number;  // If AI-selected
  selection_reason?: string;  // Why this segment was chosen
}

/**
 * Enhance task metadata (fal.ai Stable Audio 2.5)
 */
export interface EnhanceMetadata {
  provider: 'fal_stable_audio_2.5';
  chunks_processed: number;
  total_duration_seconds: number;
  prompt_used?: string;
  quality_score?: number;
}

/**
 * Clip task metadata (FFmpeg final clip creation)
 */
export interface ClipMetadata {
  duration_ms: number;
  file_size_bytes: number;
  audio_format: 'mp3' | 'wav';
  video_format?: 'mp4';
  resolution?: string;  // e.g., "1920x1080"
}

/**
 * Union type for all task metadata
 * Used in audio_tasks.metadata column
 */
export type AudioTaskMetadata =
  | DownloadMetadata
  | AlignMetadata
  | TranslateMetadata
  | TranslationQuizMetadata
  | TriviaMetadata
  | SeparateMetadata
  | SegmentMetadata
  | EnhanceMetadata
  | ClipMetadata;

/**
 * Error details for failed tasks
 * Used in audio_tasks.error_details column
 */
export interface TaskErrorDetails {
  error_type: string;  // Error constructor name
  stack?: string;  // Stack trace
  context?: Record<string, any>;  // Additional error context
  retry_after?: number;  // Suggested retry delay (ms)
  is_retryable?: boolean;  // Whether this error should trigger retry
}

/**
 * Type guard to check if metadata is TranslateMetadata
 */
export function isTranslateMetadata(metadata: any): metadata is TranslateMetadata {
  return metadata && 'translator' in metadata && 'languages' in metadata;
}

/**
 * Type guard to check if metadata is SeparateMetadata
 */
export function isSeparateMetadata(metadata: any): metadata is SeparateMetadata {
  return metadata && 'provider' in metadata && metadata.provider === 'demucs_runpod';
}

/**
 * Type guard to check if metadata is EnhanceMetadata
 */
export function isEnhanceMetadata(metadata: any): metadata is EnhanceMetadata {
  return metadata && 'provider' in metadata && metadata.provider === 'fal_stable_audio_2.5';
}
