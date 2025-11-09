/**
 * Task Stages & Status Enums
 * Centralized type definitions for audio processing pipeline
 *
 * Two-tier tracking system:
 * 1. audio_tasks.status - Granular task-level (pending/running/completed/failed)
 * 2. tracks.stage - High-level pipeline progression (derived from audio_tasks)
 */

// ============================================================================
// Audio Task Types & Status
// ============================================================================

/**
 * Individual processing tasks tracked in audio_tasks table
 */
export enum AudioTaskType {
  Download = 'download',      // Download from Spotify/YouTube
  Align = 'align',            // ElevenLabs word-level alignment
  Translate = 'translate',    // Gemini Flash 2.5 Lite via OpenRouter
  TranslationQuiz = 'translation_quiz', // Translation MCQ generation
  Trivia = 'trivia',          // Trivia generation from annotations
  Separate = 'separate',      // Demucs stem separation
  Segment = 'segment',        // Viral clip selection (hybrid: deterministic + AI)
  Enhance = 'enhance',        // Fal.ai audio enhancement
  Clip = 'clip',              // FFmpeg final clip creation
}

/**
 * Task execution status in audio_tasks table
 */
export enum TaskStatus {
  Pending = 'pending',        // Queued for execution
  Running = 'running',        // Currently processing
  Completed = 'completed',    // Successfully finished
  Failed = 'failed',          // Error occurred (retry if attempts < max_attempts)
}

// ============================================================================
// Track Stages (High-Level Pipeline Progression)
// ============================================================================

/**
 * Overall track progression in tracks.stage column
 * Derived from completed audio_tasks
 */
export enum TrackStage {
  // Initial states
  Discovered = 'discovered',           // TikTok video discovered, no Spotify match yet
  Matched = 'matched',                 // Spotify track matched via Quansic
  Enriched = 'enriched',               // ISWC + Genius data fetched

  // Audio pipeline states (derived from audio_tasks)
  AudioReady = 'audio_ready',          // Download task completed
  Aligned = 'aligned',                 // Download + align completed
  Translated = 'translated',           // Download + align + translate completed
  TranslationQuizReady = 'translation_quiz_ready', // Translation quiz generated
  TriviaReady = 'trivia_ready',        // Trivia generated from annotations
  Separated = 'separated',             // All above + separate completed
  Segmented = 'segmented',             // All above + segment completed
  Enhanced = 'enhanced',               // All above + enhance completed
  Ready = 'ready',                     // All audio tasks completed (clip done)

  // Identity & GRC-20 states
  PkpMinted = 'pkp_minted',            // PKP created for artist/creator
  LensCreated = 'lens_created',        // Lens account linked
  GRC20Ready = 'grc20_ready',          // Artist/Work/Recording mapped
  GRC20Submitted = 'grc20_submitted',  // Submitted to Grove blockchain

  // Content protection
  Encrypted = 'encrypted',             // Full audio encrypted (Lit Protocol)
  UnlockDeployed = 'unlock_deployed',  // Unlock lock deployed (per artist)

  // Complete
  Published = 'published',             // All systems go, live in app
}

// ============================================================================
// Stage Derivation Logic
// ============================================================================

/**
 * Map of stages to required completed tasks
 * Used by updateTrackStage() to derive new stage from audio_tasks
 */
export const STAGE_REQUIREMENTS: Record<TrackStage, AudioTaskType[]> = {
  [TrackStage.Discovered]: [],
  [TrackStage.Matched]: [],
  [TrackStage.Enriched]: [],

  // Audio pipeline stages (progressive requirements)
  [TrackStage.AudioReady]: [AudioTaskType.Download],
  [TrackStage.Aligned]: [AudioTaskType.Download, AudioTaskType.Align],
  [TrackStage.Translated]: [AudioTaskType.Download, AudioTaskType.Align, AudioTaskType.Translate],
  [TrackStage.TranslationQuizReady]: [
    AudioTaskType.Download,
    AudioTaskType.Align,
    AudioTaskType.Translate,
    AudioTaskType.TranslationQuiz,
  ],
  [TrackStage.TriviaReady]: [
    AudioTaskType.Download,
    AudioTaskType.Align,
    AudioTaskType.Translate,
    AudioTaskType.TranslationQuiz,
    AudioTaskType.Trivia,
  ],
  [TrackStage.Separated]: [AudioTaskType.Download, AudioTaskType.Align, AudioTaskType.Translate, AudioTaskType.Separate],
  [TrackStage.Segmented]: [AudioTaskType.Download, AudioTaskType.Align, AudioTaskType.Translate, AudioTaskType.Separate, AudioTaskType.Segment],
  [TrackStage.Enhanced]: [AudioTaskType.Download, AudioTaskType.Align, AudioTaskType.Translate, AudioTaskType.Separate, AudioTaskType.Segment, AudioTaskType.Enhance],
  [TrackStage.Ready]: [AudioTaskType.Download, AudioTaskType.Align, AudioTaskType.Translate, AudioTaskType.Separate, AudioTaskType.Segment, AudioTaskType.Enhance, AudioTaskType.Clip],

  // Identity & GRC-20 (no audio task requirements)
  [TrackStage.PkpMinted]: [],
  [TrackStage.LensCreated]: [],
  [TrackStage.GRC20Ready]: [],
  [TrackStage.GRC20Submitted]: [],

  // Content protection
  [TrackStage.Encrypted]: [],
  [TrackStage.UnlockDeployed]: [],

  [TrackStage.Published]: [],
};

