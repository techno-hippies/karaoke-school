/**
 * Audio Task: Segment Selection (Hybrid: Deterministic + AI Fallback)
 *
 * Primary: Uses normalized_lyrics section breaks to deterministically select
 * the first 40-100s viral clip (verse+chorus).
 *
 * Fallback: If normalized_lyrics has insufficient breaks (≤2 sections),
 * uses Gemini 2.5 Flash to identify song structure and select
 * first verse + extended chorus (includes consecutive chorus/pre-chorus).
 *
 * Data Sources:
 * - song_lyrics.normalized_lyrics: Text content with section breaks (double newlines)
 * - karaoke_lines: ElevenLabs word-level timestamps (start_ms, end_ms, original_text)
 *
 * Algorithm:
 * 1. Split normalized_lyrics by double newlines (\n\n) → sections
 * 2. If ≤2 sections → trigger AI structure analysis (fallback)
 * 3. Otherwise: accumulate sections from start until 40-100s
 * 4. Match accumulated text to karaoke_lines to find exact ms boundaries
 * 5. Store clip_start_ms / clip_end_ms in karaoke_segments
 *
 * AI Fallback (Extended Chorus Selection):
 * - Identifies structure: intro/verse/pre-chorus/chorus/bridge/outro
 * - Selects first verse start → extends through consecutive chorus/pre-chorus
 * - Stops at: first verse/bridge/outro OR 100s limit
 * - Ensures complete repeated choruses captured (e.g., double chorus patterns)
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
 * AI Fallback: Use Gemini to identify song structure when breaks are insufficient
 */
