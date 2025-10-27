/**
 * Genius Enrichment Cron (runs every 10 minutes)
 *
 * Enriches Genius songs, artists, and song referents (lyrics annotations).
 * Processes ALL Spotify tracks to get comprehensive Genius metadata.
 *
 * Steps:
 * 1. Match Spotify tracks → Genius songs (title/artist search)
 * 2. Enrich Genius artist metadata (social media, followers, verification)
 * 3. Fetch song referents (lyrics annotations with votes)
 */

import { NeonDB } from '../neon';
import { GeniusService } from '../services/genius';
import type { Env } from '../types';

export default async function runGeniusEnrichment(env: Env): Promise<void> {
  console.log('🎤 Genius Enrichment Cron: Starting...');

  if (!env.GENIUS_API_KEY) {
    console.log('Genius API key not configured, skipping');
    return;
  }

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const genius = new GeniusService(env.GENIUS_API_KEY);

  try {
    // Step 1: Genius song enrichment (for ALL Spotify tracks)
    const viableGeniusTracks = await db.sql`
      SELECT st.spotify_track_id, st.title, st.raw_data->'artists'->0->>'name' as artist
      FROM spotify_tracks st
      LEFT JOIN genius_songs gs ON st.spotify_track_id = gs.spotify_track_id
      WHERE gs.spotify_track_id IS NULL
      LIMIT 20
    `;

    if (viableGeniusTracks.length > 0) {
      console.log(`Enriching ${viableGeniusTracks.length} Genius songs from Spotify tracks...`);
      const geniusData = await genius.searchBatch(
        viableGeniusTracks.map((t: any) => ({
          title: t.title,
          artist: t.artist,
          spotifyTrackId: t.spotify_track_id,
        }))
      );
      const enriched = await db.batchUpsertGeniusSongs(geniusData);
      console.log(`✓ Enriched ${enriched} Genius songs`);
    } else {
      console.log('No Genius songs need enrichment');
    }

    // Step 2: Genius Artist enrichment (from genius_songs)
    const unenrichedArtists = await db.sql`
      SELECT DISTINCT gs.genius_artist_id
      FROM genius_songs gs
      LEFT JOIN genius_artists ga ON gs.genius_artist_id = ga.genius_artist_id
      WHERE ga.genius_artist_id IS NULL
      LIMIT 20
    `;

    if (unenrichedArtists.length > 0) {
      console.log(`Enriching ${unenrichedArtists.length} Genius artists...`);
      let enrichedArtists = 0;

      for (const row of unenrichedArtists) {
        try {
          const artistId = row.genius_artist_id;
          const response = await fetch(`https://api.genius.com/artists/${artistId}`, {
            headers: {
              'Authorization': `Bearer ${env.GENIUS_API_KEY}`,
            },
          });

          if (!response.ok) {
            console.error(`Failed to fetch Genius artist ${artistId}: ${response.status}`);
            continue;
          }

          const data = await response.json() as any;
          const artist = data.response?.artist;

          if (!artist) {
            console.error(`No artist data for Genius artist ${artistId}`);
            continue;
          }

          // Upsert into genius_artists table
          await db.sql`
            INSERT INTO genius_artists (
              genius_artist_id,
              name,
              alternate_names,
              is_verified,
              is_meme_verified,
              followers_count,
              image_url,
              header_image_url,
              instagram_name,
              twitter_name,
              facebook_name,
              url,
              api_path,
              raw_data
            ) VALUES (
              ${artist.id},
              ${artist.name},
              ${artist.alternate_names || []},
              ${artist.is_verified || false},
              ${artist.is_meme_verified || false},
              ${artist.followers_count || 0},
              ${artist.image_url},
              ${artist.header_image_url},
              ${artist.instagram_name},
              ${artist.twitter_name},
              ${artist.facebook_name},
              ${artist.url},
              ${artist.api_path},
              ${JSON.stringify(artist)}::jsonb
            )
            ON CONFLICT (genius_artist_id)
            DO UPDATE SET
              name = EXCLUDED.name,
              alternate_names = EXCLUDED.alternate_names,
              is_verified = EXCLUDED.is_verified,
              is_meme_verified = EXCLUDED.is_meme_verified,
              followers_count = EXCLUDED.followers_count,
              image_url = EXCLUDED.image_url,
              header_image_url = EXCLUDED.header_image_url,
              instagram_name = EXCLUDED.instagram_name,
              twitter_name = EXCLUDED.twitter_name,
              facebook_name = EXCLUDED.facebook_name,
              url = EXCLUDED.url,
              api_path = EXCLUDED.api_path,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW()
          `;

          enrichedArtists++;
          console.log(`✓ Enriched Genius artist: ${artist.name}`);

          // Rate limiting: 100ms between requests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error enriching Genius artist:`, error);
        }
      }

      console.log(`✓ Enriched ${enrichedArtists} Genius artists`);
    } else {
      console.log('No Genius artists need enrichment');
    }

    // Step 3: Genius Song Referents (lyrics annotations)
    const unenrichedSongs = await db.sql`
      SELECT gs.genius_song_id
      FROM genius_songs gs
      LEFT JOIN genius_song_referents sr ON gs.genius_song_id = sr.genius_song_id
      WHERE sr.referent_id IS NULL
      GROUP BY gs.genius_song_id
      LIMIT 10
    `;

    if (unenrichedSongs.length > 0) {
      console.log(`Enriching referents for ${unenrichedSongs.length} Genius songs...`);
      let totalReferents = 0;

      for (const row of unenrichedSongs) {
        try {
          const songId = row.genius_song_id;
          const perSong = 20; // Referents per song

          const response = await fetch(
            `https://api.genius.com/referents?song_id=${songId}&per_page=${perSong}&text_format=dom`,
            {
              headers: {
                'Authorization': `Bearer ${env.GENIUS_API_KEY}`,
              },
            }
          );

          if (!response.ok) {
            console.error(`Failed to fetch referents for song ${songId}: ${response.status}`);
            continue;
          }

          const data = await response.json() as any;
          const referents = data.response?.referents || [];

          if (referents.length === 0) {
            continue;
          }

          // Upsert each referent
          let insertedCount = 0;
          for (const ref of referents) {
            try {
              const firstAnnotation = ref.annotations?.[0];

              await db.sql`
                INSERT INTO genius_song_referents (
                  referent_id,
                  genius_song_id,
                  fragment,
                  classification,
                  votes_total,
                  comment_count,
                  is_verified,
                  annotator_id,
                  annotator_login,
                  url,
                  path,
                  api_path,
                  annotations,
                  raw_data
                ) VALUES (
                  ${ref.id},
                  ${songId},
                  ${ref.fragment || ''},
                  ${ref.classification},
                  ${firstAnnotation?.votes_total || 0},
                  ${firstAnnotation?.comment_count || 0},
                  ${firstAnnotation?.verified || false},
                  ${ref.annotator_id},
                  ${ref.annotator_login},
                  ${ref.url},
                  ${ref.path},
                  ${ref.api_path},
                  ${JSON.stringify(ref.annotations || [])}::jsonb,
                  ${JSON.stringify(ref)}::jsonb
                )
                ON CONFLICT (referent_id)
                DO UPDATE SET
                  fragment = EXCLUDED.fragment,
                  classification = EXCLUDED.classification,
                  votes_total = EXCLUDED.votes_total,
                  comment_count = EXCLUDED.comment_count,
                  is_verified = EXCLUDED.is_verified,
                  annotator_id = EXCLUDED.annotator_id,
                  annotator_login = EXCLUDED.annotator_login,
                  url = EXCLUDED.url,
                  path = EXCLUDED.path,
                  api_path = EXCLUDED.api_path,
                  annotations = EXCLUDED.annotations,
                  raw_data = EXCLUDED.raw_data,
                  updated_at = NOW()
              `;

              insertedCount++;
              totalReferents++;
            } catch (error) {
              console.error(`Error inserting referent ${ref.id}:`, error);
            }
          }

          if (insertedCount > 0) {
            console.log(`✓ Song ${songId}: ${insertedCount} referents`);
          }

          // Rate limiting: 200ms between songs
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Error enriching referents for song:`, error);
        }
      }

      console.log(`✓ Enriched ${totalReferents} total referents across ${unenrichedSongs.length} songs`);
    } else {
      console.log('No Genius songs need referent enrichment');
    }

    console.log('✅ Genius Enrichment: Complete');
  } catch (error) {
    console.error('❌ Genius Enrichment failed:', error);
    throw error;
  }
}
