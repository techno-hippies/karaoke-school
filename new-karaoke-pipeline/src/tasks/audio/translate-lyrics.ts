#!/usr/bin/env bun
/**
 * Lyrics Translation Task (REFACTORED with BaseTask)
 * Stage: aligned → translated
 *
 * Translates lyrics to multiple target languages using Gemini Flash 2.5
 * Preserves word-level timing from ElevenLabs forced alignment
 *
 * COMPARISON:
 * - Old version: 262 lines with manual lifecycle management
 * - New version: ~100 lines, BaseTask handles boilerplate
 * - Reduction: ~62% less code, same functionality
 *
 * Prerequisites:
 * - song_lyrics.normalized_lyrics (plain text lyrics)
 * - elevenlabs_word_alignments.words (word-level timing)
 *
 * Output:
 * - lyrics_translations table (one row per language)
 * - Updates tracks.stage to 'translated'
 *
 * Usage:
 *   bun src/tasks/audio/translate-lyrics-refactored.ts --limit=20
 */

import { query } from '../../db/connection';
import { LyricsTranslator, type ElevenLabsWord } from '../../services/lyrics-translator';
import { TrackStage, AudioTaskType } from '../../db/task-stages';
import { upsertTranslation, getExistingTranslations, countTranslations } from '../../db/audio-queries';
import { BaseTask, type BaseTrackInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { CONFIG } from '../../config';
import type { TranslateMetadata } from '../../types/task-metadata';

/**
 * Track ready for translation
 */
interface TrackForTranslation extends BaseTrackInput {
  spotify_track_id: string;
  title: string;
  artists: string;
  primary_artist_id: string;
  primary_artist_name: string;
  normalized_lyrics: string;
  words: ElevenLabsWord[];
  language: string | null;
}

/**
 * Translation result with metadata
 */
interface TranslationResult extends TaskResult {
  metadata: TranslateMetadata;
}

/**
 * Translate Lyrics Task
 *
 * Uses BaseTask to eliminate boilerplate:
 * - No manual ensureAudioTask/startTask/completeTask/failTask
 * - No manual updateTrackStage
 * - No manual error handling and retries
 * - No manual success/failure counting
 */
export class TranslateLyricsTask extends BaseTask<TrackForTranslation, TranslationResult> {
  readonly taskType = AudioTaskType.Translate;
  private translator: LyricsTranslator;
  private targetLanguages = CONFIG.translation.defaultLanguages;

  constructor() {
    super();

    // Initialize translator
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }
    this.translator = new LyricsTranslator(apiKey);
  }

  /**
   * Select tracks at 'aligned' stage with lyrics and word alignments
   * Only processes tracks with valid Wikidata (GRC-20 legitimacy gate)
   * Respects audio_tasks retry logic (attempts, backoff, max_attempts)
   */
  async selectTracks(limit: number, trackId?: string): Promise<TrackForTranslation[]> {
    const retryFilter = buildAudioTasksFilter(this.taskType);
    const trackIdFilter = trackId ? `AND t.spotify_track_id = $3` : '';
    const params = trackId ? [TrackStage.Aligned, limit, trackId] : [TrackStage.Aligned, limit];

    return query<TrackForTranslation>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        t.primary_artist_id,
        t.primary_artist_name,
        sl.normalized_lyrics,
        sl.language,
        ewa.words
      FROM tracks t
      JOIN song_lyrics sl ON t.spotify_track_id = sl.spotify_track_id
      JOIN elevenlabs_word_alignments ewa ON t.spotify_track_id = ewa.spotify_track_id
      WHERE t.stage = $1
        AND sl.normalized_lyrics IS NOT NULL
        AND ewa.words IS NOT NULL
        -- GRC-20 Legitimacy Gate: Only process tracks with valid Wikidata
        AND EXISTS (
          SELECT 1 FROM wikidata_artists wa
          WHERE wa.spotify_id = t.primary_artist_id
            AND wa.wikidata_id IS NOT NULL
            AND wa.name IS NOT NULL
            AND wa.name != wa.wikidata_id
        )
        ${retryFilter}
        ${trackIdFilter}
      ORDER BY t.updated_at ASC
      LIMIT $2`,
      params
    );
  }

  /**
   * Process a single track: translate to all target languages
   */
  async processTrack(track: TrackForTranslation): Promise<TranslationResult> {
    console.log(`\n🌍 Translating: ${track.title} - ${track.artists}`);

    // Detect source language
    const sourceLanguage = track.language || 'auto';
    console.log(`   Source language: ${sourceLanguage}`);

    // Parse lyrics into lines with word timing
    const lines = LyricsTranslator.parseLinesFromAlignment(
      track.words,
      track.normalized_lyrics
    );

    console.log(`   Parsed ${lines.length} lines from alignment`);

    // Check which languages are already translated
    const existingLanguageCodes = await getExistingTranslations(track.spotify_track_id);
    const existingLanguages = new Set(existingLanguageCodes);

    const languagesToTranslate = this.targetLanguages.filter(
      lang => !existingLanguages.has(lang) && lang !== sourceLanguage
    );

    // If all translations exist, return early (but still mark as completed)
    if (languagesToTranslate.length === 0) {
      console.log(`   ✓ All target languages already translated`);

      return {
        metadata: {
          translator: 'gemini-flash-2.5-lite',
          languages: Array.from(existingLanguages),
          total_translations: existingLanguages.size,
          lines_translated: lines.length,
          skipped: true,
        },
      };
    }

    console.log(`   Translating to: ${languagesToTranslate.join(', ')}`);

    // Translate to multiple languages
    const translations = await this.translator.translateToMultipleLanguages(
      lines,
      languagesToTranslate,
      sourceLanguage
    );

    // Store each translation in database
    for (const [lang, translation] of translations.entries()) {
      await upsertTranslation(track.spotify_track_id, lang, {
        lines: translation.lines,
        translator: translation.translationSource,
        quality_score: translation.confidenceScore,
      });

      console.log(
        `   ✓ Translated to ${lang}: ${translation.lines.length} lines, ` +
        `confidence: ${(translation.confidenceScore * 100).toFixed(1)}%`
      );
    }

    // Get total translation count
    const totalTranslations = await countTranslations(track.spotify_track_id);

    console.log(`   ✓ Total translations: ${totalTranslations}`);

    return {
      metadata: {
        translator: 'gemini-flash-2.5-lite',
        languages: languagesToTranslate,
        total_translations: totalTranslations,
        lines_translated: lines.length,
      },
    };
  }

  /**
   * Hook: Called before the entire run starts
   * Display configuration and check for blocked tracks
   */
  async beforeRun(options: any): Promise<void> {
    console.log(`\n🌍 Lyrics Translation`);
    console.log(`Target languages: ${this.targetLanguages.join(', ')}`);
    console.log(`Limit: ${options.limit || 10}\n`);

    // Check if tracks were blocked by GRC-20 legitimacy gate
    const blocked = await query<{ spotify_track_id: string; primary_artist_name: string }>(`
      SELECT t.spotify_track_id, t.primary_artist_name
      FROM tracks t
      JOIN song_lyrics sl ON t.spotify_track_id = sl.spotify_track_id
      JOIN elevenlabs_word_alignments ewa ON t.spotify_track_id = ewa.spotify_track_id
      WHERE t.stage = $1
        AND sl.normalized_lyrics IS NOT NULL
        AND ewa.words IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM wikidata_artists wa
          WHERE wa.spotify_id = t.primary_artist_id
            AND wa.wikidata_id IS NOT NULL
            AND wa.name IS NOT NULL
            AND wa.name != wa.wikidata_id
        )
      LIMIT 10`,
      [TrackStage.Aligned]
    );

    if (blocked.length > 0) {
      console.log('⚠️  Tracks blocked by GRC-20 legitimacy gate (no Wikidata):');
      blocked.forEach(t => {
        console.log(`   - ${t.primary_artist_name} (${t.spotify_track_id})`);
      });
      console.log('   💰 Cost savings: These tracks will not incur translation/processing costs');
      console.log(`   📊 Blocked count: ${blocked.length}${blocked.length === 10 ? '+' : ''}\n`);
    }
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;

  const task = new TranslateLyricsTask();
  task.run({ limit }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
