/**
 * Lyrics Schema
 *
 * Validation for synced lyrics from LRCLib
 */

import { z } from 'zod';

/**
 * Single lyric line with timestamp
 */
export const LyricLineSchema = z.object({
  start: z.number().gte(0).describe('Start time in seconds'),
  text: z.string().min(1).describe('Lyric text'),
});

export type LyricLine = z.infer<typeof LyricLineSchema>;

/**
 * Language-specific lyrics data
 */
export const LanguageLyricsSchema = z.object({
  source: z.literal('lrclib').describe('Lyrics source'),
  plain: z.string().describe('Plain text lyrics (no timestamps)'),
  synced: z.array(LyricLineSchema).describe('Line-by-line synced lyrics'),
});

export type LanguageLyrics = z.infer<typeof LanguageLyricsSchema>;

/**
 * Full lyrics object (supports multiple languages)
 */
export const LyricsSchema = z.object({
  en: LanguageLyricsSchema.optional(),
  // Future: es, fr, ja, ko, etc.
});

export type Lyrics = z.infer<typeof LyricsSchema>;
