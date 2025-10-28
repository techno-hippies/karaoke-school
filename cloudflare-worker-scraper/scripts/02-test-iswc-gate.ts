/**
 * Test Step 8: ISWC Discovery (THE GATE)
 *
 * Tests: Quansic → MusicBrainz fallback logic
 */

import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!dbUrl) {
  throw new Error('Missing DATABASE_URL or NEON_DATABASE_URL');
}
const sql = neon(dbUrl);

async function testISWCGate() {
  console.log('🚪 Testing ISWC Gate (Step 8)\n');

  // Get tracks ready for ISWC lookup
  const readyTracks = await sql`
    SELECT
      tp.id,
      tp.spotify_track_id,
      tp.isrc,
      st.title,
      st.artists
    FROM track_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'spotify_resolved'
      AND tp.isrc IS NOT NULL
    LIMIT 10
  `;

  console.log(`📊 Testing ${readyTracks.length} tracks:\n`);

  let passed = 0;
  let failed = 0;

  for (const track of readyTracks) {
    console.log(`\n🎵 ${track.title} by ${track.artists?.[0] || 'Unknown'}`);
    console.log(`   ISRC: ${track.isrc}`);

    // Check Quansic cache
    let iswc = null;
    const quansicCache = await sql`
      SELECT iswc FROM quansic_cache WHERE isrc = ${track.isrc}
    `;

    if (quansicCache[0]?.iswc) {
      iswc = quansicCache[0].iswc;
      console.log(`   ✅ Found in Quansic cache: ${iswc}`);
    }

    // Fallback to MusicBrainz cache
    if (!iswc) {
      const mbCache = await sql`
        SELECT iswc FROM musicbrainz_cache WHERE isrc = ${track.isrc}
      `;

      if (mbCache[0]?.iswc) {
        iswc = mbCache[0].iswc;
        console.log(`   ✅ Found in MusicBrainz cache: ${iswc}`);
      }
    }

    // Check old tables (quansic_recordings, musicbrainz_recordings)
    if (!iswc) {
      const quansicRec = await sql`
        SELECT iswc FROM quansic_recordings WHERE isrc = ${track.isrc}
      `;

      if (quansicRec[0]?.iswc) {
        iswc = quansicRec[0].iswc;
        console.log(`   ✅ Found in quansic_recordings: ${iswc}`);
      }
    }

    if (!iswc) {
      const mbRec = await sql`
        SELECT w.iswc
        FROM musicbrainz_recordings r
        JOIN musicbrainz_works w ON r.work_mbid = w.work_mbid
        WHERE r.isrc = ${track.isrc}
        LIMIT 1
      `;

      if (mbRec[0]?.iswc) {
        iswc = mbRec[0].iswc;
        console.log(`   ✅ Found in MusicBrainz recordings → works: ${iswc}`);
      }
    }

    if (iswc) {
      passed++;
      console.log(`   🚪 GATE PASSED - can continue to Step 9`);
    } else {
      failed++;
      console.log(`   ❌ GATE FAILED - no ISWC found (would mark as failed)`);
      console.log(`   💡 Would need API call to Quansic or mark as dead end`);
    }
  }

  console.log(`\n\n📊 Gate Test Results:`);
  console.log(`   ✅ Passed: ${passed} / ${readyTracks.length}`);
  console.log(`   ❌ Failed: ${failed} / ${readyTracks.length}`);
  console.log(`   📈 Pass rate: ${((passed / readyTracks.length) * 100).toFixed(1)}%`);

  // Overall stats across all tracks
  console.log(`\n🔍 Checking ISWC coverage across all 2,734 tracks...\n`);

  const coverage = await sql`
    WITH iswc_lookup AS (
      SELECT
        tp.spotify_track_id,
        tp.isrc,
        COALESCE(
          qc.iswc,
          mbc.iswc,
          qr.iswc,
          mbw.iswc
        ) as iswc
      FROM track_pipeline tp
      LEFT JOIN quansic_cache qc ON tp.isrc = qc.isrc
      LEFT JOIN musicbrainz_cache mbc ON tp.isrc = mbc.isrc
      LEFT JOIN quansic_recordings qr ON tp.isrc = qr.isrc
      LEFT JOIN musicbrainz_recordings mbr ON tp.isrc = mbr.isrc
      LEFT JOIN musicbrainz_works mbw ON mbr.work_mbid = mbw.work_mbid
      WHERE tp.status = 'spotify_resolved'
    )
    SELECT
      COUNT(*) as total,
      COUNT(iswc) as has_iswc,
      ROUND(100.0 * COUNT(iswc) / COUNT(*), 1) as coverage_percent
    FROM iswc_lookup
  `;

  console.log(`   Total tracks: ${coverage[0].total}`);
  console.log(`   Have ISWC: ${coverage[0].has_iswc}`);
  console.log(`   Coverage: ${coverage[0].coverage_percent}%`);
  console.log(`   Need API: ${Number(coverage[0].total) - Number(coverage[0].has_iswc)}\n`);

  if (Number(coverage[0].coverage_percent) < 50) {
    console.log(`⚠️  Low ISWC coverage - most tracks will need Quansic API calls`);
    console.log(`   This is expected if you haven't run enrichment yet\n`);
  }

  console.log(`\n✅ Test complete! Ready to implement Step 8 processor.`);
}

testISWCGate().catch(console.error);
