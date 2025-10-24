/**
 * Segment Selector Service
 *
 * Uses Gemini Flash 2.5 Lite to intelligently select the most iconic
 * 20-40 second segment from song lyrics.
 */

import { OpenRouterService } from './openrouter.js';

export interface SegmentSelection {
  startTime: number;
  endTime: number;
  duration: number;
  reason: string;
  selectedText?: string;
}

export class SegmentSelectorService {
  private openRouter: OpenRouterService;

  constructor() {
    this.openRouter = new OpenRouterService();
  }

  /**
   * Select the most iconic segment from synced lyrics
   *
   * @param syncedLyrics LRC format lyrics with timestamps
   * @param songTitle Song title for context
   * @param artistName Artist name for context
   * @param duration Total song duration in seconds
   * @param targetDuration Target segment length (default: 30s)
   * @returns Selected segment with timestamps
   */
  async selectIconicSegment(
    syncedLyrics: string,
    songTitle: string,
    artistName: string,
    duration: number,
    targetDuration: number = 30
  ): Promise<SegmentSelection> {
    console.log(`[SegmentSelector] Analyzing: ${songTitle} by ${artistName}`);
    console.log(`[SegmentSelector] Target duration: ${targetDuration}s`);

    // Parse synced lyrics to extract timestamps and text
    const lines = this.parseSyncedLyrics(syncedLyrics);

    if (lines.length === 0) {
      throw new Error('No valid lyrics found in synced lyrics');
    }

    console.log(`[SegmentSelector] Parsed ${lines.length} lyric lines`);

    // Build lyrics text for Gemini (without timestamps)
    const lyricsText = lines.map((l, i) => `${i + 1}. ${l.text}`).join('\n');

    const prompt = `You are a music segment selector for a karaoke app. Your task is to identify the most ICONIC and RECOGNIZABLE ${targetDuration}-second segment from a song's lyrics.

Song: "${songTitle}" by ${artistName}
Duration: ${duration.toFixed(1)} seconds
Target segment length: ${targetDuration} seconds (±5 seconds is acceptable)

Numbered lyrics:
${lyricsText}

SELECTION CRITERIA (in order of importance):
1. **Iconic/Hook**: The most memorable part (usually chorus, famous hook, or signature line)
2. **Recognition**: What most people would instantly recognize
3. **Singability**: Good for karaoke (clear melody, fun to sing)
4. **Energy**: High energy sections are preferred over slow/ballad parts
5. **Completeness**: Should be a complete musical phrase, not cut mid-sentence

IMPORTANT RULES:
- Choose a CONTINUOUS section (consecutive line numbers)
- If there are multiple choruses, choose the FIRST complete one
- Aim for ${targetDuration}s total, but ${targetDuration - 5}s to ${targetDuration + 10}s is acceptable
- Must be between line 1 and line ${lines.length}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "startLine": 12,
  "endLine": 18,
  "reason": "First chorus with the iconic hook 'We're up all night till the sun'"
}`;

    const response = await this.openRouter.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const answer = response.choices[0].message.content.trim();
    console.log(`[SegmentSelector] Gemini response:\n${answer}\n`);

    // Parse JSON response
    let selection: { startLine: number; endLine: number; reason: string };

    try {
      // Remove markdown code blocks if present
      const cleanJson = answer.replace(/```json\n?|\n?```/g, '').trim();
      selection = JSON.parse(cleanJson);
    } catch (error) {
      throw new Error(`Failed to parse Gemini JSON response: ${answer}`);
    }

    // Validate line numbers
    if (
      !selection.startLine ||
      !selection.endLine ||
      selection.startLine < 1 ||
      selection.endLine > lines.length ||
      selection.startLine > selection.endLine
    ) {
      throw new Error(
        `Invalid line numbers: ${selection.startLine}-${selection.endLine} (total lines: ${lines.length})`
      );
    }

    // Get timestamps from selected lines
    const startLine = lines[selection.startLine - 1];
    const endLine = lines[selection.endLine - 1];

    const startTime = startLine.time;
    const endTime = endLine.time + 3.0; // Add ~3s for last line to finish

    const segmentDuration = endTime - startTime;

    console.log(`[SegmentSelector] Selected lines ${selection.startLine}-${selection.endLine}`);
    console.log(`[SegmentSelector] Timestamp: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`);
    console.log(`[SegmentSelector] Duration: ${segmentDuration.toFixed(1)}s`);
    console.log(`[SegmentSelector] Reason: ${selection.reason}`);

    // Extract selected lyrics text
    const selectedText = lines
      .slice(selection.startLine - 1, selection.endLine)
      .map((l) => l.text)
      .join('\n');

    return {
      startTime,
      endTime,
      duration: segmentDuration,
      reason: selection.reason,
      selectedText,
    };
  }

  /**
   * Parse LRC synced lyrics into lines with timestamps
   */
  private parseSyncedLyrics(
    syncedLyrics: string
  ): Array<{ time: number; text: string }> {
    const lines = syncedLyrics.split('\n').filter((line) => line.trim());
    const parsed: Array<{ time: number; text: string }> = [];

    for (const line of lines) {
      // Match format: [MM:SS.XX] text or [MM:SS] text
      const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\]\s*(.+)/);

      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseFloat(match[2]);
        const text = match[3].trim();

        if (text) {
          // Skip metadata lines
          parsed.push({
            time: minutes * 60 + seconds,
            text,
          });
        }
      }
    }

    return parsed;
  }

  /**
   * Select segment using plain lyrics and total duration
   * When synced lyrics aren't available, estimates timestamps
   */
  async selectFromPlainLyrics(
    plainLyrics: string,
    songTitle: string,
    artistName: string,
    duration: number,
    targetDuration: number = 30
  ): Promise<SegmentSelection> {
    console.log(`[SegmentSelector] Analyzing plain lyrics (no timestamps)`);

    const lines = plainLyrics
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => l.trim());

    const lyricsText = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');

    const prompt = `You are a music segment selector. Identify the most ICONIC ${targetDuration}-second segment from these lyrics.

Song: "${songTitle}" by ${artistName}
Duration: ${duration.toFixed(1)} seconds

Lyrics:
${lyricsText}

Choose the most memorable part (usually chorus or hook). Respond with ONLY JSON:
{
  "startLine": 12,
  "endLine": 18,
  "reason": "First chorus with iconic hook"
}`;

    const response = await this.openRouter.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const answer = response.choices[0].message.content.trim();
    const cleanJson = answer.replace(/```json\n?|\n?```/g, '').trim();
    const selection = JSON.parse(cleanJson);

    // Estimate timestamps based on line distribution
    const totalLines = lines.length;
    const timePerLine = duration / totalLines;

    const startTime = (selection.startLine - 1) * timePerLine;
    const endTime = selection.endLine * timePerLine;

    const selectedText = lines
      .slice(selection.startLine - 1, selection.endLine)
      .join('\n');

    console.log(
      `[SegmentSelector] Estimated: ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`
    );

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      reason: selection.reason,
      selectedText,
    };
  }
}
