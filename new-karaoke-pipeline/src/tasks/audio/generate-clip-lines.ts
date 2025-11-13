/**
 * Audio Task: Generate Clip Lines
 *
 * Materializes clip-specific lyrics from karaoke_lines filtered by clip boundaries.
 * Handles boundary edge cases (lines that straddle clip start/end).
 *
 * Dependencies:
 * - audio_tasks.segment (completed) - Clip boundaries selected in karaoke_segments
 * - karaoke_lines populated - Full song line timing available
 *
 * Output:
 * - clip_lines table populated with lines overlapping clip boundaries
 * - Includes partial lines (start before clip, end after clip)
 * - Clip-relative timing for playback
 *
 * Usage:
 *   bun src/tasks/audio/generate-clip-lines.ts --limit=50
 */

import { query } from '../../db/connection';
import {
  ensureAudioTask,
  startTask,
  completeTask,
  failTask,
} from '../../db/audio-tasks';
import { AudioTaskType } from '../../db/task-stages';
import { uploadToGrove } from '../../services/storage';

interface TrackWithClipBoundaries {
  spotify_track_id: string;
  title: string;
  primary_artist_name: string;
  clip_start_ms: number;
  clip_end_ms: number;
}

interface ClipLineStats {
  total_lines: number;
  fully_inside: number;
  starts_before: number;
  ends_after: number;
}

/**
 * Generate clip_lines table from karaoke_lines + karaoke_segments
 *
 * Boundary Logic:
 * - Include lines where: (line.start_ms < clip.end_ms AND line.end_ms > clip.start_ms)
 * - This captures:
 *   1. Lines fully inside clip
 *   2. Lines starting before clip but ending inside
 *   3. Lines starting inside but ending after
 * - Excludes only lines completely outside clip boundaries
 */
