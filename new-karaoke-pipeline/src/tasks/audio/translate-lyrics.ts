#!/usr/bin/env bun
/**
 * Lyrics Translation Task
 * Stage: aligned → translated
 *
 * Translates lyrics to multiple target languages using Gemini Flash 2.5
 * Preserves word-level timing from ElevenLabs forced alignment
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
 *   bun src/tasks/audio/translate-lyrics.ts [--limit=N]
 */

import { query } from '../../db/connection';
import { LyricsTranslator, type LanguageCode, type ElevenLabsWord } from '../../services/lyrics-translator';
import { ensureAudioTask, startTask, completeTask, failTask, updateTrackStage } from '../../db/audio-tasks';
import { TrackStage } from '../../db/task-stages';
import { upsertTranslation, getExistingTranslations, countTranslations } from '../../db/audio-queries';

// Default target languages for karaoke (prioritize Asian markets)
const DEFAULT_TARGET_LANGUAGES: LanguageCode[] = ['zh', 'vi', 'id'];

interface TrackForTranslation {
  spotify_track_id: string;
  title: string;
  artists: string;
  normalized_lyrics: string;
  words: ElevenLabsWord[];
  language: string | null;
}

async function translateLyrics(limit: number = 20, targetLanguages: LanguageCode[] = DEFAULT_TARGET_LANGUAGES) {
  console.log(`\n🌍 Lyrics Translation`);
  console.log(`Target languages: ${targetLanguages.join(', ')}`);
  console.log(`Limit: ${limit}`);

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    console.error('❌ OPENROUTER_API_KEY not configured');
    process.exit(1);
  }

  const translator = new LyricsTranslator(openRouterApiKey);

  try {
    // Find tracks at 'aligned' stage with lyrics and word alignments
    const tracks = await query<TrackForTranslation>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        sl.normalized_lyrics,
        sl.language,
        ewa.words
      FROM tracks t
      JOIN song_lyrics sl ON t.spotify_track_id = sl.spotify_track_id
      JOIN elevenlabs_word_alignments ewa ON t.spotify_track_id = ewa.spotify_track_id
      WHERE t.stage = $1
        AND sl.normalized_lyrics IS NOT NULL
        AND ewa.words IS NOT NULL
      ORDER BY t.updated_at ASC
      LIMIT $2`,
      [TrackStage.Aligned, limit]
    );

    if (tracks.length === 0) {
      console.log('✓ No tracks need translation (all caught up!)');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing translation\n`);

    let translatedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      const startTime = Date.now();

      try {
        // Ensure audio_tasks record exists
        await ensureAudioTask(track.spotify_track_id, 'translate');
        await startTask(track.spotify_track_id, 'translate');

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

        const languagesToTranslate = targetLanguages.filter(
          lang => !existingLanguages.has(lang) && lang !== sourceLanguage
        );

        if (languagesToTranslate.length === 0) {
          console.log(`   ✓ All target languages already translated`);

          // Update stage to translated if we have at least 3 translations
          if (existingLanguages.size >= 3) {
            const processingTime = Date.now() - startTime;

            // Mark audio_tasks as completed (already translated)
            await completeTask(track.spotify_track_id, 'translate', {
              metadata: {
                languages: Array.from(existingLanguages),
                total_translations: existingLanguages.size,
                lines_translated: lines.length,
                skipped: true
              },
              duration_ms: processingTime
            });

            // Update track stage based on completed tasks
            await updateTrackStage(track.spotify_track_id);
            console.log(`   ✓ Stage updated: aligned → translated`);
          }

          translatedCount++;
          continue;
        }

        console.log(`   Translating to: ${languagesToTranslate.join(', ')}`);

        // Translate to multiple languages
        const translations = await translator.translateToMultipleLanguages(
          lines,
          languagesToTranslate,
          sourceLanguage
        );

        // Store each translation in database
        for (const [lang, translation] of translations.entries()) {
          await upsertTranslation(track.spotify_track_id, lang, {
            lines: translation.lines,
            translator: translation.translationSource,
            quality_score: translation.confidenceScore
          });

          console.log(
            `   ✓ Translated to ${lang}: ${translation.lines.length} lines, ` +
            `confidence: ${(translation.confidenceScore * 100).toFixed(1)}%`
          );
        }

        // Check total translations count
        const totalTranslations = await countTranslations(track.spotify_track_id);

        // Update stage to translated if we have enough translations (3+)
        if (totalTranslations >= 3) {
          const processingTime = Date.now() - startTime;

          // Mark audio_tasks as completed
          await completeTask(track.spotify_track_id, 'translate', {
            metadata: {
              languages: Array.from(targetLanguages),
              total_translations: totalTranslations,
              lines_translated: lines.length
            },
            duration_ms: processingTime
          });

          // Update track stage based on completed tasks
          await updateTrackStage(track.spotify_track_id);
          console.log(`   ✓ Stage updated: aligned → translated`);
        }

        translatedCount++;
      } catch (error: any) {
        failedCount++;
        console.error(`   ✗ Failed to translate ${track.spotify_track_id}:`, error.message);

        // Mark audio_tasks as failed
        await failTask(track.spotify_track_id, 'translate', error.message, {
          error_type: error.name,
          stack: error.stack
        });
      }
    }

    console.log(
      `\n✅ Translation Complete: ${translatedCount} tracks translated, ${failedCount} failed`
    );
  } catch (error: any) {
    console.error('❌ Translation task failed:', error);
    throw error;
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;

  translateLyrics(limit).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { translateLyrics };
