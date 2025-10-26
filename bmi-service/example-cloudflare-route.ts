/**
 * Example Cloudflare Worker Route for BMI Integration
 *
 * This file demonstrates how to integrate the BMI scraper service
 * into your existing Cloudflare Worker at cloudflare-worker-scraper
 *
 * Copy this to: cloudflare-worker-scraper/src/routes/bmi.ts
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import type { Env } from '../types';

const bmi = new Hono<{ Bindings: Env }>();

/**
 * POST /enrich-bmi-by-title
 *
 * Discover ISWCs for works where MusicBrainz has no ISWC
 * Searches BMI by title + performer name
 *
 * Usage:
 *   curl -X POST https://your-worker.workers.dev/enrich-bmi-by-title?limit=5
 */
bmi.post('/enrich-bmi-by-title', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  console.log(`🔍 Finding works without ISWCs (limit: ${limit})...`);

  // Find MusicBrainz works with no ISWC that haven't been checked in BMI
  const unenrichedWorks = await db.sql`
    SELECT DISTINCT
      mw.work_mbid,
      mw.title,
      sa.name as performer_name
    FROM musicbrainz_works mw
    LEFT JOIN work_recording_links wrl ON mw.work_mbid = wrl.work_mbid
    LEFT JOIN musicbrainz_recordings mr ON wrl.recording_mbid = mr.recording_mbid
    LEFT JOIN spotify_tracks st ON mr.isrc = st.isrc
    LEFT JOIN spotify_track_artists sta ON st.spotify_track_id = sta.spotify_track_id
    LEFT JOIN spotify_artists sa ON sta.spotify_artist_id = sa.spotify_artist_id
    LEFT JOIN bmi_works bw ON LOWER(mw.title) = LOWER(bw.title)
    WHERE mw.iswc IS NULL
      AND bw.bmi_work_id IS NULL
      AND mw.title IS NOT NULL
      AND sa.name IS NOT NULL
    LIMIT ${limit}
  `;

  if (unenrichedWorks.length === 0) {
    return c.json({
      message: 'No works need BMI enrichment',
      enriched: 0,
      total: 0
    });
  }

  console.log(`📋 Found ${unenrichedWorks.length} works to enrich`);

  let enriched = 0;
  const results = [];

  for (const work of unenrichedWorks) {
    try {
      console.log(`🎵 Searching BMI: "${work.title}" by ${work.performer_name}`);

      // Call BMI scraper service (deployed on Akash)
      const response = await fetch(`${c.env.BMI_SERVICE_URL}/search/title`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: work.title,
          performer: work.performer_name
        }),
        signal: AbortSignal.timeout(30000) // 30s timeout
      });

      if (!response.ok) {
        console.log(`  ❌ Not found in BMI`);
        results.push({
          work_mbid: work.work_mbid,
          title: work.title,
          status: 'not_found'
        });
        continue;
      }

      const bmiData = await response.json();

      // Validate response structure
      if (!bmiData.success || !bmiData.data) {
        console.log(`  ⚠️ Invalid BMI response`);
        results.push({
          work_mbid: work.work_mbid,
          title: work.title,
          status: 'invalid_response'
        });
        continue;
      }

      const workData = bmiData.data;

      // Store in bmi_works table
      await db.sql`
        INSERT INTO bmi_works (
          bmi_work_id, iswc, ascap_work_id, title,
          writers, publishers, performers, shares,
          status, status_description, raw_data
        ) VALUES (
          ${workData.bmi_work_id},
          ${workData.iswc || null},
          ${workData.ascap_work_id || null},
          ${workData.title},
          ${JSON.stringify(workData.writers)},
          ${JSON.stringify(workData.publishers)},
          ${JSON.stringify(workData.performers)},
          ${JSON.stringify(workData.shares)},
          ${workData.status || null},
          ${workData.status_description || null},
          ${JSON.stringify(workData)}
        )
        ON CONFLICT (bmi_work_id) DO UPDATE SET
          iswc = EXCLUDED.iswc,
          title = EXCLUDED.title,
          writers = EXCLUDED.writers,
          publishers = EXCLUDED.publishers,
          performers = EXCLUDED.performers,
          shares = EXCLUDED.shares,
          status = EXCLUDED.status,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;

      console.log(`  ✅ Stored BMI Work ID: ${workData.bmi_work_id}`);

      // If ISWC was discovered, update MusicBrainz work
      if (workData.iswc) {
        await db.sql`
          UPDATE musicbrainz_works
          SET iswc = ${workData.iswc}, updated_at = NOW()
          WHERE work_mbid = ${work.work_mbid}
        `;
        console.log(`  📝 Updated MusicBrainz work with ISWC: ${workData.iswc}`);
      }

      enriched++;
      results.push({
        work_mbid: work.work_mbid,
        title: work.title,
        bmi_work_id: workData.bmi_work_id,
        iswc: workData.iswc,
        status: 'enriched',
        reconciled: workData.status === 'RECONCILED'
      });

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      results.push({
        work_mbid: work.work_mbid,
        title: work.title,
        status: 'error',
        error: error.message
      });
    }

    // Rate limiting: wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return c.json({
    message: `Enriched ${enriched} of ${unenrichedWorks.length} works`,
    enriched,
    total: unenrichedWorks.length,
    results
  });
});

/**
 * POST /enrich-bmi-by-iswc
 *
 * Verify ISWCs from Quansic with BMI publisher data
 * Direct ISWC lookup in BMI database
 *
 * Usage:
 *   curl -X POST https://your-worker.workers.dev/enrich-bmi-by-iswc?limit=5
 */
bmi.post('/enrich-bmi-by-iswc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  console.log(`🔍 Finding ISWCs to verify in BMI (limit: ${limit})...`);

  // Find ISWCs from Quansic that haven't been verified with BMI
  const iswcsToVerify = await db.sql`
    SELECT qw.iswc, qw.title
    FROM quansic_works qw
    LEFT JOIN bmi_works bw ON qw.iswc = bw.iswc
    WHERE qw.iswc IS NOT NULL
      AND bw.bmi_work_id IS NULL
    LIMIT ${limit}
  `;

  if (iswcsToVerify.length === 0) {
    return c.json({
      message: 'No ISWCs need BMI verification',
      enriched: 0,
      total: 0
    });
  }

  console.log(`📋 Found ${iswcsToVerify.length} ISWCs to verify`);

  let enriched = 0;
  const results = [];

  for (const work of iswcsToVerify) {
    try {
      console.log(`🔑 Verifying ISWC: ${work.iswc}`);

      // Call BMI service with ISWC
      const response = await fetch(`${c.env.BMI_SERVICE_URL}/search/iswc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iswc: work.iswc }),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        console.log(`  ❌ ISWC not in BMI database`);
        results.push({
          iswc: work.iswc,
          title: work.title,
          status: 'not_in_bmi'
        });
        continue;
      }

      const bmiData = await response.json();

      if (!bmiData.success || !bmiData.data) {
        results.push({
          iswc: work.iswc,
          status: 'invalid_response'
        });
        continue;
      }

      const workData = bmiData.data;

      // Store BMI verification data
      await db.sql`
        INSERT INTO bmi_works (
          bmi_work_id, iswc, ascap_work_id, title,
          writers, publishers, performers, shares,
          status, status_description, raw_data
        ) VALUES (
          ${workData.bmi_work_id},
          ${workData.iswc},
          ${workData.ascap_work_id || null},
          ${workData.title},
          ${JSON.stringify(workData.writers)},
          ${JSON.stringify(workData.publishers)},
          ${JSON.stringify(workData.performers)},
          ${JSON.stringify(workData.shares)},
          ${workData.status || null},
          ${workData.status_description || null},
          ${JSON.stringify(workData)}
        )
        ON CONFLICT (bmi_work_id) DO UPDATE SET
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;

      console.log(`  ✅ Verified: ${workData.bmi_work_id} (Status: ${workData.status || 'Unknown'})`);

      enriched++;
      results.push({
        iswc: work.iswc,
        title: work.title,
        bmi_work_id: workData.bmi_work_id,
        status: 'verified',
        reconciled: workData.status === 'RECONCILED',
        writers_count: workData.writers?.length || 0,
        publishers_count: workData.publishers?.length || 0
      });

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      results.push({
        iswc: work.iswc,
        status: 'error',
        error: error.message
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return c.json({
    message: `Verified ${enriched} of ${iswcsToVerify.length} ISWCs`,
    enriched,
    total: iswcsToVerify.length,
    results
  });
});

/**
 * GET /bmi/works/:bmi_work_id
 * Retrieve BMI work data by BMI work ID
 */
bmi.get('/bmi/works/:bmi_work_id', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const bmiWorkId = c.req.param('bmi_work_id');

  const result = await db.sql`
    SELECT * FROM bmi_works
    WHERE bmi_work_id = ${bmiWorkId}
  `;

  if (result.length === 0) {
    return c.json({ error: 'BMI work not found' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /bmi/works/iswc/:iswc
 * Retrieve BMI work data by ISWC
 */
bmi.get('/bmi/works/iswc/:iswc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const iswc = c.req.param('iswc');

  const result = await db.sql`
    SELECT * FROM bmi_works
    WHERE iswc = ${iswc}
  `;

  if (result.length === 0) {
    return c.json({ error: 'ISWC not found in BMI database' }, 404);
  }

  return c.json(result[0]);
});

/**
 * GET /bmi/stats
 * Get BMI enrichment statistics
 */
bmi.get('/bmi/stats', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);

  const stats = await db.sql`
    SELECT
      COUNT(*) as total_bmi_works,
      COUNT(*) FILTER (WHERE iswc IS NOT NULL) as with_iswc,
      COUNT(*) FILTER (WHERE status = 'RECONCILED') as reconciled,
      COUNT(*) FILTER (WHERE status = 'UNDER_REVIEW') as under_review,
      COUNT(DISTINCT ascap_work_id) FILTER (WHERE ascap_work_id IS NOT NULL) as cross_referenced_ascap
    FROM bmi_works
  `;

  return c.json(stats[0]);
});

export default bmi;
