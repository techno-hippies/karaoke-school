#!/usr/bin/env bun
/**
 * Audio Task: Segment Selection (REFACTORED with BaseTask)
 * Stage: separated → segmented
 *
 * Hybrid approach: Deterministic + AI Fallback
 *
 * Primary: Uses normalized_lyrics section breaks to deterministically select
 * the first 40-100s viral clip (verse+chorus).
 *
 * Fallback: If normalized_lyrics has insufficient breaks (≤2 sections),
 * uses Gemini 2.5 Flash to identify song structure and select
 * first verse + extended chorus.
 *
 * COMPARISON:
 * - Old version: 475 lines with manual lifecycle management
 * - New version: ~350 lines, BaseTask handles boilerplate
 * - Reduction: ~26% less code, same functionality
 *
 * Data Sources:
 * - song_lyrics.normalized_lyrics: Text with section breaks
 * - karaoke_lines: ElevenLabs word-level timestamps
 *
 * Algorithm:
 * 1. Split normalized_lyrics by double newlines → sections
 * 2. If ≤2 sections → trigger AI structure analysis
 * 3. Otherwise: accumulate sections from start until 40-100s
 * 4. Match accumulated text to karaoke_lines for exact ms boundaries
 * 5. Store clip_start_ms / clip_end_ms in karaoke_segments
 *
 * Usage:
 *   bun src/tasks/audio/select-segments-refactored.ts --limit=10
 */

