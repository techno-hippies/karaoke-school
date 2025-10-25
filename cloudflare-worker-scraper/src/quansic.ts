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
      const errorText = await response.text();
      console.error(`Quansic API error ${response.status} for ISNI ${cleanIsni}:`, errorText.substring(0, 200));

      if (response.status === 401 || response.status === 403) {
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
   * Search for artist party by ISNI using entity search (fallback when direct lookup fails)
   * This searches across all ISNIs including secondary ones
   */
  async searchByISNI(isni: string): Promise<any> {
    const cleanIsni = isni.replace(/\s/g, '');
    const url = 'https://explorer.quansic.com/api/log/entitySearch';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'cookie': this.sessionCookie,
        'accept': 'application/json',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        entityType: 'isni',
        searchTerm: cleanIsni,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Entity search failed (${response.status}):`, errorText.substring(0, 200));
      return null;
    }

    const responseText = await response.text();
    if (!responseText || responseText.trim() === '') {
      console.error('Entity search returned empty response');
      return null;
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse entity search response:', responseText.substring(0, 200));
      return null;
    }

    const parties = data.results?.parties;

    if (parties && parties.length > 0) {
      // Return the first match - convert to same format as getArtistParty
      console.log(`Found via entity search! Primary ISNI: ${parties[0].ids.isnis[0]}`);
      return { party: parties[0] };
    }

    return null;
  }

  /**
   * Enrich artist with complete Quansic data
   * Now supports fallback to entity search if ISNI direct lookup fails
   */
  async enrichArtist(isni: string, musicbrainzMbid?: string): Promise<QuansicArtistData> {
    console.log(`Enriching ISNI ${isni} with Quansic...`);

    let party = null;
    let actualIsni = isni;

    try {
      // Try direct ISNI lookup first
      party = await this.getArtistParty(isni);
    } catch (error) {
      // If direct lookup fails, try entity search (finds secondary ISNIs)
      if (error instanceof Error && error.message.includes('404')) {
        console.log(`Direct ISNI lookup failed, trying entity search for ${isni}...`);
        party = await this.searchByISNI(isni);

        // Extract the primary ISNI from Quansic data
        if (party?.party?.ids?.isnis?.length > 0) {
          actualIsni = party.party.ids.isnis[0];
          console.log(`Found via search! Primary Quansic ISNI: ${actualIsni} (MusicBrainz had: ${isni})`);
        }
      }

      // If still no party data, re-throw the error
      if (!party) {
        throw error;
      }
    }

    const nameVariants = await this.getArtistNameVariants(actualIsni);
    const ids = party.party?.ids || {};

    return {
      isni: actualIsni.replace(/\s/g, ''),
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
