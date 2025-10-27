/**
 * OpenRouter Service
 * LLM API service for intelligent track title normalization
 * Uses Gemini Flash 2.5 Lite
 */

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface NormalizedTrack {
  originalTitle: string;
  normalizedTitle: string;
  originalArtist: string;
  normalizedArtist: string;
  reasoning?: string;
}

export class OpenRouterService {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.model = 'google/gemini-2.5-flash-lite-preview-09-2025';
    this.baseUrl = 'https://openrouter.ai/api/v1';
  }

  /**
   * Send chat completion request to OpenRouter
   */
  async chat(messages: OpenRouterMessage[], responseFormat?: any): Promise<OpenRouterResponse> {
    const body: any = {
      model: this.model,
      messages,
    };

    // Add structured output schema if provided
    if (responseFormat) {
      body.response_format = responseFormat;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tiktok-scraper.workers.dev',
        'X-Title': 'TikTok Track Normalizer',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Normalize track title and artist for MusicBrainz matching
   *
   * Removes version info like "Slowed Down", "Remaster", "Live at...", etc.
   *
   * @param title Original track title from Spotify
   * @param artist Original artist name from Spotify
   * @returns Normalized title and artist
   */
  async normalizeTrack(title: string, artist: string): Promise<NormalizedTrack> {
    console.log(`Normalizing: "${title}" by ${artist}`);

    const prompt = `You are a music metadata expert. Normalize this track title and artist to their canonical forms for MusicBrainz matching.

TRACK: "${title}"
ARTIST: ${artist}

RULES:
1. Remove ALL version/edition info from title:
   - "Slowed Down Version", "Slowed + Reverb", "Sped Up"
   - "Remaster", "Remastered", "2011 Remaster"
   - "Live at...", "Live", "Acoustic", "Radio Edit", "Extended Mix"
   - "Small Mix", "Big Mix", "Album Version", "Single Version"
   - Year/date info like "- 2011", "(2024)"
   - Any parentheticals or hyphens with version info

2. Keep the CORE song title only
3. Keep featured artists in title if they're part of the official name (e.g., "Song (feat. Artist)")
4. Normalize artist name if it has obvious typos or variations
5. DO NOT change the core song or artist name itself

CRITICAL: Respond with ONLY these two lines. No explanation. No reasoning. No other text.

Format:
TITLE: [normalized title]
ARTIST: [normalized artist]

Your response:`;

    const response = await this.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const answer = response.choices[0].message.content;
    console.log(`Gemini response:\n${answer}`);

    // Parse response
    const titleMatch = answer.match(/TITLE:\s*(.+)/i);
    const artistMatch = answer.match(/ARTIST:\s*(.+)/i);

    if (!titleMatch || !artistMatch) {
      // Fallback: return original if parsing fails
      console.warn(`Failed to parse normalization response, using original values`);
      return {
        originalTitle: title,
        normalizedTitle: title,
        originalArtist: artist,
        normalizedArtist: artist,
        reasoning: answer,
      };
    }

    const normalizedTitle = titleMatch[1].trim();
    const normalizedArtist = artistMatch[1].trim();

    console.log(`Normalized: "${normalizedTitle}" by ${normalizedArtist}`);

    return {
      originalTitle: title,
      normalizedTitle,
      originalArtist: artist,
      normalizedArtist,
      reasoning: answer,
    };
  }

  /**
   * Batch normalize multiple tracks
   */
  async normalizeTracks(
    tracks: Array<{ title: string; artist: string }>
  ): Promise<NormalizedTrack[]> {
    const results: NormalizedTrack[] = [];

    for (const track of tracks) {
      try {
        const normalized = await this.normalizeTrack(track.title, track.artist);
        results.push(normalized);

        // Rate limiting: 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to normalize ${track.title}:`, error);
        // Fallback to original
        results.push({
          originalTitle: track.title,
          normalizedTitle: track.title,
          originalArtist: track.artist,
          normalizedArtist: track.artist,
        });
      }
    }

    return results;
  }

  /**
   * Normalize lyrics from multiple sources for forced alignment
   *
   * Takes two versions of lyrics (e.g., from LRCLIB and Lyrics.ovh) and produces
   * a clean, standardized version optimized for ElevenLabs forced alignment.
   *
   * @param lrclibLyrics Lyrics from LRCLIB
   * @param lyricsOvhLyrics Lyrics from Lyrics.ovh
   * @param trackTitle Song title for context
   * @param artist Artist name for context
   * @returns Normalized lyrics suitable for forced alignment
   */
  async normalizeLyrics(
    lrclibLyrics: string,
    lyricsOvhLyrics: string,
    trackTitle: string,
    artist: string
  ): Promise<{
    normalizedLyrics: string;
    reasoning: string;
  }> {
    console.log(`Normalizing lyrics for "${trackTitle}" by ${artist}`);

    const prompt = `You are a lyrics normalization expert for audio forced alignment. Given two versions of the same song lyrics, produce ONE clean, standardized version optimized for speech-to-text alignment with audio.

SONG: "${trackTitle}" by ${artist}

VERSION 1 (LRCLIB):
${lrclibLyrics.substring(0, 2000)}${lrclibLyrics.length > 2000 ? '...' : ''}

VERSION 2 (Lyrics.ovh):
${lyricsOvhLyrics.substring(0, 2000)}${lyricsOvhLyrics.length > 2000 ? '...' : ''}

NORMALIZATION RULES:
1. **Remove ad-libs in parentheses**: "(ooh)", "(yeah)", "(Check it out)" - unless they're actually sung
2. **Standardize spelling**: Use proper spelling - "you" not "u", "with" not "wit" UNLESS it's phonetically different when sung
3. **Preserve phonetic slang**: Keep "gon'" (not "going to"), "tryna", "gonna", "'cause" - they sound different
4. **Remove metadata**: [Chorus], [Verse 2], [x2], timestamps
5. **Remove backing vocal markers**: Unless they're main vocals
6. **Keep only audibly sung words**: What you'd hear in the audio
7. **Reasonable line breaks**: Match musical phrasing, but don't over-segment
8. **No copyright notices**: Remove any "Lyrics provided by" text
9. **Merge best parts**: Use context from both versions to get the most accurate lyrics

CRITICAL OUTPUT FORMAT:
Return ONLY the normalized lyrics. No explanation. No reasoning header. Just the clean lyrics text that matches what's sung in the audio.

After the lyrics, on a new line, add:
---REASONING---
[One paragraph explaining your normalization decisions]

Your response:`;

    const response = await this.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const answer = response.choices[0].message.content;

    // Split lyrics from reasoning
    const parts = answer.split('---REASONING---');
    const normalizedLyrics = parts[0].trim();
    const reasoning = parts[1]?.trim() || 'No reasoning provided';

    console.log(`Normalized lyrics: ${normalizedLyrics.length} characters`);
    console.log(`Reasoning: ${reasoning.substring(0, 100)}...`);

    return {
      normalizedLyrics,
      reasoning,
    };
  }

  /**
   * Select best 190s segment for karaoke production AND optimal TikTok clip
   *
   * @param title Song title
   * @param artist Artist name
   * @param durationMs Total song duration in milliseconds
   * @param syncedLyrics LRC-formatted synced lyrics with timestamps
   * @returns Karaoke segment (190s) and TikTok clip (15-50s)
   */
  async selectKaraokeSegment(
    title: string,
    artist: string,
    durationMs: number,
    syncedLyrics: string
  ): Promise<{
    startMs: number;
    endMs: number;
    tiktokClipStartMs: number;
    tiktokClipEndMs: number;
  }> {
    console.log(`Selecting segments for "${title}" by ${artist} (${(durationMs / 1000).toFixed(0)}s total)`);

    const durationSeconds = Math.floor(durationMs / 1000);

    const prompt = `You are an expert at selecting the most impactful segments from songs for different purposes.

SONG: "${title}" by ${artist}
TOTAL DURATION: ${durationSeconds} seconds (${Math.floor(durationSeconds / 60)}:${(durationSeconds % 60).toString().padStart(2, '0')})

SYNCED LYRICS (LRC format with timestamps):
${syncedLyrics.substring(0, 3000)}${syncedLyrics.length > 3000 ? '\n...[truncated]' : ''}

YOUR TASK: Select TWO segments from this song:

1. **KARAOKE SEGMENT (190 seconds for full karaoke experience)**
   - Must be EXACTLY 190 seconds (190000ms)
   - Include the main chorus and most singable parts
   - Should feel like a complete musical experience
   - Start and end at natural boundaries (verse/chorus transitions)
   - Prioritize vocal prominence and sing-along value

2. **TIKTOK CLIP (15-50 seconds for viral potential)**
   - Must be between 15-50 seconds
   - The MOST iconic, memorable, culturally significant part
   - The part everyone knows and recognizes
   - Usually the main hook/chorus
   - Maximum emotional impact and recognizability
   - This clip MUST be WITHIN the 190s karaoke segment

IMPORTANT CONSTRAINTS:
- Karaoke segment: start_ms >= 0, end_ms <= ${durationMs}, duration = 190000ms
- TikTok clip: MUST be within the karaoke segment boundaries
- TikTok clip: duration between 15000-50000ms
- Both must start/end at natural musical boundaries`;

    // Define structured output schema (no reasoning to save tokens)
    const responseFormat = {
      type: 'json_schema',
      json_schema: {
        name: 'segment_selection',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            karaoke_segment: {
              type: 'object',
              properties: {
                start_ms: {
                  type: 'number',
                  description: 'Start time in milliseconds (>= 0)'
                },
                end_ms: {
                  type: 'number',
                  description: 'End time in milliseconds (<= track duration)'
                }
              },
              required: ['start_ms', 'end_ms'],
              additionalProperties: false
            },
            tiktok_clip: {
              type: 'object',
              properties: {
                start_ms: {
                  type: 'number',
                  description: 'Start time in milliseconds (must be within karaoke segment)'
                },
                end_ms: {
                  type: 'number',
                  description: 'End time in milliseconds (must be within karaoke segment)'
                }
              },
              required: ['start_ms', 'end_ms'],
              additionalProperties: false
            }
          },
          required: ['karaoke_segment', 'tiktok_clip'],
          additionalProperties: false
        }
      }
    };

    const response = await this.chat([
      {
        role: 'user',
        content: prompt,
      },
    ], responseFormat);

    const content = response.choices[0].message.content;
    const result = JSON.parse(content);

    console.log(`Karaoke segment: ${(result.karaoke_segment.start_ms / 1000).toFixed(1)}s - ${(result.karaoke_segment.end_ms / 1000).toFixed(1)}s`);
    console.log(`TikTok clip: ${(result.tiktok_clip.start_ms / 1000).toFixed(1)}s - ${(result.tiktok_clip.end_ms / 1000).toFixed(1)}s`);

    // Validate and adjust karaoke segment
    let startMs = Math.max(0, Math.min(result.karaoke_segment.start_ms, durationMs - 190000));
    let endMs = startMs + 190000;

    if (endMs > durationMs) {
      startMs = durationMs - 190000;
      endMs = durationMs;
    }

    // Validate TikTok clip
    let tiktokStartMs = result.tiktok_clip.start_ms;
    let tiktokEndMs = result.tiktok_clip.end_ms;
    let tiktokDuration = tiktokEndMs - tiktokStartMs;

    // Ensure TikTok clip is within bounds
    if (tiktokStartMs < startMs) tiktokStartMs = startMs;
    if (tiktokEndMs > endMs) tiktokEndMs = endMs;

    // Ensure TikTok clip duration is within 15-50s
    tiktokDuration = tiktokEndMs - tiktokStartMs;
    if (tiktokDuration < 15000) {
      tiktokEndMs = tiktokStartMs + 15000;
    } else if (tiktokDuration > 50000) {
      tiktokEndMs = tiktokStartMs + 50000;
    }

    // Final validation
    if (tiktokEndMs > endMs) {
      tiktokStartMs = endMs - 30000; // Default to 30s clip at end
      tiktokEndMs = endMs;
    }

    return {
      startMs,
      endMs,
      tiktokClipStartMs: tiktokStartMs,
      tiktokClipEndMs: tiktokEndMs,
    };
  }
}
