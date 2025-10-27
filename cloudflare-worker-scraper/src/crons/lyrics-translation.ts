/**
 * Lyrics Translation Cron
 * Automatically translates tracks with ElevenLabs alignments to supported languages
 * Runs every 55 minutes
 */

import { NeonDB } from '../neon';
import { parseWordsIntoLines } from '../services/lyrics-line-parser';
import { LyricsTranslator, SUPPORTED_LANGUAGES, type LanguageCode } from '../services/lyrics-translator';
import type { Env } from '../types';

const BATCH_SIZE = 5; // Process 5 tracks per run
const TARGET_LANGUAGES: LanguageCode[] = ['zh', 'vi', 'id'];

export default async function runLyricsTranslation(env: Env): Promise<void> {
  console.log('🌐 Starting lyrics translation cron');

  const db = new NeonDB(env.NEON_DATABASE_URL);

  try {
    // Find tracks with ElevenLabs alignments but missing translations
    const tracksToTranslate = await db.sql`
      SELECT DISTINCT e.spotify_track_id
      FROM elevenlabs_word_alignments e
      WHERE e.words IS NOT NULL
        AND e.spotify_track_id NOT IN (
          SELECT DISTINCT spotify_track_id
          FROM lyrics_translations
          WHERE language_code = ANY(${TARGET_LANGUAGES})
          GROUP BY spotify_track_id
          HAVING COUNT(DISTINCT language_code) = ${TARGET_LANGUAGES.length}
        )
      ORDER BY e.spotify_track_id DESC
      LIMIT ${BATCH_SIZE}
    `;

    if (tracksToTranslate.length === 0) {
      console.log('✅ No tracks need translation');
      return;
    }

    console.log(`📝 Found ${tracksToTranslate.length} tracks to translate`);

    const translator = new LyricsTranslator(env.OPENROUTER_API_KEY);
    let successCount = 0;
    let errorCount = 0;

    for (const track of tracksToTranslate) {
      const spotifyTrackId = track.spotify_track_id;

      try {
        console.log(`🎵 Translating track: ${spotifyTrackId}`);

        // Fetch ElevenLabs alignment
        const alignmentResult = await db.sql`
          SELECT words FROM elevenlabs_word_alignments
          WHERE spotify_track_id = ${spotifyTrackId}
        `.then(rows => rows[0]);

        if (!alignmentResult) {
          console.warn(`⚠️ No alignment found for ${spotifyTrackId}`);
          continue;
        }

        const words = alignmentResult.words as any[];

        // Parse into lines
        const lines = parseWordsIntoLines(words);

        if (lines.length === 0) {
          console.warn(`⚠️ No lines parsed for ${spotifyTrackId}`);
          continue;
        }

        // Check which languages are missing
        const existingTranslations = await db.sql`
          SELECT language_code
          FROM lyrics_translations
          WHERE spotify_track_id = ${spotifyTrackId}
            AND language_code = ANY(${TARGET_LANGUAGES})
        `;

        const existingLangCodes = existingTranslations.map(r => r.language_code);
        const missingLanguages = TARGET_LANGUAGES.filter(
          lang => !existingLangCodes.includes(lang)
        );

        if (missingLanguages.length === 0) {
          console.log(`✅ All translations exist for ${spotifyTrackId}`);
          continue;
        }

        console.log(`🔄 Translating to: ${missingLanguages.join(', ')}`);

        // Translate to missing languages
        const results = await translator.translateToMultipleLanguages(
          lines,
          missingLanguages
        );

        // Store translations
        for (const [langCode, translation] of results.entries()) {
          try {
            await db.sql`
              INSERT INTO lyrics_translations
                (spotify_track_id, language_code, lines, translation_source, confidence_score)
              VALUES (
                ${spotifyTrackId},
                ${langCode},
                ${JSON.stringify(translation.lines)},
                ${translation.translationSource},
                ${translation.confidenceScore}
              )
              ON CONFLICT (spotify_track_id, language_code)
              DO UPDATE SET
                lines = excluded.lines,
                confidence_score = excluded.confidence_score,
                translated_at = NOW()
            `;

            console.log(`  ✅ Stored ${langCode} translation`);
          } catch (error: any) {
            console.error(`  ❌ Error storing ${langCode}:`, error.message);
          }
        }

        successCount++;
        console.log(`✅ Completed translation for ${spotifyTrackId}`);

      } catch (error: any) {
        errorCount++;
        console.error(`❌ Error translating ${spotifyTrackId}:`, error.message);
      }
    }

    console.log(`🏁 Translation cron complete: ${successCount} success, ${errorCount} errors`);

  } catch (error: any) {
    console.error('❌ Translation cron error:', error);
    throw error;
  }
}
