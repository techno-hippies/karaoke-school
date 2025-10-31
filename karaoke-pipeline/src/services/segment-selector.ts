/**
 * AI Segment Selector Service
 *
 * Uses AI (Gemini via OpenRouter) to analyze lyrics with word-level timing
 * and select optimal karaoke segments:
 *
 * 1. Optimal 190s segment (for songs ≥190s only)
 * 2. Best 20-50s clip (for ALL songs)
 */

import { OpenRouterService } from './openrouter';

export interface WordTiming {
  text: string;
  start: number; // seconds
  end: number;
}

export interface OptimalSegmentResult {
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface SegmentSelectionResult {
  optimalSegment?: OptimalSegmentResult; // Only for songs ≥190s
  clip: OptimalSegmentResult;            // For ALL songs
}

export class SegmentSelectorService {
  private openRouter: OpenRouterService;

  constructor(apiKey: string) {
    this.openRouter = new OpenRouterService(apiKey);
  }

  /**
   * Select optimal segments for a track
   *
   * @param words Word-level timing data from ElevenLabs
   * @param trackDurationMs Total track duration in milliseconds
   * @returns Selected segments
   */
  async selectSegments(
    words: WordTiming[],
    trackDurationMs: number
  ): Promise<SegmentSelectionResult> {
    const trackDurationSeconds = trackDurationMs / 1000;
    const needsOptimalSegment = trackDurationMs >= 190000;

    console.log(`[SegmentSelector] Track duration: ${trackDurationSeconds}s`);
    console.log(`[SegmentSelector] Needs 190s segment: ${needsOptimalSegment}`);

    // Format lyrics with timing for AI analysis
    const lyricsWithTiming = this.formatLyricsWithTiming(words);

    if (needsOptimalSegment) {
      // Songs ≥190s: Sequential calls (clip WITHIN optimal segment)
      // Step 1: Select optimal 190s segment
      const optimalSegment = await this.selectOptimal190sSegment(
        lyricsWithTiming,
        trackDurationSeconds
      );

      // Step 2: Filter words to only those within optimal segment
      const optimalSegmentStartSec = optimalSegment.startMs / 1000;
      const optimalSegmentEndSec = optimalSegment.endMs / 1000;

      const wordsInSegment = words.filter(
        w => w.start >= optimalSegmentStartSec && w.start <= optimalSegmentEndSec
      );

      // Step 3: Adjust word times to be relative to segment start (0-190s)
      const relativeWords: WordTiming[] = wordsInSegment.map(w => ({
        text: w.text,
        start: w.start - optimalSegmentStartSec,
        end: w.end - optimalSegmentStartSec
      }));

      // Step 4: Select clip from FILTERED words (constrained to 0-190s)
      const lyricsInSegment = this.formatLyricsWithTiming(relativeWords);
      const clipRelative = await this.selectBestClip(
        lyricsInSegment,
        190 // Clip selected within 190s segment window
      );

      // Step 5: Convert clip back to absolute times
      const clip: OptimalSegmentResult = {
        startMs: clipRelative.startMs + optimalSegment.startMs,
        endMs: clipRelative.endMs + optimalSegment.startMs,
        durationMs: clipRelative.durationMs
      };

      console.log(
        `[SegmentSelector] Clip converted from relative [${clipRelative.startMs}-${clipRelative.endMs}] to absolute [${clip.startMs}-${clip.endMs}]`
      );

      return { optimalSegment, clip };
    } else {
      // Songs <190s: Only select best clip from full track
      const clip = await this.selectBestClip(lyricsWithTiming, trackDurationSeconds);
      return { clip };
    }
  }

  /**
   * Format words with timing into readable text for AI
   */
  private formatLyricsWithTiming(words: WordTiming[]): string {
    return words
      .map(w => `[${w.start.toFixed(2)}s] ${w.text}`)
      .join(' ');
  }

