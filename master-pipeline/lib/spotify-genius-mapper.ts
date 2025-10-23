/**
 * Spotify to Genius Mapper
 * Maps Spotify track IDs to Genius song IDs using two-phase matching:
 * 1. Direct Spotify ID match from Genius media array (100% confidence)
 * 2. Fuzzy metadata matching (title/artist/album with weighted scoring)
 */

import { requireEnv } from './config';

// ============================================================================
// Types
// ============================================================================

export interface SpotifyTrackMetadata {
  id: string;
  name: string;
  artists: string[];
  album: string;
  releaseDate: string;
  isrc?: string;
  uri: string;
}

export interface GeniusSearchResult {
  id: number;
  title: string;
  titleWithFeatured: string;
  artist: string;
  artistId?: number;
  path: string;
  url: string;
  artworkThumbnail?: string;
  lyricsState: string;
}

export interface GeniusSongMetadata {
  id: number;
  title: string;
  titleWithFeatured: string;
  artist: string;
  artistId?: number;
  path: string;
  url: string;
  artworkUrl: string;
  artworkThumbnailUrl: string;
  releaseDate?: string;
  spotifyUuid?: string | null;
  media: Array<{
    provider: string;
    url: string;
    type: string;
    nativeUri?: string;
  }>;
}

export interface MatchResult {
  geniusId: number;
  geniusArtistId?: number;
  confidence: number;
  matchType: 'spotify_id' | 'fuzzy_metadata';
  matchDetails: {
    titleScore?: number;
    artistScore?: number;
    spotifyIdMatched?: boolean;
  };
  geniusData: {
    title: string;
    artist: string;
    url: string;
    path: string;
    artwork?: string;
  };
  spotifyData: SpotifyTrackMetadata;
}

// ============================================================================
// Spotify API Client
// ============================================================================

class SpotifyClient {
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor() {
    this.clientId = requireEnv('SPOTIFY_CLIENT_ID');
    this.clientSecret = requireEnv('SPOTIFY_CLIENT_SECRET');
  }

  /**
   * Get access token using client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spotify auth error response:', errorText);
      throw new Error(`Spotify auth failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // Expire 1 min early

    return this.accessToken;
  }

  /**
   * Fetch track metadata from Spotify
   */
  async getTrack(trackId: string): Promise<SpotifyTrackMetadata> {
    const token = await this.getAccessToken();

    const response = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const track = await response.json();

    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map((a: any) => a.name),
      album: track.album.name,
      releaseDate: track.album.release_date,
      isrc: track.external_ids?.isrc,
      uri: track.uri,
    };
  }
}

// ============================================================================
// Genius API Client
// ============================================================================

class GeniusClient {
  private apiKey: string;

  constructor() {
    this.apiKey = requireEnv('GENIUS_API_KEY');
  }