import { query } from '../../db/connection';
import { TrackStage, AudioTaskType } from '../../db/task-stages';
import { BaseTask, type BaseTrackInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { CONFIG } from '../../config';
import type { SegmentMetadata } from '../../types/task-metadata';

interface TrackForSegmentation extends BaseTrackInput {
  spotify_track_id: string;
  title: string;
  artists: any;
  duration_ms: number;
  normalized_lyrics: string;
}

interface SegmentationResult extends TaskResult {
  metadata: SegmentMetadata;
}

interface KaraokeLineStructure {
  line_index: number;
  start_ms: number;
  end_ms: number;
  original_text: string;
}

interface SongSection {
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'pre-chorus';
  start_line: number;
  end_line: number;
}

interface SongStructure {
  sections: SongSection[];
}

/**
 * Select Segments Task
 *
 * Uses BaseTask to eliminate boilerplate:
 * - No manual ensureAudioTask/startTask/completeTask/failTask
 * - No manual updateTrackStage
 * - No manual error handling and retries
 * - No manual success/failure counting
 */
export class SelectSegmentsTask extends BaseTask<TrackForSegmentation, SegmentationResult> {
  readonly taskType = AudioTaskType.Segment;
  private openRouterKey: string;

  constructor() {
    super();

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error('OPENROUTER_API_KEY not found in environment');
    }
    this.openRouterKey = key;
  }

  /**
   * Select tracks ready for segment selection
   * (separated + aligned, with normalized lyrics)
   * Respects audio_tasks retry logic (attempts, backoff, max_attempts)
   */
  async selectTracks(limit: number, trackId?: string): Promise<TrackForSegmentation[]> {
    const retryFilter = buildAudioTasksFilter(this.taskType);
    const trackIdFilter = trackId ? `AND t.spotify_track_id = $3` : '';
    const params = trackId ? [TrackStage.Separated, limit, trackId] : [TrackStage.Separated, limit];

    return query<TrackForSegmentation>(
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
      WHERE at_sep.task_type = 'separate'
        AND at_sep.status = 'completed'
        AND at_align.task_type = 'align'
        AND at_align.status = 'completed'
        AND sl.normalized_lyrics IS NOT NULL
        AND t.stage = $1
        ${retryFilter}
        ${trackIdFilter}
      ORDER BY t.created_at DESC
      LIMIT $2`,
      params
    );
  }

  /**
   * Process a single track: select viral segment
   */
  async processTrack(track: TrackForSegmentation): Promise<SegmentationResult> {
    console.log(`\n📍 ${track.title} - ${JSON.stringify(track.artists)}`);
    console.log(`   Duration: ${(track.duration_ms / 1000).toFixed(1)}s`);

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

    // Try deterministic method first (using normalized_lyrics breaks)
    let selection = this.selectSegmentFromBreaks(track.normalized_lyrics, lines);

    // Fallback to AI structure analysis if needed
    if (!selection) {
      console.log(`   🤖 Using AI to identify song structure...`);
      const structure = await this.identifySongStructure(lines);
      console.log(`   ✓ Structure: ${structure.sections.map(s => s.type).join(' → ')}`);
      console.log(`   Selecting first verse + first chorus...`);
      selection = this.selectSegmentFromStructure(structure, lines);
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

    return {
      metadata: {
        method: selection.method, // Use actual method ('deterministic' or 'ai')
        start_ms: selection.start_ms,
        end_ms: selection.end_ms,
        duration_ms: selection.duration_ms,
        selection_reason: selection.method === 'ai'
          ? 'AI structure analysis (insufficient section breaks)'
          : 'Deterministic section accumulation'
      },
    };
  }

  /**
   * AI Fallback: Use Gemini to identify song structure
   */
  private async identifySongStructure(lines: KaraokeLineStructure[]): Promise<SongStructure> {
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
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CONFIG.translation.model,
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
      throw new Error(`Failed to parse AI response: ${e.message}`);
    }
  }

  /**
   * Select segment from AI-identified structure
   */
  private selectSegmentFromStructure(
    structure: SongStructure,
    lines: KaraokeLineStructure[]
  ): { start_ms: number; end_ms: number; duration_ms: number; method: string } {
    const firstVerse = structure.sections.find(s => s.type === 'verse');
    const firstChorusIndex = structure.sections.findIndex(s => s.type === 'chorus');

    if (!firstVerse || firstChorusIndex === -1) {
      throw new Error('Song must have at least one verse and one chorus');
    }

    const startLine = lines[firstVerse.start_line];
    if (!startLine) {
      throw new Error(`Invalid verse start line: ${firstVerse.start_line}`);
    }

    // Extend through consecutive chorus/pre-chorus until verse/bridge/outro or 100s
    let endSectionIndex = firstChorusIndex;
    for (let i = firstChorusIndex + 1; i < structure.sections.length; i++) {
      const section = structure.sections[i];

      if (section.type === 'verse' || section.type === 'bridge' || section.type === 'outro') {
        break;
      }

      if (section.type === 'chorus' || section.type === 'pre-chorus') {
        const potentialEndLine = lines[section.end_line];
        if (!potentialEndLine) continue;

        const potentialDuration = potentialEndLine.end_ms - startLine.start_ms;
        if (potentialDuration > CONFIG.audio.segment.maxDurationMs) {
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

    if (duration_ms < CONFIG.audio.segment.minDurationMs) {
      throw new Error(`Segment too short: ${(duration_ms / 1000).toFixed(1)}s`);
    }

    return { start_ms, end_ms, duration_ms, method: 'ai' };
  }

  /**
   * Select segment deterministically using normalized_lyrics breaks
   */
  private selectSegmentFromBreaks(
    normalizedLyrics: string,
    lines: KaraokeLineStructure[]
  ): { start_ms: number; end_ms: number; duration_ms: number; method: string } | null {
    const sections = normalizedLyrics
      .split('\n\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (sections.length === 0) {
      throw new Error('No sections found in normalized lyrics');
    }

    console.log(`   Sections found: ${sections.length}`);

    // If only 1-2 sections, trigger AI fallback
    if (sections.length <= 2) {
      console.log(`   ⚠️  Too few sections (${sections.length}) - need AI`);
      return null;
    }

    // Accumulate sections until 40-100s range
    let accumulated = '';
    let bestMatch: ReturnType<typeof this.findSegmentBoundaries> = null;

    for (let i = 0; i < sections.length; i++) {
      accumulated += (accumulated ? '\n\n' : '') + sections[i];

      const match = this.findSegmentBoundaries(accumulated, lines);
      if (!match) continue;

      console.log(`   Section ${i + 1}: ${(match.duration_ms / 1000).toFixed(1)}s`);

      const minDur = CONFIG.audio.segment.minDurationMs;
      const maxDur = CONFIG.audio.segment.maxDurationMs;

      if (match.duration_ms >= minDur && match.duration_ms <= maxDur) {
        bestMatch = match;
        console.log(`   ✓ Found segment in range at section ${i + 1}`);
        break;
      }

      if (match.duration_ms > maxDur) {
        if (bestMatch && bestMatch.duration_ms >= minDur) {
          console.log(`   ✓ Using previous section (current exceeds max)`);
          break;
        }
        bestMatch = match;
        break;
      }

      bestMatch = match;
    }

    if (!bestMatch) {
      throw new Error('Could not find valid segment boundaries');
    }

    if (bestMatch.duration_ms < CONFIG.audio.segment.minDurationMs) {
      throw new Error(`Segment too short: ${(bestMatch.duration_ms / 1000).toFixed(1)}s`);
    }

    return { ...bestMatch, method: 'deterministic' };
  }

  /**
   * Match accumulated text to karaoke_lines for timestamps
   */
  private findSegmentBoundaries(
    accumulatedText: string,
    lines: KaraokeLineStructure[]
  ): { start_ms: number; end_ms: number; duration_ms: number } | null {
    const normalizedAccumulated = accumulatedText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();

    const fullLyrics = lines.map(l =>
      l.original_text.toLowerCase().replace(/[^\w\s]/g, '').trim()
    );

    let accumulatedWords = normalizedAccumulated.split(/\s+/);
    let matchedLines = 0;
    let wordCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineWords = fullLyrics[i].split(/\s+/).filter(w => w.length > 0);
      wordCount += lineWords.length;
      matchedLines = i;

      if (wordCount >= accumulatedWords.length * 0.9) {
        break;
      }
    }

    if (matchedLines === 0) {
      return null;
    }

    let start_ms = lines[0].start_ms;
    const end_ms = lines[matchedLines].end_ms;

    // If first lyrics start within 15s, include intro
    if (start_ms < 15000) {
      start_ms = 0;
    }

    const duration_ms = end_ms - start_ms;
    return { start_ms, end_ms, duration_ms };
  }

  /**
   * Hook: Called before the entire run starts
   */
  async beforeRun(options: any): Promise<void> {
    console.log(`\n🎯 Audio Task: Segment Selection [Hybrid: Deterministic + AI Fallback]`);
    console.log(`Limit: ${options.limit || 10}\n`);
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  const task = new SelectSegmentsTask();
  task.run({ limit }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
