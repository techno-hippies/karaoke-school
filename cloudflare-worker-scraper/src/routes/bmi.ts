/**
 * BMI Songview Routes
 * Scrapes BMI Songview repertoire database for:
 * - ISWC verification (corroborate with Quansic/MLC)
 * - ISWC discovery (fill gaps from MusicBrainz)
 * - Publisher data (for Story Protocol compliance)
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { BMIService, type BMIWorkData } from '../bmi';
import type { Env } from '../types';

const bmi = new Hono<{ Bindings: Env }>();

/**
 * POST /enrich-bmi-by-iswc
 * Verify ISWCs from Quansic/MusicBrainz with BMI publisher data
 */
bmi.post('/enrich-bmi-by-iswc', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const bmiService = new BMIService(c.env.BMI_SERVICE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  console.log(`🔍 Finding ISWCs to verify in BMI (limit: ${limit})...`);

  // Find ISWCs from Quansic or MusicBrainz that haven't been verified with BMI
  const iswcsToVerify = await db.sql`
    SELECT DISTINCT
      COALESCE(qw.iswc, mw.iswc) as iswc,
      COALESCE(qw.title, mw.title) as title,
      CASE WHEN qw.iswc IS NOT NULL THEN 'quansic' ELSE 'musicbrainz' END as source
    FROM (
      SELECT iswc, title FROM quansic_works WHERE iswc IS NOT NULL
      UNION
      SELECT iswc, title FROM musicbrainz_works WHERE iswc IS NOT NULL
    ) AS combined(iswc, title)
    LEFT JOIN quansic_works qw ON combined.iswc = qw.iswc
    LEFT JOIN musicbrainz_works mw ON combined.iswc = mw.iswc
    LEFT JOIN bmi_works bw ON combined.iswc = bw.iswc
    WHERE bw.iswc IS NULL
    LIMIT ${limit}
  `;

  if (iswcsToVerify.length === 0) {
    return c.json({
      message: 'No ISWCs need BMI verification',
      verified: 0,
      total: 0,
    });
  }

  console.log(`📋 Found ${iswcsToVerify.length} ISWCs to verify`);

  let verified = 0;
  const results = [];

  for (const work of iswcsToVerify) {
    try {
      console.log(`🔑 Verifying ISWC: ${work.iswc} (from ${work.source})`);

      const bmiData = await bmiService.searchByISWC(work.iswc);

      if (!bmiData) {
        console.log(`  ❌ ISWC not in BMI database`);
        results.push({
          iswc: work.iswc,
          title: work.title,
          status: 'not_in_bmi',
        });
        continue;
      }

      // Store in bmi_works table
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
          iswc = EXCLUDED.iswc,
          writers = EXCLUDED.writers,
          publishers = EXCLUDED.publishers,
          performers = EXCLUDED.performers,
          shares = EXCLUDED.shares,
          status = EXCLUDED.status,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;

      console.log(`  ✅ Verified BMI Work ID: ${bmiData.bmi_work_id} (${bmiData.publishers.length} publishers)`);

      verified++;
      results.push({
        iswc: work.iswc,
        title: work.title,
        bmi_work_id: bmiData.bmi_work_id,
        status: 'verified',
        reconciled: bmiData.status === 'RECONCILED',
        writers_count: bmiData.writers.length,
        publishers_count: bmiData.publishers.length,
      });

      // Rate limiting: wait 1.5s between requests
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      results.push({
        iswc: work.iswc,
        title: work.title,
        status: 'error',
        error: error.message,
      });
    }
  }

  return c.json({
    message: `Verified ${verified} of ${iswcsToVerify.length} ISWCs`,
    verified,
    total: iswcsToVerify.length,
    results,
  });
});

/**
 * POST /enrich-bmi-by-title
 * Discover ISWCs for works where MusicBrainz has no ISWC
 */
bmi.post('/enrich-bmi-by-title', async (c) => {
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const bmiService = new BMIService(c.env.BMI_SERVICE_URL);
  const limit = parseInt(c.req.query('limit') || '10');

  console.log(`🔍 Finding works without ISWCs (limit: ${limit})...`);

  // Find tracks with no ISWC that haven't been checked in BMI
  const unenrichedWorks = await db.sql`
    SELECT DISTINCT
      st.spotify_track_id,
      st.title,
      st.artists[1] as performer_name
    FROM spotify_tracks st
    LEFT JOIN bmi_works bw ON LOWER(st.title) = LOWER(bw.title)
    WHERE st.has_iswc = false
      AND st.isrc IS NOT NULL
      AND st.artists IS NOT NULL
      AND array_length(st.artists, 1) > 0
      AND bw.bmi_work_id IS NULL
    LIMIT ${limit}
  `;

  if (unenrichedWorks.length === 0) {
    return c.json({
      message: 'No works need BMI enrichment',
      enriched: 0,
      total: 0,
    });
  }

  console.log(`📋 Found ${unenrichedWorks.length} works to enrich`);

  let enriched = 0;
  const results = [];

  for (const work of unenrichedWorks) {
    try {
      console.log(`🎵 Searching BMI: "${work.title}" by ${work.performer_name}`);

      const bmiData = await bmiService.searchByTitle(work.title, work.performer_name);

      if (!bmiData) {
        console.log(`  ❌ Not found in BMI`);
        results.push({
          spotify_track_id: work.spotify_track_id,
          title: work.title,
          status: 'not_found',
        });
        continue;
      }

      // Store in bmi_works table
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
          iswc = EXCLUDED.iswc,
          writers = EXCLUDED.writers,
          publishers = EXCLUDED.publishers,
          raw_data = EXCLUDED.raw_data,
          updated_at = NOW()
      `;

      console.log(`  ✅ Stored BMI Work ID: ${bmiData.bmi_work_id}`);

      // If ISWC was discovered, update the track
      if (bmiData.iswc) {
        await db.sql`
          UPDATE spotify_tracks
          SET has_iswc = true,
              iswc_source = CASE
                WHEN iswc_source IS NULL THEN jsonb_build_object('bmi', ${bmiData.iswc}::text)
                ELSE jsonb_set(iswc_source::jsonb, '{bmi}', to_jsonb(${bmiData.iswc}::text))
              END
          WHERE spotify_track_id = ${work.spotify_track_id}
        `;
        console.log(`  📝 Updated track with ISWC: ${bmiData.iswc}`);
      }

      enriched++;
      results.push({
        spotify_track_id: work.spotify_track_id,
        title: work.title,
        bmi_work_id: bmiData.bmi_work_id,
        iswc: bmiData.iswc,
        status: 'enriched',
        reconciled: bmiData.status === 'RECONCILED',
      });

      // Rate limiting: wait 1.5s between requests
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
      results.push({
        spotify_track_id: work.spotify_track_id,
        title: work.title,
        status: 'error',
        error: error.message,
      });
    }
  }

  return c.json({
    message: `Enriched ${enriched} of ${unenrichedWorks.length} works`,
    enriched,
    total: unenrichedWorks.length,
    results,
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
      COUNT(DISTINCT ascap_work_id) FILTER (WHERE ascap_work_id IS NOT NULL) as cross_referenced_ascap,
      COUNT(*) FILTER (WHERE jsonb_array_length(publishers) > 0) as with_publishers,
      AVG(jsonb_array_length(publishers))::numeric(10,2) as avg_publishers_per_work,
      AVG(jsonb_array_length(writers))::numeric(10,2) as avg_writers_per_work
    FROM bmi_works
  `;

  return c.json(stats[0]);
});

export default bmi;
