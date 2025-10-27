/**
 * Genius Routes
 * Endpoints for Genius artists and song referents (lyrics annotations)
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import type { Env } from '../types';

const genius = new Hono<{ Bindings: Env }>();

/**
 * POST /enrich-genius-artists
 * Fetch and store Genius artist metadata for artists in genius_songs
 */
genius.post('/enrich-genius-artists', async (c) => {
  if (!c.env.GENIUS_API_KEY) {
    return c.json({ error: 'Genius API key not configured' }, 500);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '20');

  // Get unique genius_artist_ids from genius_songs that don't exist in genius_artists
  const result = await db.sql`
    SELECT DISTINCT gs.genius_artist_id
    FROM genius_songs gs
    LEFT JOIN genius_artists ga ON gs.genius_artist_id = ga.genius_artist_id
    WHERE ga.genius_artist_id IS NULL
    LIMIT ${limit}
  `;

  const unenrichedArtistIds = result.map((r: any) => r.genius_artist_id);

  if (unenrichedArtistIds.length === 0) {
    return c.json({ message: 'No Genius artists to enrich' });
  }

  console.log(`Enriching ${unenrichedArtistIds.length} Genius artists...`);

  let enriched = 0;
  const results = [];

  for (const artistId of unenrichedArtistIds) {
    try {
      // Fetch artist from Genius API
      const response = await fetch(`https://api.genius.com/artists/${artistId}`, {
        headers: {
          'Authorization': `Bearer ${c.env.GENIUS_API_KEY}`,
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch Genius artist ${artistId}: ${response.status}`);
        results.push({ artistId, status: 'failed', error: response.status });
        continue;
      }

      const data = await response.json() as any;
      const artist = data.response?.artist;

      if (!artist) {
        console.error(`No artist data for Genius artist ${artistId}`);
        results.push({ artistId, status: 'no_data' });
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

      enriched++;
      results.push({ artistId, name: artist.name, status: 'success' });

      // Rate limiting: wait 100ms between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error enriching Genius artist ${artistId}:`, error);
      results.push({ artistId, status: 'error', error: String(error) });
    }
  }

  return c.json({
    success: true,
    service: 'genius-artists',
    enriched,
    total: unenrichedArtistIds.length,
    results,
  });
});

/**
 * POST /enrich-genius-by-artist-name
 * Search Genius by artist name from MusicBrainz and index all their songs
 * Uses search API to find artists, then crawls their entire catalog
 */
genius.post('/enrich-genius-by-artist-name', async (c) => {
  if (!c.env.GENIUS_API_KEY) {
    return c.json({ error: 'Genius API key not configured' }, 500);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');
  const songsPerArtist = parseInt(c.req.query('songs_per_artist') || '50');

  // Get MusicBrainz artists without Genius matches
  const mbArtists = await db.sql`
    SELECT ma.mbid, ma.name, ma.spotify_artist_id
    FROM musicbrainz_artists ma
    LEFT JOIN genius_artists ga ON LOWER(TRIM(ma.name)) = LOWER(TRIM(ga.name))
    WHERE ga.genius_artist_id IS NULL
    ORDER BY ma.name
    LIMIT ${limit}
  `;

  if (mbArtists.length === 0) {
    return c.json({ message: 'All MusicBrainz artists have Genius matches' });
  }

  console.log(`Searching Genius for ${mbArtists.length} MusicBrainz artists...`);

  let artistsMatched = 0;
  let songsFetched = 0;
  const results = [];

  for (const mbArtist of mbArtists) {
    try {
      // 1. Search Genius by artist name
      const searchResponse = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(mbArtist.name)}`,
        {
          headers: { 'Authorization': `Bearer ${c.env.GENIUS_API_KEY}` },
        }
      );

      if (!searchResponse.ok) {
        console.error(`Search failed for ${mbArtist.name}: ${searchResponse.status}`);
        results.push({ artist: mbArtist.name, status: 'search_failed', error: searchResponse.status });
        continue;
      }

      const searchData = await searchResponse.json() as any;
      const hits = searchData.response?.hits || [];

      if (hits.length === 0) {
        console.log(`No Genius results for: ${mbArtist.name}`);
        results.push({ artist: mbArtist.name, status: 'no_results' });
        continue;
      }

      // 2. Try all hits to find one where primary_artist matches the search query
      let geniusArtist = null;

      // Normalize artist name (handle special characters)
      const normalizeArtistName = (name: string) => {
        return name
          .toLowerCase()
          .trim()
          .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-') // Various hyphens/dashes → regular hyphen
          .replace(/[\u00A0]/g, ' ') // Non-breaking space → regular space
          .replace(/\s+/g, ' '); // Multiple spaces → single space
      };

      const mbNameNormalized = normalizeArtistName(mbArtist.name);

      for (const hit of hits) {
        const primaryArtist = hit.result?.primary_artist;
        if (!primaryArtist || !primaryArtist.id) continue;

        const geniusNameNormalized = normalizeArtistName(primaryArtist.name);

        // Check if names match (exact, contains, or similar)
        const isMatch = mbNameNormalized === geniusNameNormalized ||
                        geniusNameNormalized.includes(mbNameNormalized) ||
                        mbNameNormalized.includes(geniusNameNormalized);

        if (isMatch) {
          geniusArtist = primaryArtist;
          console.log(`✓ Found match in search results: ${mbArtist.name} → ${primaryArtist.name}`);
          break;
        }
      }

      if (!geniusArtist) {
        // No matching primary_artist found in any of the search results
        const firstPrimary = hits[0]?.result?.primary_artist?.name || 'unknown';
        console.log(`No primary_artist match: "${mbArtist.name}" (first result: "${firstPrimary}")`);
        results.push({
          artist: mbArtist.name,
          status: 'no_match',
          first_result: firstPrimary
        });
        continue;
      }

      console.log(`✓ Matched: ${mbArtist.name} → Genius ID ${geniusArtist.id}`);

      // 4. Fetch full artist details
      const artistResponse = await fetch(
        `https://api.genius.com/artists/${geniusArtist.id}`,
        {
          headers: { 'Authorization': `Bearer ${c.env.GENIUS_API_KEY}` },
        }
      );

      if (!artistResponse.ok) {
        console.error(`Failed to fetch artist ${geniusArtist.id}: ${artistResponse.status}`);
        results.push({ artist: mbArtist.name, status: 'fetch_failed', error: artistResponse.status });
        continue;
      }

      const artistData = await artistResponse.json() as any;
      const artist = artistData.response?.artist;

      if (!artist) {
        console.error(`No artist data for ${geniusArtist.id}`);
        results.push({ artist: mbArtist.name, status: 'no_data' });
        continue;
      }

      // 5. Upsert artist
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

      artistsMatched++;

      // 6. Fetch artist's songs and index them
      let artistSongs = 0;
      const songsResponse = await fetch(
        `https://api.genius.com/artists/${artist.id}/songs?per_page=${songsPerArtist}&sort=popularity`,
        {
          headers: { 'Authorization': `Bearer ${c.env.GENIUS_API_KEY}` },
        }
      );

      if (songsResponse.ok) {
        const songsData = await songsResponse.json() as any;
        const songs = songsData.response?.songs || [];

        for (const song of songs) {
          try {
            await db.sql`
              INSERT INTO genius_songs (
                genius_song_id,
                genius_artist_id,
                title,
                artist_name,
                url,
                lyrics_state,
                annotation_count,
                pyongs_count,
                raw_data
              ) VALUES (
                ${song.id},
                ${artist.id},
                ${song.title},
                ${song.artist_names || artist.name},
                ${song.url},
                ${song.lyrics_state},
                ${song.annotation_count || 0},
                ${song.pyongs_count || 0},
                ${JSON.stringify(song)}::jsonb
              )
              ON CONFLICT (genius_song_id)
              DO UPDATE SET
                title = EXCLUDED.title,
                artist_name = EXCLUDED.artist_name,
                url = EXCLUDED.url,
                lyrics_state = EXCLUDED.lyrics_state,
                annotation_count = EXCLUDED.annotation_count,
                pyongs_count = EXCLUDED.pyongs_count,
                raw_data = EXCLUDED.raw_data,
                updated_at = NOW()
            `;
            artistSongs++;
            songsFetched++;
          } catch (error) {
            console.error(`Error inserting song ${song.id}:`, error);
          }
        }
      }

      results.push({
        artist: mbArtist.name,
        status: 'success',
        genius_id: artist.id,
        genius_name: artist.name,
        songs_indexed: artistSongs,
        is_verified: artist.is_verified,
        followers: artist.followers_count,
      });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing ${mbArtist.name}:`, error);
      results.push({ artist: mbArtist.name, status: 'error', error: String(error) });
    }
  }

  return c.json({
    success: true,
    service: 'genius-by-artist-name',
    artists_matched: artistsMatched,
    songs_indexed: songsFetched,
    total_processed: mbArtists.length,
    results,
  });
});

/**
 * POST /enrich-song-referents
 * Fetch and store song referents (lyrics annotations) from Genius
 */
genius.post('/enrich-song-referents', async (c) => {
  if (!c.env.GENIUS_API_KEY) {
    return c.json({ error: 'Genius API key not configured' }, 500);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');
  const perSong = parseInt(c.req.query('per_song') || '20'); // Referents per song

  // Get genius_song_ids that don't have referents yet
  const result = await db.sql`
    SELECT gs.genius_song_id
    FROM genius_songs gs
    LEFT JOIN genius_song_referents sr ON gs.genius_song_id = sr.genius_song_id
    WHERE sr.referent_id IS NULL
    GROUP BY gs.genius_song_id
    LIMIT ${limit}
  `;

  const unenrichedSongIds = result.map((r: any) => r.genius_song_id);

  if (unenrichedSongIds.length === 0) {
    return c.json({ message: 'No songs need referent enrichment' });
  }

  console.log(`Enriching referents for ${unenrichedSongIds.length} songs...`);

  let totalReferents = 0;
  const results = [];

  for (const songId of unenrichedSongIds) {
    try {
      // Fetch referents from Genius API
      const response = await fetch(
        `https://api.genius.com/referents?song_id=${songId}&per_page=${perSong}&text_format=dom`,
        {
          headers: {
            'Authorization': `Bearer ${c.env.GENIUS_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`Failed to fetch referents for song ${songId}: ${response.status}`);
        results.push({ songId, status: 'failed', error: response.status });
        continue;
      }

      const data = await response.json() as any;
      const referents = data.response?.referents || [];

      if (referents.length === 0) {
        results.push({ songId, status: 'no_referents', count: 0 });
        continue;
      }

      // Upsert each referent
      let insertedCount = 0;
      for (const ref of referents) {
        try {
          // Get first annotation for stats (if exists)
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

      results.push({ songId, status: 'success', count: insertedCount });

      // Rate limiting: wait 100ms between songs
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error enriching referents for song ${songId}:`, error);
      results.push({ songId, status: 'error', error: String(error) });
    }
  }

  return c.json({
    success: true,
    service: 'song-referents',
    totalReferents,
    songsProcessed: unenrichedSongIds.length,
    results,
  });
});

/**
 * GET /genius/artists/:id
 * Get Genius artist by ID
 */
genius.get('/genius/artists/:id', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const artistId = parseInt(c.req.param('id'));

  const result = await db.sql`
    SELECT * FROM genius_artists
    WHERE genius_artist_id = ${artistId}
  `;

  if (result.length === 0) {
    return c.json({ error: 'Artist not found' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /genius/songs/:id/referents
 * Get all referents for a Genius song
 */
genius.get('/genius/songs/:id/referents', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const songId = parseInt(c.req.param('id'));
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const result = await db.sql`
    SELECT * FROM genius_song_referents
    WHERE genius_song_id = ${songId}
    ORDER BY votes_total DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return c.json({
    genius_song_id: songId,
    count: result.length,
    referents: result,
  });
});

/**
 * GET /genius/referents/top
 * Get top referents by votes across all songs
 */
genius.get('/genius/referents/top', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '20');

  const result = await db.sql`
    SELECT
      sr.*,
      gs.title as song_title,
      gs.artist_name
    FROM genius_song_referents sr
    JOIN genius_songs gs ON sr.genius_song_id = gs.genius_song_id
    WHERE sr.classification = 'accepted'
    ORDER BY sr.votes_total DESC
    LIMIT ${limit}
  `;

  return c.json({
    count: result.length,
    referents: result,
  });
});

export default genius;
