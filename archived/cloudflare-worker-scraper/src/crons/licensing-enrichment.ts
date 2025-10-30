/**
 * Licensing Enrichment Cron (runs every 30 minutes)
 *
 * Enriches licensing data for Story Protocol compliance.
 *
 * Flow:
 * - MLC works (ISWC → Writers, Publishers, Share %)
 * - MLC recordings (ISRC discovery for alternate versions)
 *
 * Priority: Quansic recordings (PRIMARY ISWC source) > MusicBrainz works (fallback)
 */

import { NeonDB } from '../neon';
import type { Env } from '../types';

export default async function runLicensingEnrichment(env: Env): Promise<void> {
  console.log('📜 Licensing Enrichment Cron: Starting...');

  const db = new NeonDB(env.NEON_DATABASE_URL);

  try {
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
      LIMIT 20
    `;

    if (worksNeedingMLC.length === 0) {
      console.log('No works need MLC licensing enrichment');
      return;
    }

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

    console.log(`✅ Licensing Enrichment: ${enrichedMLC} works enriched`);
  } catch (error) {
    console.error('❌ Licensing Enrichment failed:', error);
    throw error;
  }
}
