/**
 * Enrichment Routes
 * Manual triggers for Spotify, Genius, MusicBrainz, and Quansic enrichment
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { SpotifyService } from '../spotify';
import { GeniusService } from '../genius';
import { MusicBrainzService } from '../musicbrainz';
import { OpenRouterService } from '../openrouter';
import { QuansicService } from '../quansic';
import type { Env } from '../types';

const enrichment = new Hono<{ Bindings: Env }>();

/**
 * POST /enrich
 * Manually enrich Spotify tracks
 */
enrichment.post('/enrich', async (c) => {
  if (!c.env.SPOTIFY_CLIENT_ID || !c.env.SPOTIFY_CLIENT_SECRET) {
    return c.json({ error: 'Spotify credentials not configured' }, 500);
  }

  const spotify = new SpotifyService(c.env.SPOTIFY_CLIENT_ID, c.env.SPOTIFY_CLIENT_SECRET);
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '100');

  const unenrichedTracks = await db.getUnenrichedSpotifyTracks(limit);

  if (unenrichedTracks.length === 0) {
    return c.json({ message: 'No Spotify tracks to enrich' });
  }

  console.log(`Enriching ${unenrichedTracks.length} Spotify tracks...`);
  const trackData = await spotify.fetchTracks(unenrichedTracks);
  const enriched = await db.batchUpsertSpotifyTracks(trackData);

  return c.json({
    success: true,
    service: 'spotify',
    enriched,
    total: unenrichedTracks.length,
  });
});

/**
 * POST /enrich-artists
 * Manually enrich Spotify artists
 */
enrichment.post('/enrich-artists', async (c) => {
  if (!c.env.SPOTIFY_CLIENT_ID || !c.env.SPOTIFY_CLIENT_SECRET) {
    return c.json({ error: 'Spotify credentials not configured' }, 500);
  }

  const spotify = new SpotifyService(c.env.SPOTIFY_CLIENT_ID, c.env.SPOTIFY_CLIENT_SECRET);
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '50');

  const unenrichedArtists = await db.getUnenrichedSpotifyArtists(limit);

  if (unenrichedArtists.length === 0) {
    return c.json({ message: 'No Spotify artists to enrich' });
  }

  console.log(`Enriching ${unenrichedArtists.length} Spotify artists...`);
  const artistData = await spotify.fetchArtists(unenrichedArtists);
  const enriched = await db.batchUpsertSpotifyArtists(artistData);

  return c.json({
    success: true,
    service: 'spotify-artists',
    enriched,
    total: unenrichedArtists.length,
  });
});

/**
 * POST /enrich-musicbrainz
 * Manually enrich MusicBrainz artists or recordings
 */
