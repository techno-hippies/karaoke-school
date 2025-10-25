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
}
