/**
 * Pipeline-New
 *
 * Karaoke content processing pipeline.
 *
 * CLI Scripts:
 *   create-account.ts     - Create posting accounts (Scarlett, etc.)
 *   add-song.ts           - Add song with lyrics files
 *   process-audio.ts      - Demucs separation + FAL enhancement
 *   align-lyrics.ts       - ElevenLabs word-level alignment
 *   generate-video.ts     - Create karaoke video with ASS subtitles
 *   generate-exercises.ts - Generate trivia/translation/sayitback
 *   post-clip.ts          - Post to Lens Protocol
 */

// Re-export types
export * from './types';

// Re-export config
export * from './config';

// Re-export database functions
export * from './db/connection';
export * from './db/queries';

// Re-export services
export * from './services/elevenlabs';
export * from './services/grove';
export * from './services/demucs';
export * from './services/fal';
export * from './services/lens';

// Re-export utilities
export * from './lib/lyrics-parser';
export * from './lib/ass-generator';
