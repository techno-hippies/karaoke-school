/**
 * Audio Task: Segment Selection (Structure-Based)
 *
 * Uses AI to identify song structure (intro/verse/chorus/bridge/outro),
 * then deterministically picks first verse + first chorus.
 *
 * Flow:
 * 1. Query karaoke_lines for line-level lyrics
 * 2. AI labels song structure sections
 * 3. Pick first verse + first chorus (40-100s)
 * 4. Store clip_start_ms / clip_end_ms in karaoke_segments
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

interface SongSection {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro';
  start_line: number;
  end_line: number;
}

interface SongStructure {
  sections: SongSection[];
}

/**
 * Use AI to identify song structure
 */
async function identifySongStructure(
  lines: KaraokeLineStructure[],
  openRouterKey: string
): Promise<SongStructure> {
  const lyricsWithIndex = lines.map((l, i) =>
    `Line ${l.line_index}: ${l.original_text}`
  ).join('\n');

  const prompt = `Analyze this song's structure and label each section.

Identify these section types:
- intro: Instrumental opening or pre-verse lines
- verse: Story/narrative sections
- chorus: Repeated hook/main message
- bridge: Contrasting middle section
- outro: Ending section

Song lyrics (${lines.length} lines):

${lyricsWithIndex}

Return JSON array of sections with line ranges:
{
  "sections": [
    {"type": "intro", "start_line": 0, "end_line": 2},
    {"type": "verse", "start_line": 3, "end_line": 10},
    {"type": "chorus", "start_line": 11, "end_line": 18},
    ...
  ]
}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-preview-09-2025',
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
  try {
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    throw new Error(`Failed to parse AI response: ${e.message}\nResponse: ${aiResponse}`);
  }
}

/**
 * Select segment based on structure: first verse + first chorus
 */
function selectSegmentFromStructure(
  structure: SongStructure,
  lines: KaraokeLineStructure[]
): { start_ms: number; end_ms: number; duration_ms: number } {
  const firstVerse = structure.sections.find(s => s.type === 'verse');
  const firstChorus = structure.sections.find(s => s.type === 'chorus');

  if (!firstVerse || !firstChorus) {
    throw new Error('Song must have at least one verse and one chorus');
  }

  // Get timing from lines
  const startLine = lines[firstVerse.start_line];
  const endLine = lines[firstChorus.end_line];

  if (!startLine || !endLine) {
    throw new Error(`Invalid line indices: verse ${firstVerse.start_line}, chorus ${firstChorus.end_line}`);
  }

  const start_ms = startLine.start_ms;
  const end_ms = endLine.end_ms;
  const duration_ms = end_ms - start_ms;

  // Validate duration
  if (duration_ms < 40000) {
    throw new Error(`Segment too short: ${(duration_ms / 1000).toFixed(1)}s (minimum 40s)`);
  }

  if (duration_ms > 100000) {
    throw new Error(`Segment too long: ${(duration_ms / 1000).toFixed(1)}s (maximum 100s)`);
  }

  return { start_ms, end_ms, duration_ms };
}

/**
 * Process segment selection for tracks
 */
export async function processStructuredSegmentSelection(limit: number = 10): Promise<void> {
  console.log(`\n🎯 Audio Task: Segment Selection [Structure-Based] (limit: ${limit})`);

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment');
  }

  try {
    // Find tracks ready for segmentation
    const tracks = await query<any>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        sa.duration_ms,
        t.created_at
      FROM tracks t
      JOIN audio_tasks at_sep ON t.spotify_track_id = at_sep.spotify_track_id
        AND at_sep.task_type = 'separate'
        AND at_sep.status = 'completed'
      JOIN audio_tasks at_align ON t.spotify_track_id = at_align.spotify_track_id
        AND at_align.task_type = 'align'
        AND at_align.status = 'completed'
      JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
      JOIN karaoke_lines kl ON t.spotify_track_id = kl.spotify_track_id
      LEFT JOIN audio_tasks at_seg ON t.spotify_track_id = at_seg.spotify_track_id
        AND at_seg.task_type = 'segment'
      WHERE (at_seg.id IS NULL OR at_seg.status = 'pending')
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

        await ensureAudioTask(track.spotify_track_id, 'segment');
        await startTask(track.spotify_track_id, 'segment');

        // Get karaoke lines
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

        // Step 1: AI identifies structure
        console.log(`   AI analyzing structure...`);
        const structure = await identifySongStructure(lines, openRouterKey);

        console.log(`   ✓ Structure: ${structure.sections.map(s => s.type).join(' → ')}`);

        // Step 2: Deterministically pick first verse + first chorus
        console.log(`   Selecting first verse + first chorus...`);
        const selection = selectSegmentFromStructure(structure, lines);

        console.log(`   ✓ Selected: ${(selection.start_ms / 1000).toFixed(1)}s - ${(selection.end_ms / 1000).toFixed(1)}s (${(selection.duration_ms / 1000).toFixed(1)}s)`);

        // Store in karaoke_segments
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
            clip_duration_ms: selection.duration_ms,
            structure: structure.sections
          },
          duration_ms: processingTime
        });

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
  let limit = 10;
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  if (limitArg) {
    limit = parseInt(limitArg.split('=')[1]);
  } else if (process.argv[2] && !process.argv[2].startsWith('--')) {
    limit = parseInt(process.argv[2]);
  }

  processStructuredSegmentSelection(limit)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
