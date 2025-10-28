/**
 * Quansic Enrichment Cron (runs every 20 minutes)
 *
 * Enriches artists and works with Quansic data (IPN, Luminate ID, composers).
 *
 * Steps:
 * 1. Enrich artists (ISNI → IPN, Luminate ID, name variants)
 * 2. Enrich works (ISWC → Composers, recording count, Q1 score)
 *
 * Rate limit: 200ms between requests
 */

import { NeonDB } from '../neon';
import type { Env } from '../types';

export default async function runQuansicEnrichment(env: Env): Promise<void> {
  console.log('🔮 Quansic Enrichment Cron: Starting...');

  if (!env.QUANSIC_SERVICE_URL) {
    console.log('Quansic service URL not configured, skipping');
    return;
  }

  const db = new NeonDB(env.NEON_DATABASE_URL);

  try {
    // Step 1: Quansic artist enrichment (all MusicBrainz artists with ISNIs)
    const viableQuansicArtists = await db.sql`
      SELECT DISTINCT ma.name, ma.mbid, ma.isnis, ma.spotify_artist_id
      FROM musicbrainz_artists ma
      LEFT JOIN quansic_artists qa ON ma.isnis[1] = qa.isni
      WHERE ma.isnis IS NOT NULL
        AND array_length(ma.isnis, 1) > 0
        AND qa.isni IS NULL
      LIMIT 50
    `;

    if (viableQuansicArtists.length > 0) {
      console.log(`Enriching ${viableQuansicArtists.length} artists with Quansic...`);
      let enrichedQuansic = 0;

      for (const artist of viableQuansicArtists) {
        try {
          for (const isni of artist.isnis) {
            // Add rate limiting to prevent hitting API limits
            await new Promise(resolve => setTimeout(resolve, 200));
            
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
    } else {
      console.log('No Quansic artists need enrichment');
    }

    // Step 2: Quansic work enrichment (ISWC → Composers)
    const worksNeedingEnrichment = await db.sql`
      SELECT w.iswc, w.work_mbid, w.title
      FROM musicbrainz_works w
      LEFT JOIN quansic_works qw ON w.iswc = qw.iswc
      WHERE w.iswc IS NOT NULL
        AND qw.iswc IS NULL
      LIMIT 50
    `;

    if (worksNeedingEnrichment.length > 0) {
      console.log(`Enriching ${worksNeedingEnrichment.length} works with Quansic (ISWC → Composers)...`);
      let enrichedWorks = 0;

      for (const work of worksNeedingEnrichment) {
        try {
          // Add rate limiting to prevent hitting API limits
          await new Promise(resolve => setTimeout(resolve, 200));
          
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
    } else {
      console.log('No Quansic works need enrichment');
    }

    console.log('✅ Quansic Enrichment: Complete');
  } catch (error) {
    console.error('❌ Quansic Enrichment failed:', error);
    throw error;
  }
}