export async function generateClipLines(limit: number = 50): Promise<void> {
  console.log(`\n✂️  Audio Task: Generate Clip Lines (limit: ${limit})`);

  try {
    // Find tracks with:
    // 1. Completed 'segment' task (clip boundaries selected)
    // 2. karaoke_lines populated
    // 3. clip_lines NOT yet generated (or failed)
    const tracks = await query<TrackWithClipBoundaries>(
      `SELECT DISTINCT
        t.spotify_track_id,
        t.title,
        t.primary_artist_name,
        ks.clip_start_ms,
        ks.clip_end_ms
      FROM tracks t
      JOIN karaoke_segments ks ON t.spotify_track_id = ks.spotify_track_id
      JOIN karaoke_lines kl ON t.spotify_track_id = kl.spotify_track_id
      JOIN audio_tasks at_segment ON t.spotify_track_id = at_segment.spotify_track_id
        AND at_segment.task_type = 'segment'
        AND at_segment.status = 'completed'
      LEFT JOIN audio_tasks at_clip_lines ON t.spotify_track_id = at_clip_lines.spotify_track_id
        AND at_clip_lines.task_type = 'generate_clip_lines'
      WHERE
        ks.clip_start_ms IS NOT NULL
        AND ks.clip_end_ms IS NOT NULL
        AND (at_clip_lines.id IS NULL OR at_clip_lines.status IN ('pending', 'failed'))
      ORDER BY t.spotify_track_id
      LIMIT $1`,
      [limit]
    );

    if (tracks.length === 0) {
      console.log('✓ No tracks ready for clip_lines generation');
      return;
    }

    console.log(`Found ${tracks.length} tracks for clip_lines generation\n`);

    let successCount = 0;
    let failedCount = 0;
    let totalLinesInserted = 0;

    for (const track of tracks) {
      const { spotify_track_id, title, primary_artist_name, clip_start_ms, clip_end_ms } = track;
      const clipDurationSec = Math.round((clip_end_ms - clip_start_ms) / 1000);

      try {
        // Ensure task record exists
        await ensureAudioTask(spotify_track_id, AudioTaskType.GenerateClipLines);
        await startTask(spotify_track_id, AudioTaskType.GenerateClipLines);

        console.log(`📝 ${title} - ${primary_artist_name}`);
        console.log(`   Clip: ${clip_start_ms}ms → ${clip_end_ms}ms (${clipDurationSec}s)`);

        // Delete existing clip_lines (idempotent)
        await query(
          `DELETE FROM clip_lines WHERE spotify_track_id = $1`,
          [spotify_track_id]
        );

        // Insert clip lines with correct boundary logic
        // CRITICAL: Use overlap detection (start < clip_end AND end > clip_start)
        // NOT strict containment (start >= clip_start AND end <= clip_end)
        const result = await query<ClipLineStats>(
          `WITH filtered_lines AS (
            SELECT
              kl.line_id,
              kl.spotify_track_id,
              kl.line_index,
              kl.original_text,
              kl.normalized_text,
              kl.start_ms,
              kl.end_ms,
              kl.duration_ms,
              kl.word_timings,
              kl.segment_hash,
              -- Compute clip-relative index (0-based)
              ROW_NUMBER() OVER (ORDER BY kl.line_index) - 1 AS clip_line_index,
              -- Boundary flags
              (kl.start_ms < $2) AS starts_before_clip,
              (kl.end_ms > $3) AS ends_after_clip
            FROM karaoke_lines kl
            WHERE kl.spotify_track_id = $1
              -- Overlap detection: line overlaps clip if start < clip_end AND end > clip_start
              AND kl.start_ms < $3  -- Line starts before clip ends
              AND kl.end_ms > $2    -- Line ends after clip starts
            ORDER BY kl.line_index
          )
          INSERT INTO clip_lines (
            line_id,
            spotify_track_id,
            clip_start_ms,
            clip_end_ms,
            clip_line_index,
            original_line_index,
            original_text,
            normalized_text,
            start_ms,
            end_ms,
            duration_ms,
            clip_relative_start_ms,
            clip_relative_end_ms,
            word_timings,
            segment_hash,
            starts_before_clip,
            ends_after_clip
          )
          SELECT
            line_id,
            spotify_track_id,
            $2 AS clip_start_ms,
            $3 AS clip_end_ms,
            clip_line_index,
            line_index AS original_line_index,
            original_text,
            normalized_text,
            start_ms,
            end_ms,
            duration_ms,
            -- Clamp to clip boundaries for relative timing
            GREATEST(0, start_ms - $2) AS clip_relative_start_ms,
            LEAST(end_ms - $2, $3 - $2) AS clip_relative_end_ms,
            word_timings,
            segment_hash,
            starts_before_clip,
            ends_after_clip
          FROM filtered_lines
          RETURNING 1`,
          [spotify_track_id, clip_start_ms, clip_end_ms]
        );

        const insertedCount = result.length;
        totalLinesInserted += insertedCount;

        // Get stats for boundary edge cases
        const stats = await query<ClipLineStats>(
          `SELECT
            COUNT(*) as total_lines,
            COUNT(*) FILTER (WHERE NOT starts_before_clip AND NOT ends_after_clip) as fully_inside,
            COUNT(*) FILTER (WHERE starts_before_clip) as starts_before,
            COUNT(*) FILTER (WHERE ends_after_clip) as ends_after
          FROM clip_lines
          WHERE spotify_track_id = $1`,
          [spotify_track_id]
        );

        const { total_lines, fully_inside, starts_before, ends_after } = stats[0];

        console.log(`   ✓ Inserted ${insertedCount} clip lines`);
        console.log(`     - Fully inside: ${fully_inside}`);
        if (starts_before > 0) {
          console.log(`     - Starts before clip: ${starts_before}`);
        }
        if (ends_after > 0) {
          console.log(`     - Ends after clip: ${ends_after}`);
        }

        // Upload clip lyrics to Grove (for frontend access)
        console.log(`   📤 Uploading clip lyrics to Grove...`);
        const clipLyrics = await query<{
          clip_line_index: number;
          original_text: string;
          clip_relative_start_ms: number;
          clip_relative_end_ms: number;
          word_timings: any;
        }>(
          `SELECT
            clip_line_index,
            original_text,
            clip_relative_start_ms,
            clip_relative_end_ms,
            word_timings
          FROM clip_lines
          WHERE spotify_track_id = $1
          ORDER BY clip_line_index`,
          [spotify_track_id]
        );

        // Transform to Grove metadata format (compatible with frontend)
        const groveMetadata = {
          version: 'v2',
          type: 'clip_lyrics',
          spotify_track_id,
          clip_start_ms,
          clip_end_ms,
          line_count: clipLyrics.length,
          lines: clipLyrics.map((line) => ({
            lineIndex: line.clip_line_index,
            originalText: line.original_text,
            start: line.clip_relative_start_ms / 1000, // Convert to seconds
            end: line.clip_relative_end_ms / 1000,
            words: line.word_timings || [],
          })),
          generated_at: new Date().toISOString(),
        };

        const { cid, url } = await uploadToGrove(
          JSON.stringify(groveMetadata, null, 2),
          `clip-lyrics-${spotify_track_id}.json`
        );

        console.log(`   ✓ Uploaded to Grove: ${cid}`);

        // Store Grove URL in karaoke_segments
        await query(
          `UPDATE karaoke_segments
          SET clip_lyrics_grove_cid = $1,
              clip_lyrics_grove_url = $2,
              updated_at = NOW()
          WHERE spotify_track_id = $3`,
          [cid, url, spotify_track_id]
        );

        console.log(`   ✓ Updated karaoke_segments with Grove URL`);

        // Mark task as completed
        await completeTask(spotify_track_id, AudioTaskType.GenerateClipLines);
        successCount++;

      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        await failTask(
          spotify_track_id,
          AudioTaskType.GenerateClipLines,
          error.message
        );
        failedCount++;
      }
    }

    console.log(`\n✓ Complete: ${successCount} succeeded, ${failedCount} failed`);
    console.log(`  Total clip lines inserted: ${totalLinesInserted}`);

    // Global stats
    if (successCount > 0) {
      const globalStats = await query<{
        total_tracks: number;
        total_full_lines: number;
        total_clip_lines: number;
        clip_percentage: string;
      }>(
        `SELECT
          COUNT(DISTINCT cl.spotify_track_id) as total_tracks,
          (SELECT COUNT(*) FROM karaoke_lines WHERE spotify_track_id IN (SELECT DISTINCT spotify_track_id FROM clip_lines)) as total_full_lines,
          COUNT(cl.line_id) as total_clip_lines,
          ROUND(100.0 * COUNT(cl.line_id) / (SELECT COUNT(*) FROM karaoke_lines WHERE spotify_track_id IN (SELECT DISTINCT spotify_track_id FROM clip_lines)), 1) as clip_percentage
        FROM clip_lines cl`
      );

      const { total_tracks, total_full_lines, total_clip_lines, clip_percentage } = globalStats[0];
      console.log(`\n📊 Global Stats:`);
      console.log(`  - Tracks with clip lines: ${total_tracks}`);
      console.log(`  - Full song lines: ${total_full_lines}`);
      console.log(`  - Clip lines: ${total_clip_lines}`);
      console.log(`  - Clip coverage: ${clip_percentage}%`);
    }

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

  console.log(`🚀 Starting clip lines generation (limit: ${limit})\n`);

  generateClipLines(limit)
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error);
      process.exit(1);
    });
}
