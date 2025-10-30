/**
 * ISWC Discovery Cron (runs every 3 minutes)
 *
 * HIGH PRIORITY: Determines which tracks are viable for the entire enrichment pipeline.
 *
 * Flow:
 * 1. BMI title search (DISCOVERY - independent, only needs Spotify title+artist)
 * 2. CISAC title search (DISCOVERY - authoritative ISWC source)
 * 3. MusicBrainz ISRC lookup (ISRC-based, ~40% success)
 * 4. Quansic ISRC lookup (ISRC-based, ~85% success)
 * 5. MLC corroboration (if ISWC found)
 * 6. BMI ISWC search (CORROBORATION - if candidate found)
 * 7. CISAC ISWC search (CORROBORATION - if candidate found)
 *
 * Corroboration logic:
 * - All agree → use it
 * - Majority (2/3+) → use majority
 * - All disagree → skip (conflict)
 * - Single source → use with caution
 */

import { NeonDB } from '../neon';
import { MusicBrainzService } from '../services/musicbrainz';
import { BMIService } from '../services/bmi';
import { CISACService } from '../services/cisac';
import type { Env } from '../types';

export default async function runISWCDiscovery(env: Env): Promise<void> {
  console.log('🔍 ISWC Discovery Cron: Starting...');

  const db = new NeonDB(env.NEON_DATABASE_URL);

  try {
    // Get tracks needing ISWC lookup
    const tracksNeedingIswc = await db.sql`
      SELECT spotify_track_id, title, isrc, has_iswc
      FROM spotify_tracks
      WHERE isrc IS NOT NULL
        AND (has_iswc IS NULL OR has_iswc = false OR bmi_checked IS NULL OR bmi_checked = false)
      LIMIT 30
    `;

    if (tracksNeedingIswc.length === 0) {
      console.log('No tracks need ISWC lookup');
      return;
    }

    console.log(`Checking ISWC for ${tracksNeedingIswc.length} tracks...`);
    const musicbrainz = new MusicBrainzService();
    let foundIswc = 0;

    for (const track of tracksNeedingIswc) {
      // Load existing ISWC sources to preserve data from previous runs
      let iswcSources: { [key: string]: string | null } = {
        bmi: null,
        cisac: null,
        musicbrainz: null,
        quansic: null,
        mlc: null,
      };

      // Merge with existing sources if track has them
      if (track.has_iswc) {
        const existingTrack = await db.sql`
          SELECT iswc_source FROM spotify_tracks WHERE spotify_track_id = ${track.spotify_track_id}
        `;
        if (existingTrack[0]?.iswc_source) {
          const existing = existingTrack[0].iswc_source as any;
          iswcSources = { ...iswcSources, ...existing };
          console.log(`  📋 Loading existing ISWCs: ${JSON.stringify(existing)}`);
        }
      }

      try {
        // Try 1: BMI title search (ISWC DISCOVERY - independent)
        if (env.BMI_SERVICE_URL) {
          console.log(`  Trying BMI title search for "${track.title}"...`);
          try {
            const performerResult = await db.sql`
              SELECT sa.name
              FROM spotify_track_artists sta
              JOIN spotify_artists sa ON sta.spotify_artist_id = sa.spotify_artist_id
              WHERE sta.spotify_track_id = ${track.spotify_track_id}
              ORDER BY sta.artist_position ASC
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

          // Mark BMI as checked
          await db.sql`
            UPDATE spotify_tracks
            SET bmi_checked = true
            WHERE spotify_track_id = ${track.spotify_track_id}
          `;
        }

        // Try 1B: CISAC title search (ISWC DISCOVERY)
        if (env.CISAC_SERVICE_URL) {
          console.log(`  Trying CISAC title search for "${track.title}"...`);
          try {
            const performerResult = await db.sql`
              SELECT sa.name
              FROM spotify_track_artists sta
              JOIN spotify_artists sa ON sta.spotify_artist_id = sa.spotify_artist_id
              WHERE sta.spotify_track_id = ${track.spotify_track_id}
              ORDER BY sta.artist_position ASC
              LIMIT 1
            `;

            if (performerResult.length > 0) {
              const cisacService = new CISACService(env.CISAC_SERVICE_URL);
              const cisacData = await cisacService.searchByTitle(track.title, performerResult[0].name);

              if (cisacData?.iswc) {
                iswcSources.cisac = cisacData.iswc;
                console.log(`  ✓ CISAC DISCOVERED: ${cisacData.iswc}`);

                // Store CISAC work immediately
                await db.sql`
                  INSERT INTO cisac_works (
                    iswc, title, iswc_status,
                    composers, authors, publishers, other_titles, raw_data
                  ) VALUES (
                    ${cisacData.iswc},
                    ${cisacData.title},
                    ${cisacData.iswc_status},
                    ${JSON.stringify(cisacData.composers)}::jsonb,
                    ${JSON.stringify(cisacData.authors)}::jsonb,
                    ${JSON.stringify(cisacData.publishers)}::jsonb,
                    ${JSON.stringify(cisacData.other_titles || [])}::jsonb,
                    ${JSON.stringify(cisacData)}::jsonb
                  )
                  ON CONFLICT (iswc) DO UPDATE SET
                    raw_data = EXCLUDED.raw_data,
                    updated_at = NOW()
                `;
              } else {
                console.log(`  ✗ CISAC title search: no match found`);
              }
            }
          } catch (cisacError) {
            console.log(`  ✗ CISAC title search failed:`, cisacError);
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
                    console.log(`  ✓ MusicBrainz ISWC: ${work.iswc}`);
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
                console.log(`  ✓ Quansic: ${quansicIswc}`);
              }
            }
          } catch (quansicError) {
            console.log(`  ✗ Quansic failed:`, quansicError);
          }
        }

        // Try 4: MLC corroboration (if we got ISWC from BMI, MB, or Quansic)
        const tempIswc = iswcSources.bmi || iswcSources.cisac || iswcSources.musicbrainz || iswcSources.quansic;
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

        // Try 5: BMI ISWC search (CORROBORATION - only if candidate exists and BMI title didn't find it)
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

        // Try 5B: CISAC ISWC search (CORROBORATION - only if candidate exists and CISAC title didn't find it)
        if (tempIswc && env.CISAC_SERVICE_URL && !iswcSources.cisac) {
          console.log(`  Trying CISAC ISWC corroboration (ISWC: ${tempIswc})...`);
          try {
            const cisacService = new CISACService(env.CISAC_SERVICE_URL);
            const cisacData = await cisacService.searchByISWC(tempIswc);

            if (cisacData?.iswc) {
              iswcSources.cisac = cisacData.iswc;
              console.log(`  ✓ CISAC CORROBORATED: ${cisacData.iswc}`);

              // Store CISAC work
              await db.sql`
                INSERT INTO cisac_works (
                  iswc, title, iswc_status,
                  composers, authors, publishers, other_titles, raw_data
                ) VALUES (
                  ${cisacData.iswc},
                  ${cisacData.title},
                  ${cisacData.iswc_status},
                  ${JSON.stringify(cisacData.composers)}::jsonb,
                  ${JSON.stringify(cisacData.authors)}::jsonb,
                  ${JSON.stringify(cisacData.publishers)}::jsonb,
                  ${JSON.stringify(cisacData.other_titles || [])}::jsonb,
                  ${JSON.stringify(cisacData)}::jsonb
                )
                ON CONFLICT (iswc) DO UPDATE SET
                  raw_data = EXCLUDED.raw_data,
                  updated_at = NOW()
              `;
            }
          } catch (cisacError) {
            console.log(`  ✗ CISAC ISWC search failed:`, cisacError);
          }
        }

        // Corroboration logic
        const iswcValues = Object.values(iswcSources).filter(v => v !== null);
        const uniqueIswcs = [...new Set(iswcValues)];

        let finalIswc: string | null = null;
        let hasIswc = false;

        if (uniqueIswcs.length === 0) {
          hasIswc = false;
          console.log(`  ❌ No ISWC found for "${track.title}"`);
        } else if (uniqueIswcs.length === 1) {
          // All sources agree OR only 1 source
          finalIswc = uniqueIswcs[0];
          hasIswc = true;
          if (iswcValues.length >= 2) {
            console.log(`  ✅ CORROBORATED: ${finalIswc} (${iswcValues.length} sources agree)`);
          } else {
            console.log(`  ✅ SINGLE SOURCE: ${finalIswc}`);
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
            console.log(`  ✅ MAJORITY: ${finalIswc} (${maxCount} sources)`);
          } else {
            // All disagree - don't trust any
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
        await db.sql`
          UPDATE spotify_tracks
          SET has_iswc = false
          WHERE spotify_track_id = ${track.spotify_track_id}
        `;
      }
    }

    console.log(`✅ ISWC Discovery: ${foundIswc}/${tracksNeedingIswc.length} tracks have ISWC`);
  } catch (error) {
    console.error('❌ ISWC Discovery failed:', error);
    throw error;
  }
}
