/**
 * Quansic Recordings Enrichment Cron (runs every 15 minutes)
 *
 * Focuses on bulk population of quansic_recordings table to maximize ISRC → ISWC mapping.
 * This is the highest yield enrichment for discovering ISWCs from existing ISRC data.
 *
 * Strategy:
 * 1. Prioritize tracks without existing quansic_recordings enrichment
 * 2. Batch process 50 ISRCs per run vs only 30 from ISWC discovery
 * 3. Rate limit to avoid API throttling
 * 4. Retry failed ISRCs later
 */

import { NeonDB } from '../neon';
import type { Env } from '../types';

export default async function runQuansicRecordingsEnrichment(env: Env): Promise<void> {
  console.log('🎵 Quansic Recordings Enrichment Cron: Starting...');

  if (!env.QUANSIC_SERVICE_URL) {
    console.log('Quansic service URL not configured, skipping');
    return;
  }

  const db = new NeonDB(env.NEON_DATABASE_URL);

  try {
    // Get ISRCs that need Quansic enrichment (priority: no existing quansic_recordings)
    // Note: failed_quansic_lookups table commented out for now - create it later for optimization
    const isrcsNeedingEnrichment = await db.sql`
      SELECT st.spotify_track_id, st.title, st.isrc, mbr.recording_mbid, st.has_iswc, st.bmi_checked
      FROM spotify_tracks st
      LEFT JOIN quansic_recordings qr ON st.isrc = qr.isrc
      LEFT JOIN musicbrainz_recordings mbr ON st.spotify_track_id = mbr.spotify_track_id
      WHERE st.isrc IS NOT NULL
        AND qr.isrc IS NULL
      ORDER BY 
        -- Prioritize tracks that have failed BMI/CISAC lookups (need Quansic more)
        (st.bmi_checked IS NULL OR st.bmi_checked = false) DESC,
        -- Prioritize tracks with no ISWC yet
        (st.has_iswc IS NULL OR st.has_iswc = false) DESC,
        st.title
      LIMIT 50
    `;

    if (isrcsNeedingEnrichment.length === 0) {
      console.log('No ISRCs need Quansic recording enrichment');
      return;
    }

    console.log(`Enriching ${isrcsNeedingEnrichment.length} ISRCs with Quansic recordings...`);
    let enrichedRecordings = 0;
    let iswcFound = 0;
    let failedRequests = 0;

    for (const track of isrcsNeedingEnrichment) {
      try {
        // Rate limiting between requests
        await new Promise(resolve => setTimeout(resolve, 200));

        console.log(`  🎵 Recording enrichment: ISRC ${track.isrc}`);

        const quansicResponse = await fetch(`${env.QUANSIC_SERVICE_URL}/enrich-recording`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            isrc: track.isrc,
            spotify_track_id: track.spotify_track_id,
            recording_mbid: track.recording_mbid
          })
        });

        if (!quansicResponse.ok) {
          // Handle specific errors gracefully
          if (quansicResponse.status === 404) {
            console.log(`  ✗ ISRC ${track.isrc} not found in Quansic (404)`);
            failedRequests++;
          } else if (quansicResponse.status >= 500) {
            console.log(`  ✗ ISRC ${track.isrc} server error (${quansicResponse.status}), will retry later`);
            failedRequests++;
          } else {
            console.error(`  ✗ ISRC ${track.isrc} request failed: ${quansicResponse.status}`);
            failedRequests++;
          }
          continue;
        }

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
            ${data.spotify_track_id ? null : track.recording_mbid},
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
            recording_mbid = COALESCE(EXCLUDED.recording_mbid, quansic_recordings.recording_mbid),
            spotify_track_id = COALESCE(EXCLUDED.spotify_track_id, quansic_recordings.spotify_track_id),
            title = EXCLUDED.title,
            iswc = EXCLUDED.iswc,
            work_title = EXCLUDED.work_title,
            duration_ms = EXCLUDED.duration_ms,
            release_date = EXCLUDED.release_date,
            artists = EXCLUDED.artists,
            composers = EXCLUDED.composers,
            platform_ids = EXCLUDED.platform_ids,
            q2_score = EXCLUDED.q2_score,
            raw_data = EXCLUDED.raw_data,
            enriched_at = NOW()
        `;

        enrichedRecordings++;

        if (quansicIswc) {
          iswcFound++;
          console.log(`  ✓ ISRC ${track.isrc} → ISWC ${quansicIswc} (${data.title})`);
        } else {
          console.log(`  ✓ ISRC ${track.isrc} enriched (no ISWC found)`);
        }

        // Update ISWC sources if we found a new ISWC
        if (quansicIswc) {
          const existingTrack = await db.sql`
            SELECT iswc_source FROM spotify_tracks WHERE spotify_track_id = ${track.spotify_track_id}
          `;
          
          const existing = existingTrack[0]?.iswc_source as any || {};
          const updatedSources = { ...existing, quansic: quansicIswc };
          
          await db.sql`
            UPDATE spotify_tracks
            SET has_iswc = true,
                iswc_source = ${JSON.stringify(updatedSources)},
                bmi_checked = COALESCE(bmi_checked, false),
                cisac_checked = COALESCE(cisac_checked, false)
            WHERE spotify_track_id = ${track.spotify_track_id}
          `;
        }

      } catch (error: any) {
        console.error(`  ❌ Failed to enrich ISRC ${track.isrc}:`, error.message);
        failedRequests++;
        
        // Mark problematic ISRCs to avoid repeated failures
        if (error.message.includes('not found') || error.message.includes('404')) {
          await db.sql`
            INSERT INTO failed_quansic_lookups (isrc, error_type, error_details, retry_count, created_at)
            VALUES (
              ${track.isrc}, 
              'not_found', 
              ${error.message.substring(0, 500)}, 
              1, 
              NOW()
            )
            ON CONFLICT (isrc) DO UPDATE SET
              retry_count = failed_quansic_lookups.retry_count + 1,
              updated_at = NOW()
          `;
        } else if (error.message.includes('rate') || error.message.includes('429')) {
          await db.sql`
            INSERT INTO failed_quansic_lookups (isrc, error_type, error_details, retry_count, created_at)
            VALUES (
              ${track.isrc}, 
              'rate_limit', 
              ${error.message.substring(0, 500)}, 
              1, 
              NOW()
            )
            ON CONFLICT (isrc) DO UPDATE SET
              retry_count = failed_quansic_lookups.retry_count + 1,
              updated_at = NOW()
          `;
        }
      }
    }

    console.log(`✅ Quansic Recordings Enrichment: ${enrichedRecordings}/${isrcsNeedingEnrichment.length} ISRCs processed`);
    console.log(`   📝 ${iswcFound} ISWCs discovered via Quansic`);
    if (failedRequests > 0) {
      console.log(`   ❌ ${failedRequests} failed requests (404s, server errors)`);
    }

  } catch (error) {
    console.error('❌ Quansic Recordings Enrichment failed:', error);
    throw error;
  }
}
