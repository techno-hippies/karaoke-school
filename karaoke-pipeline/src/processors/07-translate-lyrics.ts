/**
 * Step 7: Lyrics Translation (Multi-Language)
 * Status: alignment_complete → translations_ready (NEW status)
 *
 * Processes tracks that have:
 * - ElevenLabs word alignment (elevenlabs_word_alignments)
 * - Normalized lyrics (song_lyrics.plain_text)
 *
 * Translates lyrics to multiple target languages:
 * - Spanish (es)
 * - Mandarin Chinese (zh)
 * - Japanese (ja)
 * - Korean (ko)
 *
 * Preserves word-level timing from ElevenLabs alignment.
 * Stores results in lyrics_translations table.
 */

import { getNeonClient } from '../db/neon';
import { LyricsTranslator, type LanguageCode } from '../services/lyrics-translator';
import type { ElevenLabsWord } from '../services/elevenlabs';
import type { Env } from '../types';

// Default target languages for karaoke
const DEFAULT_TARGET_LANGUAGES: LanguageCode[] = ['es', 'zh', 'ja', 'ko'];

interface TrackForTranslation {
  spotifyTrackId: string;
  title: string;
  artists: string[];
  plainLyrics: string;
  words: ElevenLabsWord[];
  languageData: {
    primary: string;
    breakdown?: Array<{ code: string; pct: number }>;
  } | null;
}

export async function processLyricsTranslation(
  env: Env,
  limit: number = 20,
  targetLanguages: LanguageCode[] = DEFAULT_TARGET_LANGUAGES
): Promise<void> {
  console.log(`\n[Step 7] Lyrics Translation (limit: ${limit})`);
  console.log(`Target languages: ${targetLanguages.join(', ')}`);

  if (!env.OPENROUTER_API_KEY) {
    console.log('⚠️ OPENROUTER_API_KEY not configured, skipping');
    return;
  }

  const db = getNeonClient(env.NEON_DATABASE_URL);
  const translator = new LyricsTranslator(env.OPENROUTER_API_KEY);

  try {
    // Find tracks needing translation: alignment_complete status + no translations yet
    const tracksQuery = `
      SELECT
        sp.spotify_track_id,
        st.title,
        st.artists,
        sl.plain_text as plain_lyrics,
        sl.language_data,
        ewa.words
      FROM song_pipeline sp
      JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
      JOIN song_lyrics sl ON sp.spotify_track_id = sl.spotify_track_id
      JOIN elevenlabs_word_alignments ewa ON sp.spotify_track_id = ewa.spotify_track_id
      WHERE sp.status = 'alignment_complete'
      ORDER BY sp.updated_at ASC
      LIMIT $1
    `;

    const result = await db.query(tracksQuery, [limit]);
    const tracks = result.rows as TrackForTranslation[];

    if (tracks.length === 0) {
      console.log('✓ No tracks need translation (all caught up!)');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing translation`);

    let translatedCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      try {
        const artistsStr = Array.isArray(track.artists)
          ? track.artists.join(', ')
          : track.artists;

        console.log(`\n🌍 Translating: ${track.title} - ${artistsStr}`);

        // Detect source language
        const sourceLanguage = track.languageData?.primary || 'auto';
        console.log(`   Source language: ${sourceLanguage}`);

        // Update pipeline: mark as attempting
        await db.query(
          `UPDATE song_pipeline
           SET last_attempted_at = NOW(),
               retry_count = retry_count + 1,
               error_message = NULL,
               error_stage = NULL
           WHERE spotify_track_id = $1`,
          [track.spotifyTrackId]
        );

        // Parse lyrics into lines with word timing
        const lines = LyricsTranslator.parseLinesFromAlignment(
          track.words,
          track.plainLyrics
        );

        console.log(`   Parsed ${lines.length} lines from alignment`);

        // Check which languages are already translated
        const existingTranslationsResult = await db.query(
          `SELECT language_code FROM lyrics_translations WHERE spotify_track_id = $1`,
          [track.spotifyTrackId]
        );
        const existingLanguages = new Set(
          existingTranslationsResult.rows.map(r => r.language_code)
        );

        const languagesToTranslate = targetLanguages.filter(
          lang => !existingLanguages.has(lang) && lang !== sourceLanguage
        );

        if (languagesToTranslate.length === 0) {
          console.log(`   ✓ All target languages already translated`);

          // Update status to translations_ready if we have at least 3 translations
          if (existingLanguages.size >= 3) {
            await db.query(
              `UPDATE song_pipeline
               SET status = 'translations_ready',
                   updated_at = NOW()
               WHERE spotify_track_id = $1`,
              [track.spotifyTrackId]
            );
          }

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
          await db.query(
            `INSERT INTO lyrics_translations (
               spotify_track_id,
               language_code,
               lines,
               translation_source,
               confidence_score,
               source_language_code,
               source_language_data
             ) VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (spotify_track_id, language_code)
             DO UPDATE SET
               lines = EXCLUDED.lines,
               translation_source = EXCLUDED.translation_source,
               confidence_score = EXCLUDED.confidence_score,
               updated_at = NOW()`,
            [
              track.spotifyTrackId,
              lang,
              JSON.stringify(translation.lines),
              translation.translationSource,
              translation.confidenceScore,
              translation.sourceLanguage,
              track.languageData ? JSON.stringify(track.languageData) : null,
            ]
          );

          console.log(
            `   ✓ Translated to ${lang}: ${translation.lines.length} lines, ` +
            `confidence: ${(translation.confidenceScore * 100).toFixed(1)}%`
          );
        }

        // Check total translations count
        const totalTranslationsResult = await db.query(
          `SELECT COUNT(*) as count FROM lyrics_translations WHERE spotify_track_id = $1`,
          [track.spotifyTrackId]
        );
        const totalTranslations = parseInt(totalTranslationsResult.rows[0].count);

        // Update pipeline status if we have enough translations (3+)
        if (totalTranslations >= 3) {
          await db.query(
            `UPDATE song_pipeline
             SET status = 'translations_ready',
                 updated_at = NOW()
             WHERE spotify_track_id = $1`,
            [track.spotifyTrackId]
          );

          console.log(`   ✓ Status updated: alignment_complete → translations_ready`);
        }

        translatedCount++;
      } catch (error: any) {
        failedCount++;

        console.error(`   ✗ Failed to translate ${track.spotifyTrackId}:`, error.message);

        // Update pipeline with error
        await db.query(
          `UPDATE song_pipeline
           SET error_message = $1,
               error_stage = 'lyrics_translation',
               updated_at = NOW()
           WHERE spotify_track_id = $2`,
          [error.message, track.spotifyTrackId]
        );

        // If retry count >= 3, continue without failing the track
        const retryResult = await db.query(
          `SELECT retry_count FROM song_pipeline WHERE spotify_track_id = $1`,
          [track.spotifyTrackId]
        );

        if (retryResult.rows[0]?.retry_count >= 3) {
          console.log(`   ⚠️ Max retries reached, skipping translations for now`);
        }
      }
    }

    console.log(
      `\n✅ Step 7 Complete: ${translatedCount} tracks translated, ${failedCount} failed`
    );
  } catch (error) {
    console.error('❌ Step 7 (Lyrics Translation) failed:', error);
    throw error;
  }
}
