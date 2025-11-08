/**
 * Audio Task: Segment Selection
 *
 * Uses Gemini Flash 2.5 Lite to analyze song structure and select
 * the most prominent verse+chorus segment (40-100s) for viral clips.
 *
 * Stores clip boundaries only - no file operations, no wasteful explanations.
 *
 * Flow:
 * 1. Query karaoke_lines for line-level structure
 * 2. AI selects best 40-100s segment (verse+chorus)
 * 3. Store clip_start_ms / clip_end_ms in karaoke_segments
 * 4. Mark segment task complete
 */

import { query } from '../../db/connection';
import {
  ensureAudioTask,
  startTask,
  completeTask,
  failTask,
  updateTrackStage
} from '../../db/audio-tasks';

interface KaraokeLineStructure {
  line_index: number;
  start_ms: number;
  end_ms: number;
  original_text: string;
  duration_ms: number;
}

interface SegmentSelection {
  start_ms: number;
  end_ms: number;
  duration_ms: number;
}

/**
 * Use Gemini Flash 2.5 Lite to select best segment
 */
async function selectSegmentWithAI(
  lines: KaraokeLineStructure[],
  openRouterKey: string
): Promise<SegmentSelection> {
  const totalDurationMs = lines[lines.length - 1].end_ms;

  // Show lyrics with timing so AI can understand structure
  const lyricsWithTimestamps = lines.map(l =>
    `[${(l.start_ms / 1000).toFixed(1)}s-${(l.end_ms / 1000).toFixed(1)}s] ${l.original_text}`
  ).join('\n');

  const prompt = `Select the MOST VIRAL 40-100 second segment from this song for TikTok/social media.

REQUIREMENTS:
- Duration: 40-100 seconds
- Pick the most recognizable, singable, catchy part of the song
- Complete musical phrase (must end at natural break, not mid-line)
- This will be used for karaoke, so pick the part people most want to sing

GOOD segments include:
- The main hook/chorus if it's the most iconic part
- Opening verse + first chorus if that's what people know
- Any continuous section that would make people go "oh I know this part!"

BAD segments:
- Random middle sections
- Ending mid-phrase or mid-word
- Skipping the most recognizable parts

Lyrics with timing (${lines.length} lines, ${(totalDurationMs / 1000).toFixed(1)}s total):

${lyricsWithTimestamps}

Return ONLY JSON with exact start/end millisecond times:
{"start_ms": <number>, "end_ms": <number>}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',  // Same as openrouter.ts
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API failed: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content.trim();

  // Parse AI response
  let selection: any;
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    selection = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    throw new Error(`Failed to parse AI response: ${e.message}`);
  }

  const durationMs = selection.end_ms - selection.start_ms;

  // Validate maximum (we'll handle minimum with failsafe below)
  if (durationMs > 100000) {
    throw new Error(`Segment too long: ${(durationMs / 1000).toFixed(1)}s (maximum 100s)`);
  }

  // Snap to line boundaries (allow 5s tolerance for AI imprecision)
  let startLine = lines.find(l => Math.abs(l.start_ms - selection.start_ms) < 5000);
  let endLine = lines.find(l => Math.abs(l.end_ms - selection.end_ms) < 5000);

  if (!startLine || !endLine) {
    console.log(`   AI selected: ${selection.start_ms}ms - ${selection.end_ms}ms`);
    console.log(`   Available line boundaries: ${lines.map(l => `${l.start_ms}-${l.end_ms}`).join(', ')}`);
    throw new Error('AI selected times do not align with line boundaries');
  }

  let duration_ms = endLine.end_ms - startLine.start_ms;

  // Minimal failsafe: Only expand if very close to 40s (38-40s range)
  // This should rarely trigger if the AI has proper lyrics context
  if (duration_ms < 40000 && duration_ms >= 38000) {
    console.log(`   ⚠️  AI selected ${(duration_ms / 1000).toFixed(1)}s (close to 40s), expanding slightly...`);

    const startIndex = lines.findIndex(l => l.line_index === startLine.line_index);
    const endIndex = lines.findIndex(l => l.line_index === endLine.line_index);

    // Just add 1-2 lines to reach 40s
    let newEndIndex = endIndex;
    while (newEndIndex < lines.length - 1 && duration_ms < 40000) {
      newEndIndex++;
      duration_ms = lines[newEndIndex].end_ms - startLine.start_ms;
    }

    endLine = lines[newEndIndex];
    duration_ms = endLine.end_ms - startLine.start_ms;

    console.log(`   ✓ Expanded to ${(duration_ms / 1000).toFixed(1)}s (added ${newEndIndex - endIndex} lines)`);
  } else if (duration_ms < 38000) {
    // If significantly under 40s, this is an AI error - fail and let it retry
    throw new Error(`Segment too short: ${(duration_ms / 1000).toFixed(1)}s (minimum 40s) - AI should select a longer verse+chorus section`);
  }

  return {
    start_ms: startLine.start_ms,
    end_ms: endLine.end_ms,
    duration_ms
  };
}

/**
 * Process segment selection for tracks
 */
export async function processSegmentSelection(limit: number = 10): Promise<void> {
  console.log(`\n🎯 Audio Task: Segment Selection (limit: ${limit})`);

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    console.log('⚠️  OPENROUTER_API_KEY not configured');
    return;
  }

  console.log('   AI: Gemini Flash 2.5 Lite');

  try {
    // Find tracks ready for segment selection
    // Must have: separated audio + word alignments + karaoke_lines
    const tracks = await query<{
      spotify_track_id: string;
      title: string;
      artists: string;
      duration_ms: number;
    }>(
      `SELECT DISTINCT
        t.spotify_track_id,
        t.title,
        t.artists,
        sa.duration_ms,
        t.created_at
      FROM tracks t
      JOIN audio_tasks at_sep ON t.spotify_track_id = at_sep.spotify_track_id
      JOIN audio_tasks at_align ON t.spotify_track_id = at_align.spotify_track_id
      JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
      JOIN karaoke_lines kl ON t.spotify_track_id = kl.spotify_track_id
      LEFT JOIN audio_tasks at_seg ON t.spotify_track_id = at_seg.spotify_track_id
        AND at_seg.task_type = 'segment'
      WHERE at_sep.task_type = 'separate'
        AND at_sep.status = 'completed'
        AND at_align.task_type = 'align'
        AND at_align.status = 'completed'
        AND (at_seg.id IS NULL OR at_seg.status = 'pending')
      ORDER BY t.created_at DESC
      LIMIT $1`,
      [limit]
    );

    if (tracks.length === 0) {
      console.log('✓ No tracks ready for segment selection');
      return;
    }

    console.log(`Found ${tracks.length} tracks ready\n`);

    let successCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      const startTime = Date.now();

      try {
        console.log(`📍 ${track.title} - ${track.artists}`);
        console.log(`   Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

        // Ensure task record exists
        await ensureAudioTask(track.spotify_track_id, 'segment');
        await startTask(track.spotify_track_id, 'segment');

        // Get karaoke lines structure
        const lines = await query<KaraokeLineStructure>(
          `SELECT line_index, start_ms, end_ms, original_text,
                  (end_ms - start_ms) as duration_ms
           FROM karaoke_lines
           WHERE spotify_track_id = $1
           ORDER BY line_index`,
          [track.spotify_track_id]
        );

        if (lines.length === 0) {
          throw new Error('No karaoke lines found');
        }

        console.log(`   Lines: ${lines.length}`);

        // AI selects best segment
        console.log(`   AI analyzing structure...`);
        const selection = await selectSegmentWithAI(lines, openRouterKey);

        console.log(`   ✓ Selected: ${(selection.start_ms / 1000).toFixed(1)}s - ${(selection.end_ms / 1000).toFixed(1)}s (${(selection.duration_ms / 1000).toFixed(1)}s)`);

        // Ensure karaoke_segments record exists and update
        await query(
          `INSERT INTO karaoke_segments (
            spotify_track_id,
            clip_start_ms,
            clip_end_ms
          ) VALUES ($1, $2, $3)
          ON CONFLICT (spotify_track_id)
          DO UPDATE SET
            clip_start_ms = $2,
            clip_end_ms = $3,
            updated_at = NOW()`,
          [track.spotify_track_id, selection.start_ms, selection.end_ms]
        );

        // Complete task
        const processingTime = Date.now() - startTime;
        await completeTask(track.spotify_track_id, 'segment', {
          metadata: {
            clip_start_ms: selection.start_ms,
            clip_end_ms: selection.end_ms,
            clip_duration_ms: selection.duration_ms
          },
          duration_ms: processingTime
        });

        // Update track stage
        await updateTrackStage(track.spotify_track_id);

        console.log(`   ✓ Completed (${(processingTime / 1000).toFixed(1)}s)\n`);
        successCount++;

      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);

        await failTask(
          track.spotify_track_id,
          'segment',
          error.message,
          { stack: error.stack }
        );

        failedCount++;
      }
    }

    console.log(`\n✓ Segment selection complete: ${successCount} succeeded, ${failedCount} failed`);

  } catch (error: any) {
    console.error(`Fatal error: ${error.message}`);
    throw error;
  }
}

// CLI execution
if (import.meta.main) {
  // Parse --limit=N or second arg
  let limit = 10;
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1]);
  } else if (process.argv[2] && !process.argv[2].startsWith('--')) {
    limit = parseInt(process.argv[2]);
  }

  processSegmentSelection(limit)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
