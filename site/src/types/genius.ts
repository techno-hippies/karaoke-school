/**
 * Genius.com API Types
 *
 * Types matching the actual Genius Lit Action responses (v7/v8)
 * These types correspond to the data returned from lit-actions/src/search/
 */

// ============================================================================
// Search Response Types (from free.js)
// ============================================================================

/**
 * Genius search result
 * Returned by the search Lit Action
 */
export interface GeniusSearchResult {
  genius_id: number;
  title: string;
  title_with_featured: string;
  artist: string;
  artist_id?: number;
  genius_slug: string;
  url: string;
  artwork_thumbnail: string | null;
  lyrics_state: string;  // 'complete', 'incomplete', etc.
  _score?: number;        // Search relevance score
}

/**
 * Search Lit Action response
 */
export interface GeniusSearchResponse {
  success: boolean;
  results: GeniusSearchResult[];
  count: number;
  keyUsed?: number;
  version?: string;
  analytics?: string;
  error?: string;
}

// ============================================================================
// Song Metadata Types (from song.js)
// ============================================================================

/**
 * Artist reference (used in featured_artists, producer_artists, writer_artists)
 */
export interface GeniusArtistReference {
  id: number;
  name: string;
}

/**
 * Album reference
 */
export interface GeniusAlbumReference {
  id: number;
  name: string;
  url: string;
}

/**
 * Media link (YouTube, Spotify, etc.)
 */
export interface GeniusMediaLink {
  provider: string;  // 'youtube', 'spotify', 'soundcloud', etc.
  type: string;
  url: string;
}

/**
 * Full song metadata
 * Returned by the song Lit Action
 */
export interface GeniusSongMetadata {
  id: number;
  title: string;
  artist: string;
  artist_id?: number;
  url: string;
  path: string;
  header_image_url: string;
  song_art_image_url: string;
  release_date: string | null;
  description: string;
  featured_artists: GeniusArtistReference[];
  producer_artists: GeniusArtistReference[];
  writer_artists: GeniusArtistReference[];
  album: GeniusAlbumReference | null;
  media: GeniusMediaLink[];
  apple_music_id?: string;
  spotify_uuid?: string;
  youtube_url?: string;
  soundcloud_url?: string;
}

/**
 * Song Lit Action response
 */
export interface GeniusSongResponse {
  success: boolean;
  song: GeniusSongMetadata | null;
  keyUsed?: number;
  version?: string;
  error?: string;
}

// ============================================================================
// Referents Response Types (from referents.js)
// ============================================================================

/**
 * Range in lyrics (character positions)
 */
export interface GeniusRange {
  start: number;
  end: number;
}

/**
 * Single referent (annotated lyric segment)
 * Returned by the referents Lit Action
 */
export interface GeniusReferent {
  id: number;
  fragment: string;                  // Lyric text (cleaned, no [Producer] tags)
  range: GeniusRange | null;
  annotation_id: number | null;
  annotation: string;                // Plain text annotation body
  votes_total: number;
  verified: boolean;
  classification: string;            // 'verified', 'accepted', 'unknown', etc.
}

/**
 * Referents Lit Action response
 */
export interface GeniusReferentsResponse {
  success: boolean;
  songId: string;
  page: number;
  count: number;
  referents: GeniusReferent[];
  next_page: number | null;
  keyUsed?: number;
  version?: string;
  error?: string;
}

// ============================================================================
// Legacy Aliases (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use GeniusSearchResult instead
 */
export type GeniusSong = GeniusSearchResult;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * All possible Genius API error types
 */
export type GeniusError =
  | 'RATE_LIMITED'
  | 'SONG_NOT_FOUND'
  | 'unknown_error'
  | string;

/**
 * Combined response type (discriminated union)
 */
export type GeniusLitActionResponse =
  | GeniusSearchResponse
  | GeniusSongResponse
  | GeniusReferentsResponse;

/**
 * External links extracted from song metadata
 */
export interface GeniusExternalLinks {
  songLinks: Array<{
    label: string;
    url: string;
  }>;
  lyricsLinks: Array<{
    label: string;
    url: string;
  }>;
}

/**
 * Generate external links for a Genius song
 * Creates privacy-preserving mirror links
 */
export function generateGeniusExternalLinks(song: GeniusSongMetadata): GeniusExternalLinks {
  console.log('[generateGeniusExternalLinks] Input song:', song);
  const songLinks: Array<{ label: string; url: string }> = [];
  const lyricsLinks: Array<{ label: string; url: string }> = [];

  // Extract media links (YouTube, Spotify, etc.)
  if (song.media && song.media.length > 0) {
    console.log('[generateGeniusExternalLinks] Found media links:', song.media);

    song.media.forEach(media => {
      if (media.provider === 'youtube' && media.url) {
        songLinks.push({ label: 'YouTube', url: media.url });
      } else if (media.provider === 'spotify' && media.url) {
        songLinks.push({ label: 'Spotify', url: media.url });
      }
    });
  }

  // Add Apple Music if available
  if (song.apple_music_id) {
    console.log('[generateGeniusExternalLinks] Found apple_music_id:', song.apple_music_id);
    songLinks.push({
      label: 'Apple Music',
      url: `https://music.apple.com/us/song/${song.apple_music_id}`
    });
  }

  // Extract SoundCloud slug if available
  if (song.soundcloud_url) {
    console.log('[generateGeniusExternalLinks] Found soundcloud_url:', song.soundcloud_url);
    const soundcloudSlug = extractSoundcloudSlug(song.soundcloud_url);
    console.log('[generateGeniusExternalLinks] Extracted slug:', soundcloudSlug);
    if (soundcloudSlug) {
      songLinks.push({ label: 'SoundCloud', url: song.soundcloud_url });
      songLinks.push({ label: 'Maid.zone', url: `https://sc.maid.zone/${soundcloudSlug}` });
    }
  } else {
    console.log('[generateGeniusExternalLinks] No soundcloud_url found');
  }

  // Genius lyrics links (original + mirrors)
  console.log('[generateGeniusExternalLinks] Building lyrics links with url:', song.url, 'path:', song.path);
  lyricsLinks.push({ label: 'Genius', url: song.url });
  lyricsLinks.push({ label: 'Intellectual', url: `https://intellectual.insprill.net${song.path}` });
  lyricsLinks.push({ label: 'Dumb', url: `https://dm.vern.cc${song.path}` });

  console.log('[generateGeniusExternalLinks] Final songLinks:', songLinks);
  console.log('[generateGeniusExternalLinks] Final lyricsLinks:', lyricsLinks);

  return { songLinks, lyricsLinks };
}

/**
 * Extract slug from SoundCloud URL
 * @example "https://soundcloud.com/eminemofficial/mockingbird" -> "eminemofficial/mockingbird"
 */
function extractSoundcloudSlug(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('soundcloud.com')) {
      // Remove leading slash and return path
      return parsed.pathname.substring(1);
    }
  } catch (error) {
    console.error('Failed to parse SoundCloud URL:', error);
  }
  return null;
}
