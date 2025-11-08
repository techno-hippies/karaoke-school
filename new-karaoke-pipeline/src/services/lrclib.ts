/**
 * LRCLib API Service
 * Free, open-source synced lyrics database
 * https://lrclib.net/docs
 */

const LRCLIB_API_URL = 'https://lrclib.net/api';
const USER_AGENT = 'KaraokePipeline/1.0 (https://github.com/your-org)';

export interface LRCLibLyrics {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number; // seconds
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null; // LRC format
}

/**
 * Search for lyrics by track metadata
 * This is the recommended search method
 */
export async function searchLyrics(params: {
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
}): Promise<LRCLibLyrics | null> {
  try {
    const searchParams = new URLSearchParams({
      track_name: params.trackName,
      artist_name: params.artistName,
    });

    if (params.albumName) {
      searchParams.append('album_name', params.albumName);
    }

    if (params.duration) {
      searchParams.append('duration', Math.round(params.duration).toString());
    }

    const url = `${LRCLIB_API_URL}/get?${searchParams}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`LRCLib API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`LRCLib search failed:`, error.message);
    throw error;
  }
}

/**
 * Get lyrics by LRCLib ID
 */
export async function getLyricsById(id: number): Promise<LRCLibLyrics | null> {
  try {
    const url = `${LRCLIB_API_URL}/get/${id}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`LRCLib API error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`LRCLib get by ID failed:`, error.message);
    throw error;
  }
}

/**
 * Parse LRC format and extract metadata
 */
export function parseLRC(lrc: string): {
  metadata: Record<string, string>;
  lines: Array<{ time: number; text: string }>;
} {
  const metadata: Record<string, string> = {};
  const lines: Array<{ time: number; text: string }> = [];

  const lrcLines = lrc.split('\n');

  for (const line of lrcLines) {
    // Metadata tags: [ar: Artist], [ti: Title], [al: Album], etc.
    const metaMatch = line.match(/^\[([a-z]+):(.+)\]$/i);
    if (metaMatch) {
      metadata[metaMatch[1]] = metaMatch[2].trim();
      continue;
    }

    // Timestamp lines: [00:12.34] Lyric text
    const timeMatch = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/);
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1]);
      const seconds = parseInt(timeMatch[2]);
      const centiseconds = parseInt(timeMatch[3]);
      const time = minutes * 60 + seconds + centiseconds / 100;
      const text = timeMatch[4].trim();

      if (text) {
        lines.push({ time, text });
      }
    }
  }

  return { metadata, lines };
}

/**
 * Validate lyrics quality
 */
export function validateLyrics(lyrics: LRCLibLyrics): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for instrumental
  if (lyrics.instrumental) {
    issues.push('Track is marked as instrumental');
  }

  // Check for empty lyrics
  if (!lyrics.plainLyrics && !lyrics.syncedLyrics) {
    issues.push('No lyrics available');
  }

  // Check plain text quality
  if (lyrics.plainLyrics) {
    const wordCount = lyrics.plainLyrics.split(/\s+/).length;
    if (wordCount < 10) {
      issues.push(`Plain lyrics too short: ${wordCount} words`);
    }
  }

  // Check synced lyrics quality
  if (lyrics.syncedLyrics) {
    const parsed = parseLRC(lyrics.syncedLyrics);
    if (parsed.lines.length < 5) {
      issues.push(`Synced lyrics too short: ${parsed.lines.length} lines`);
    }

    // Check for timing consistency
    for (let i = 1; i < parsed.lines.length; i++) {
      if (parsed.lines[i].time <= parsed.lines[i - 1].time) {
        issues.push('Synced lyrics have inconsistent timing');
        break;
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Calculate lyrics metrics
 */
export function calculateMetrics(lyrics: LRCLibLyrics): {
  wordCount: number;
  lineCount: number;
  hasTiming: boolean;
} {
  let wordCount = 0;
  let lineCount = 0;

  if (lyrics.plainLyrics) {
    const lines = lyrics.plainLyrics.split('\n').filter(l => l.trim());
    lineCount = lines.length;
    wordCount = lyrics.plainLyrics.split(/\s+/).length;
  } else if (lyrics.syncedLyrics) {
    const parsed = parseLRC(lyrics.syncedLyrics);
    lineCount = parsed.lines.length;
    wordCount = parsed.lines.reduce((sum, line) => sum + line.text.split(/\s+/).length, 0);
  }

  return {
    wordCount,
    lineCount,
    hasTiming: !!lyrics.syncedLyrics,
  };
}