enrichment.post('/enrich-musicbrainz', async (c) => {
  const musicbrainz = new MusicBrainzService();
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const type = c.req.query('type') || 'artists'; // artists or recordings
  const limit = parseInt(c.req.query('limit') || '5');

  if (type === 'artists') {
    const unenrichedMBArtists = await db.getUnenrichedMusicBrainzArtists(limit);

    if (unenrichedMBArtists.length === 0) {
      return c.json({ message: 'No MusicBrainz artists to enrich' });
    }

    let enrichedMBArtists = 0;
    const results = [];

    for (const artist of unenrichedMBArtists) {
      try {
        const searchResult = await musicbrainz.searchArtist(artist.name);
        if (searchResult?.artists?.length > 0) {
          const topResult = searchResult.artists[0];
          const mbArtist = await musicbrainz.getArtist(topResult.id);
          mbArtist.spotify_artist_id = artist.spotify_artist_id;
          await db.upsertMusicBrainzArtist(mbArtist);
          enrichedMBArtists++;
          results.push({ name: artist.name, mbid: mbArtist.mbid, isnis: mbArtist.isnis });
        }
      } catch (error) {
        console.error(`Failed to enrich MusicBrainz artist ${artist.name}:`, error);
      }
    }

    return c.json({
      success: true,
      service: 'musicbrainz-artists',
      enriched: enrichedMBArtists,
      total: unenrichedMBArtists.length,
      results,
    });
  } else if (type === 'recordings') {
    const unenrichedMBRecordings = await db.getUnenrichedMusicBrainzRecordings(limit);

    if (unenrichedMBRecordings.length === 0) {
      return c.json({ message: 'No MusicBrainz recordings to enrich' });
    }

    let enrichedMBRecordings = 0;
    const results = [];

    for (const track of unenrichedMBRecordings) {
      try {
        const result = await musicbrainz.searchRecordingByISRC(track.isrc);
        if (result?.recordings?.length > 0) {
          const recording = result.recordings[0];
          const mbRecording = await musicbrainz.getRecording(recording.id);
          mbRecording.spotify_track_id = track.spotify_track_id;
          await db.upsertMusicBrainzRecording(mbRecording);
          enrichedMBRecordings++;

          const works = [];
          // Extract and store associated works (compositions)
          if (recording.relations) {
            for (const rel of recording.relations) {
              if (rel.type === 'performance' && rel.work) {
                const work = await musicbrainz.getWork(rel.work.id);
                await db.upsertMusicBrainzWork(work);
                await db.linkWorkToRecording(work.work_mbid, mbRecording.recording_mbid);
                works.push({ title: work.title, iswc: work.iswc });
              }
            }
          }

          results.push({
            isrc: track.isrc,
            recording_mbid: mbRecording.recording_mbid,
            works
          });
        }
      } catch (error) {
        console.error(`Failed to enrich MusicBrainz recording ${track.isrc}:`, error);
      }
    }

    return c.json({
      success: true,
      service: 'musicbrainz-recordings',
      enriched: enrichedMBRecordings,
      total: unenrichedMBRecordings.length,
      results,
    });
  }

  return c.json({ error: 'Invalid type parameter. Use type=artists or type=recordings' }, 400);
});

/**
 * POST /enrich-genius
 * Manually enrich Genius songs
 */
enrichment.post('/enrich-genius', async (c) => {
  if (!c.env.GENIUS_API_KEY) {
    return c.json({ error: 'Genius API key not configured' }, 500);
  }

  const genius = new GeniusService(c.env.GENIUS_API_KEY);
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '50');

  const unenrichedTracks = await db.getUnenrichedGeniusTracks(limit);

  if (unenrichedTracks.length === 0) {
    return c.json({ message: 'No Genius songs to enrich' });
  }

  console.log(`Enriching ${unenrichedTracks.length} Genius songs...`);
  const geniusData = await genius.searchBatch(
    unenrichedTracks.map(t => ({
      title: t.title,
      artist: t.artist,
      spotifyTrackId: t.spotify_track_id,
    }))
  );
  const enriched = await db.batchUpsertGeniusSongs(geniusData);

  return c.json({
    success: true,
    service: 'genius',
    enriched,
    total: unenrichedTracks.length,
  });
});

/**
 * POST /normalize-and-match
 * Normalize unmatched tracks with Gemini and retry MusicBrainz matching
 */
