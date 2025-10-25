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
 * NEW: ISWC gate - only enriches tracks that have ISWC
 */
export async function runEnrichmentPipeline(env: Env, db: NeonDB) {
  try {
    // Step 1: Spotify enrichment (gets ISRC)
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
      console.log('Spotify credentials not configured, skipping enrichment');
      return;
    }

    const spotify = new SpotifyService(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET);
    const unenrichedSpotifyTracks = await db.getUnenrichedSpotifyTracks(100); // Increased for paid plan (1,000 subrequest limit)

    if (unenrichedSpotifyTracks.length > 0) {
      console.log(`Enriching ${unenrichedSpotifyTracks.length} Spotify tracks...`);
      const trackData = await spotify.fetchTracks(unenrichedSpotifyTracks);
      const enriched = await db.batchUpsertSpotifyTracks(trackData);
      console.log(`✓ Enriched ${enriched} Spotify tracks`);
    }

    // Step 2: ISWC LOOKUP (CRITICAL GATE - determines if track is viable)
    console.log('🔍 Step 2: ISWC Lookup (MusicBrainz → Quansic → MLC)...');
    const tracksNeedingIswc = await db.sql`
      SELECT spotify_track_id, title, isrc
      FROM spotify_tracks
      WHERE isrc IS NOT NULL
        AND has_iswc IS NULL
      LIMIT 30
    `;

    if (tracksNeedingIswc.length > 0) {
      console.log(`Checking ISWC for ${tracksNeedingIswc.length} tracks...`);
      const musicbrainz = new MusicBrainzService();
      let foundIswc = 0;

      for (const track of tracksNeedingIswc) {
        const iswcSources: { [key: string]: string | null } = {
          musicbrainz: null,
          quansic: null,
          mlc: null,
        };

        try {
          // Try 1: MusicBrainz (fast, ~40% success)
          console.log(`  Trying MusicBrainz for ${track.title}...`);
          try {
            const mbResult = await musicbrainz.searchRecordingByISRC(track.isrc);
            if (mbResult?.recordings?.length > 0) {
              const recording = mbResult.recordings[0];
              if (recording.relations) {
                for (const rel of recording.relations) {
                  if (rel.type === 'performance' && rel.work) {
                    const work = await musicbrainz.getWork(rel.work.id);
                    if (work.iswc) {
                      iswcSources.musicbrainz = work.iswc;
                      console.log(`  ✓ MusicBrainz: ${work.iswc}`);
                      break;
                    }
                  }
                }
              }
            }
          } catch (mbError) {
            console.log(`  ✗ MusicBrainz failed:`, mbError);
          }

          // Try 2: Quansic (slow but reliable ~85% success)
          if (env.QUANSIC_SERVICE_URL) {
            console.log(`  Trying Quansic for ${track.title}...`);
            try {
              const quansicResponse = await fetch(`${env.QUANSIC_SERVICE_URL}/enrich-recording`, {
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
                const quansicIswc = data.iswc || data.raw_data?.works?.[0]?.iswc;
                if (quansicIswc) {
                  iswcSources.quansic = quansicIswc;
                  console.log(`  ✓ Quansic: ${quansicIswc}`);
                }
              }
            } catch (quansicError) {
              console.log(`  ✗ Quansic failed:`, quansicError);
            }
          }

          // Try 3: MLC corroboration (if we got ISWC from MB or Quansic)
          const tempIswc = iswcSources.musicbrainz || iswcSources.quansic;
          if (tempIswc) {
            console.log(`  Trying MLC for corroboration (ISWC: ${tempIswc})...`);
            try {
              const mlcIswc = tempIswc.replace(/[-\.]/g, '');
              const mlcResponse = await fetch('https://api.ptl.themlc.com/api2v/public/search/works?page=0&size=10', {
                method: 'POST',
                headers: {
                  'Accept': 'application/json, text/plain, */*',
                  'Content-Type': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
                },
                body: JSON.stringify({ iswc: mlcIswc })
              });

              if (mlcResponse.ok) {
                const mlcData = await mlcResponse.json();
                if (mlcData.content?.length > 0 && mlcData.content[0].iswc) {
                  iswcSources.mlc = mlcData.content[0].iswc;
                  console.log(`  ✓ MLC: ${mlcData.content[0].iswc}`);
                }
              }
            } catch (mlcError) {
              console.log(`  ✗ MLC failed:`, mlcError);
            }
          }

          // Corroboration logic
          const iswcValues = Object.values(iswcSources).filter(v => v !== null);
          const uniqueIswcs = [...new Set(iswcValues)];

          let finalIswc: string | null = null;
          let hasIswc = false;

          if (uniqueIswcs.length === 0) {
            // No sources found ISWC
            hasIswc = false;
            console.log(`  ❌ No ISWC found for "${track.title}"`);
          } else if (uniqueIswcs.length === 1) {
            // All sources agree OR only 1 source - use it
            finalIswc = uniqueIswcs[0];
            hasIswc = true;
            if (iswcValues.length >= 2) {
              console.log(`  ✅ CORROBORATED: ${finalIswc} (${iswcValues.length} sources agree)`);
            } else {
              console.log(`  ✅ SINGLE SOURCE: ${finalIswc} (${iswcValues.length} source)`);
            }
          } else {
            // Sources disagree - find majority
            const counts = uniqueIswcs.map(iswc => ({
              iswc,
              count: iswcValues.filter(v => v === iswc).length
            }));
            const maxCount = Math.max(...counts.map(c => c.count));

            if (maxCount >= 2) {
              // Majority wins
              finalIswc = counts.find(c => c.count === maxCount)!.iswc;
              hasIswc = true;
              console.log(`  ✅ MAJORITY: ${finalIswc} (${maxCount}/3 sources)`);
            } else {
              // All 3 disagree - don't trust any
              hasIswc = false;
              console.log(`  ⚠️ CONFLICT: All sources disagree - skipping (${JSON.stringify(iswcSources)})`);
            }
          }

          // Update track with corroboration results
          await db.sql`
            UPDATE spotify_tracks
            SET has_iswc = ${hasIswc},
                iswc_source = ${hasIswc ? JSON.stringify(iswcSources) : null}
            WHERE spotify_track_id = ${track.spotify_track_id}
          `;

          if (hasIswc) {
            foundIswc++;
          }

        } catch (error) {
          console.error(`  Error checking ISWC for ${track.title}:`, error);
          // Mark as checked but not found
          await db.sql`
            UPDATE spotify_tracks
            SET has_iswc = false
            WHERE spotify_track_id = ${track.spotify_track_id}
          `;
        }
      }

      console.log(`✓ ISWC Lookup: ${foundIswc}/${tracksNeedingIswc.length} tracks have ISWC`);
    }

    // Step 3: ONLY enrich tracks WITH ISWC (spotify_artists, genius, etc.)
    // Filter: only enrich artists from tracks that have ISWC
    console.log('🎯 Step 3: Enriching ONLY tracks with ISWC...');
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
    }

    // Step 4: Genius enrichment (ONLY for tracks with ISWC)
    if (env.GENIUS_API_KEY) {
      const genius = new GeniusService(env.GENIUS_API_KEY);
      const viableGeniusTracks = await db.sql`
        SELECT st.spotify_track_id, st.title, st.raw_data->'artists'->0->>'name' as artist
        FROM spotify_tracks st
        LEFT JOIN genius_songs gs ON st.spotify_track_id = gs.spotify_track_id
        WHERE st.has_iswc = true
          AND gs.spotify_track_id IS NULL
        LIMIT 20
      `;

      if (viableGeniusTracks.length > 0) {
        console.log(`Enriching ${viableGeniusTracks.length} Genius songs (from tracks with ISWC)...`);
        const geniusData = await genius.searchBatch(
          viableGeniusTracks.map((t: any) => ({
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

    // Step 5: MusicBrainz Artist enrichment (ONLY for artists from tracks with ISWC)
    const musicbrainz = new MusicBrainzService();
    const viableMBArtists = await db.sql`
      SELECT DISTINCT sa.spotify_artist_id, sa.name
      FROM spotify_artists sa
      JOIN spotify_track_artists sta ON sa.spotify_artist_id = sta.spotify_artist_id
      JOIN spotify_tracks st ON sta.spotify_track_id = st.spotify_track_id
      LEFT JOIN musicbrainz_artists ma ON sa.spotify_artist_id = ma.spotify_artist_id
      WHERE st.has_iswc = true
        AND ma.spotify_artist_id IS NULL
      LIMIT 5
    `;

    if (viableMBArtists.length > 0) {
      console.log(`Enriching ${viableMBArtists.length} MusicBrainz artists (from tracks with ISWC)...`);
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
    }

    // Step 6: Quansic enrichment (ONLY for artists from tracks with ISWC)
    if (env.QUANSIC_SESSION_COOKIE) {
      const quansic = new QuansicService(env.QUANSIC_SESSION_COOKIE);
      const viableQuansicArtists = await db.sql`
        SELECT DISTINCT ma.name, ma.mbid, ma.isnis
        FROM musicbrainz_artists ma
        JOIN spotify_artists sa ON ma.spotify_artist_id = sa.spotify_artist_id
        JOIN spotify_track_artists sta ON sa.spotify_artist_id = sta.spotify_artist_id
        JOIN spotify_tracks st ON sta.spotify_track_id = st.spotify_track_id
        LEFT JOIN quansic_artists qa ON ma.isnis[1] = qa.isni
        WHERE st.has_iswc = true
          AND ma.isnis IS NOT NULL
          AND array_length(ma.isnis, 1) > 0
          AND qa.isni IS NULL
        LIMIT 5
      `;

      if (viableQuansicArtists.length > 0) {
        console.log(`Enriching ${viableQuansicArtists.length} artists with Quansic (from tracks with ISWC)...`);
        let enrichedQuansic = 0;

        for (const artist of viableQuansicArtists) {
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

    // Step 7: LRCLIB Lyrics enrichment (ONLY for tracks with ISWC)
    console.log('🎵 Step 7: LRCLIB Lyrics enrichment (from tracks with ISWC)...');
    const { LRCLIBService, calculateMatchScore } = await import('../lrclib');
    const lrclib = new LRCLIBService();

    const tracksNeedingLyrics = await db.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists[1] as artist,
        st.album as album_name,
        ROUND(st.duration_ms / 1000) as duration
      FROM spotify_tracks st
      LEFT JOIN spotify_track_lyrics stl
        ON st.spotify_track_id = stl.spotify_track_id
      WHERE st.has_iswc = true
        AND st.duration_ms IS NOT NULL
        AND st.artists IS NOT NULL
        AND st.album IS NOT NULL
        AND stl.spotify_track_id IS NULL
      LIMIT 10
    `;

    if (tracksNeedingLyrics.length > 0) {
      console.log(`Fetching lyrics for ${tracksNeedingLyrics.length} tracks (from tracks with ISWC)...`);
      let enrichedLyrics = 0;
      let instrumental = 0;

      for (const track of tracksNeedingLyrics) {
        try {
          // Try exact match first
          let lyricsData = await lrclib.getLyrics({
            track_name: track.title,
            artist_name: track.artist,
            album_name: track.album_name,
            duration: track.duration,
          });

          let confidenceScore = 1.0;

          // Fallback to search if needed
          if (!lyricsData) {
            const searchResults = await lrclib.searchLyrics({
              track_name: track.title,
              artist_name: track.artist,
            });

            if (searchResults.length > 0) {
              const scoredResults = searchResults.map(result => ({
                result,
                score: calculateMatchScore(result, {
                  title: track.title,
                  artist: track.artist,
                  album: track.album_name,
                  duration: track.duration,
                }),
              }));

              const bestMatch = scoredResults
                .filter(s => s.score >= 0.7)
                .sort((a, b) => b.score - a.score)[0];

              if (bestMatch) {
                lyricsData = bestMatch.result;
                confidenceScore = bestMatch.score;
              }
            }
          }

          if (lyricsData) {
            await db.upsertLyrics(track.spotify_track_id, lyricsData, confidenceScore);
            if (lyricsData.instrumental) {
              instrumental++;
            } else {
              enrichedLyrics++;
            }
            console.log(`✓ Lyrics for ${track.title} (synced: ${!!lyricsData.syncedLyrics}, instrumental: ${lyricsData.instrumental})`);
          }
        } catch (error) {
          console.error(`Failed to fetch lyrics for ${track.title}:`, error);
        }
      }

      console.log(`✓ Enriched ${enrichedLyrics} tracks with lyrics, ${instrumental} instrumental`);
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
      name: profile.nickname,
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
