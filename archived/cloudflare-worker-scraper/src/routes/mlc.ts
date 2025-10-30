/**
 * MLC (Mechanical Licensing Collective) Routes
 * Endpoints for mechanical licensing data enrichment
 *
 * Required for Story Protocol compliance (≥98% publisher share)
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import type { Env } from '../types';

const mlc = new Hono<{ Bindings: Env }>();

/**
 * Helper: Check if a work's recordings include the target ISRC
 */
async function workHasISRC(songCode: string, targetIsrc: string): Promise<boolean> {
  const recordingsUrl = `https://api.ptl.themlc.com/api/dsp-recording/matched/${songCode}?page=1&limit=10&order=matchedAmount&direction=desc`;

  try {
    const response = await fetch(recordingsUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://portal.themlc.com',
        'Referer': 'https://portal.themlc.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return false;

    const data = await response.json() as any;
    const recordings = data.recordings || [];

    return recordings.some((r: any) => r.isrc === targetIsrc);
  } catch {
    return false;
  }
}

/**
 * Helper: Fetch matched recordings for a work
 */
async function fetchRecordings(songCode: string): Promise<any[]> {
  const recordingsUrl = `https://api.ptl.themlc.com/api/dsp-recording/matched/${songCode}?page=1&limit=50&order=matchedAmount&direction=desc`;

  try {
    const response = await fetch(recordingsUrl, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://portal.themlc.com',
        'Referer': 'https://portal.themlc.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) return [];

    const data = await response.json() as any;
    return data.recordings || [];
  } catch {
    return [];
  }
}

/**
 * POST /enrich-mlc-by-iswc
 * Enrich MLC works using ISWCs from Quansic recordings (PRIMARY source)
 * Corroborates ISWC and adds licensing data (writers, publishers)
 */
mlc.post('/enrich-mlc-by-iswc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '5');

  // Get ISWCs from Quansic (PRIMARY) or MusicBrainz works (fallback)
  const result = await db.sql`
    SELECT isrc, iswc, work_title, title FROM (
      -- Try Quansic first (PRIMARY source)
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
    LIMIT ${limit}
  `;

  const unenrichedRecordings = result;

  if (unenrichedRecordings.length === 0) {
    return c.json({ message: 'No ISWCs need MLC corroboration (checked Quansic + MusicBrainz)' });
  }

  console.log(`Corroborating ${unenrichedRecordings.length} ISWCs via MLC (from Quansic/MusicBrainz)...`);

  let enriched = 0;
  const results = [];

  for (const rec of unenrichedRecordings) {
    try {
      const iswc = rec.iswc as string;
      const isrc = rec.isrc as string;

      // Search MLC by ISWC
      const searchUrl = 'https://api.ptl.themlc.com/api2v/public/search/works?page=0&size=50';
      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Origin': 'https://portal.themlc.com',
          'Referer': 'https://portal.themlc.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ iswc }),
      });

      if (!response.ok) {
        results.push({ iswc, status: 'search_failed', error: response.status });
        continue;
      }

      const data = await response.json() as any;
      const mlcWorks = data.content || [];

      if (mlcWorks.length === 0) {
        results.push({ iswc, status: 'no_match' });
        continue;
      }

      const mlcWork = mlcWorks[0]; // Take first match

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
      const recordings = await fetchRecordings(mlcWork.songCode);

      // Store all ISRCs we discover
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

      const iswcMatch = mlcWork.iswc === iswc;

      enriched++;
      results.push({
        isrc,
        iswc,
        iswc_match: iswcMatch,
        source_title: rec.title,
        source: isrc ? 'quansic' : 'musicbrainz',
        mlc_song_code: mlcWork.songCode,
        mlc_title: mlcWork.title,
        total_publisher_share: totalShare,
        writers_count: writers.length,
        publishers_count: publishers.length,
        recordings_discovered: recordings.length,
        status: 'success',
      });

      // Rate limiting: wait 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error corroborating ISWC ${rec.iswc}:`, error);
      results.push({
        isrc: rec.isrc,
        iswc: rec.iswc,
        status: 'error',
        error: String(error)
      });
    }
  }

  return c.json({
    success: true,
    service: 'mlc-corroboration',
    enriched,
    total: unenrichedRecordings.length,
    results,
  });
});

/**
 * GET /mlc/works/:songCode
 * Get MLC work by song code
 */
mlc.get('/mlc/works/:songCode', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const songCode = c.req.param('songCode');

  const result = await db.sql`
    SELECT * FROM mlc_works
    WHERE mlc_song_code = ${songCode}
  `;

  if (result.length === 0) {
    return c.json({ error: 'MLC work not found' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /mlc/recordings/isrc/:isrc
 * Get MLC recording by ISRC
 */
mlc.get('/mlc/recordings/isrc/:isrc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const isrc = c.req.param('isrc');

  const result = await db.sql`
    SELECT
      mr.*,
      mw.title as work_title,
      mw.total_publisher_share,
      mw.story_mintable,
      mw.writers,
      mw.publishers
    FROM mlc_recordings mr
    JOIN mlc_works mw ON mr.mlc_song_code = mw.mlc_song_code
    WHERE mr.isrc = ${isrc}
  `;

  if (result.length === 0) {
    return c.json({ error: 'MLC recording not found' }, 404);
  }

  return c.json(result[0]);
});

export default mlc;
