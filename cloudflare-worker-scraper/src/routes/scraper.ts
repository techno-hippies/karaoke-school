/**
 * TikTok Scraper Routes
 * Handles TikTok video scraping, creator stats, and track analytics
 */

import { Hono } from 'hono';
import { TikTokScraper } from '../tiktok-scraper';
import { NeonDB } from '../neon';
import { SpotifyService } from '../spotify';
import { GeniusService } from '../genius';
import { MusicBrainzService } from '../musicbrainz';
import { QuansicService } from '../quansic';
import type { Env } from '../types';

const scraper = new Hono<{ Bindings: Env }>();

/**
 * Background enrichment pipeline
 * Runs async to enrich newly scraped data
 */
async function runEnrichmentPipeline(env: Env, db: NeonDB) {
  try {
    // Step 1: Spotify enrichment
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
      console.log('Spotify credentials not configured, skipping enrichment');
      return;
    }

    const spotify = new SpotifyService(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET);
    const unenrichedSpotifyTracks = await db.getUnenrichedSpotifyTracks(50);

    if (unenrichedSpotifyTracks.length > 0) {
      console.log(`Enriching ${unenrichedSpotifyTracks.length} Spotify tracks...`);
      const trackData = await spotify.fetchTracks(unenrichedSpotifyTracks);
      const enriched = await db.batchUpsertSpotifyTracks(trackData);
      console.log(`✓ Enriched ${enriched} Spotify tracks`);
    }

    // Step 2: Spotify Artist enrichment (extract from tracks)
    const unenrichedArtists = await db.getUnenrichedSpotifyArtists(20);
    if (unenrichedArtists.length > 0) {
      console.log(`Enriching ${unenrichedArtists.length} Spotify artists...`);
      const artistData = await spotify.fetchArtists(unenrichedArtists);
      const enrichedArtists = await db.batchUpsertSpotifyArtists(artistData);
      console.log(`✓ Enriched ${enrichedArtists} Spotify artists`);
    }

    // Step 3: Genius enrichment (triggered after Spotify track enrichment)
    if (env.GENIUS_API_KEY) {
      const genius = new GeniusService(env.GENIUS_API_KEY);
      const unenrichedGeniusTracks = await db.getUnenrichedGeniusTracks(20);

      if (unenrichedGeniusTracks.length > 0) {
        console.log(`Enriching ${unenrichedGeniusTracks.length} Genius songs...`);
        const geniusData = await genius.searchBatch(
          unenrichedGeniusTracks.map(t => ({
            title: t.title,
            artist: t.artist,
            spotifyTrackId: t.spotify_track_id,
          }))
        );
        const enriched = await db.batchUpsertGeniusSongs(geniusData);
        console.log(`✓ Enriched ${enriched} Genius songs`);
      }
    } else {
      console.log('Genius API key not configured, skipping Genius enrichment');
    }

    // Step 4: MusicBrainz Artist enrichment (match with Spotify artists)
    const musicbrainz = new MusicBrainzService();
    const unenrichedMBArtists = await db.getUnenrichedMusicBrainzArtists(5); // Low limit due to rate limiting

    if (unenrichedMBArtists.length > 0) {
      console.log(`Enriching ${unenrichedMBArtists.length} MusicBrainz artists...`);
      let enrichedMBArtists = 0;

      for (const artist of unenrichedMBArtists) {
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
    }

    // Step 5: MusicBrainz Recording enrichment (match by ISRC)
    const unenrichedMBRecordings = await db.getUnenrichedMusicBrainzRecordings(5); // Low limit due to rate limiting

    if (unenrichedMBRecordings.length > 0) {
      console.log(`Enriching ${unenrichedMBRecordings.length} MusicBrainz recordings...`);
      let enrichedMBRecordings = 0;

      for (const track of unenrichedMBRecordings) {
        try {
          const result = await musicbrainz.searchRecordingByISRC(track.isrc);
          if (result?.recordings?.length > 0) {
            const recording = result.recordings[0];
            const mbRecording = await musicbrainz.getRecording(recording.id);
            mbRecording.spotify_track_id = track.spotify_track_id;
            await db.upsertMusicBrainzRecording(mbRecording);
            enrichedMBRecordings++;

            // Extract and store associated works (compositions)
            if (recording.relations) {
              for (const rel of recording.relations) {
                if (rel.type === 'performance' && rel.work) {
                  const work = await musicbrainz.getWork(rel.work.id);
                  await db.upsertMusicBrainzWork(work);
                  await db.linkWorkToRecording(work.work_mbid, mbRecording.recording_mbid);
                  console.log(`✓ Linked work ${work.title} (ISWC: ${work.iswc || 'N/A'})`);
                }
              }
            }

            console.log(`✓ Matched ISRC ${track.isrc} → ${mbRecording.recording_mbid}`);
          }
        } catch (error) {
          console.error(`Failed to enrich MusicBrainz recording ${track.isrc}:`, error);
        }
      }

      console.log(`✓ Enriched ${enrichedMBRecordings} MusicBrainz recordings`);
    }

    // Step 6: Quansic enrichment (for artists with ISNIs)
    if (env.QUANSIC_SESSION_COOKIE) {
      const quansic = new QuansicService(env.QUANSIC_SESSION_COOKIE);
      const unenrichedQuansicArtists = await db.getUnenrichedQuansicArtists(5);

      if (unenrichedQuansicArtists.length > 0) {
        console.log(`Enriching ${unenrichedQuansicArtists.length} artists with Quansic...`);
        let enrichedQuansic = 0;

        for (const artist of unenrichedQuansicArtists) {
          try {
            for (const isni of artist.isnis) {
              const quansicData = await quansic.enrichArtist(isni, artist.mbid);
              await db.upsertQuansicArtist(quansicData);
              enrichedQuansic++;
              console.log(`✓ Enriched ${artist.name} (ISNI: ${isni})`);
            }
          } catch (error) {
            console.error(`Failed to enrich ${artist.name} with Quansic:`, error);
          }
        }

        console.log(`✓ Enriched ${enrichedQuansic} artists with Quansic`);
      }
    } else {
      console.log('Quansic session cookie not configured, skipping Quansic enrichment');
    }
  } catch (error) {
    console.error('Enrichment failed:', error);
  }
}

