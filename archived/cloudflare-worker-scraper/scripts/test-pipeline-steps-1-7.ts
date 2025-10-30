/**
 * Test Pipeline Steps 1-7
 *
 * Tests:
 * - Steps 1-3: Use existing TikTok scraped data
 * - Steps 4-7: Spotify resolution with dump-first pattern
 */

import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!dbUrl) {
  throw new Error('Missing DATABASE_URL or NEON_DATABASE_URL env variable');
}
const sql = neon(dbUrl);

async function testPipelineSteps() {
  console.log('🧪 Testing Pipeline Steps 1-7\n');

  // Step 1: Check if we have TikTok scraped videos
  console.log('📍 Step 1-3: Checking TikTok scraped data...');
  const tiktokVideos = await sql`
    SELECT video_id, spotify_track_id, created_at
    FROM tiktok_scraped_videos
    WHERE spotify_track_id IS NOT NULL
      AND copyright_status = 'copyrighted'
    LIMIT 5
  `;
  console.log(`✅ Found ${tiktokVideos.length} TikTok videos with Spotify IDs`);
  if (tiktokVideos.length > 0) {
    console.log('   Sample:', tiktokVideos[0].spotify_track_id);
  }

  // Step 2: Insert sample tracks into pipeline
  console.log('\n📍 Step 2: Populating track_pipeline_test...');
  const testTrackIds = tiktokVideos.slice(0, 3).map(v => v.spotify_track_id);

  for (const trackId of testTrackIds) {
    await sql`
      INSERT INTO track_pipeline_test (spotify_track_id, status)
      VALUES (${trackId}, 'scraped')
      ON CONFLICT (spotify_track_id) DO NOTHING
    `;
  }

  const pipelineTracks = await sql`
    SELECT * FROM track_pipeline_test WHERE status = 'scraped'
  `;
  console.log(`✅ Inserted ${pipelineTracks.length} tracks into pipeline`);

  // Step 3: Test Spotify dump lookup (dump-first pattern)
  console.log('\n📍 Step 4-7: Testing Spotify dump lookup...');

  for (const track of pipelineTracks) {
    console.log(`\n🔍 Processing track: ${track.spotify_track_id}`);

    // Check dump first
    const dumpTrack = await sql`
      SELECT
        t.trackid,
        t.name,
        t.durationms,
        t.explicit,
        t.albumid,
        a.name as album_name,
        a.releasedate,
        e.value as isrc,
        array_agg(DISTINCT art.name) FILTER (WHERE art.name IS NOT NULL) as artists
      FROM spotify_track t
      LEFT JOIN spotify_album a ON t.albumid = a.albumid
      LEFT JOIN spotify_track_externalid e ON t.trackid = e.trackid AND e.name = 'isrc'
      LEFT JOIN spotify_track_artist ta ON t.trackid = ta.trackid
      LEFT JOIN spotify_artist art ON ta.artistid = art.id
      WHERE t.trackid = ${track.spotify_track_id}
      GROUP BY t.trackid, t.name, t.durationms, t.explicit, t.albumid, a.name, a.releasedate, e.value
    `;

    if (dumpTrack.length > 0) {
      const data = dumpTrack[0];
      console.log(`   ✅ Found in dump!`);
      console.log(`   Title: ${data.name}`);
      console.log(`   Artists: ${data.artists?.join(', ') || 'N/A'}`);
      console.log(`   ISRC: ${data.isrc || 'N/A'}`);
      console.log(`   Duration: ${data.durationms}ms`);
      console.log(`   Album: ${data.album_name}`);

      // Update pipeline with ISRC
      if (data.isrc) {
        await sql`
          UPDATE track_pipeline_test
          SET
            status = 'spotify_resolved',
            isrc = ${data.isrc},
            updated_at = NOW()
          WHERE spotify_track_id = ${track.spotify_track_id}
        `;
        console.log(`   ✅ Updated pipeline: scraped → spotify_resolved`);
      } else {
        console.log(`   ⚠️ No ISRC found in dump`);
      }
    } else {
      console.log(`   ⚠️ NOT in dump (would call API)`);
    }
  }

  // Step 4: Summary
  console.log('\n📊 Pipeline Summary:');
  const summary = await sql`
    SELECT
      status,
      COUNT(*) as count,
      array_agg(spotify_track_id) as track_ids
    FROM track_pipeline_test
    GROUP BY status
  `;

  for (const row of summary) {
    console.log(`   ${row.status}: ${row.count} tracks`);
  }

  // Step 5: Calculate dump coverage
  console.log('\n📈 Spotify Dump Coverage:');
  const coverageResult = await sql`
    SELECT
      COUNT(*) as total_tiktok_tracks,
      COUNT(CASE WHEN st.trackid IS NOT NULL THEN 1 END) as in_dump,
      ROUND(
        100.0 * COUNT(CASE WHEN st.trackid IS NOT NULL THEN 1 END) / COUNT(*),
        1
      ) as coverage_percent
    FROM tiktok_scraped_videos v
    LEFT JOIN spotify_track st ON v.spotify_track_id = st.trackid
    WHERE v.spotify_track_id IS NOT NULL
      AND v.copyright_status = 'copyrighted'
  `;

  const coverage = coverageResult[0];
  console.log(`   Total TikTok tracks: ${coverage.total_tiktok_tracks}`);
  console.log(`   Found in dump: ${coverage.in_dump}`);
  console.log(`   Coverage: ${coverage.coverage_percent}%`);

  // Step 6: Show tracks ready for Step 8 (ISWC lookup)
  console.log('\n🚀 Tracks ready for Step 8 (ISWC lookup):');
  const readyForIswc = await sql`
    SELECT
      tp.spotify_track_id,
      tp.isrc,
      st.name as title,
      array_agg(DISTINCT a.name) as artists
    FROM track_pipeline_test tp
    JOIN spotify_track st ON tp.spotify_track_id = st.trackid
    LEFT JOIN spotify_track_artist ta ON st.trackid = ta.trackid
    LEFT JOIN spotify_artist a ON ta.artistid = a.id
    WHERE tp.status = 'spotify_resolved'
      AND tp.isrc IS NOT NULL
    GROUP BY tp.spotify_track_id, tp.isrc, st.name
  `;

  if (readyForIswc.length > 0) {
    console.log(`   ${readyForIswc.length} tracks ready for ISWC lookup:`);
    for (const track of readyForIswc) {
      console.log(`   - ${track.title} by ${track.artists?.join(', ')}`);
      console.log(`     ISRC: ${track.isrc}`);
    }
  } else {
    console.log('   None yet (need ISRC from dump or API)');
  }

  console.log('\n✅ Test complete!');
}

// Run test
testPipelineSteps().catch(console.error);
