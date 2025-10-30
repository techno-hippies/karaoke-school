/**
 * MusicBrainz Enrichment Cron (runs every 15 minutes)
 *
 * Enriches MusicBrainz artists from Spotify artists.
 * Note: ISRC → Recording → Work lookup is handled by iswc-discovery.ts.
 *
 * This cron focuses on:
 * - Artist name → MusicBrainz artist matching
 * - Getting ISNI, IPI, social media links
 * - Enabling downstream Quansic enrichment (needs ISNI)
 *
 * Rate limit: 1 request/second (MusicBrainz policy)
 */

import { NeonDB } from '../neon';
import { MusicBrainzService } from '../services/musicbrainz';
import type { Env } from '../types';

export default async function runMusicBrainzEnrichment(env: Env): Promise<void> {
  console.log('🎼 MusicBrainz Enrichment Cron: Starting...');

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const musicbrainz = new MusicBrainzService();

  try {
    // Enrich MusicBrainz artists (all artists to enable ISWC discovery)
    const viableMBArtists = await db.sql`
      SELECT DISTINCT sa.spotify_artist_id, sa.name
      FROM spotify_artists sa
      LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id
      WHERE ma.spotify_artist_id IS NULL
      LIMIT 5
    `;

    if (viableMBArtists.length > 0) {
      console.log(`Enriching ${viableMBArtists.length} MusicBrainz artists...`);
      let enrichedMBArtists = 0;

      for (const artist of viableMBArtists) {
        try {
          const searchResult = await musicbrainz.searchArtist(artist.name);
          if (searchResult?.artists?.length > 0) {
            const topResult = searchResult.artists[0];
            const mbArtist = await musicbrainz.getArtist(topResult.id);
            mbArtist.spotify_artist_id = artist.spotify_artist_id;
            await db.upsertMusicBrainzArtist(mbArtist);
            enrichedMBArtists++;
            console.log(`✓ Matched ${artist.name} → ${mbArtist.mbid}`);
          }
        } catch (error) {
          console.error(`Failed to enrich MusicBrainz artist ${artist.name}:`, error);
        }
      }

      console.log(`✓ Enriched ${enrichedMBArtists} MusicBrainz artists`);
    } else {
      console.log('No MusicBrainz artists need enrichment');
    }

    console.log('✅ MusicBrainz Enrichment: Complete');
  } catch (error) {
    console.error('❌ MusicBrainz Enrichment failed:', error);
    throw error;
  }
}
