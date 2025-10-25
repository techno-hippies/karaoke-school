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
  raw_data: Record<string, unknown>;
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

    // Extract Spotify ID from URL relationships
    let spotifyId: string | undefined;
    if (artist.relations) {
      for (const rel of artist.relations) {
        if (rel.type === 'streaming' && rel.url?.resource?.includes('spotify.com/artist/')) {
          const match = rel.url.resource.match(/artist\/([a-zA-Z0-9]+)/);
          if (match) {
            spotifyId = match[1];
            break;
          }
        }
      }
    }

    return {
      mbid: artist.id,
      spotify_artist_id: spotifyId,
      name: artist.name,
      sort_name: artist['sort-name'],
      type: artist.type || null,
      isnis: artist.isnis || [],
      ipi: artist.ipi || null,
      country: artist.country || null,
      gender: artist.gender || null,
      birth_date: artist['life-span']?.begin || null,
      death_date: artist['life-span']?.end || null,
      disambiguation: artist.disambiguation || null,
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