/**
 * Stage ordering for monotonic progression
 * Lower index = earlier stage
 */
export const STAGE_ORDER = [
  TrackStage.Discovered,
  TrackStage.Matched,
  TrackStage.Enriched,
  TrackStage.AudioReady,
  TrackStage.Aligned,
  TrackStage.Translated,
  TrackStage.TranslationQuizReady,
  TrackStage.TriviaReady,
  TrackStage.Separated,
  TrackStage.Segmented,
  TrackStage.Enhanced,
  TrackStage.Ready,
  TrackStage.PkpMinted,
  TrackStage.LensCreated,
  TrackStage.GRC20Ready,
  TrackStage.GRC20Submitted,
  TrackStage.Encrypted,
  TrackStage.UnlockDeployed,
  TrackStage.Published,
] as const;

/**
 * Check if stage transition is valid (monotonic progression)
 */
export function isValidStageTransition(
  currentStage: TrackStage,
  newStage: TrackStage
): boolean {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const newIndex = STAGE_ORDER.indexOf(newStage);

  // Allow forward progression only (or staying at same stage)
  return newIndex >= currentIndex;
}

/**
 * Derive track stage from completed audio tasks
 * Returns the highest stage achievable with current completed tasks
 */
export function deriveStageFromTasks(completedTasks: AudioTaskType[]): TrackStage {
  const completedSet = new Set(completedTasks);

  // Check stages in reverse order (highest to lowest)
  // Return first stage where all requirements are met
  for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
    const stage = STAGE_ORDER[i];
    const requirements = STAGE_REQUIREMENTS[stage];

    // Skip non-audio stages (they have empty requirements)
    if (requirements.length === 0) continue;

    // Check if all requirements are met
    const allRequirementsMet = requirements.every(req => completedSet.has(req));
    if (allRequirementsMet) {
      return stage;
    }
  }

  // Fallback to initial state
  return TrackStage.Enriched;
}

// ============================================================================
// Type Guards & Utilities
// ============================================================================

/**
 * Check if a string is a valid AudioTaskType
 */
export function isAudioTaskType(value: string): value is AudioTaskType {
  return Object.values(AudioTaskType).includes(value as AudioTaskType);
}

/**
 * Check if a string is a valid TaskStatus
 */
export function isTaskStatus(value: string): value is TaskStatus {
  return Object.values(TaskStatus).includes(value as TaskStatus);
}

/**
 * Check if a string is a valid TrackStage
 */
export function isTrackStage(value: string): value is TrackStage {
  return Object.values(TrackStage).includes(value as TrackStage);
}

/**
 * Check if stage is part of audio pipeline
 */
export function isAudioPipelineStage(stage: TrackStage): boolean {
  const audioPipelineStages = [
    TrackStage.AudioReady,
    TrackStage.Aligned,
    TrackStage.Translated,
    TrackStage.TranslationQuizReady,
    TrackStage.TriviaReady,
    TrackStage.Separated,
    TrackStage.Segmented,
    TrackStage.Enhanced,
    TrackStage.Ready,
  ];

  return audioPipelineStages.includes(stage);
}

/**
 * Get human-readable stage description
 */
export function getStageDescription(stage: TrackStage): string {
  const descriptions: Record<TrackStage, string> = {
    [TrackStage.Discovered]: 'TikTok video discovered',
    [TrackStage.Matched]: 'Spotify track matched',
    [TrackStage.Enriched]: 'ISWC + Genius data fetched',
    [TrackStage.AudioReady]: 'Audio downloaded',
    [TrackStage.Aligned]: 'Word-level timing aligned',
    [TrackStage.Translated]: 'Lyrics translated',
    [TrackStage.TranslationQuizReady]: 'Translation quizzes generated',
    [TrackStage.TriviaReady]: 'Trivia questions generated',
    [TrackStage.Separated]: 'Vocal stems separated',
    [TrackStage.Segmented]: 'Viral clip selected',
    [TrackStage.Enhanced]: 'Audio enhanced',
    [TrackStage.Ready]: 'Final clips created',
    [TrackStage.PkpMinted]: 'PKP identity created',
    [TrackStage.LensCreated]: 'Lens account linked',
    [TrackStage.GRC20Ready]: 'GRC-20 metadata prepared',
    [TrackStage.GRC20Submitted]: 'Submitted to Grove blockchain',
    [TrackStage.Encrypted]: 'Full audio encrypted',
    [TrackStage.UnlockDeployed]: 'Artist lock deployed',
    [TrackStage.Published]: 'Live in app',
  };

  return descriptions[stage];
}

// ============================================================================
// SQL Value Mappings (for parameterized queries)
// ============================================================================

/**
 * Convert enum to string value for SQL queries
 */
export function taskTypeToSQL(taskType: AudioTaskType): string {
  return taskType;
}

export function taskStatusToSQL(status: TaskStatus): string {
  return status;
}

export function trackStageToSQL(stage: TrackStage): string {
  return stage;
}