  /**
   * Search Genius for songs
   */
  async search(query: string, limit: number = 10): Promise<GeniusSearchResult[]> {
    const url = `https://api.genius.com/search?q=${encodeURIComponent(query)}&per_page=${limit}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Genius search failed: ${response.status}`);
    }

    const data: any = await response.json();

    if (!data.response?.hits) return [];

    return data.response.hits.map((hit: any) => {
      const result = hit.result;
      return {
        id: result.id,
        title: result.title,
        titleWithFeatured: result.title_with_featured,
        artist: result.primary_artist?.name || result.artist_names,
        artistId: result.primary_artist?.id,
        path: result.path?.replace(/^\//, '') || '',
        url: result.url,
        artworkThumbnail: result.song_art_image_thumbnail_url || result.header_image_thumbnail_url,
        lyricsState: result.lyrics_state,
      };
    });
  }

  /**
   * Fetch full song metadata from Genius
   */
  async getSong(songId: number): Promise<GeniusSongMetadata | null> {
    const url = `https://api.genius.com/songs/${songId}?text_format=plain`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`⚠️  Failed to fetch Genius song ${songId}: ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    if (!data.response?.song) return null;

    const song = data.response.song;
    return {
      id: song.id,
      title: song.title,
      titleWithFeatured: song.title_with_featured,
      artist: song.primary_artist?.name || song.artist_names,
      artistId: song.primary_artist?.id,
      path: song.path,
      url: song.url,
      artworkUrl: song.song_art_image_url,
      artworkThumbnailUrl: song.song_art_image_thumbnail_url,
      releaseDate: song.release_date_for_display,
      spotifyUuid: song.spotify_uuid || null,
      media: (song.media || []).map((m: any) => ({
        provider: m.provider,
        url: m.url,
        type: m.type,
        nativeUri: m.native_uri,
      })),
    };
  }
}

// ============================================================================
// Matcher
// ============================================================================

export class SpotifyGeniusMatcher {
  private spotify: SpotifyClient;
  private genius: GeniusClient;

  constructor() {
    this.spotify = new SpotifyClient();
    this.genius = new GeniusClient();
  }

  /**
   * Normalize string for fuzzy matching
   * - Lowercase
   * - Remove parentheses and brackets content
   * - Remove featuring artists
   * - Remove special characters
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/\s*[\(\[\{].*?[\)\]\}]\s*/g, '') // Remove (anything)
      .replace(/\s+(feat\.|ft\.|featuring)\s+.*/i, '') // Remove feat. ...
      .replace(/[^\w\s]/g, '') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Calculate string similarity (Sørensen-Dice coefficient)
   * Returns value between 0 and 1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Create bigrams
    const bigrams1 = new Set<string>();
    for (let i = 0; i < str1.length - 1; i++) {
      bigrams1.add(str1.substring(i, i + 2));
    }

    const bigrams2 = new Set<string>();
    for (let i = 0; i < str2.length - 1; i++) {
      bigrams2.add(str2.substring(i, i + 2));
    }

    // Calculate intersection
    const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));

    // Sørensen-Dice coefficient
    if (bigrams1.size + bigrams2.size === 0) return 0;
    return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
  }

  /**
   * Extract Spotify track ID from Genius media array
   */
  private extractSpotifyIdFromMedia(
    media: GeniusSongMetadata['media']
  ): string | null {
    const spotifyMedia = media.find(
      m => m.provider === 'spotify' && m.type === 'audio'
    );

    if (!spotifyMedia) return null;

    // Try native_uri first (format: "spotify:track:TRACK_ID")
    if (spotifyMedia.nativeUri) {
      const match = spotifyMedia.nativeUri.match(/spotify:track:([A-Za-z0-9]+)/);
      if (match) return match[1];
    }

    // Try URL format (format: "https://open.spotify.com/track/TRACK_ID")
    if (spotifyMedia.url) {
      const match = spotifyMedia.url.match(/track\/([A-Za-z0-9]+)/);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Phase 1: Try to match via Spotify ID in Genius media array
   */
  private async matchBySpotifyId(
    spotifyTrackId: string,
    searchResults: GeniusSearchResult[],
    spotifyMetadata: SpotifyTrackMetadata
  ): Promise<MatchResult | null> {
    console.log(`   🔍 Phase 1: Checking for direct Spotify ID match...`);

    // Check top 5 results for Spotify ID match
    for (const result of searchResults.slice(0, 5)) {
      const songData = await this.genius.getSong(result.id);
      if (!songData) continue;

      const geniusSpotifyId = this.extractSpotifyIdFromMedia(songData.media);

      if (geniusSpotifyId === spotifyTrackId) {
        console.log(`   ✅ Found exact Spotify ID match in Genius song ${result.id}`);
        return {
          geniusId: songData.id,
          geniusArtistId: songData.artistId,
          confidence: 1.0,
          matchType: 'spotify_id',
          matchDetails: {
            spotifyIdMatched: true,
          },
          geniusData: {
            title: songData.title,
            artist: songData.artist,
            url: songData.url,
            path: songData.path.replace(/^\//, ''),
            artwork: songData.artworkThumbnailUrl,
          },
          spotifyData: spotifyMetadata,
        };
      }

      // Rate limit protection
      await this.sleep(300);
    }

    console.log(`   ℹ️  No direct Spotify ID match found`);
    return null;
  }

  /**
   * Phase 2: Fuzzy metadata matching with weighted scoring
   */
  private async matchByMetadata(
    spotifyMetadata: SpotifyTrackMetadata,
    searchResults: GeniusSearchResult[]
  ): Promise<MatchResult | null> {
    console.log(`   🔍 Phase 2: Fuzzy metadata matching...`);

    const normalizedSpotifyTitle = this.normalizeString(spotifyMetadata.name);
    const normalizedSpotifyArtists = spotifyMetadata.artists.map(a =>
      this.normalizeString(a)
    );

    let bestMatch: MatchResult | null = null;
    let bestScore = 0;

    for (const result of searchResults) {
      const normalizedGeniusTitle = this.normalizeString(result.title);
      const normalizedGeniusArtist = this.normalizeString(result.artist);

      // Calculate title similarity
      const titleScore = this.calculateSimilarity(
        normalizedSpotifyTitle,
        normalizedGeniusTitle
      );

      // Calculate artist similarity (max score across all Spotify artists)
      const artistScore = Math.max(
        ...normalizedSpotifyArtists.map(spotifyArtist =>
          this.calculateSimilarity(spotifyArtist, normalizedGeniusArtist)
        )
      );

      // Weighted total score (title 45%, artist 40%, base 15%)
      const totalScore = 0.45 * titleScore + 0.4 * artistScore + 0.15;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = {
          geniusId: result.id,
          geniusArtistId: result.artistId,
          confidence: totalScore,
          matchType: 'fuzzy_metadata',
          matchDetails: {
            titleScore,
            artistScore,
          },
          geniusData: {
            title: result.title,
            artist: result.artist,
            url: result.url,
            path: result.path,
            artwork: result.artworkThumbnail,
          },
          spotifyData: spotifyMetadata,
        };
      }
    }

    if (bestMatch) {
      console.log(
        `   📊 Best fuzzy match: ${bestMatch.geniusData.title} by ${bestMatch.geniusData.artist}`
      );
      console.log(
        `      Confidence: ${(bestMatch.confidence * 100).toFixed(1)}% ` +
          `(title: ${((bestMatch.matchDetails.titleScore || 0) * 100).toFixed(1)}%, ` +
          `artist: ${((bestMatch.matchDetails.artistScore || 0) * 100).toFixed(1)}%)`
      );
    }

    return bestMatch;
  }

  /**
   * Main matching function
   * Takes a Spotify track ID and returns Genius song ID + artist ID + confidence
   */
  async matchSpotifyToGenius(
    spotifyTrackId: string,
    minConfidence: number = 0.7
  ): Promise<MatchResult | null> {
    console.log(`\n🔍 Matching Spotify track ${spotifyTrackId} to Genius...`);

    // Step 1: Fetch Spotify metadata
    console.log(`   📀 Fetching Spotify metadata...`);
    const spotifyMetadata = await this.spotify.getTrack(spotifyTrackId);
    console.log(
      `   • Spotify: ${spotifyMetadata.name} by ${spotifyMetadata.artists.join(', ')}`
    );
    if (spotifyMetadata.isrc) {
      console.log(`   • ISRC: ${spotifyMetadata.isrc}`);
    }

    // Step 2: Search Genius
    const query = `${spotifyMetadata.artists[0]} ${spotifyMetadata.name}`;
    console.log(`   🔎 Searching Genius: "${query}"`);

    const searchResults = await this.genius.search(query, 10);

    if (searchResults.length === 0) {
      console.log(`   ❌ No Genius search results found`);
      return null;
    }

    console.log(`   ℹ️  Found ${searchResults.length} Genius results`);

    // Step 3: Phase 1 - Try Spotify ID match
    const spotifyIdMatch = await this.matchBySpotifyId(
      spotifyTrackId,
      searchResults,
      spotifyMetadata
    );
    if (spotifyIdMatch) {
      return spotifyIdMatch;
    }

    // Step 4: Phase 2 - Fuzzy metadata match
    const metadataMatch = await this.matchByMetadata(spotifyMetadata, searchResults);

    if (!metadataMatch) {
      console.log(`   ❌ No match found`);
      return null;
    }

    if (metadataMatch.confidence < minConfidence) {
      console.log(
        `   ⚠️  Match confidence ${(metadataMatch.confidence * 100).toFixed(1)}% ` +
          `below threshold ${(minConfidence * 100).toFixed(1)}%`
      );
      return null;
    }

    return metadataMatch;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// CLI Usage
// ============================================================================

if (import.meta.main) {
  const spotifyTrackId = process.argv[2];

  if (!spotifyTrackId) {
    console.error('Usage: bun lib/spotify-genius-mapper.ts <spotify_track_id>');
    console.error('Example: bun lib/spotify-genius-mapper.ts 3n3Ppam7vgaVa1iaRUc9Lp');
    process.exit(1);
  }

  try {
    const matcher = new SpotifyGeniusMatcher();
    const match = await matcher.matchSpotifyToGenius(spotifyTrackId);

    if (match) {
      console.log('\n✅ Match found!');
      console.log(JSON.stringify(match, null, 2));
    } else {
      console.log('\n❌ No match found');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}
