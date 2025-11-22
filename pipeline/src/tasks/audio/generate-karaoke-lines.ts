/**
 * Generate karaoke_lines from lyrics_translations
 *
 * Extracts line-level structure from translations and populates karaoke_lines table.
 * This enables line-based segment selection and FSRS tracking.
 *
 * Prerequisites:
 * - lyrics_translations (any language, structure is the same)
 *
 * Output:
 * - karaoke_lines (one row per line with word timing)
 */

import { query } from '../../db/connection';

interface TranslationLine {
  lineIndex: number;
  start: number; // seconds
  end: number; // seconds
  originalText: string;
  words: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

interface Translation {
  spotify_track_id: string;
  lines: TranslationLine[];
}

export async function generateKaraokeLines(limit: number = 50): Promise<void> {
  console.log(`\n📝 Generating karaoke_lines (limit: ${limit})`);

  try {
    // Get tracks with translations but no karaoke_lines yet
    const translations = await query<Translation>(
      `SELECT DISTINCT ON (lt.spotify_track_id)
        lt.spotify_track_id,
        lt.lines
      FROM lyrics_translations lt
      LEFT JOIN karaoke_lines kl ON lt.spotify_track_id = kl.spotify_track_id
      WHERE kl.spotify_track_id IS NULL
      ORDER BY lt.spotify_track_id, lt.language_code
      LIMIT $1`,
      [limit]
    );

    if (translations.length === 0) {
      console.log('✓ All tracks already have karaoke_lines');
      return;
    }

    console.log(`Found ${translations.length} tracks needing karaoke_lines\n`);

    let totalLinesInserted = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const translation of translations) {
      try {
        const { spotify_track_id, lines } = translation;

        if (!lines || !Array.isArray(lines)) {
          console.warn(`⚠️  Skipping ${spotify_track_id}: invalid lines data`);
          failedCount++;
          continue;
        }

        console.log(`📝 ${spotify_track_id} (${lines.length} lines)`);

        // Insert lines one at a time (safer for special characters)
        for (const line of lines) {
          const startMs = Math.round(line.start * 1000);
          const endMs = Math.round(line.end * 1000);
          const durationMs = endMs - startMs;

          // Convert words to format with milliseconds
          const wordTimings = line.words?.map(w => ({
            word: w.text,
            start_ms: Math.round(w.start * 1000),
            end_ms: Math.round(w.end * 1000)
          })) || [];

          await query(
            `INSERT INTO karaoke_lines (
              spotify_track_id,
              line_index,
              start_ms,
              end_ms,
              duration_ms,
              original_text,
              word_timings
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (spotify_track_id, line_index)
            DO UPDATE SET
              start_ms = EXCLUDED.start_ms,
              end_ms = EXCLUDED.end_ms,
              duration_ms = EXCLUDED.duration_ms,
              original_text = EXCLUDED.original_text,
              word_timings = EXCLUDED.word_timings,
              updated_at = NOW()`,
            [
              spotify_track_id,
              line.lineIndex,
              startMs,
              endMs,
              durationMs,
              line.originalText,
              JSON.stringify(wordTimings)
            ]
          );
        }

        totalLinesInserted += lines.length;
        successCount++;
        console.log(`   ✓ Inserted ${lines.length} lines`);

      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        failedCount++;
      }
    }

    console.log(`\n✓ Complete: ${successCount} tracks, ${totalLinesInserted} lines inserted, ${failedCount} failed`);

  } catch (error: any) {
    console.error(`Fatal error: ${error.message}`);
    throw error;
  }
}

// CLI execution
if (import.meta.main) {
  const args = process.argv.slice(2);
  let limit = 50;

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    } else if (!arg.startsWith('--')) {
      limit = parseInt(arg);
    }
  }

  generateKaraokeLines(limit)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