async function identifySongStructure(
  lines: KaraokeLineStructure[],
  openRouterKey: string
): Promise<SongStructure> {
  const lyricsWithIndex = lines.map((l) =>
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
 * Select segment from AI-identified structure: first verse + chorus sections
 * Extends through consecutive chorus/pre-chorus patterns until hitting verse/bridge/outro
 */
function selectSegmentFromStructure(
  structure: SongStructure,
  lines: KaraokeLineStructure[]
): { start_ms: number; end_ms: number; duration_ms: number } {
  const firstVerse = structure.sections.find(s => s.type === 'verse');
  const firstChorusIndex = structure.sections.findIndex(s => s.type === 'chorus');

  if (!firstVerse || firstChorusIndex === -1) {
    throw new Error('Song must have at least one verse and one chorus');
  }

  const startLine = lines[firstVerse.start_line];
  if (!startLine) {
    throw new Error(`Invalid verse start line: ${firstVerse.start_line}`);
  }

  // Extend through consecutive chorus/pre-chorus sections until we hit verse/bridge/outro or 100s limit
  let endSectionIndex = firstChorusIndex;
  for (let i = firstChorusIndex + 1; i < structure.sections.length; i++) {
    const section = structure.sections[i];

    // Stop if we hit verse, bridge, or outro
    if (section.type === 'verse' || section.type === 'bridge' || section.type === 'outro') {
      break;
    }

    // Continue through chorus and pre-chorus
    if (section.type === 'chorus' || section.type === 'pre-chorus') {
      const potentialEndLine = lines[section.end_line];
      if (!potentialEndLine) continue;

      const potentialDuration = potentialEndLine.end_ms - startLine.start_ms;

      // Stop if we'd exceed 100s
      if (potentialDuration > 100000) {
        break;
      }

      endSectionIndex = i;
    }
  }

  const endLine = lines[structure.sections[endSectionIndex].end_line];
  if (!endLine) {
    throw new Error(`Invalid end line: ${structure.sections[endSectionIndex].end_line}`);
  }

  const start_ms = startLine.start_ms;
  const end_ms = endLine.end_ms;
  const duration_ms = end_ms - start_ms;

  if (duration_ms < 40000) {
    throw new Error(`Segment too short: ${(duration_ms / 1000).toFixed(1)}s (minimum 40s)`);
  }

  return { start_ms, end_ms, duration_ms };
}

/**
 * Match accumulated text back to karaoke_lines to get timestamps
 */
function findSegmentBoundaries(
  accumulatedText: string,
  lines: KaraokeLineStructure[]
): { start_ms: number; end_ms: number; duration_ms: number } | null {
  // Normalize accumulated text for matching
  const normalizedAccumulated = accumulatedText
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();

  // Build full lyrics from lines
  const fullLyrics = lines.map(l =>
    l.original_text.toLowerCase().replace(/[^\w\s]/g, '').trim()
  );

  // Find where accumulated text ends in the line sequence
  let accumulatedWords = normalizedAccumulated.split(/\s+/);
  let matchedLines = 0;
  let wordCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineWords = fullLyrics[i].split(/\s+/).filter(w => w.length > 0);
    wordCount += lineWords.length;
    matchedLines = i;

    // Check if we've matched all accumulated words
    if (wordCount >= accumulatedWords.length * 0.9) { // 90% match threshold
      break;
    }
  }

  if (matchedLines === 0) {
    return null;
  }

  let start_ms = lines[0].start_ms;
  const end_ms = lines[matchedLines].end_ms;

  // If first lyrics start within first 15s, start at 0 (include intro)
  if (start_ms < 15000) {
    start_ms = 0;
  }

  const duration_ms = end_ms - start_ms;

  return { start_ms, end_ms, duration_ms };
}

/**
 * Select segment deterministically using normalized_lyrics breaks
 */
function selectSegmentFromBreaks(
  normalizedLyrics: string,
  lines: KaraokeLineStructure[]
): { start_ms: number; end_ms: number; duration_ms: number } | null {
  // Split by double newlines to get sections
  const sections = normalizedLyrics
    .split('\n\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sections.length === 0) {
    throw new Error('No sections found in normalized lyrics');
  }

  console.log(`   Sections found: ${sections.length}`);

  // If only 1-2 sections, normalized lyrics don't have good breaks
  // Return null to trigger AI fallback
  if (sections.length <= 2) {
    console.log(`   ⚠️  Too few sections (${sections.length}) - need AI to identify structure`);
    return null;
  }

  // Accumulate sections until we reach 40-100s range
  let accumulated = '';
  let bestMatch: { start_ms: number; end_ms: number; duration_ms: number } | null = null;

  for (let i = 0; i < sections.length; i++) {
    accumulated += (accumulated ? '\n\n' : '') + sections[i];

    const match = findSegmentBoundaries(accumulated, lines);
    if (!match) continue;

    console.log(`   Section ${i + 1}: ${(match.duration_ms / 1000).toFixed(1)}s`);

    // If we're in the 40-100s range, we're done
    if (match.duration_ms >= 40000 && match.duration_ms <= 100000) {
      bestMatch = match;
      console.log(`   ✓ Found segment in range at section ${i + 1}`);
      break;
    }

    // If we've exceeded 100s, use previous section
    if (match.duration_ms > 100000) {
      if (bestMatch && bestMatch.duration_ms >= 40000) {
        console.log(`   ✓ Using previous section (current exceeds 100s)`);
        break;
      }
      // If we don't have a valid previous, use this one anyway
      bestMatch = match;
      break;
    }

    // Keep accumulating
    bestMatch = match;
  }

  if (!bestMatch) {
    throw new Error('Could not find valid segment boundaries');
  }

  // Final validation
  if (bestMatch.duration_ms < 40000) {
    throw new Error(`Segment too short: ${(bestMatch.duration_ms / 1000).toFixed(1)}s (minimum 40s)`);
  }

  if (bestMatch.duration_ms > 100000) {
    console.log(`   ⚠️  Segment exceeds 100s (${(bestMatch.duration_ms / 1000).toFixed(1)}s) but using anyway`);
  }

  return bestMatch;
}

/**
 * Process segment selection for tracks
 */
export async function processSimpleSegmentSelection(limit: number = 10): Promise<void> {
  console.log(`\n🎯 Audio Task: Segment Selection [Simple/Deterministic + AI Fallback] (limit: ${limit})`);

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) {
    throw new Error('OPENROUTER_API_KEY not found in environment');
  }

  try {
    // Find tracks ready for segment selection
    const tracks = await query<{
      spotify_track_id: string;
      title: string;
      artists: any;
      duration_ms: number;
      normalized_lyrics: string;
    }>(
      `SELECT DISTINCT
        t.spotify_track_id,
        t.title,
        t.artists,
        sa.duration_ms,
        sl.normalized_lyrics,
        t.created_at
      FROM tracks t
      JOIN audio_tasks at_sep ON t.spotify_track_id = at_sep.spotify_track_id
      JOIN audio_tasks at_align ON t.spotify_track_id = at_align.spotify_track_id
      JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
      JOIN song_lyrics sl ON t.spotify_track_id = sl.spotify_track_id
      JOIN karaoke_lines kl ON t.spotify_track_id = kl.spotify_track_id
      LEFT JOIN audio_tasks at_seg ON t.spotify_track_id = at_seg.spotify_track_id
        AND at_seg.task_type = 'segment'
      WHERE at_sep.task_type = 'separate'
        AND at_sep.status = 'completed'
        AND at_align.task_type = 'align'
        AND at_align.status = 'completed'
        AND sl.normalized_lyrics IS NOT NULL
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
        console.log(`📍 ${track.title} - ${JSON.stringify(track.artists)}`);
        console.log(`   Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

        await ensureAudioTask(track.spotify_track_id, 'segment');
        await startTask(track.spotify_track_id, 'segment');

        // Get karaoke lines
        const lines = await query<KaraokeLineStructure>(
          `SELECT line_index, start_ms, end_ms, original_text
           FROM karaoke_lines
           WHERE spotify_track_id = $1
           ORDER BY line_index`,
          [track.spotify_track_id]
        );

        if (lines.length === 0) {
          throw new Error('No karaoke lines found');
        }

        console.log(`   Lines: ${lines.length}`);

        // Try simple method first (using normalized_lyrics breaks)
        let selection = selectSegmentFromBreaks(track.normalized_lyrics, lines);

        // Fallback to AI structure analysis if needed
        if (!selection) {
          console.log(`   🤖 Using AI to identify song structure...`);
          const structure = await identifySongStructure(lines, openRouterKey);
          console.log(`   ✓ Structure: ${structure.sections.map(s => s.type).join(' → ')}`);
          console.log(`   Selecting first verse + first chorus...`);
          selection = selectSegmentFromStructure(structure, lines);
        }

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
            method: 'simple/deterministic'
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

  processSimpleSegmentSelection(limit)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
