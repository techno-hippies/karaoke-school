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
  async chat(messages: OpenRouterMessage[]): Promise<OpenRouterResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tiktok-scraper.workers.dev',
        'X-Title': 'TikTok Track Normalizer',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
      }),
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
   * Select best 190s segment for karaoke production (fal.ai limit)
   *
   * @param title Song title
   * @param artist Artist name
   * @param durationMs Total song duration in milliseconds
   * @param syncedLyrics LRC-formatted synced lyrics with timestamps
   * @returns Start and end time in milliseconds + reasoning
   */
  async selectKaraokeSegment(
    title: string,
    artist: string,
    durationMs: number,
    syncedLyrics: string
  ): Promise<{
    startMs: number;
    endMs: number;
    reasoning: string;
  }> {
    console.log(`Selecting best 190s segment for "${title}" by ${artist} (${(durationMs / 1000).toFixed(0)}s total)`);

    const prompt = `You are a karaoke segment selector. I need you to select the BEST 190 seconds (3 minutes 10 seconds) from this song for karaoke production.

SONG: "${title}" by ${artist}
TOTAL DURATION: ${(durationMs / 1000).toFixed(1)} seconds
SEGMENT LIMIT: Exactly 190 seconds (3:10)

SYNCED LYRICS (LRC format):
${syncedLyrics}

SELECTION CRITERIA (in order of priority):
1. MUST include the chorus/hook (most recognizable part)
2. Prefer the MAIN CHORUS (not intro/outro)
3. Should start at a natural song boundary (verse/chorus start, not mid-phrase)
4. Avoid starting in the middle of a sentence
5. Should end at a natural boundary (not cut off mid-word)
6. Prioritize musical/lyrical completeness over arbitrary timing
7. Prefer segments with high energy and singability

IMPORTANT:
- The segment MUST be exactly 190 seconds (190000 milliseconds)
- Start time must be >= 0
- End time must be <= total duration
- Calculate: endMs = startMs + 190000

CRITICAL: Respond with ONLY these three lines. No explanation before. No reasoning after.

Format:
START_MS: [start time in milliseconds]
END_MS: [end time in milliseconds]
REASON: [one sentence explaining why this is the best segment]

Your response:`;

    const response = await this.chat([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    const answer = response.choices[0].message.content;
    console.log(`Gemini segment selection:\n${answer}`);

    // Parse response
    const startMatch = answer.match(/START[_\s]*MS:\s*(\d+)/i);
    const endMatch = answer.match(/END[_\s]*MS:\s*(\d+)/i);
    const reasonMatch = answer.match(/REASON:\s*(.+)/i);

    if (!startMatch || !endMatch) {
      throw new Error(`Failed to parse segment selection: ${answer}`);
    }

    const startMs = parseInt(startMatch[1]);
    const endMs = parseInt(endMatch[1]);
    const reasoning = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';

    // Validate segment
    if (endMs - startMs !== 190000) {
      console.warn(`Segment duration is ${endMs - startMs}ms, adjusting to 190000ms`);
      return {
        startMs,
        endMs: startMs + 190000,
        reasoning,
      };
    }

    if (endMs > durationMs) {
      console.warn(`Segment extends beyond song duration, adjusting...`);
      return {
        startMs: durationMs - 190000,
        endMs: durationMs,
        reasoning,
      };
    }

    console.log(`Selected segment: ${(startMs / 1000).toFixed(1)}s - ${(endMs / 1000).toFixed(1)}s`);

    return {
      startMs,
      endMs,
      reasoning,
    };
  }
}
