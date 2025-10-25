/**
 * Quansic API Service
 * Enriches artist data with additional identifiers and name variants
 * Requires authenticated session cookie
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
  private sessionCookie: string;

  constructor(sessionCookie: string) {
    this.sessionCookie = sessionCookie;
  }

  /**
   * Fetch artist party data from Quansic
   */
  async getArtistParty(isni: string): Promise<any> {
    // Remove spaces from ISNI if present
    const cleanIsni = isni.replace(/\s/g, '');
    const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${cleanIsni}`;

    const response = await fetch(url, {
      headers: {
        'cookie': this.sessionCookie,
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Quansic session expired - please refresh QUANSIC_SESSION_COOKIE secret');
      }
      throw new Error(`Quansic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
  }

  /**
   * Fetch artist name variants
   */
  async getArtistNameVariants(isni: string): Promise<Array<{ name: string; language?: string }>> {
    const cleanIsni = isni.replace(/\s/g, '');
    const url = `https://explorer.quansic.com/api/q/lookup/party/Quansic::isni::${cleanIsni}/nameVariants`;

    const response = await fetch(url, {
      headers: {
        'cookie': this.sessionCookie,
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Quansic session expired - please refresh QUANSIC_SESSION_COOKIE secret');
      }
      console.warn(`Failed to fetch name variants for ${isni}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const variants = data.results?.nameVariants || [];

    return variants.map((v: any) => ({
      name: v.fullname || v.name,
      language: v.language,
    }));
  }

  /**
   * Enrich artist with complete Quansic data
   */
  async enrichArtist(isni: string, musicbrainzMbid?: string): Promise<QuansicArtistData> {
    console.log(`Enriching ISNI ${isni} with Quansic...`);

    const [party, nameVariants] = await Promise.all([
      this.getArtistParty(isni),
      this.getArtistNameVariants(isni),
    ]);

    const ids = party.party?.ids || {};

    return {
      isni: isni.replace(/\s/g, ''),
      musicbrainz_mbid: musicbrainzMbid,
      ipn: ids.ipns?.[0] || null,
      luminate_id: ids.luminateIds?.[0] || null,
      gracenote_id: ids.gracenoteIds?.[0] || null,
      amazon_id: ids.amazonIds?.[0] || null,
      apple_music_id: ids.appleIds?.[0] || null,
      name_variants: nameVariants,
      raw_data: party,
    };
  }

  /**
   * Batch enrich multiple artists
   */
  async enrichArtists(
    artists: Array<{ isni: string; musicbrainz_mbid?: string }>
  ): Promise<QuansicArtistData[]> {
    const results: QuansicArtistData[] = [];

    for (const artist of artists) {
      try {
        const enriched = await this.enrichArtist(artist.isni, artist.musicbrainz_mbid);
        results.push(enriched);

        // Rate limiting: 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Failed to enrich ${artist.isni}:`, error);
      }
    }

    return results;
  }
}
