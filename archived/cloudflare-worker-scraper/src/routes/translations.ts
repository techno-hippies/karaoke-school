/**
 * Lyrics Translation Routes
 * Endpoints for processing and translating karaoke lyrics
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { parseWordsIntoLines, validateLines } from '../services/lyrics-line-parser';
import { LyricsTranslator, SUPPORTED_LANGUAGES, type LanguageCode } from '../services/lyrics-translator';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /translations/process-track
 * Process ElevenLabs alignment into line-level structure
 */
app.post('/process-track', async (c) => {
  const { spotifyTrackId } = await c.req.json();

  if (!spotifyTrackId) {
    return c.json({ error: 'Missing spotifyTrackId' }, 400);
  }

  try {
    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    // Fetch ElevenLabs word alignment from database
    const alignmentResult = await db.sql`
      SELECT words FROM elevenlabs_word_alignments
      WHERE spotify_track_id = ${spotifyTrackId}
    `.then(rows => rows[0]);

    if (!alignmentResult) {
      return c.json({ error: 'No ElevenLabs alignment found for this track' }, 404);
    }

    const words = alignmentResult.words as any[];

    // Parse into lines
    const lines = parseWordsIntoLines(words);

    // Validate structure
    const validation = validateLines(lines);

    if (!validation.valid) {
      console.warn('Line validation issues:', validation.issues);
    }

    return c.json({
      success: true,
      spotifyTrackId,
      lineCount: lines.length,
      lines,
      validation,
    });
  } catch (error: any) {
    console.error('Error processing track:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /translations/translate
 * Translate a track to target language(s)
 */
app.post('/translate', async (c) => {
  const { spotifyTrackId, targetLanguages } = await c.req.json();

  if (!spotifyTrackId || !targetLanguages || !Array.isArray(targetLanguages)) {
    return c.json(
      { error: 'Missing spotifyTrackId or targetLanguages (array)' },
      400
    );
  }

  // Validate language codes
  const invalidLangs = targetLanguages.filter(
    (lang) => !Object.keys(SUPPORTED_LANGUAGES).includes(lang)
  );
  if (invalidLangs.length > 0) {
    return c.json(
      {
        error: `Invalid language codes: ${invalidLangs.join(', ')}`,
        supported: Object.keys(SUPPORTED_LANGUAGES),
      },
      400
    );
  }

  try {
    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    // Fetch ElevenLabs alignment
    const alignmentResult = await db.sql`
      SELECT words FROM elevenlabs_word_alignments
      WHERE spotify_track_id = ${spotifyTrackId}
    `.then(rows => rows[0]);

    if (!alignmentResult) {
      return c.json({ error: 'No ElevenLabs alignment found for this track' }, 404);
    }

    const words = alignmentResult.words as any[];

    // Parse into lines
    const lines = parseWordsIntoLines(words);

    // Initialize translator
    const translator = new LyricsTranslator(c.env.OPENROUTER_API_KEY);

    // Translate to each language
    const results = await translator.translateToMultipleLanguages(
      lines,
      targetLanguages as LanguageCode[]
    );

    // Store translations in database
    const insertedCount = await storeTranslations(
      db,
      spotifyTrackId,
      results
    );

    return c.json({
      success: true,
      spotifyTrackId,
      translatedLanguages: Array.from(results.keys()),
      insertedCount,
      results: Object.fromEntries(results),
    });
  } catch (error: any) {
    console.error('Error translating track:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /translations/:trackId/:languageCode
 * Fetch translation for a track in specific language
 */
app.get('/:trackId/:languageCode', async (c) => {
  const spotifyTrackId = c.req.param('trackId');
  const languageCode = c.req.param('languageCode');

  try {
    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    const result = await db.sql`
      SELECT * FROM lyrics_translations
      WHERE spotify_track_id = ${spotifyTrackId}
        AND language_code = ${languageCode}
    `.then(rows => rows[0]);

    if (!result) {
      return c.json(
        {
          error: 'Translation not found',
          hint: 'Use POST /translations/translate to create translations',
        },
        404
      );
    }

    return c.json({
      success: true,
      translation: result,
    });
  } catch (error: any) {
    console.error('Error fetching translation:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /translations/stats
 * Get translation statistics
 */
app.get('/stats', async (c) => {
  try {
    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    // Count by language
    const byLanguage = await db.sql`
      SELECT
        language_code,
        COUNT(*) as track_count,
        AVG(confidence_score) as avg_confidence
      FROM lyrics_translations
      GROUP BY language_code
      ORDER BY language_code
    `;

    // Total tracks with at least one translation
    const totalTracks = await db.sql`
      SELECT COUNT(DISTINCT spotify_track_id) as count
      FROM lyrics_translations
    `.then(rows => rows[0]);

    // Tracks with all 3 languages
    const completeTracks = await db.sql`
      SELECT COUNT(*) as count
      FROM (
        SELECT spotify_track_id
        FROM lyrics_translations
        GROUP BY spotify_track_id
        HAVING COUNT(DISTINCT language_code) = 3
      ) t
    `.then(rows => rows[0]);

    return c.json({
      success: true,
      stats: {
        total_tracks_with_translations: totalTracks.count,
        tracks_with_all_languages: completeTracks.count,
        by_language: byLanguage,
      },
    });
  } catch (error: any) {
    console.error('Error fetching translation stats:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /translations/:trackId
 * Fetch all translations for a track
 */
app.get('/:trackId', async (c) => {
  const spotifyTrackId = c.req.param('trackId');

  try {
    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    const results = await db.sql`
      SELECT language_code, confidence_score, translated_at, validated
      FROM lyrics_translations
      WHERE spotify_track_id = ${spotifyTrackId}
      ORDER BY language_code
    `;

    return c.json({
      success: true,
      spotifyTrackId,
      translations: results,
    });
  } catch (error: any) {
    console.error('Error fetching translations:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Helper: Store translations in database
 */
async function storeTranslations(
  db: NeonDB,
  spotifyTrackId: string,
  results: Map<LanguageCode, any>
): Promise<number> {
  let insertedCount = 0;

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

      insertedCount++;
    } catch (error: any) {
      console.error(`Error storing translation for ${langCode}:`, error);
    }
  }

  return insertedCount;
}

export default app;
