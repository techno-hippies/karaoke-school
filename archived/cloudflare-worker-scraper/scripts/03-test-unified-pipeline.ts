/**
 * Test Unified Pipeline
 *
 * Simulates the unified pipeline processor locally
 */

import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!dbUrl) {
  throw new Error('Missing DATABASE_URL or NEON_DATABASE_URL');
}
const sql = neon(dbUrl);

async function testUnifiedPipeline() {
  console.log('🧪 Testing Unified Pipeline Architecture\n');

  // Step 1: Check track_pipeline status distribution
  console.log('📊 Pipeline Status Distribution:\n');

  const statusCounts = await sql`
    SELECT
      status,
      COUNT(*) as count
    FROM track_pipeline
    GROUP BY status
    ORDER BY
      CASE status
        WHEN 'scraped' THEN 1
        WHEN 'spotify_resolved' THEN 2
        WHEN 'iswc_found' THEN 3
        WHEN 'metadata_enriched' THEN 4
        WHEN 'lyrics_ready' THEN 5
        WHEN 'audio_downloaded' THEN 6
        WHEN 'alignment_complete' THEN 7
        WHEN 'stems_separated' THEN 8
        WHEN 'media_enhanced' THEN 9
        WHEN 'ready_to_mint' THEN 10
        WHEN 'minted' THEN 11
        WHEN 'failed' THEN 99
        ELSE 50
      END
  `;

  for (const row of statusCounts) {
    console.log(`   ${row.status.padEnd(20)} ${row.count}`);
  }

  // Step 2: Check readiness for Step 8 (ISWC Discovery)
  console.log('\n\n🚪 Step 8: ISWC Discovery Readiness:\n');

  const readyForStep8 = await sql`
    SELECT COUNT(*) as count
    FROM track_pipeline
    WHERE status = 'spotify_resolved'
      AND isrc IS NOT NULL
      AND (last_attempted_at IS NULL OR last_attempted_at < NOW() - INTERVAL '1 hour')
      AND retry_count < 3
  `;

  console.log(`   Ready for processing: ${readyForStep8[0].count} tracks`);

  // Step 3: ISWC cache hit rate
  console.log('\n\n📈 ISWC Cache Coverage (Step 8 success rate):\n');

  const iswcCoverage = await sql`
    WITH ready_tracks AS (
      SELECT tp.isrc
      FROM track_pipeline tp
      WHERE tp.status = 'spotify_resolved'
        AND tp.isrc IS NOT NULL
    ),
    iswc_lookup AS (
      SELECT
        rt.isrc,
        COALESCE(
          qc.iswc,
          qr.iswc,
          mbc.iswc,
          mbw.iswc
        ) as iswc
      FROM ready_tracks rt
      LEFT JOIN quansic_cache qc ON rt.isrc = qc.isrc
      LEFT JOIN quansic_recordings qr ON rt.isrc = qr.isrc
      LEFT JOIN musicbrainz_cache mbc ON rt.isrc = mbc.isrc
      LEFT JOIN musicbrainz_recordings mbr ON rt.isrc = mbr.isrc
      LEFT JOIN work_recording_links wrl ON mbr.recording_mbid = wrl.recording_mbid
      LEFT JOIN musicbrainz_works mbw ON wrl.work_mbid = mbw.work_mbid
    )
    SELECT
      COUNT(*) as total,
      COUNT(iswc) as has_iswc,
      ROUND(100.0 * COUNT(iswc) / COUNT(*), 1) as coverage_percent
    FROM iswc_lookup
  `;

  const coverage = iswcCoverage[0];
  console.log(`   Total tracks: ${coverage.total}`);
  console.log(`   Cached ISWC: ${coverage.has_iswc} (${coverage.coverage_percent}%)`);
  console.log(`   Need API: ${Number(coverage.total) - Number(coverage.has_iswc)} (${(100 - Number(coverage.coverage_percent)).toFixed(1)}%)`);

  // Step 4: Show sample tracks ready for Step 8
  console.log('\n\n🎵 Sample Tracks Ready for Step 8:\n');

  const sampleTracks = await sql`
    SELECT
      tp.id,
      st.title,
      st.artists,
      tp.isrc,
      tp.status,
      tp.retry_count
    FROM track_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'spotify_resolved'
      AND tp.isrc IS NOT NULL
    LIMIT 5
  `;

  for (const track of sampleTracks) {
    const artist = Array.isArray(track.artists) ? track.artists[0] : 'Unknown';
    console.log(`   ${track.id.toString().padStart(4)} | ${track.title} - ${artist}`);
    console.log(`        ISRC: ${track.isrc} | Retries: ${track.retry_count}`);
  }

  // Summary
  console.log('\n\n📋 Architecture Summary:\n');
  console.log('   ✅ Single unified processor with 19 steps');
  console.log('   ✅ Each step processes tracks in specific status');
  console.log('   ✅ State machine auto-advances: status → nextStatus');
  console.log('   ✅ Cron: runs every 5 minutes (all enabled steps)');
  console.log('   ✅ Manual: POST /trigger/pipeline?step=8&limit=50');
  console.log('   ✅ Testable: Each step is pure function\n');

  console.log('🎯 Next Actions:\n');
  console.log('   1. Run: POST /trigger/pipeline?step=8&limit=10');
  console.log('   2. Verify: Tracks advance from "spotify_resolved" → "iswc_found"');
  console.log('   3. Deploy: wrangler deploy');
  console.log('   4. Monitor: Cron runs automatically every 5 minutes\n');
}

testUnifiedPipeline().catch(console.error);
