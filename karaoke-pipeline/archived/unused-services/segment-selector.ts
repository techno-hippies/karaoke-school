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
- MUST be MAXIMUM 190 seconds (can be slightly shorter, NEVER longer)
- MUST be continuous (no gaps)
- Start/end times MUST align to word boundaries from the timing data
- MUST NOT exceed track duration
- fal.ai has a HARD LIMIT of 190.00s - segments over this will be rejected

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
      let startMs = Math.round(result.startSeconds * 1000);
      let endMs = Math.round(result.endSeconds * 1000);
      let durationMs = endMs - startMs;

      // SAFETY CHECK: Enforce fal.ai's hard 190s limit (no tolerance)
      if (durationMs > 190000) {
        const originalDuration = durationMs;
        endMs = startMs + 190000;
        durationMs = 190000;
        console.warn(`[SegmentSelector] ⚠️ AI selected ${(originalDuration / 1000).toFixed(2)}s, trimmed to exactly 190.00s for fal.ai compatibility`);
      }

      console.log(`[SegmentSelector] Selected 190s segment: ${startMs}ms - ${endMs}ms`);
      console.log(`[SegmentSelector] Reasoning: ${result.reasoning}`);

      return {
        startMs,
        endMs,
        durationMs
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
    const systemPrompt = `You are a karaoke segment selector. Your job is to find the BEST karaoke-worthy segment for people to sing along to.

🚨 CRITICAL DURATION REQUIREMENT 🚨
The clip MUST be MINIMUM 35 seconds and MAXIMUM 60 seconds.
- If you select < 35 seconds, the clip will be REJECTED (too short for karaoke)
- If you select > 60 seconds, the clip will be REJECTED (too long)
- Target the OPTIMAL range: 40-50 seconds (perfect for verse+chorus)

🎤 KARAOKE STRUCTURE PRIORITY 🎤

THE IDEAL SELECTION IS **VERSE + FULL CHORUS**:
1. **VERSE + CHORUS** (40-55s) - The GOLD STANDARD for karaoke
   - Start with a full verse (or last half of verse)
   - Include the COMPLETE chorus/hook section
   - End cleanly after chorus finishes

2. **PRE-CHORUS + CHORUS + POST-CHORUS** (35-50s)
   - Build-up → main hook → resolution
   - Complete musical arc

3. **BRIDGE + FINAL CHORUS** (40-55s)
   - Emotional peak of the song
   - Powerful sing-along moment

WHAT MAKES A GREAT KARAOKE CLIP:
✅ **COMPLETENESS** - Full verse + full chorus (not fragments)
✅ **ICONIC SECTION** - The part everyone knows and loves
✅ **SINGABILITY** - Easy to follow melodically
✅ **MEMORABILITY** - The most recognizable part
✅ **ENERGY** - Engaging, not boring intro/outro
✅ **CLEAN BOUNDARIES** - Start/end at natural phrase breaks

EXAMPLES OF PERFECT SELECTIONS:
✅ Last 2 verse lines + Full chorus (45s)
✅ Full verse + Full chorus + First line of next verse (50s)
✅ Pre-chorus (8s) + Chorus (25s) + Post-chorus (12s) = 45s
✅ Bridge (15s) + Final chorus (30s) = 45s

EXAMPLES OF BAD SELECTIONS:
❌ Just the chorus (15-25s) - TOO SHORT, need verse too
❌ Just the hook (8-15s) - TOO SHORT, not karaoke-worthy
❌ Half verse + half chorus (20-28s) - TOO SHORT, feels incomplete
❌ Verse only (20-30s) - Missing the chorus hook
❌ Entire verse + chorus + verse + chorus (80s+) - TOO LONG

⚠️ VERIFICATION CHECKLIST:
1. Calculate duration: endSeconds - startSeconds
2. Verify 35.0 ≤ duration ≤ 60.0
3. Confirm includes AT LEAST one full chorus
4. Confirm includes verse material (not just chorus)
5. If duration < 35s, EXPAND to include more verse/chorus
6. If duration > 60s, SHRINK to single verse+chorus

Return ONLY valid JSON:
{
  "startSeconds": 60.2,
  "endSeconds": 105.8,
  "reasoning": "Full second verse (15s) + complete chorus with hook (30s) = 45.6s total. Most iconic singable section."
}`;

    const userPrompt = `Track duration: ${trackDurationSeconds}s

Lyrics with word timing:
${lyricsWithTiming}

Select the BEST karaoke segment. MUST be 35-60 seconds. Target 40-50s.
PRIORITIZE: Verse + Full Chorus combinations.
VERIFY duration is 35-60s before returning. Return JSON only.`;

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
      let startMs = Math.round(result.startSeconds * 1000);
      let endMs = Math.round(result.endSeconds * 1000);
      let durationMs = endMs - startMs;

      // ENFORCE 35-60s requirement (karaoke needs verse+chorus)
      if (durationMs < 35000 || durationMs > 60000) {
        console.warn(`[SegmentSelector] ⚠️ AI violated 35-60s constraint: ${durationMs}ms`);
        console.warn(`[SegmentSelector] AI reasoning: ${result.reasoning}`);

        // Try to intelligently fix if close to valid range
        if (durationMs < 35000 && durationMs >= 30000) {
          // Too short but close - try extending
          const deficit = 35000 - durationMs;
          const extendStart = Math.floor(deficit / 2);
          const extendEnd = deficit - extendStart;

          startMs = Math.max(0, startMs - extendStart);
          endMs = Math.min(trackDurationSeconds * 1000, endMs + extendEnd);
          durationMs = endMs - startMs;

          console.log(`[SegmentSelector] Auto-extended to ${durationMs}ms`);
        } else if (durationMs > 60000 && durationMs <= 70000) {
          // Too long but close - try shrinking to 50s
          const excess = durationMs - 50000; // Target 50s
          const shrinkStart = Math.floor(excess / 2);
          const shrinkEnd = excess - shrinkStart;

          startMs = startMs + shrinkStart;
          endMs = endMs - shrinkEnd;
          durationMs = endMs - startMs;

          console.log(`[SegmentSelector] Auto-shortened to ${durationMs}ms`);
        }

        // If still invalid, throw error to trigger fallback
        if (durationMs < 35000 || durationMs > 60000) {
          throw new Error(`Invalid clip duration: ${durationMs}ms (must be 35-60s). AI reasoning: ${result.reasoning}`);
        }
      }

      console.log(`[SegmentSelector] Selected clip: ${startMs}ms - ${endMs}ms (${durationMs}ms)`);
      console.log(`[SegmentSelector] Reasoning: ${result.reasoning}`);

      return { startMs, endMs, durationMs };
    } catch (error: any) {
      console.error(`[SegmentSelector] Failed to select clip: ${error.message}`);
      // Fallback: Intelligently select 45s (verse+chorus) from chorus area
      const clipDuration = 45000; // 45s = good verse+chorus length

      // Choruses typically appear 30-50% into the track
      // Start slightly before (to catch verse) and extend through chorus
      const chorusEstimate = trackDurationSeconds * 1000 * 0.40;
      const fallbackStart = Math.max(0, Math.min(
        chorusEstimate - 10000, // Start 10s before estimated chorus for verse
        trackDurationSeconds * 1000 - clipDuration
      ));
      const fallbackEnd = Math.min(trackDurationSeconds * 1000, fallbackStart + clipDuration);

      console.log(`[SegmentSelector] Using intelligent fallback: ${fallbackStart}ms - ${fallbackEnd}ms (45s verse+chorus at ~40% mark)`);

      return {
        startMs: Math.round(fallbackStart),
        endMs: Math.round(fallbackEnd),
        durationMs: Math.round(fallbackEnd - fallbackStart)
      };
    }
  }
}