  /**
   * Select optimal 190s karaoke segment (for songs ≥190s)
   */
  private async selectOptimal190sSegment(
    lyricsWithTiming: string,
    trackDurationSeconds: number
  ): Promise<OptimalSegmentResult> {
    const systemPrompt = `You are a karaoke segment selector. Analyze lyrics with word-level timing and select the BEST continuous 190-second segment for karaoke.

SELECTION CRITERIA (in order of importance):
1. **Melodic hooks** - Include catchy, memorable melodic phrases
2. **Chorus/hook** - MUST include at least one full chorus if present
3. **Singability** - Prioritize sing-along worthy sections
4. **Energy** - Prefer higher energy sections over ballad verses
5. **Completeness** - Avoid cutting mid-phrase; align to natural boundaries
6. **Structure** - Prefer verse→chorus→verse patterns over repetitive sections

CONSTRAINTS:
- MUST be exactly 190 seconds (±2s tolerance)
- MUST be continuous (no gaps)
- Start/end times MUST align to word boundaries from the timing data
- MUST NOT exceed track duration

Return ONLY valid JSON in this exact format:
{
  "startSeconds": 45.5,
  "endSeconds": 235.5,
  "reasoning": "Contains main chorus hook and bridge with high energy"
}`;

    const userPrompt = `Track duration: ${trackDurationSeconds}s

Lyrics with word timing:
${lyricsWithTiming}

Select the optimal 190-second segment. Return JSON only.`;

    try {
      const response = await this.openRouter.complete([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);
      const startMs = Math.round(result.startSeconds * 1000);
      const endMs = Math.round(result.endSeconds * 1000);

      console.log(`[SegmentSelector] Selected 190s segment: ${startMs}ms - ${endMs}ms`);
      console.log(`[SegmentSelector] Reasoning: ${result.reasoning}`);

      return {
        startMs,
        endMs,
        durationMs: endMs - startMs
      };
    } catch (error: any) {
      console.error(`[SegmentSelector] Failed to select optimal segment: ${error.message}`);
      // Fallback: Use middle 190s of track
      const fallbackStart = Math.max(0, (trackDurationSeconds * 1000 - 190000) / 2);
      const fallbackEnd = Math.min(trackDurationSeconds * 1000, fallbackStart + 190000);

      console.log(`[SegmentSelector] Using fallback: ${fallbackStart}ms - ${fallbackEnd}ms`);

      return {
        startMs: Math.round(fallbackStart),
        endMs: Math.round(fallbackEnd),
        durationMs: Math.round(fallbackEnd - fallbackStart)
      };
    }
  }

  /**
   * Select best 20-50s clip (for ALL songs)
   */
  private async selectBestClip(
    lyricsWithTiming: string,
    trackDurationSeconds: number
  ): Promise<OptimalSegmentResult> {
    const systemPrompt = `You are a viral clip selector. Analyze lyrics with word-level timing and select the BEST 20-50 second clip that would make the most engaging short-form content.

SELECTION CRITERIA (in order of importance):
1. **Hook/Chorus** - MUST include the most memorable part of the song
2. **Completeness** - Should feel like a complete musical phrase
3. **Energy** - Prefer high energy moments
4. **Viral potential** - The part people would want to sing/share
5. **Recognition** - The most recognizable part of the song
6. **Natural boundaries** - Start/end at phrase boundaries, not mid-word

CONSTRAINTS:
- MUST be between 20-50 seconds
- MUST be continuous (no gaps)
- Start/end times MUST align to word boundaries from the timing data
- MUST NOT exceed track duration
- Prefer 30-40 seconds (optimal clip length)

Return ONLY valid JSON in this exact format:
{
  "startSeconds": 60.2,
  "endSeconds": 95.8,
  "reasoning": "Main chorus hook with high energy"
}`;

    const userPrompt = `Track duration: ${trackDurationSeconds}s

Lyrics with word timing:
${lyricsWithTiming}

Select the best 20-50s clip. Return JSON only.`;

    try {
      const response = await this.openRouter.complete([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const result = JSON.parse(jsonMatch[0]);
      const startMs = Math.round(result.startSeconds * 1000);
      const endMs = Math.round(result.endSeconds * 1000);
      const durationMs = endMs - startMs;

      // Validate clip duration
      if (durationMs < 20000 || durationMs > 50000) {
        console.warn(`[SegmentSelector] Clip duration ${durationMs}ms outside 20-50s range`);
      }

      console.log(`[SegmentSelector] Selected clip: ${startMs}ms - ${endMs}ms (${durationMs}ms)`);
      console.log(`[SegmentSelector] Reasoning: ${result.reasoning}`);

      return { startMs, endMs, durationMs };
    } catch (error: any) {
      console.error(`[SegmentSelector] Failed to select clip: ${error.message}`);
      // Fallback: Use first 35s or middle 35s of track
      const clipDuration = 35000;
      const fallbackStart = Math.max(0, Math.min(
        30000, // Prefer starting around 30s mark (after intro)
        (trackDurationSeconds * 1000 - clipDuration) / 2
      ));
      const fallbackEnd = Math.min(trackDurationSeconds * 1000, fallbackStart + clipDuration);

      console.log(`[SegmentSelector] Using fallback clip: ${fallbackStart}ms - ${fallbackEnd}ms`);

      return {
        startMs: Math.round(fallbackStart),
        endMs: Math.round(fallbackEnd),
        durationMs: Math.round(fallbackEnd - fallbackStart)
      };
    }
  }
}
