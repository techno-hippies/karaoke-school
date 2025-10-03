/**
 * Genius.com API Types
 *
 * Types for Genius search results and referents (annotated lyric segments)
 */

// Genius search result (from search Lit Action)
export interface GeniusSong {
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

// Genius referent (annotated lyric segment)
export interface GeniusReferent {
  id: number;
  fragment: string;                       // The lyric text
  song_id: number;
  range: { start: number; end: number };  // Character positions in full lyrics
  annotations?: GeniusAnnotation[];       // Optional annotations
}

// Genius annotation (community-contributed explanation)
export interface GeniusAnnotation {
  id: number;
  body: string;                           // Markdown explanation
  votes_total: number;
  verified: boolean;
  authors: GeniusAuthor[];
}

// Genius contributor
export interface GeniusAuthor {
  id: number;
  name: string;
  avatar_url?: string;
  iq: number;                             // Genius IQ score
}

// Genius song full response (from /songs/{id} endpoint)
export interface GeniusSongFull extends GeniusSong {
  lyrics?: string;                        // Full lyrics (plain text)
  description?: string;                   // Song description
  release_date?: string;
  album?: {
    id: number;
    name: string;
    cover_art_url: string;
  };
  featured_artists?: Array<{
    id: number;
    name: string;
  }>;
  producer_artists?: Array<{
    id: number;
    name: string;
  }>;
  media?: Array<{
    provider: string;                     // 'youtube', 'spotify', etc.
    type: string;
    url: string;
  }>;
}