enrichment.post('/normalize-and-match', async (c) => {
  if (!c.env.OPENROUTER_API_KEY) {
    return c.json({ error: 'OpenRouter API key not configured' }, 500);
  }

  const openrouter = new OpenRouterService(c.env.OPENROUTER_API_KEY);
  const musicbrainz = new MusicBrainzService();
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '5');

  // Get unmatched recordings (tracks with ISRC but no MusicBrainz recording)
  const unmatchedTracks = await db.getUnenrichedMusicBrainzRecordings(limit);

  if (unmatchedTracks.length === 0) {
    return c.json({ message: 'No unmatched tracks to normalize' });
  }

  console.log(`Normalizing ${unmatchedTracks.length} unmatched tracks...`);

  const results = [];
  let matched = 0;

  for (const track of unmatchedTracks) {
    try {
      // Step 1: Normalize track title with Gemini
      const normalized = await openrouter.normalizeTrack(track.title, track.artist);

      // Step 2: Try ISRC search first (most reliable)
      let mbData = await musicbrainz.searchRecordingByISRC(track.isrc);

      // Step 3: If ISRC fails, try normalized title + artist search
      if (!mbData || !mbData.recordings || mbData.recordings.length === 0) {
        console.log(`ISRC search failed, trying normalized title: "${normalized.normalizedTitle}" by ${normalized.normalizedArtist}`);
        mbData = await musicbrainz.searchRecording(normalized.normalizedTitle, normalized.normalizedArtist);
      }

      // Step 4: If we got a match, save it
      if (mbData?.recordings?.length > 0) {
        const recording = mbData.recordings[0];
        const mbRecording = await musicbrainz.getRecording(recording.id);
        mbRecording.spotify_track_id = track.spotify_track_id;
        await db.upsertMusicBrainzRecording(mbRecording);
        matched++;

        const works = [];
        // Extract and store associated works (compositions)
        if (recording.relations) {
          for (const rel of recording.relations) {
            if (rel.type === 'performance' && rel.work) {
              const work = await musicbrainz.getWork(rel.work.id);
              await db.upsertMusicBrainzWork(work);
              await db.linkWorkToRecording(work.work_mbid, mbRecording.recording_mbid);
              works.push({ title: work.title, iswc: work.iswc });
            }
          }
        }

        results.push({
          original: { title: track.title, artist: track.artist },
          normalized: { title: normalized.normalizedTitle, artist: normalized.normalizedArtist },
          matched: true,
          recording_mbid: mbRecording.recording_mbid,
          isrc: track.isrc,
          works,
        });

        console.log(`✓ Matched: "${track.title}" → ${mbRecording.recording_mbid}`);
      } else {
        results.push({
          original: { title: track.title, artist: track.artist },
          normalized: { title: normalized.normalizedTitle, artist: normalized.normalizedArtist },
          matched: false,
          isrc: track.isrc,
        });

        console.log(`✗ No match for: "${normalized.normalizedTitle}" by ${normalized.normalizedArtist}`);
      }
    } catch (error) {
      console.error(`Failed to process ${track.title}:`, error);
      results.push({
        original: { title: track.title, artist: track.artist },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({
    success: true,
    service: 'normalize-and-match',
    processed: unmatchedTracks.length,
    matched,
    results,
  });
});

/**
 * POST /enrich-quansic
 * Manually enrich artists with Quansic data (IPN, Luminate ID, name variants)
 */
enrichment.post('/enrich-quansic', async (c) => {
  if (!c.env.QUANSIC_SESSION_COOKIE) {
    return c.json({ error: 'Quansic session cookie not configured' }, 500);
  }

  const quansic = new QuansicService(c.env.QUANSIC_SESSION_COOKIE);
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  // Get MusicBrainz artists with ISNIs that need Quansic enrichment
  const unenrichedArtists = await db.getUnenrichedQuansicArtists(limit);

  if (unenrichedArtists.length === 0) {
    return c.json({ message: 'No artists with ISNIs to enrich' });
  }

  console.log(`Enriching ${unenrichedArtists.length} artists with Quansic...`);

  const results = [];
  let enriched = 0;

  for (const artist of unenrichedArtists) {
    try {
      // Enrich each ISNI
      for (const isni of artist.isnis) {
        const quansicData = await quansic.enrichArtist(isni, artist.mbid);
        await db.upsertQuansicArtist(quansicData);
        enriched++;

        results.push({
          name: artist.name,
          isni,
          ipn: quansicData.ipn,
          luminate_id: quansicData.luminate_id,
          name_variants_count: quansicData.name_variants.length,
        });

        console.log(`✓ Enriched ${artist.name} (ISNI: ${isni})`);
      }
    } catch (error) {
      console.error(`Failed to enrich ${artist.name}:`, error);
      results.push({
        name: artist.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({
    success: true,
    service: 'quansic',
    enriched,
    total: unenrichedArtists.length,
    results,
  });
});

export default enrichment;
