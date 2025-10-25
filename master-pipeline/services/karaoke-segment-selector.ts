/**
 * Karaoke Segment Selector Service
 *
 * Handles fal.ai's 190-second audio-to-audio processing limit by:
 * - Returning full track if ≤ 190s
 * - Using Gemini to identify iconic moment and extracting 190s window if > 190s
 */

import { OpenRouterService } from './openrouter.js';

export interface KaraokeSegmentSelection {
  start_ms: number;
  end_ms: number;
  duration_ms: number;
  reason: string;
  is_full_track: boolean;
}

export class KaraokeSegmentSelectorService {
  private openRouter: OpenRouterService;
  private readonly MAX_SEGMENT_MS = 190_000; // 190 seconds = fal.ai limit

  constructor() {
    this.openRouter = new OpenRouterService();
  }

  /**
   * Select the best karaoke segment for fal.ai processing
   *
   * @param trackTitle Song title
   * @param artistName Artist name
   * @param durationMs Total track duration in milliseconds
   * @returns Segment selection with timestamps in milliseconds
   */
  async selectSegment(
    trackTitle: string,
    artistName: string,
    durationMs: number
  ): Promise<KaraokeSegmentSelection> {
    console.log(
      `[KaraokeSegmentSelector] Analyzing: "${trackTitle}" by ${artistName}`
    );
    console.log(`[KaraokeSegmentSelector] Duration: ${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`);

    // If track fits within fal.ai limit, use full track
    if (durationMs <= this.MAX_SEGMENT_MS) {
      console.log(`[KaraokeSegmentSelector] ✓ Full track within 190s limit`);
      return {
        start_ms: 0,
        end_ms: durationMs,
        duration_ms: durationMs,
        reason: 'full_track_within_190s_limit',
        is_full_track: true,
      };
    }

    // Track is longer than 190s - ask Gemini to identify iconic moment
    console.log(
      `[KaraokeSegmentSelector] Track exceeds 190s, asking Gemini for iconic moment...`
    );

    const prompt = `You are a music expert identifying the MOST ICONIC and KARAOKE-ABLE moment in a song.

Song: "${trackTitle}" by ${artistName}
Total Duration: ${(durationMs / 1000).toFixed(1)} seconds

This song is longer than 190 seconds, so we can only process a 190-second segment for karaoke production. Your task is to identify the SINGLE MOST ICONIC moment that would make the best karaoke experience.

SELECTION CRITERIA (in order of importance):
1. **Iconic Hook/Chorus**: The part everyone knows and wants to sing
2. **Recognition**: What listeners would instantly recognize
3. **Singability**: Fun to sing, clear melody, engaging
4. **Energy**: High energy preferred (unless it's a famous ballad section)
5. **Cultural Impact**: Famous lyrics, viral moments, signature phrases

IMPORTANT GUIDELINES:
- Identify the CENTRAL POINT of the iconic moment (e.g., "the chorus starts at 45 seconds")
- We will extract a 190-second window CENTERED on your suggested moment
- If the song has a famous chorus, choose the FIRST occurrence
- If it's a well-known intro/hook, choose that instead
- Avoid instrumental breaks, outros, or fade-outs
- Think about what people would most want to sing at karaoke

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "iconic_moment_seconds": 65.0,
  "segment_name": "First chorus with iconic hook",
  "reasoning": "This is where the memorable 'We're up all night to get lucky' chorus begins, which is the most recognizable part of the song"
}`;

    const response = await this.openRouter.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const answer = response.choices[0].message.content.trim();
    console.log(`[KaraokeSegmentSelector] Gemini response:\n${answer}\n`);

    // Parse JSON response
    let geminiSelection: {
      iconic_moment_seconds: number;
      segment_name: string;
      reasoning: string;
    };

    try {
      // Remove markdown code blocks if present
      const cleanJson = answer.replace(/```json\n?|\n?```/g, '').trim();
      geminiSelection = JSON.parse(cleanJson);
    } catch (error) {
      throw new Error(
        `Failed to parse Gemini JSON response: ${answer}`
      );
    }

    // Validate iconic moment timestamp
    const iconicMomentSeconds = geminiSelection.iconic_moment_seconds;
    const trackDurationSeconds = durationMs / 1000;

    if (
      iconicMomentSeconds < 0 ||
      iconicMomentSeconds > trackDurationSeconds
    ) {
      throw new Error(
        `Invalid iconic moment: ${iconicMomentSeconds}s (track is ${trackDurationSeconds}s)`
      );
    }

    // Calculate 190s window centered on iconic moment
    const halfWindow = this.MAX_SEGMENT_MS / 2; // 95 seconds on each side
    const iconicMomentMs = iconicMomentSeconds * 1000;

    let startMs = iconicMomentMs - halfWindow;
    let endMs = iconicMomentMs + halfWindow;

    // Adjust if window extends beyond track boundaries
    if (startMs < 0) {
      // Shift window to start from beginning
      startMs = 0;
      endMs = this.MAX_SEGMENT_MS;
      console.log(
        `[KaraokeSegmentSelector] Adjusted window to start from beginning`
      );
    } else if (endMs > durationMs) {
      // Shift window to end at track end
      endMs = durationMs;
      startMs = durationMs - this.MAX_SEGMENT_MS;
      console.log(
        `[KaraokeSegmentSelector] Adjusted window to end at track end`
      );
    }

    const finalDurationMs = endMs - startMs;

    console.log(
      `[KaraokeSegmentSelector] Selected segment: ${(startMs / 1000).toFixed(1)}s - ${(endMs / 1000).toFixed(1)}s`
    );
    console.log(
      `[KaraokeSegmentSelector] Duration: ${(finalDurationMs / 1000).toFixed(1)}s`
    );
    console.log(
      `[KaraokeSegmentSelector] Segment: ${geminiSelection.segment_name}`
    );
    console.log(
      `[KaraokeSegmentSelector] Reasoning: ${geminiSelection.reasoning}`
    );

    return {
      start_ms: Math.round(startMs),
      end_ms: Math.round(endMs),
      duration_ms: Math.round(finalDurationMs),
      reason: `${geminiSelection.segment_name} - ${geminiSelection.reasoning}`,
      is_full_track: false,
    };
  }

  /**
   * Get the maximum segment duration in milliseconds
   */
  getMaxSegmentMs(): number {
    return this.MAX_SEGMENT_MS;
  }
}
