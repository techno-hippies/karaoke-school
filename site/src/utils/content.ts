/**
 * Content Conversion Utilities
 *
 * Functions to convert between different content sources and unified types
 */

import type { GeniusSong, GeniusReferent } from '../types/genius';
import type {
  Song,
  Segment,
  SegmentMetadata,
  ContentSource,
  UntimestampedLyrics,
} from '../types/song';
import { ContentSource as CS } from '../types/song';

/**
 * Convert Genius search result to unified Song interface
 */
export function convertGeniusToSong(geniusResult: GeniusSong): Song {
  return {
    id: geniusResult.genius_id.toString(),
    source: CS.Genius,
    title: geniusResult.title_with_featured || geniusResult.title,
    artist: geniusResult.artist,
    thumbnailUrl: geniusResult.artwork_thumbnail || undefined,
    _geniusData: geniusResult,
  };
}

/**
 * Convert Genius referents to unified Segment array
 */
export function convertReferentsToSegments(
  referents: GeniusReferent[],
  songTitle: string,
  artist: string
): Segment[] {
  return referents.map((referent, index) => {
    // Split fragment into lines
    const lines = referent.fragment
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(text => ({
        text: text.trim(),
        originalText: text.trim(),
      }));

    const lyrics: UntimestampedLyrics = {
      type: 'untimestamped',
      lines,
    };

    // Calculate line range for title
    const lineStart = index * lines.length + 1;
    const lineEnd = lineStart + lines.length - 1;

    return {
      id: `referent-${referent.id}`,
      source: CS.Genius,
      title: lines.length === 1
        ? `Line ${lineStart}`
        : `Lines ${lineStart}-${lineEnd}`,
      artist,
      sectionType: 'Referent',
      sectionIndex: index,
      lyrics,
      annotations: referent.annotations,
      characterRange: referent.range,
    };
  });
}

/**
 * Convert Genius referent to full SegmentMetadata
 */
export function convertReferentToSegmentMetadata(
  referent: GeniusReferent,
  songTitle: string,
  artist: string,
  index: number
): SegmentMetadata {
  const segment = convertReferentsToSegments([referent], songTitle, artist)[0];
  const lyrics = segment.lyrics as UntimestampedLyrics;

  return {
    ...segment,
    totalLines: lyrics.lines.length,
    languages: ['en'], // Genius defaults to English, can be extended
  };
}

/**
 * Generate human-readable song ID from title and artist
 * Used for native songs
 */
export function generateSongId(title: string, artist: string): string {
  const slug = `${title}-${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug;
}

/**
 * Generate segment ID for native segments
 */
export function generateSegmentId(
  sectionType: string,
  sectionIndex: number
): string {
  return `${sectionType.toLowerCase()}-${sectionIndex + 1}`;
}

/**
 * Format external link for Genius song
 */
export function getGeniusExternalLinks(geniusSong: GeniusSong) {
  return {
    songLinks: [
      {
        label: 'View on Genius',
        url: geniusSong.url,
      },
    ],
    lyricsLinks: [
      {
        label: 'Full Lyrics & Annotations',
        url: geniusSong.url,
      },
    ],
  };
}

/**
 * Get display name for content source
 */
export function getSourceDisplayName(source: ContentSource): string {
  switch (source) {
    case CS.Native:
      return 'Library';
    case CS.Genius:
      return 'Genius';
    case CS.Soundcloud:
      return 'SoundCloud';
    case CS.Spotify:
      return 'Spotify';
    default:
      return 'Unknown';
  }
}

/**
 * Get icon/badge color for content source
 */
export function getSourceColor(source: ContentSource): string {
  switch (source) {
    case CS.Native:
      return 'bg-blue-500';
    case CS.Genius:
      return 'bg-yellow-500';
    case CS.Soundcloud:
      return 'bg-orange-500';
    case CS.Spotify:
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
}

/**
 * Check if source supports audio
 */
export function sourceHasAudio(source: ContentSource): boolean {
  return source === CS.Native || source === CS.Soundcloud || source === CS.Spotify;
}

/**
 * Check if source supports timestamps
 */
export function sourceHasTimestamps(source: ContentSource): boolean {
  return source === CS.Native;
}

/**
 * Check if source supports multiple recording modes
 */
export function sourceHasMultipleModes(source: ContentSource): boolean {
  return source === CS.Native; // Only native has Practice/Perform/Lip Sync
}
