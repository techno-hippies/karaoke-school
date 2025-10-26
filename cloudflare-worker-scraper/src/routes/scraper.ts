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
import { BMIService } from '../bmi';
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
          bmi: null,
          musicbrainz: null,
          quansic: null,
          mlc: null,
        };

        try {
          // Try 1: BMI title search (ISWC DISCOVERY - independent, only needs title+performer from Spotify)
          if (env.BMI_SERVICE_URL) {
            console.log(`  Trying BMI title search for "${track.title}"...`);
            try {
              // Get first artist as performer
              const performerResult = await db.sql`
                SELECT sa.name
                FROM spotify_track_artists sta
                JOIN spotify_artists sa ON sta.spotify_artist_id = sa.spotify_artist_id
                WHERE sta.spotify_track_id = ${track.spotify_track_id}
                ORDER BY sta.position ASC
                LIMIT 1
              `;

              if (performerResult.length > 0) {
                const bmiService = new BMIService(env.BMI_SERVICE_URL);
                const bmiData = await bmiService.searchByTitle(track.title, performerResult[0].name);

                if (bmiData?.iswc) {
                  iswcSources.bmi = bmiData.iswc;
                  console.log(`  ✓ BMI DISCOVERED: ${bmiData.iswc}`);

                  // Store BMI work immediately
                  await db.sql`
                    INSERT INTO bmi_works (
                      bmi_work_id, iswc, ascap_work_id, title,
                      writers, publishers, performers, shares,
                      status, raw_data
                    ) VALUES (
                      ${bmiData.bmi_work_id},
                      ${bmiData.iswc},
                      ${bmiData.ascap_work_id},
                      ${bmiData.title},
                      ${JSON.stringify(bmiData.writers)}::jsonb,
                      ${JSON.stringify(bmiData.publishers)}::jsonb,
                      ${JSON.stringify(bmiData.performers)}::jsonb,
                      ${JSON.stringify(bmiData.shares)}::jsonb,
                      ${bmiData.status},
                      ${JSON.stringify(bmiData)}::jsonb
                    )
                    ON CONFLICT (bmi_work_id) DO UPDATE SET
                      raw_data = EXCLUDED.raw_data,
                      updated_at = NOW()
                  `;
                } else {
                  console.log(`  ✗ BMI title search: no match found`);
                }
              }
            } catch (bmiError) {
              console.log(`  ✗ BMI title search failed:`, bmiError);
            }
          }

          // Try 2: MusicBrainz (ISRC-based, ~40% success)
          console.log(`  Trying MusicBrainz for ${track.title}...`);
          try {
            const mbResult = await musicbrainz.searchRecordingByISRC(track.isrc);
            if (mbResult?.recordings?.length > 0) {
              const recording = mbResult.recordings[0];

              // Get and store full recording data
              const mbRecording = await musicbrainz.getRecording(recording.id);
              mbRecording.spotify_track_id = track.spotify_track_id;
              await db.upsertMusicBrainzRecording(mbRecording);
              console.log(`  ✓ Stored MusicBrainz recording: ${mbRecording.recording_mbid}`);

              // Extract and store associated works
              if (recording.relations) {
                for (const rel of recording.relations) {
                  if (rel.type === 'performance' && rel.work) {
                    const work = await musicbrainz.getWork(rel.work.id);

                    // Store work and link to recording
                    await db.upsertMusicBrainzWork(work);
                    await db.linkWorkToRecording(work.work_mbid, mbRecording.recording_mbid);

                    if (work.iswc) {
                      iswcSources.musicbrainz = work.iswc;
                      console.log(`  ✓ MusicBrainz ISWC: ${work.iswc} (work: ${work.work_mbid})`);
                      break;
                    }
                  }
                }
              }
            }
          } catch (mbError) {
            console.log(`  ✗ MusicBrainz failed:`, mbError);
          }

          // Try 3: Quansic (ISRC-based, ~85% success)
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

                // Extract ISWC from works array if not in top-level
                let quansicIswc = data.iswc;
                let workTitle = data.work_title;

                if (!quansicIswc && data.raw_data?.recording?.works?.length > 0) {
                  const work = data.raw_data.recording.works[0];
                  quansicIswc = work.iswc || null;
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
                    ${null},
                    ${data.spotify_track_id || track.spotify_track_id},
                    ${data.title},
                    ${quansicIswc},
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

                if (quansicIswc) {
                  iswcSources.quansic = quansicIswc;
                  console.log(`  ✓ Quansic: ${quansicIswc} (stored in quansic_recordings)`);
                }
              }
            } catch (quansicError) {
              console.log(`  ✗ Quansic failed:`, quansicError);
            }
          }

          // Try 4: MLC corroboration (if we got ISWC from BMI, MB, or Quansic)
          const tempIswc = iswcSources.bmi || iswcSources.musicbrainz || iswcSources.quansic;
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

          // Try 5: BMI ISWC search (ISWC CORROBORATION - only if we have candidate and BMI title didn't find it)
          if (tempIswc && env.BMI_SERVICE_URL && !iswcSources.bmi) {
            console.log(`  Trying BMI ISWC corroboration (ISWC: ${tempIswc})...`);
            try {
              const bmiService = new BMIService(env.BMI_SERVICE_URL);
              const bmiData = await bmiService.searchByISWC(tempIswc);

              if (bmiData?.iswc) {
                iswcSources.bmi = bmiData.iswc;
                console.log(`  ✓ BMI CORROBORATED: ${bmiData.iswc}`);

                // Store BMI work
                await db.sql`
                  INSERT INTO bmi_works (
                    bmi_work_id, iswc, ascap_work_id, title,
                    writers, publishers, performers, shares,
                    status, raw_data
                  ) VALUES (
                    ${bmiData.bmi_work_id},
                    ${bmiData.iswc},
                    ${bmiData.ascap_work_id},
                    ${bmiData.title},
                    ${JSON.stringify(bmiData.writers)}::jsonb,
                    ${JSON.stringify(bmiData.publishers)}::jsonb,
                    ${JSON.stringify(bmiData.performers)}::jsonb,
                    ${JSON.stringify(bmiData.shares)}::jsonb,
                    ${bmiData.status},
                    ${JSON.stringify(bmiData)}::jsonb
                  )
                  ON CONFLICT (bmi_work_id) DO UPDATE SET
                    raw_data = EXCLUDED.raw_data,
                    updated_at = NOW()
                `;
              }
            } catch (bmiError) {
              console.log(`  ✗ BMI ISWC search failed:`, bmiError);
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

    // Step 4.5: Genius Artist enrichment (from genius_songs)
    if (env.GENIUS_API_KEY) {
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
      }
    }

    // Step 4.6: Genius Song Referents (lyrics annotations)
    if (env.GENIUS_API_KEY) {
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
      }
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
    if (env.QUANSIC_SERVICE_URL) {
      const viableQuansicArtists = await db.sql`
        SELECT DISTINCT ma.name, ma.mbid, ma.isnis, ma.spotify_artist_id
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
              // Call Quansic service endpoint with Spotify ID fallback
              const quansicResponse = await fetch(`${env.QUANSIC_SERVICE_URL}/enrich`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  isni: isni,
                  musicbrainz_mbid: artist.mbid,
                  spotify_artist_id: artist.spotify_artist_id
                })
              });

              if (quansicResponse.ok) {
                const { data } = await quansicResponse.json();
                await db.upsertQuansicArtist(data);
                enrichedQuansic++;
                console.log(`✓ Enriched ${artist.name} (ISNI: ${isni})`);
              } else {
                console.error(`Quansic artist enrichment failed for ${artist.name} (${quansicResponse.status})`);
              }
            }
          } catch (error) {
            console.error(`Failed to enrich ${artist.name} with Quansic:`, error);
          }
        }

        console.log(`✓ Enriched ${enrichedQuansic} artists with Quansic`);
      }
    } else {
      console.log('Quansic service URL not configured, skipping Quansic artist enrichment');
    }

    // Step 6.5: Quansic Work enrichment (ISWC → Composers)
    if (env.QUANSIC_SERVICE_URL) {
      console.log('🎼 Step 6.5: Quansic Work enrichment (ISWC → Composers)...');

      const worksNeedingEnrichment = await db.sql`
        SELECT w.iswc, w.work_mbid, w.title
        FROM musicbrainz_works w
        LEFT JOIN quansic_works qw ON w.iswc = qw.iswc
        WHERE w.iswc IS NOT NULL
          AND qw.iswc IS NULL
        LIMIT 5
      `;

      if (worksNeedingEnrichment.length > 0) {
        console.log(`Enriching ${worksNeedingEnrichment.length} works with Quansic (ISWC → Composers)...`);
        let enrichedWorks = 0;

        for (const work of worksNeedingEnrichment) {
          try {
            const response = await fetch(`${env.QUANSIC_SERVICE_URL}/enrich-work`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                iswc: work.iswc,
                work_mbid: work.work_mbid
              })
            });

            if (!response.ok) {
              console.error(`Quansic work enrichment failed for ${work.iswc}: ${response.status}`);
              continue;
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

            enrichedWorks++;
            console.log(`✓ Enriched work "${work.title}" (${data.contributors?.length || 0} composers)`);
          } catch (error) {
            console.error(`Failed to enrich work ${work.iswc}:`, error);
          }
        }

        console.log(`✓ Enriched ${enrichedWorks} works with composer data`);
      }
    } else {
      console.log('Quansic service URL not configured, skipping Quansic work enrichment');
    }

    // Step 6.6: MLC Licensing enrichment (ISWC → Writers, Publishers for Story Protocol)
    console.log('📜 Step 6.6: MLC Licensing enrichment (ISWC → Writers, Publishers)...');

    const worksNeedingMLC = await db.sql`
      SELECT isrc, iswc, work_title, title FROM (
        -- Try Quansic recordings first (PRIMARY source)
        SELECT
          qr.isrc,
          qr.iswc,
          qr.work_title,
          qr.title,
          1 as priority
        FROM quansic_recordings qr
        LEFT JOIN mlc_works mlw ON qr.iswc = mlw.iswc
        WHERE qr.iswc IS NOT NULL
          AND mlw.iswc IS NULL

        UNION ALL

        -- Fallback to MusicBrainz works
        SELECT
          NULL as isrc,
          mw.iswc,
          mw.title as work_title,
          mw.title,
          2 as priority
        FROM musicbrainz_works mw
        LEFT JOIN mlc_works mlw ON mw.iswc = mlw.iswc
        WHERE mw.iswc IS NOT NULL
          AND mlw.iswc IS NULL
      ) combined
      ORDER BY priority, iswc
      LIMIT 5
    `;

    if (worksNeedingMLC.length > 0) {
      console.log(`Enriching ${worksNeedingMLC.length} works with MLC licensing data...`);
      let enrichedMLC = 0;

      for (const rec of worksNeedingMLC) {
        try {
          const iswc = rec.iswc as string;

          // Search MLC by ISWC
          const searchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works?page=0&size=50';
          const response = await fetch(searchUrl, {
            method: 'POST',
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json',
              'Origin': 'https://portal.themlc.com',
              'Referer': 'https://portal.themlc.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            body: JSON.stringify({ iswc }),
          });

          if (!response.ok) {
            console.error(`MLC search failed for ${iswc}: ${response.status}`);
            continue;
          }

          const data = await response.json() as any;
          const mlcWorks = data.content || [];

          if (mlcWorks.length === 0) {
            console.log(`No MLC match for ${iswc}`);
            continue;
          }

          const mlcWork = mlcWorks[0];

          // Calculate total publisher share
          let directShare = 0;
          let adminShare = 0;

          for (const pub of mlcWork.originalPublishers || []) {
            directShare += pub.publisherShare || 0;
            for (const admin of pub.administratorPublishers || []) {
              adminShare += admin.publisherShare || 0;
            }
          }

          const totalShare = directShare + adminShare;

          // Prepare writers and publishers
          const writers = mlcWork.writers.map((w: any) => ({
            name: `${w.firstName || ''} ${w.lastName || ''}`.trim() || 'Unknown',
            ipi: w.ipiNumber || null,
            role: w.roleCode === 11 ? 'Composer' : 'Writer',
            share: w.writerShare || 0,
          }));

          const publishers = mlcWork.originalPublishers.map((p: any) => ({
            name: p.publisherName,
            ipi: p.ipiNumber || '',
            share: p.publisherShare || 0,
            administrators: (p.administratorPublishers || []).map((a: any) => ({
              name: a.publisherName,
              ipi: a.ipiNumber || '',
              share: a.publisherShare || 0,
            })),
          }));

          // Upsert into mlc_works
          await db.sql`
            INSERT INTO mlc_works (
              mlc_song_code,
              title,
              iswc,
              total_publisher_share,
              writers,
              publishers,
              raw_data
            ) VALUES (
              ${mlcWork.songCode},
              ${mlcWork.title},
              ${mlcWork.iswc || null},
              ${totalShare},
              ${JSON.stringify(writers)}::jsonb,
              ${JSON.stringify(publishers)}::jsonb,
              ${JSON.stringify(mlcWork)}::jsonb
            )
            ON CONFLICT (mlc_song_code)
            DO UPDATE SET
              title = EXCLUDED.title,
              iswc = EXCLUDED.iswc,
              total_publisher_share = EXCLUDED.total_publisher_share,
              writers = EXCLUDED.writers,
              publishers = EXCLUDED.publishers,
              raw_data = EXCLUDED.raw_data,
              updated_at = NOW()
          `;

          // Fetch all recordings for this work (discovers alternate ISRCs)
          const recordingsUrl = `https://api.ptl.themlc.com/api/dsp-recording/matched/${mlcWork.songCode}?page=1&limit=50&order=matchedAmount&direction=desc`;
          const recResponse = await fetch(recordingsUrl, {
            headers: {
              'Accept': 'application/json, text/plain, */*',
              'Origin': 'https://portal.themlc.com',
              'Referer': 'https://portal.themlc.com/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          if (recResponse.ok) {
            const recData = await recResponse.json() as any;
            const recordings = recData.recordings || [];

            // Store all discovered ISRCs
            for (const mlcRec of recordings) {
              if (mlcRec.isrc) {
                await db.sql`
                  INSERT INTO mlc_recordings (
                    isrc,
                    mlc_song_code,
                    raw_data
                  ) VALUES (
                    ${mlcRec.isrc},
                    ${mlcWork.songCode},
                    ${JSON.stringify(mlcRec)}::jsonb
                  )
                  ON CONFLICT (isrc)
                  DO UPDATE SET
                    mlc_song_code = EXCLUDED.mlc_song_code,
                    raw_data = EXCLUDED.raw_data,
                    updated_at = NOW()
                `;
              }
            }

            enrichedMLC++;
            console.log(`✓ Enriched "${mlcWork.title}" (${writers.length} writers, ${publishers.length} publishers, ${totalShare}% share, ${recordings.length} recordings)`);
          }

          // Rate limiting: 200ms between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          console.error(`Failed to enrich MLC work ${rec.iswc}:`, error);
        }
      }

      console.log(`✓ Enriched ${enrichedMLC} works with MLC licensing data`);
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

    // Step 8: Audio Download (Freyr → Grove IPFS storage)
    if (env.FREYR_SERVICE_URL && env.ACOUSTID_API_KEY) {
      console.log('🎧 Step 8: Audio Download (tracks with ISWC + MLC ≥98%)...');

      const readyTracks = await db.sql`
        SELECT
          st.spotify_track_id,
          st.title,
          st.artists,
          st.isrc,
          mlw.total_publisher_share
        FROM spotify_tracks st
        LEFT JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
        LEFT JOIN mlc_recordings mlr ON st.isrc = mlr.isrc
        LEFT JOIN mlc_works mlw ON mlr.mlc_song_code = mlw.mlc_song_code
        WHERE taf.spotify_track_id IS NULL
          AND st.has_iswc = true
          AND mlw.total_publisher_share >= 98
        ORDER BY mlw.total_publisher_share DESC, st.spotify_track_id
        LIMIT 2
      `;

      if (readyTracks.length > 0) {
        console.log(`Downloading audio for ${readyTracks.length} tracks...`);
        let downloaded = 0;

        for (const track of readyTracks) {
          try {
            const artists = track.artists as any[];
            const primaryArtist = artists[0]?.name || 'Unknown';

            console.log(`Downloading: ${track.title} - ${primaryArtist}`);

            const response = await fetch(`${env.FREYR_SERVICE_URL}/download-and-store`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                spotify_track_id: track.spotify_track_id,
                expected_title: track.title,
                expected_artist: primaryArtist,
                acoustid_api_key: env.ACOUSTID_API_KEY,
                neon_database_url: env.NEON_DATABASE_URL,
                chain_id: 37111, // Lens Network
              }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error(`Failed to download ${track.spotify_track_id}: ${errorData.message}`);
              continue;
            }

            const data = await response.json();
            downloaded++;

            console.log(`✓ Downloaded "${track.title}" (CID: ${data.grove_cid}, ${data.download_method}, verified: ${data.verification?.verified})`);

            // Rate limiting: 3 seconds between downloads
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (error) {
            console.error(`Error downloading ${track.spotify_track_id}:`, error);
          }
        }

        console.log(`✓ Downloaded ${downloaded} audio files to Grove`);
      } else {
        console.log('No tracks ready for audio download (need ISWC + MLC ≥98%)');
      }
    } else {
      if (!env.FREYR_SERVICE_URL) {
        console.log('FREYR_SERVICE_URL not configured, skipping audio download');
      }
      if (!env.ACOUSTID_API_KEY) {
        console.log('ACOUSTID_API_KEY not configured, skipping audio download');
      }
    }

    console.log('✅ Enrichment cycle complete');
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