/**
 * GET /scrape/:handle
 * Scrape TikTok user videos and auto-enrich in background
 */
scraper.get('/scrape/:handle', async (c) => {
  const handle = c.req.param('handle').replace('@', '');
  const limitParam = c.req.query('limit');
  const maxVideos = limitParam ? parseInt(limitParam) : Infinity;

  console.log(`Scraping @${handle} (limit: ${maxVideos === Infinity ? 'ALL' : maxVideos})`);

  const tikTokScraper = new TikTokScraper();
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  // 1. Fetch user profile
  const profile = await tikTokScraper.getUserProfile(handle);
  if (!profile) {
    return c.json({ error: 'Failed to fetch user profile' }, 404);
  }

  console.log(`Profile: ${profile.nickname} (${profile.stats.followerCount} followers, ${profile.stats.videoCount} videos)`);

  // 2. Upsert creator
  await db.upsertCreator(profile);

  // 3. Fetch videos (all by default)
  const videos = await tikTokScraper.getUserVideos(profile.secUid, maxVideos);
  console.log(`Fetched ${videos.length} videos`);

  // 4. Prepare video records
  const videoRecords = videos.map((video) => ({
    video,
    tiktokHandle: handle,
    spotifyTrackId: tikTokScraper.extractSpotifyId(video),
    copyrightStatus: tikTokScraper.getCopyrightStatus(video),
  }));

  // 5. Batch upsert videos
  const insertedCount = await db.batchUpsertVideos(videoRecords);

  // 6. Get stats
  const stats = await db.getCreatorStats(handle);

  // 7. Run enrichment in background (don't await)
  c.executionCtx.waitUntil(runEnrichmentPipeline(c.env, db));

  return c.json({
    success: true,
    creator: {
      handle: `@${handle}`,
      nickname: profile.nickname,
      followers: profile.stats.followerCount,
    },
    scraped: {
      videos: videos.length,
      inserted: insertedCount,
    },
    stats,
  });
});

/**
 * GET /stats/:handle
 * Get creator statistics
 */
scraper.get('/stats/:handle', async (c) => {
  const handle = c.req.param('handle').replace('@', '');
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  const stats = await db.getCreatorStats(handle);

  if (!stats) {
    return c.json({ error: 'Creator not found' }, 404);
  }

  return c.json({ handle: `@${handle}`, ...stats });
});

/**
 * GET /top-tracks
 * Get top Spotify tracks across all creators
 */
scraper.get('/top-tracks', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  const topTracks = await db.getTopTrackVideos(limit);

  return c.json(topTracks);
});

export default scraper;
