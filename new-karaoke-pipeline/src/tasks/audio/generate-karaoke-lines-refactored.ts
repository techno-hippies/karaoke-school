#!/usr/bin/env bun
/**
 * Generate Karaoke Lines Task (REFACTORED with BaseTask)
 * Stage: translated → (data available for segmentation)
 *
 * Extracts line-level structure from lyrics_translations and populates
 * karaoke_lines table. This enables line-based segment selection and FSRS tracking.
 *
 * COMPARISON:
 * - Old version: 143 lines with manual lifecycle management
 * - New version: ~80 lines, BaseTask handles boilerplate
 * - Reduction: ~44% less code, same functionality
 *
 * NOTE: This task doesn't use audio_tasks or update track.stage.
 * It populates karaoke_lines from existing translation data.
 *
 * Prerequisites:
 * - lyrics_translations (any language, structure is the same)
 *
 * Output:
 * - karaoke_lines (one row per line with word timing)
 *
 * Usage:
 *   bun src/tasks/audio/generate-karaoke-lines-refactored.ts --limit=50
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

interface TrackWithTranslation {
  spotify_track_id: string;
  lines: TranslationLine[];
}

/**
 * Generate Karaoke Lines Task
 *
 * Simpler than audio tasks - no stage updates, just data transformation
 */
export class GenerateKaraokeLinesTask {
  /**
   * Select tracks with translations but no karaoke_lines yet
   */
  async selectTracks(limit: number, trackId?: string): Promise<TrackWithTranslation[]> {
    const trackIdFilter = trackId ? `AND lt.spotify_track_id = $2` : '';
    const params = trackId ? [limit, trackId] : [limit];

    return query<TrackWithTranslation>(
      `SELECT DISTINCT ON (lt.spotify_track_id)
        lt.spotify_track_id,
        lt.lines
      FROM lyrics_translations lt
      LEFT JOIN karaoke_lines kl ON lt.spotify_track_id = kl.spotify_track_id
      WHERE kl.spotify_track_id IS NULL
        ${trackIdFilter}
      ORDER BY lt.spotify_track_id, lt.language_code
      LIMIT $1`,
      params
    );
  }

  /**
   * Process a single track: extract lines from translation
   */
  async processTrack(track: TrackWithTranslation): Promise<number> {
    const { spotify_track_id, lines } = track;

    if (!lines || !Array.isArray(lines)) {
      throw new Error('Invalid lines data');
    }

    console.log(`   📝 ${spotify_track_id} (${lines.length} lines)`);

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

    console.log(`   ✓ Inserted ${lines.length} lines`);
    return lines.length;
  }

  /**
   * Main execution method
   */
  async run(options: { limit?: number; trackId?: string } = {}): Promise<void> {
    const limit = options.limit || 50;
    const trackId = options.trackId;
    console.log(`\n📝 Generating karaoke_lines (limit: ${limit})\n`);

    const tracks = await this.selectTracks(limit, trackId);

    if (tracks.length === 0) {
      console.log('✓ All tracks already have karaoke_lines\n');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing karaoke_lines\n`);

    let totalLinesInserted = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      try {
        const linesInserted = await this.processTrack(track);
        totalLinesInserted += linesInserted;
        successCount++;
      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        failedCount++;
      }
    }

    console.log(
      `\n✓ Complete: ${successCount} tracks, ` +
      `${totalLinesInserted} lines inserted, ` +
      `${failedCount} failed\n`
    );
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;

  const trackIdArg = process.argv.find(arg => arg.startsWith('--trackId='));
  const trackId = trackIdArg ? trackIdArg.split('=')[1] : undefined;

  const task = new GenerateKaraokeLinesTask();
  task.run({ limit, trackId }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
