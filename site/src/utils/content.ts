/**
 * Content Conversion Utilities
 *
 * Functions to convert between different content sources and unified types
 */

import type {
  GeniusSearchResult,
  GeniusSongMetadata,
  GeniusReferent,
  GeniusExternalLinks,
} from '../types/genius';
import type {
  Song,
  Segment,
  SegmentMetadata,
  ContentSource,
  UntimestampedLyrics,
} from '../types/song';
import { ContentSource as CS } from '../types/song';

// ============================================================================
// Genius Search → Song Conversion
// ============================================================================

/**
 * Convert Genius search result to unified Song interface
 */
export function convertGeniusSearchToSong(searchResult: GeniusSearchResult): Song {
  return {
    id: searchResult.genius_id.toString(),
    source: CS.Genius,
    title: searchResult.title_with_featured || searchResult.title,
    artist: searchResult.artist,
    thumbnailUrl: searchResult.artwork_thumbnail || undefined,
    _geniusData: searchResult,
  };
}

/**
 * Convert Genius song metadata to unified Song interface
 */
export function convertGeniusSongToSong(songMetadata: GeniusSongMetadata): Song {
  return {
    id: songMetadata.id.toString(),
    source: CS.Genius,
    title: songMetadata.title,
    artist: songMetadata.artist,
    thumbnailUrl: songMetadata.song_art_image_url || songMetadata.header_image_url,
    _geniusData: {
      genius_id: songMetadata.id,
      title: songMetadata.title,
      title_with_featured: songMetadata.title,
      artist: songMetadata.artist,
      artist_id: songMetadata.artist_id,
      genius_slug: songMetadata.path.replace(/^\//, ''),
      url: songMetadata.url,
      artwork_thumbnail: songMetadata.song_art_image_url,
      lyrics_state: 'complete', // Assume complete if we have metadata
    },
  };
}

// ============================================================================
// Genius Referents → Segments Conversion
// ============================================================================

/**
 * Convert Genius referents to unified Segment array
 */
export function convertReferentsToSegments(
  referents: GeniusReferent[],
  songTitle: string,
  artist: string
): Segment[] {
  return referents
    .filter(ref => ref.fragment && ref.fragment.length > 0)
    .map((referent, index) => {
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
      const lineStart = index + 1;
      const lineCount = lines.length;
      const lineEnd = lineStart + lineCount - 1;

      return {
        id: `referent-${referent.id}`,
        source: CS.Genius,
        title: lineCount === 1
          ? `Line ${lineStart}`
          : `Lines ${lineStart}-${lineEnd}`,
        artist,
        sectionType: 'Referent',
        sectionIndex: index,
        lyrics,
        // Genius-specific fields
        annotations: referent.annotation ? [
          {
            id: referent.annotation_id || 0,
            body: referent.annotation,
            votes_total: referent.votes_total,
            verified: referent.verified,
          }
        ] : [],
        characterRange: referent.range || undefined,
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
    languages: ['en'], // Genius defaults to English
  };
}

// ============================================================================
// ID Generation
// ============================================================================

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

// ============================================================================
// External Links
// ============================================================================

/**
 * Format external links for Genius song (from search result)
 */
export function getGeniusExternalLinks(geniusData: GeniusSearchResult): GeniusExternalLinks {
  return {
    songLinks: [
      {
        label: 'View on Genius',
        url: geniusData.url,
      },
    ],
    lyricsLinks: [
      {
        label: 'Full Lyrics & Annotations',
        url: geniusData.url,
      },
    ],
  };
}

/**
 * Format external links for Genius song (from full metadata)
 */
export function getGeniusExternalLinksFromMetadata(
  songMetadata: GeniusSongMetadata
): GeniusExternalLinks {
  const songLinks: Array<{ label: string; url: string }> = [
    {
      label: 'View on Genius',
      url: songMetadata.url,
    },
  ];

  const lyricsLinks: Array<{ label: string; url: string }> = [
    {
      label: 'Full Lyrics & Annotations',
      url: songMetadata.url,
    },
  ];

  // Add media links
  if (songMetadata.youtube_url) {
    songLinks.push({ label: 'YouTube', url: songMetadata.youtube_url });
  }
  if (songMetadata.spotify_uuid) {
    songLinks.push({
      label: 'Spotify',
      url: `https://open.spotify.com/track/${songMetadata.spotify_uuid}`,
    });
  }
  if (songMetadata.soundcloud_url) {
    songLinks.push({ label: 'SoundCloud', url: songMetadata.soundcloud_url });
  }
  if (songMetadata.apple_music_id) {
    songLinks.push({
      label: 'Apple Music',
      url: `https://music.apple.com/us/song/${songMetadata.apple_music_id}`,
    });
  }

  // Add additional media links from media array
  songMetadata.media.forEach(media => {
    if (media.url && !songLinks.some(link => link.url === media.url)) {
      const label = media.provider.charAt(0).toUpperCase() + media.provider.slice(1);
      songLinks.push({ label, url: media.url });
    }
  });

  return { songLinks, lyricsLinks };
}

// ============================================================================
// Content Source Utilities
// ============================================================================

/**
 * Get display name for content source
 */
export function getSourceDisplayName(source: ContentSource): string {
  switch (source) {
    case CS.Native:
      return 'Library';
    case CS.Genius:
      return 'Genius';
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
    default:
      return 'bg-gray-500';
  }
}

/**
 * Check if source supports audio
 */
export function sourceHasAudio(source: ContentSource): boolean {
  return source === CS.Native;
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
