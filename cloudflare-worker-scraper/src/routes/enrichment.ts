/**
 * Enrichment Routes
 * Manual triggers for Spotify, Genius, MusicBrainz, and Quansic enrichment
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { SpotifyService } from '../services/spotify';
import { GeniusService } from '../services/genius';
import { MusicBrainzService } from '../services/musicbrainz';
import { OpenRouterService } from '../services/openrouter';
import { QuansicService } from '../services/quansic';
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
  if (!c.env.QUANSIC_SERVICE_URL) {
    return c.json({ error: 'Quansic service URL not configured' }, 500);
  }

  console.log(`Using Quansic service: ${c.env.QUANSIC_SERVICE_URL}`);

  const quansic = new QuansicService(c.env.QUANSIC_SERVICE_URL);
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
        const quansicData = await quansic.enrichArtist(
          isni,
          artist.mbid,
          artist.spotify_artist_id
        );
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

/**
 * POST /enrich-quansic-recordings
 * Enrich recordings by ISRC (PRIMARY - fills ISWC gaps)
 */
enrichment.post('/enrich-quansic-recordings', async (c) => {
  // Debug: Log what we're receiving
  console.log('QUANSIC_SERVICE_URL:', c.env.QUANSIC_SERVICE_URL);
  console.log('All env keys:', Object.keys(c.env));

  if (!c.env.QUANSIC_SERVICE_URL) {
    return c.json({
      error: 'QUANSIC_SERVICE_URL not configured',
      debug: {
        has_url: !!c.env.QUANSIC_SERVICE_URL,
        env_keys: Object.keys(c.env)
      }
    }, 500);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const quansicUrl = c.env.QUANSIC_SERVICE_URL;
  const limit = parseInt(c.req.query('limit') || '10');

  // Get Spotify tracks with ISRCs that haven't been enriched through Quansic yet
  const unenriched = await db.sql`
    SELECT DISTINCT st.isrc, st.spotify_track_id, st.title
    FROM spotify_tracks st
    LEFT JOIN quansic_recordings qr ON st.isrc = qr.isrc
    WHERE st.isrc IS NOT NULL
    AND qr.isrc IS NULL
    LIMIT ${limit}
  `;

  if (unenriched.length === 0) {
    return c.json({ message: 'No recordings with ISRC but no ISWC to enrich' });
  }

  console.log(`Enriching ${unenriched.length} recordings with Quansic (ISRC → ISWC)...`);

  const results = [];
  let enriched = 0;

  for (const rec of unenriched) {
    try {
      const response = await fetch(`${quansicUrl}/enrich-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isrc: rec.isrc,
          spotify_track_id: rec.spotify_track_id,
          recording_mbid: null  // Not from MusicBrainz yet
        })
      });

      if (!response.ok) {
        throw new Error(`Quansic API error: ${response.status}`);
      }

      const { data } = await response.json();

      // Extract ISWC from works array if not in top-level (Quansic service bug workaround)
      let iswc = data.iswc;
      let workTitle = data.work_title;

      if (!iswc && data.raw_data?.recording?.works?.length > 0) {
        const work = data.raw_data.recording.works[0];
        iswc = work.iswc || null;
        workTitle = work.title || null;
      }

      // Store in quansic_recordings table
      await db.sql`
        INSERT INTO quansic_recordings (
          isrc, recording_mbid, spotify_track_id, title, iswc, work_title,
          duration_ms, release_date, artists, composers, platform_ids, q2_score,
          raw_data, enriched_at
        ) VALUES (
          ${data.isrc},
          ${null},  -- Not from MusicBrainz yet
          ${data.spotify_track_id || rec.spotify_track_id},
          ${data.title},
          ${iswc},
          ${workTitle},
          ${data.duration_ms},
          ${data.release_date},
          ${JSON.stringify(data.artists)},
          ${JSON.stringify(data.composers)},
          ${JSON.stringify(data.platform_ids)},
          ${data.q2_score},
          ${JSON.stringify(data.raw_data)},
          NOW()
        )
        ON CONFLICT (isrc) DO UPDATE SET
          iswc = EXCLUDED.iswc,
          work_title = EXCLUDED.work_title,
          composers = EXCLUDED.composers,
          platform_ids = EXCLUDED.platform_ids,
          raw_data = EXCLUDED.raw_data,
          enriched_at = NOW()
      `;

      enriched++;
      results.push({
        isrc: rec.isrc,
        title: rec.title,
        iswc,
        work_title: workTitle,
        composers_count: data.composers.length
      });

      console.log(`✓ Enriched ${rec.title} (ISRC: ${rec.isrc}) → ISWC: ${iswc || 'none'}`);
    } catch (error) {
      console.error(`Failed to enrich ${rec.isrc}:`, error);
      results.push({
        isrc: rec.isrc,
        title: rec.title,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return c.json({
    success: true,
    service: 'quansic-recordings',
    enriched,
    total: unenriched.length,
    results
  });
});

/**
 * POST /enrich-quansic-works
 * Enrich works by ISWC
 */
enrichment.post('/enrich-quansic-works', async (c) => {
  if (!c.env.QUANSIC_SERVICE_URL) {
    return c.json({ error: 'QUANSIC_SERVICE_URL not configured' }, 500);
  }

  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const quansicUrl = c.env.QUANSIC_SERVICE_URL;
  const limit = parseInt(c.req.query('limit') || '10');

  // Get works with ISWC that need enrichment
  const unenriched = await db.sql`
    SELECT w.iswc, w.work_mbid, w.title
    FROM musicbrainz_works w
    LEFT JOIN quansic_works qw ON w.iswc = qw.iswc
    WHERE w.iswc IS NOT NULL
    AND qw.iswc IS NULL
    LIMIT ${limit}
  `;

  if (unenriched.length === 0) {
    return c.json({ message: 'No works with ISWC to enrich' });
  }

  console.log(`Enriching ${unenriched.length} works with Quansic (ISWC → Composers)...`);

  const results = [];
  let enriched = 0;

  for (const work of unenriched) {
    try {
      const response = await fetch(`${quansicUrl}/enrich-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          iswc: work.iswc,
          work_mbid: work.work_mbid
        })
      });

      if (!response.ok) {
        throw new Error(`Quansic API error: ${response.status}`);
      }

      const { data } = await response.json();

      // Store in quansic_works table
      await db.sql`
        INSERT INTO quansic_works (
          iswc, work_mbid, title, contributors, recording_count,
          q1_score, sample_recordings, raw_data, enriched_at
        ) VALUES (
          ${data.iswc},
          ${work.work_mbid},
          ${data.title},
          ${JSON.stringify(data.contributors)},
          ${data.recording_count},
          ${data.q1_score},
          ${JSON.stringify(data.sample_recordings)},
          ${JSON.stringify(data.raw_data)},
          NOW()
        )
        ON CONFLICT (iswc) DO UPDATE SET
          contributors = EXCLUDED.contributors,
          recording_count = EXCLUDED.recording_count,
          q1_score = EXCLUDED.q1_score,
          sample_recordings = EXCLUDED.sample_recordings,
          raw_data = EXCLUDED.raw_data,
          enriched_at = NOW()
      `;

      enriched++;
      results.push({
        iswc: work.iswc,
        title: work.title,
        contributors_count: data.contributors.length,
        recording_count: data.recording_count,
        q1_score: data.q1_score
      });

      console.log(`✓ Enriched ${work.title} (ISWC: ${work.iswc}) → ${data.contributors.length} contributors`);
    } catch (error) {
      console.error(`Failed to enrich ${work.iswc}:`, error);
      results.push({
        iswc: work.iswc,
        title: work.title,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return c.json({
    success: true,
    service: 'quansic-works',
    enriched,
    total: unenriched.length,
    results
  });
});

/**
 * POST /enrich-iswc
 * Manually trigger ISWC lookup (MusicBrainz → Quansic → MLC)
 * This is the CRITICAL GATE - sets has_iswc flag
 */
enrichment.post('/enrich-iswc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const musicbrainz = new MusicBrainzService();
  const limit = parseInt(c.req.query('limit') || '20');

  // Get tracks that need ISWC lookup
  const tracksNeedingIswc = await db.sql`
    SELECT spotify_track_id, title, isrc
    FROM spotify_tracks
    WHERE isrc IS NOT NULL
      AND has_iswc IS NULL
    LIMIT ${limit}
  `;

  if (tracksNeedingIswc.length === 0) {
    return c.json({ message: 'No tracks need ISWC lookup' });
  }

  console.log(`Checking ISWC for ${tracksNeedingIswc.length} tracks...`);
  const results = [];
  let foundIswc = 0;

  for (const track of tracksNeedingIswc) {
    let iswc: string | null = null;
    let iswcSource: string | null = null;
    const allSources: { source: string; iswc: string | null }[] = [];

    try {
      // Try 1: MusicBrainz (fast, ~40% success)
      console.log(`  Trying MusicBrainz for ${track.title}...`);
      const mbResult = await musicbrainz.searchRecordingByISRC(track.isrc);

      if (mbResult?.recordings?.length > 0) {
        const recording = mbResult.recordings[0];

        // Check if recording has work relations with ISWC
        if (recording.relations) {
          for (const rel of recording.relations) {
            if (rel.type === 'performance' && rel.work) {
              const work = await musicbrainz.getWork(rel.work.id);
              if (work.iswc) {
                iswc = work.iswc;
                iswcSource = 'musicbrainz';
                allSources.push({ source: 'musicbrainz', iswc: work.iswc });
                console.log(`  ✓ MusicBrainz: ${iswc}`);
                break;
              }
            }
          }
        }
      }
      if (!iswc) {
        allSources.push({ source: 'musicbrainz', iswc: null });
      }

      // Try 2: Quansic (slow but cleanest ~85% success) - ALWAYS try for corroboration
      if (c.env.QUANSIC_SERVICE_URL) {
        console.log(`  Trying Quansic for ${track.title}...`);
        const quansicResponse = await fetch(`${c.env.QUANSIC_SERVICE_URL}/enrich-recording`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isrc: track.isrc,
            spotify_track_id: track.spotify_track_id,
            recording_mbid: null
          })
        });

        if (quansicResponse.ok) {
          const { data } = await quansicResponse.json();

          // Extract ISWC (might be in works array due to Quansic service structure)
          let quansicIswc = data.iswc;
          if (!quansicIswc && data.raw_data?.recording?.works?.length > 0) {
            quansicIswc = data.raw_data.recording.works[0].iswc;
          }

          if (quansicIswc) {
            if (!iswc) {
              iswc = quansicIswc;
              iswcSource = 'quansic';
            }
            allSources.push({ source: 'quansic', iswc: quansicIswc });
            console.log(`  ✓ Quansic: ${quansicIswc}`);
          } else {
            allSources.push({ source: 'quansic', iswc: null });
          }
        } else {
          allSources.push({ source: 'quansic', iswc: null });
        }
      }

      // Try 3: MLC corroboration (ONLY if we found ISWC from MB or Quansic)
      // MLC cannot search by ISRC - only by ISWC, work title, writer, etc.
      if (iswc) {
        console.log(`  Trying MLC for corroboration (ISWC: ${iswc})...`);
        const mlcSearchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works?page=0&size=10';

        // Normalize ISWC for MLC (remove dashes/dots)
        const mlcIswc = iswc.replace(/[-\.]/g, '');

        const mlcResponse = await fetch(mlcSearchUrl, {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Content-Type': 'application/json',
            'Origin': 'https://portal.themlc.com',
            'Referer': 'https://portal.themlc.com/',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'X-Requested-With': 'XMLHttpRequest',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
          },
          body: JSON.stringify({ iswc: mlcIswc })
        });

        try {
          if (mlcResponse.ok) {
            const mlcData = await mlcResponse.json();
            console.log(`  MLC response:`, JSON.stringify(mlcData).substring(0, 200));

            if (mlcData.content && mlcData.content.length > 0) {
              const mlcWork = mlcData.content[0];
              if (mlcWork.iswc) {
                allSources.push({ source: 'mlc', iswc: mlcWork.iswc });
                console.log(`  ✓ MLC corroborates: ${mlcWork.iswc} (song: ${mlcWork.mlcSongCode})`);
              } else {
                allSources.push({ source: 'mlc', iswc: null });
                console.log(`  ⚠️  MLC work has no ISWC`);
              }
            } else {
              allSources.push({ source: 'mlc', iswc: null });
              console.log(`  ⚠️  MLC: No work found for ISWC ${mlcIswc}`);
            }
          } else {
            const errorText = await mlcResponse.text();
            allSources.push({ source: 'mlc', iswc: null });
            console.log(`  ⚠️  MLC API error: ${mlcResponse.status} - ${errorText.substring(0, 100)}`);
          }
        } catch (mlcError) {
          allSources.push({ source: 'mlc', iswc: null });
          console.error(`  ❌ MLC error:`, mlcError);
        }
      } else {
        // No ISWC to corroborate
        allSources.push({ source: 'mlc', iswc: null });
      }

      // Update track with ISWC result
      await db.sql`
        UPDATE spotify_tracks
        SET has_iswc = ${!!iswc},
            iswc_source = ${iswcSource}
        WHERE spotify_track_id = ${track.spotify_track_id}
      `;

      if (iswc) {
        foundIswc++;
        results.push({
          spotify_track_id: track.spotify_track_id,
          title: track.title,
          isrc: track.isrc,
          iswc,
          iswc_source: iswcSource,
          has_iswc: true,
          all_sources: allSources,
        });
        console.log(`  ✅ ISWC found for "${track.title}": ${iswc} (source: ${iswcSource})`);
        console.log(`  All sources:`, JSON.stringify(allSources));
      } else {
        results.push({
          spotify_track_id: track.spotify_track_id,
          title: track.title,
          isrc: track.isrc,
          has_iswc: false,
          message: 'No ISWC found - will skip deep enrichment',
          all_sources: allSources,
        });
        console.log(`  ❌ No ISWC found for "${track.title}" - will skip deep enrichment`);
        console.log(`  All sources:`, JSON.stringify(allSources));
      }

    } catch (error) {
      console.error(`  Error checking ISWC for ${track.title}:`, error);
      // Mark as checked but not found
      await db.sql`
        UPDATE spotify_tracks
        SET has_iswc = false
        WHERE spotify_track_id = ${track.spotify_track_id}
      `;
      results.push({
        spotify_track_id: track.spotify_track_id,
        title: track.title,
        isrc: track.isrc,
        has_iswc: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return c.json({
    success: true,
    service: 'iswc-lookup',
    checked: tracksNeedingIswc.length,
    found_iswc: foundIswc,
    found_percentage: ((foundIswc / tracksNeedingIswc.length) * 100).toFixed(1) + '%',
    results,
  });
});

/**
 * GET /test-quansic
 * Test Quansic ISRC lookup directly
 */
enrichment.get('/test-quansic', async (c) => {
  const testIsrc = 'USRC11902726'; // The Adults Are Talking
  const testTrackId = '5ruzrDWcT0vuJIOMW7gMnW';

  if (!c.env.QUANSIC_SERVICE_URL) {
    return c.json({ error: 'QUANSIC_SERVICE_URL not configured' });
  }

  console.log(`Testing Quansic with ISRC: ${testIsrc}`);

  const quansicResponse = await fetch(`${c.env.QUANSIC_SERVICE_URL}/enrich-recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      isrc: testIsrc,
      spotify_track_id: testTrackId,
      recording_mbid: null
    })
  });

  const responseText = await quansicResponse.text();

  return c.json({
    isrc: testIsrc,
    url: c.env.QUANSIC_SERVICE_URL + '/enrich-recording',
    status: quansicResponse.status,
    statusText: quansicResponse.statusText,
    ok: quansicResponse.ok,
    body: responseText,
    parsed: (() => {
      try {
        return JSON.parse(responseText);
      } catch {
        return null;
      }
    })()
  });
});

/**
 * GET /test-mlc-corroboration
 * Test MLC ISWC corroboration directly
 */
enrichment.get('/test-mlc-corroboration', async (c) => {
  const testIswc = 'T-931.596.136-5'; // The Adults Are Talking
  const mlcIswc = testIswc.replace(/[-\.]/g, ''); // T9315961365

  const mlcSearchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works?page=0&size=10';

  console.log(`Testing MLC with ISWC: ${testIswc} → ${mlcIswc}`);

  const mlcResponse = await fetch(mlcSearchUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/json',
      'Origin': 'https://portal.themlc.com',
      'Referer': 'https://portal.themlc.com/',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-site',
    },
    body: JSON.stringify({ iswc: mlcIswc })
  });

  const responseText = await mlcResponse.text();

  return c.json({
    original_iswc: testIswc,
    normalized_iswc: mlcIswc,
    url: mlcSearchUrl,
    status: mlcResponse.status,
    statusText: mlcResponse.statusText,
    ok: mlcResponse.ok,
    headers: Object.fromEntries(mlcResponse.headers.entries()),
    body: responseText,
    parsed: (() => {
      try {
        return JSON.parse(responseText);
      } catch {
        return null;
      }
    })()
  });
});

export default enrichment;
