/**
 * Filename parser for extracting artist, title, and track type from audio filenames
 * Supports formats:
 * - "Artist - Title.mp3"
 * - "Artist - Title (Vocals).mp3"
 * - "Artist - Title (Instrumental).mp3"
 */

export interface ParsedFilename {
  artist: string;
  title: string;
  isVocals: boolean;
  isInstrumental: boolean;
  isFullTrack: boolean;
  raw: string;
}

/**
 * Parse audio filename to extract metadata
 * @param filename - Full filename including extension (e.g., "Ethel Waters - Down Home Blues.mp3")
 * @returns Parsed metadata or null if format is invalid
 */
export function parseAudioFilename(filename: string): ParsedFilename | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(mp3|wav|m4a)$/i, '');

  // Check for track type suffixes
  const vocalsMatch = nameWithoutExt.match(/^(.+?)\s*\(Vocals?\)$/i);
  const instrumentalMatch = nameWithoutExt.match(/^(.+?)\s*\(Instrumental\)$/i);

  let cleanName = nameWithoutExt;
  let isVocals = false;
  let isInstrumental = false;

  if (vocalsMatch) {
    cleanName = vocalsMatch[1].trim();
    isVocals = true;
  } else if (instrumentalMatch) {
    cleanName = instrumentalMatch[1].trim();
    isInstrumental = true;
  }

  // Split by hyphen to get artist and title
  const parts = cleanName.split(' - ');

  if (parts.length < 2) {
    // No hyphen separator found - invalid format
    return null;
  }

  // Handle multiple hyphens: "Artist - Title - Subtitle" -> Artist: "Artist", Title: "Title - Subtitle"
  const artist = parts[0].trim();
  const title = parts.slice(1).join(' - ').trim();

  if (!artist || !title) {
    return null;
  }

  return {
    artist,
    title,
    isVocals,
    isInstrumental,
    isFullTrack: !isVocals && !isInstrumental,
    raw: filename
  };
}

/**
 * Generate normalized folder name from parsed filename
 * Converts to lowercase, replaces spaces with hyphens, removes special chars
 * @param parsed - Parsed filename metadata
 * @returns Normalized folder name (e.g., "ethel-waters-down-home-blues")
 */
export function generateFolderName(parsed: ParsedFilename): string {
  const combined = `${parsed.artist} ${parsed.title}`;
  return combined
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '');        // Remove leading/trailing hyphens
}

/**
 * Generate normalized song ID for clip naming
 * @param parsed - Parsed filename metadata
 * @returns Normalized song ID (e.g., "downhome-blues")
 */
export function generateSongId(parsed: ParsedFilename): string {
  return parsed.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
