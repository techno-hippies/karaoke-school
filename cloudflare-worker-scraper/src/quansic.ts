/**
 * Quansic Service Client
 * Calls the Quansic service (running on Akash) to enrich artist data
 * The service handles authentication and API calls to Quansic
 */

export interface QuansicArtistData {
  isni: string;
  musicbrainz_mbid?: string;
  ipn: string | null;
  luminate_id: string | null;
  gracenote_id: string | null;
  amazon_id: string | null;
  apple_music_id: string | null;
  name_variants: Array<{ name: string; language?: string }>;
  raw_data: Record<string, unknown>;
}

export class QuansicService {
  private serviceUrl: string;

  constructor(serviceUrl: string) {
    this.serviceUrl = serviceUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Enrich artist with complete Quansic data via Quansic service
   * The service handles authentication, ISNI lookup, entity search, and Spotify ID fallback
   */
  async enrichArtist(
    isni: string,
    musicbrainzMbid?: string,
    spotifyArtistId?: string
  ): Promise<QuansicArtistData> {
    console.log(`Enriching ISNI ${isni} with Quansic...`);

    // Build query params
    const params = new URLSearchParams();
    if (musicbrainzMbid) {
      params.set('musicbrainz_mbid', musicbrainzMbid);
    }
    if (spotifyArtistId) {
      params.set('spotify_artist_id', spotifyArtistId);
    }

    const url = `${this.serviceUrl}/enrich/${isni.replace(/\s/g, '')}${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Quansic service error ${response.status}:`, errorText.substring(0, 200));
      throw new Error(`Quansic service error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Batch enrich multiple artists
   */
  async enrichArtists(
    artists: Array<{ isni: string; musicbrainz_mbid?: string; spotify_artist_id?: string }>
  ): Promise<QuansicArtistData[]> {
    const results: QuansicArtistData[] = [];

    for (const artist of artists) {
      try {
        const enriched = await this.enrichArtist(
          artist.isni,
          artist.musicbrainz_mbid,
          artist.spotify_artist_id
        );
        results.push(enriched);

        // Small delay between requests to avoid overwhelming the service
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Failed to enrich ${artist.isni}:`, error);
      }
    }

    return results;
  }
}
