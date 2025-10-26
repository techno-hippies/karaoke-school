/**
 * MusicBrainz API Service
 * Searches and fetches artist, recording, and work metadata
 */

export interface MusicBrainzArtistData {
  mbid: string;
  spotify_artist_id?: string;
  name: string;
  sort_name: string;
  type: string | null;
  isnis: string[];
  ipi: string | null;
  country: string | null;
  gender: string | null;
  birth_date: string | null;
  death_date: string | null;
  disambiguation: string | null;

  // Social media identifiers
  tiktok_handle?: string | null;
  instagram_handle?: string | null;
  twitter_handle?: string | null;
  facebook_handle?: string | null;
  youtube_channel?: string | null;
  soundcloud_handle?: string | null;

  // Other external IDs
  wikidata_id?: string | null;
  genius_slug?: string | null;
  discogs_id?: string | null;

  raw_data: Record<string, unknown>;
}

export interface MusicBrainzRecordingData {
  recording_mbid: string;
  spotify_track_id?: string;
  isrc: string | null;
  title: string;
  length_ms: number | null;
  raw_data: Record<string, unknown>;
}

export interface MusicBrainzWorkData {
  work_mbid: string;
  iswc: string | null;
  title: string;
  type: string | null;
  language: string | null;  // ISO 639-3 code (e.g., "eng", "kor", "jpn")
  raw_data: Record<string, unknown>;
}

/**
 * Extract social media identifiers from MusicBrainz URL relations
 * Based on musicbrainz-psql reference implementation
 */
function extractSocialIdentifiers(relations: any[]): {
  spotify_artist_id?: string;
  tiktok_handle?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  facebook_handle?: string;
  youtube_channel?: string;
  soundcloud_handle?: string;
  wikidata_id?: string;
  genius_slug?: string;
  discogs_id?: string;
} {
  const identifiers: ReturnType<typeof extractSocialIdentifiers> = {};

  if (!relations || relations.length === 0) {
    return identifiers;
  }

  for (const rel of relations) {
    if (!rel.url) continue;

    const url = rel.url.resource || String(rel.url);

    // Extract Spotify ID
    if (url.includes('spotify.com/artist/')) {
      const match = url.match(/spotify\.com\/artist\/([a-zA-Z0-9]+)/);
      if (match) identifiers.spotify_artist_id = match[1];
    }

    // Extract TikTok handle
    else if (url.includes('tiktok.com/@')) {
      const match = url.match(/tiktok\.com\/@([^/?]+)/);
      if (match) identifiers.tiktok_handle = match[1];
    }

    // Extract Instagram handle
    else if (url.includes('instagram.com/')) {
      const match = url.match(/instagram\.com\/([^/?]+)/);
      if (match && match[1] !== 'p') {
        identifiers.instagram_handle = match[1];
      }
    }

    // Extract Twitter/X handle
    else if (url.includes('twitter.com/') || url.includes('x.com/')) {
      const match = url.match(/(?:twitter|x)\.com\/([^/?]+)/);
      if (match) identifiers.twitter_handle = match[1];
    }

    // Extract Facebook handle
    else if (url.includes('facebook.com/')) {
      const match = url.match(/facebook\.com\/([^/?]+)/);
      if (match) identifiers.facebook_handle = match[1];
    }

    // Extract YouTube channel
    else if (url.includes('youtube.com/')) {
      const match = url.match(/youtube\.com\/(channel|c|user)\/([^/?]+)/);
      if (match) identifiers.youtube_channel = match[2];
    }

    // Extract SoundCloud handle
    else if (url.includes('soundcloud.com/')) {
      const match = url.match(/soundcloud\.com\/([^/?]+)/);
      if (match) identifiers.soundcloud_handle = match[1];
    }

    // Extract Wikidata ID
    else if (url.includes('wikidata.org')) {
      const match = url.match(/wikidata\.org\/(entity|wiki)\/(Q\d+)/);
      if (match) identifiers.wikidata_id = match[2];
    }

    // Extract Genius slug
    else if (url.includes('genius.com/artists/')) {
      const match = url.match(/genius\.com\/artists\/([^/?]+)/);
      if (match) identifiers.genius_slug = match[1];
    }

    // Extract Discogs ID
    else if (url.includes('discogs.com/artist/')) {
      const match = url.match(/discogs\.com\/artist\/(\d+)/);
      if (match) identifiers.discogs_id = match[1];
    }
  }

  return identifiers;
}

