/**
 * Spotify Enrichment Cron (runs every 5 minutes)
 *
 * Enriches Spotify tracks and artists from TikTok scraped videos.
 *
 * Steps:
 * 1. Fetch unenriched Spotify tracks (from tiktok_scraped_videos)
 * 2. Batch fetch track metadata from Spotify API
 * 3. Store in spotify_tracks with ISRC for downstream ISWC lookup
 * 4. Enrich Spotify artists (ONLY from tracks with ISWC to save API calls)
 */

import { NeonDB } from '../neon';
import { SpotifyService } from '../services/spotify';
import type { Env } from '../types';

export default async function runSpotifyEnrichment(env: Env): Promise<void> {
  console.log('🎵 Spotify Enrichment Cron: Starting...');

  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    console.log('Spotify credentials not configured, skipping');
    return;
  }

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const spotify = new SpotifyService(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET);

  try {
    // Step 1: Enrich Spotify tracks (gets ISRC for ISWC lookup)
    const unenrichedSpotifyTracks = await db.getUnenrichedSpotifyTracks(100);

    if (unenrichedSpotifyTracks.length > 0) {
      console.log(`Enriching ${unenrichedSpotifyTracks.length} Spotify tracks...`);
      const trackData = await spotify.fetchTracks(unenrichedSpotifyTracks);
      const enriched = await db.batchUpsertSpotifyTracks(trackData);
      console.log(`✓ Enriched ${enriched} Spotify tracks`);
    } else {
      console.log('No Spotify tracks need enrichment');
    }

    // Step 2: Enrich Spotify artists (ONLY from tracks with ISWC to save API calls)
    const viableArtists = await db.sql`
      SELECT DISTINCT sa.spotify_artist_id, sa.name
      FROM spotify_artists sa
      JOIN spotify_track_artists sta ON sa.spotify_artist_id = sta.spotify_artist_id
      JOIN spotify_tracks st ON sta.spotify_track_id = st.spotify_track_id
      LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id
      WHERE st.has_iswc = true
        AND ma.spotify_artist_id IS NULL
      LIMIT 20
    `;

    if (viableArtists.length > 0) {
      console.log(`Enriching ${viableArtists.length} Spotify artists (from tracks with ISWC)...`);
      const artistIds = viableArtists.map((a: any) => a.spotify_artist_id);
      const artistData = await spotify.fetchArtists(artistIds);
      const enrichedArtists = await db.batchUpsertSpotifyArtists(artistData);
      console.log(`✓ Enriched ${enrichedArtists} Spotify artists`);
    } else {
      console.log('No Spotify artists need enrichment');
    }

    console.log('✅ Spotify Enrichment: Complete');
  } catch (error) {
    console.error('❌ Spotify Enrichment failed:', error);
    throw error;
  }
}
