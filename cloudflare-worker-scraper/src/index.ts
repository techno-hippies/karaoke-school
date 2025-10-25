/**
 * Cloudflare Worker - TikTok Scraper
 *
 * Scrapes TikTok creator videos and stores them in Neon PostgreSQL
 *
 * Routes:
 * - GET /scrape/:handle - Scrape a TikTok user
 * - GET /stats/:handle - Get creator stats
 * - GET /top-tracks - Get top Spotify tracks
 */

import { TikTokScraper } from './tiktok-scraper';
import { NeonDB } from './neon';
import { SpotifyService } from './spotify';
import { GeniusService } from './genius';
import { MusicBrainzService } from './musicbrainz';
import { OpenRouterService } from './openrouter';
import { QuansicService } from './quansic';

export interface Env {
  NEON_DATABASE_URL: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  GENIUS_API_KEY: string;
  OPENROUTER_API_KEY: string;
  QUANSIC_SESSION_COOKIE: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Initialize services
      const scraper = new TikTokScraper();
      const db = new NeonDB(env.NEON_DATABASE_URL);

      // Route: GET /scrape/:handle
      const scrapeMatch = path.match(/^\/scrape\/(@?[\w.-]+)$/);
      if (scrapeMatch) {
        const handle = scrapeMatch[1].replace('@', '');
        const limitParam = url.searchParams.get('limit');
        const maxVideos = limitParam ? parseInt(limitParam) : Infinity;

        console.log(`Scraping @${handle} (limit: ${maxVideos === Infinity ? 'ALL' : maxVideos})`);

        // 1. Fetch user profile
        const profile = await scraper.getUserProfile(handle);
        if (!profile) {
          return new Response(
            JSON.stringify({ error: 'Failed to fetch user profile' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Profile: ${profile.nickname} (${profile.stats.followerCount} followers, ${profile.stats.videoCount} videos)`);

        // 2. Upsert creator
        await db.upsertCreator(profile);

        // 3. Fetch videos (all by default)
        const videos = await scraper.getUserVideos(profile.secUid, maxVideos);
        console.log(`Fetched ${videos.length} videos`);

        // 4. Prepare video records
        const videoRecords = videos.map((video) => ({
          video,
          tiktokHandle: handle,
          spotifyTrackId: scraper.extractSpotifyId(video),
          copyrightStatus: scraper.getCopyrightStatus(video),
        }));

        // 5. Batch upsert videos
        const insertedCount = await db.batchUpsertVideos(videoRecords);

        // 6. Get stats
        const stats = await db.getCreatorStats(handle);

        // 7. Enrich Spotify tracks, then Genius (async, don't block response)
        const enrichAll = async () => {
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
        };

        // Run enrichment in background (don't await)
        enrichAll();

        return new Response(
          JSON.stringify({
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
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: GET /stats/:handle
      const statsMatch = path.match(/^\/stats\/(@?[\w.-]+)$/);
      if (statsMatch) {
        const handle = statsMatch[1].replace('@', '');
        const stats = await db.getCreatorStats(handle);

        if (!stats) {
          return new Response(
            JSON.stringify({ error: 'Creator not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ handle: `@${handle}`, ...stats }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: GET /top-tracks
      if (path === '/top-tracks') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const topTracks = await db.getTopTrackVideos(limit);

        return new Response(
          JSON.stringify(topTracks),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: POST /enrich
      // Manual trigger for Spotify enrichment
      if (path === '/enrich' && request.method === 'POST') {
        if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
          return new Response(
            JSON.stringify({ error: 'Spotify credentials not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const spotify = new SpotifyService(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET);
        const limit = parseInt(url.searchParams.get('limit') || '100');

        const unenrichedTracks = await db.getUnenrichedSpotifyTracks(limit);

        if (unenrichedTracks.length === 0) {
          return new Response(
            JSON.stringify({ message: 'No Spotify tracks to enrich' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Enriching ${unenrichedTracks.length} Spotify tracks...`);
        const trackData = await spotify.fetchTracks(unenrichedTracks);
        const enriched = await db.batchUpsertSpotifyTracks(trackData);

        return new Response(
          JSON.stringify({
            success: true,
            service: 'spotify',
            enriched,
            total: unenrichedTracks.length,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: POST /enrich-artists
      // Manual trigger for Spotify Artist enrichment
      if (path === '/enrich-artists' && request.method === 'POST') {
        if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
          return new Response(
            JSON.stringify({ error: 'Spotify credentials not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const spotify = new SpotifyService(env.SPOTIFY_CLIENT_ID, env.SPOTIFY_CLIENT_SECRET);
        const limit = parseInt(url.searchParams.get('limit') || '50');

        const unenrichedArtists = await db.getUnenrichedSpotifyArtists(limit);

        if (unenrichedArtists.length === 0) {
          return new Response(
            JSON.stringify({ message: 'No Spotify artists to enrich' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Enriching ${unenrichedArtists.length} Spotify artists...`);
        const artistData = await spotify.fetchArtists(unenrichedArtists);
        const enriched = await db.batchUpsertSpotifyArtists(artistData);

        return new Response(
          JSON.stringify({
            success: true,
            service: 'spotify-artists',
            enriched,
            total: unenrichedArtists.length,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: POST /enrich-musicbrainz
      // Manual trigger for MusicBrainz enrichment
      if (path === '/enrich-musicbrainz' && request.method === 'POST') {
        const musicbrainz = new MusicBrainzService();
        const type = url.searchParams.get('type') || 'artists'; // artists or recordings
        const limit = parseInt(url.searchParams.get('limit') || '5');

        if (type === 'artists') {
          const unenrichedMBArtists = await db.getUnenrichedMusicBrainzArtists(limit);

          if (unenrichedMBArtists.length === 0) {
            return new Response(
              JSON.stringify({ message: 'No MusicBrainz artists to enrich' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
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

          return new Response(
            JSON.stringify({
              success: true,
              service: 'musicbrainz-artists',
              enriched: enrichedMBArtists,
              total: unenrichedMBArtists.length,
              results,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        } else if (type === 'recordings') {
          const unenrichedMBRecordings = await db.getUnenrichedMusicBrainzRecordings(limit);

          if (unenrichedMBRecordings.length === 0) {
            return new Response(
              JSON.stringify({ message: 'No MusicBrainz recordings to enrich' }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
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

          return new Response(
            JSON.stringify({
              success: true,
              service: 'musicbrainz-recordings',
              enriched: enrichedMBRecordings,
              total: unenrichedMBRecordings.length,
              results,
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Route: POST /enrich-genius
      // Manual trigger for Genius enrichment
      if (path === '/enrich-genius' && request.method === 'POST') {
        if (!env.GENIUS_API_KEY) {
          return new Response(
            JSON.stringify({ error: 'Genius API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const genius = new GeniusService(env.GENIUS_API_KEY);
        const limit = parseInt(url.searchParams.get('limit') || '50');

        const unenrichedTracks = await db.getUnenrichedGeniusTracks(limit);

        if (unenrichedTracks.length === 0) {
          return new Response(
            JSON.stringify({ message: 'No Genius songs to enrich' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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

        return new Response(
          JSON.stringify({
            success: true,
            service: 'genius',
            enriched,
            total: unenrichedTracks.length,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: POST /normalize-and-match
      // Normalize unmatched tracks and retry MusicBrainz matching
      if (path === '/normalize-and-match' && request.method === 'POST') {
        if (!env.OPENROUTER_API_KEY) {
          return new Response(
            JSON.stringify({ error: 'OpenRouter API key not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const openrouter = new OpenRouterService(env.OPENROUTER_API_KEY);
        const musicbrainz = new MusicBrainzService();
        const limit = parseInt(url.searchParams.get('limit') || '5');

        // Get unmatched recordings (tracks with ISRC but no MusicBrainz recording)
        const unmatchedTracks = await db.getUnenrichedMusicBrainzRecordings(limit);

        if (unmatchedTracks.length === 0) {
          return new Response(
            JSON.stringify({ message: 'No unmatched tracks to normalize' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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

        return new Response(
          JSON.stringify({
            success: true,
            service: 'normalize-and-match',
            processed: unmatchedTracks.length,
            matched,
            results,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Route: POST /enrich-quansic
      // Manual trigger for Quansic artist enrichment
      if (path === '/enrich-quansic' && request.method === 'POST') {
        if (!env.QUANSIC_SESSION_COOKIE) {
          return new Response(
            JSON.stringify({ error: 'Quansic session cookie not configured' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const quansic = new QuansicService(env.QUANSIC_SESSION_COOKIE);
        const limit = parseInt(url.searchParams.get('limit') || '10');

        // Get MusicBrainz artists with ISNIs that need Quansic enrichment
        const unenrichedArtists = await db.getUnenrichedQuansicArtists(limit);

        if (unenrichedArtists.length === 0) {
          return new Response(
            JSON.stringify({ message: 'No artists with ISNIs to enrich' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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

        return new Response(
          JSON.stringify({
            success: true,
            service: 'quansic',
            enriched,
            total: unenrichedArtists.length,
            results,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Default: API info
      return new Response(
        JSON.stringify({
          name: 'TikTok Scraper API',
          version: '1.0.0',
          endpoints: {
            'GET /scrape/:handle': 'Scrape TikTok user videos (auto-enriches Spotify + Genius)',
            'GET /stats/:handle': 'Get creator stats',
            'GET /top-tracks': 'Get top Spotify tracks',
            'POST /enrich': 'Manually enrich Spotify tracks',
            'POST /enrich-artists': 'Manually enrich Spotify artists',
            'POST /enrich-musicbrainz': 'Manually enrich MusicBrainz (type=artists|recordings)',
            'POST /enrich-genius': 'Manually enrich Genius songs',
            'POST /normalize-and-match': 'Normalize unmatched tracks and retry MusicBrainz matching',
            'POST /enrich-quansic': 'Enrich MusicBrainz artists with Quansic data (IPN, Luminate ID, etc.)',
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },

  // Optional: Scheduled cron job
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log('Cron triggered:', event.scheduledTime);

    // Example: Scrape predefined creators (fetches ALL videos)
    const creators = ['idazeile', 'brookemonk_']; // Add your target creators

    const scraper = new TikTokScraper();
    const db = new NeonDB(env.NEON_DATABASE_URL);

    for (const handle of creators) {
      try {
        console.log(`Scraping @${handle}...`);

        const profile = await scraper.getUserProfile(handle);
        if (!profile) continue;

        await db.upsertCreator(profile);

        // Fetch ALL videos (no limit)
        const videos = await scraper.getUserVideos(profile.secUid);
        const videoRecords = videos.map((video) => ({
          video,
          tiktokHandle: handle,
          spotifyTrackId: scraper.extractSpotifyId(video),
          copyrightStatus: scraper.getCopyrightStatus(video),
        }));

        const inserted = await db.batchUpsertVideos(videoRecords);
        console.log(`@${handle}: ${inserted}/${videos.length} videos upserted`);
      } catch (error) {
        console.error(`Failed to scrape @${handle}:`, error);
      }
    }
  },
};