export class MusicBrainzService {
  private baseUrl = 'https://musicbrainz.org/ws/2';
  private userAgent = 'TikTokScraper/1.0 (https://github.com/yourusername/tiktok-scraper)';

  /**
   * Rate limiting helper
   */
  private async rateLimitDelay(): Promise<void> {
    // MusicBrainz requires 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Search for artist by name
   */
  async searchArtist(name: string): Promise<any> {
    const query = `artist:"${name}"`;
    const url = `${this.baseUrl}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    await this.rateLimitDelay();
    return await response.json();
  }

  /**
   * Search for recording by title and artist (for normalized matching)
   */
  async searchRecording(title: string, artist: string): Promise<any> {
    const query = `recording:"${title}" AND artist:"${artist}"`;
    const url = `${this.baseUrl}/recording?query=${encodeURIComponent(query)}&fmt=json&limit=5`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    await this.rateLimitDelay();
    return await response.json();
  }

  /**
   * Get artist by MBID with full metadata
   */
  async getArtist(mbid: string): Promise<MusicBrainzArtistData> {
    const url = `${this.baseUrl}/artist/${mbid}?inc=aliases+tags+genres+url-rels+artist-rels&fmt=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    const artist = await response.json() as any;
    await this.rateLimitDelay();

    // Extract all social media identifiers from URL relationships
    const socialIds = extractSocialIdentifiers(artist.relations || []);

    return {
      mbid: artist.id,
      spotify_artist_id: socialIds.spotify_artist_id || undefined,
      name: artist.name,
      sort_name: artist['sort-name'],
      type: artist.type || null,
      isnis: artist.isnis || [],
      ipi: artist.ipis?.[0] || null, // Extract first IPI from array
      country: artist.country || null,
      gender: artist.gender || null,
      birth_date: artist['life-span']?.begin || null,
      death_date: artist['life-span']?.end || null,
      disambiguation: artist.disambiguation || null,

      // Social media identifiers
      tiktok_handle: socialIds.tiktok_handle || null,
      instagram_handle: socialIds.instagram_handle || null,
      twitter_handle: socialIds.twitter_handle || null,
      facebook_handle: socialIds.facebook_handle || null,
      youtube_channel: socialIds.youtube_channel || null,
      soundcloud_handle: socialIds.soundcloud_handle || null,

      // Other external IDs
      wikidata_id: socialIds.wikidata_id || null,
      genius_slug: socialIds.genius_slug || null,
      discogs_id: socialIds.discogs_id || null,

      raw_data: artist,
    };
  }

  /**
   * Search for recording by ISRC
   */
  async searchRecordingByISRC(isrc: string): Promise<any> {
    const url = `${this.baseUrl}/isrc/${isrc}?inc=artist-credits+isrcs+work-rels&fmt=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // ISRC not found
      }
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    await this.rateLimitDelay();
    return await response.json();
  }

  /**
   * Get recording by MBID
   */
  async getRecording(mbid: string): Promise<MusicBrainzRecordingData> {
    const url = `${this.baseUrl}/recording/${mbid}?inc=artist-credits+isrcs+work-rels&fmt=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    const recording = await response.json() as any;
    await this.rateLimitDelay();

    return {
      recording_mbid: recording.id,
      isrc: recording.isrcs?.[0] || null,
      title: recording.title,
      length_ms: recording.length || null,
      raw_data: recording,
    };
  }

  /**
   * Get work by MBID
   */
  async getWork(mbid: string): Promise<MusicBrainzWorkData> {
    const url = `${this.baseUrl}/work/${mbid}?fmt=json`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
      },
    });

    if (!response.ok) {
      throw new Error(`MusicBrainz API error: ${response.status}`);
    }

    const work = await response.json() as any;
    await this.rateLimitDelay();

    return {
      work_mbid: work.id,
      iswc: work.iswcs?.[0] || null,
      title: work.title,
      type: work.type || null,
      language: work.language || null,  // ISO 639-3 code
      raw_data: work,
    };
  }

  /**
   * Search batch recordings by ISRCs (sequential to respect rate limits)
   */
  async searchRecordingsByISRCs(isrcs: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    for (const isrc of isrcs) {
      try {
        const data = await this.searchRecordingByISRC(isrc);
        if (data) {
          results.set(isrc, data);
        }
      } catch (error) {
        console.error(`Failed to search ISRC ${isrc}:`, error);
      }
    }

    return results;
  }
}
