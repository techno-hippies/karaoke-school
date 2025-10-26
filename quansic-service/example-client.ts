/**
 * Example: How to use Quansic Service from Cloudflare Worker
 *
 * This shows how to integrate the Akash-deployed Quansic service
 * into your enrichment pipeline.
 */

// Configuration
const QUANSIC_SERVICE_URL = 'https://your-akash-deployment-url.provider.akash.network';

interface QuansicEnrichmentResult {
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

/**
 * Enrich artist with Quansic data via Akash service
 */
async function enrichWithQuansic(
  isni: string,
  musicbrainzMbid?: string
): Promise<QuansicEnrichmentResult | null> {
  try {
    const response = await fetch(`${QUANSIC_SERVICE_URL}/enrich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isni,
        musicbrainz_mbid: musicbrainzMbid,
      }),
    });

    if (!response.ok) {
      console.error(`Quansic service error: ${response.status}`);
      return null;
    }

    const result = await response.json();
    return result.data;

  } catch (error) {
    console.error('Failed to enrich with Quansic:', error);
    return null;
  }
}

/**
 * Search for artist by ISNI (fallback for secondary ISNIs)
 */
async function searchQuansicByISNI(isni: string): Promise<any> {
  try {
    const response = await fetch(`${QUANSIC_SERVICE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isni }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    return result.data;

  } catch (error) {
    console.error('Quansic search failed:', error);
    return null;
  }
}

/**
 * Example: Enrich MusicBrainz artists from Neon DB
 */
async function enrichMusicBrainzArtists() {
  // This would be in your Cloudflare Worker enrichment route
  // Example from cloudflare-worker-scraper/src/routes/enrichment.ts

  const neonResponse = await fetch(
    `${neonApiUrl}/sql`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${neonApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          SELECT mbid, name, isnis[1] as primary_isni
          FROM musicbrainz_artists
          WHERE isnis IS NOT NULL
            AND isnis[1] IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM quansic_artists
              WHERE musicbrainz_mbid = musicbrainz_artists.mbid
            )
          LIMIT 100
        `,
      }),
    }
  );

  const { results } = await neonResponse.json();

  for (const artist of results) {
    const { mbid, name, primary_isni } = artist;

    console.log(`Enriching ${name} (${mbid}) with ISNI ${primary_isni}...`);

    // Call Quansic service
    const enriched = await enrichWithQuansic(primary_isni, mbid);

    if (enriched) {
      // Store in Neon DB
      await fetch(
        `${neonApiUrl}/sql`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${neonApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `
              INSERT INTO quansic_artists (
                isni, musicbrainz_mbid, ipn, luminate_id,
                gracenote_id, amazon_id, apple_music_id,
                name_variants, raw_data
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (isni) DO UPDATE SET
                ipn = EXCLUDED.ipn,
                luminate_id = EXCLUDED.luminate_id,
                gracenote_id = EXCLUDED.gracenote_id,
                amazon_id = EXCLUDED.amazon_id,
                apple_music_id = EXCLUDED.apple_music_id,
                name_variants = EXCLUDED.name_variants,
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW()
            `,
            params: [
              enriched.isni,
              enriched.musicbrainz_mbid,
              enriched.ipn,
              enriched.luminate_id,
              enriched.gracenote_id,
              enriched.amazon_id,
              enriched.apple_music_id,
              JSON.stringify(enriched.name_variants),
              JSON.stringify(enriched.raw_data),
            ],
          }),
        }
      );

      console.log(`✅ Stored Quansic data for ${name}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Example: Check service health
 */
async function checkQuansicServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${QUANSIC_SERVICE_URL}/health`);
    const health = await response.json();

    console.log('Quansic service status:', health);

    return health.status === 'healthy' && health.session_valid;
  } catch (error) {
    console.error('Quansic service unreachable:', error);
    return false;
  }
}

// Export for use in Cloudflare Worker
export {
  enrichWithQuansic,
  searchQuansicByISNI,
  enrichMusicBrainzArtists,
  checkQuansicServiceHealth,
};
