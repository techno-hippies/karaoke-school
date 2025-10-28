/**
 * Step 1: Populate track_pipeline from existing TikTok data
 */

import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
if (!dbUrl) {
  throw new Error('Missing DATABASE_URL or NEON_DATABASE_URL');
}
const sql = neon(dbUrl);

async function populatePipeline() {
  console.log('🚀 Populating track_pipeline from TikTok data\n');

  // Step 1: Get TikTok videos with Spotify IDs
  const tiktokVideos = await sql`
    SELECT DISTINCT
      video_id,
      spotify_track_id,
      created_at
    FROM tiktok_scraped_videos
    WHERE spotify_track_id IS NOT NULL
      AND copyright_status = 'copyrighted'
  `;

  console.log(`📊 Found ${tiktokVideos.length} unique Spotify tracks from TikTok\n`);

  // Step 2: Insert into pipeline (with conflict handling)
  let inserted = 0;
  let skipped = 0;

  for (const video of tiktokVideos) {
    try {
      const result = await sql`
        INSERT INTO track_pipeline (
          tiktok_video_id,
          spotify_track_id,
          status,
          created_at
        )
        VALUES (
          ${video.video_id},
          ${video.spotify_track_id},
          'scraped',
          ${video.created_at}
        )
        ON CONFLICT (spotify_track_id) DO NOTHING
        RETURNING id
      `;

      if (result.length > 0) {
        inserted++;
      } else {
        skipped++;
      }

      if (inserted % 100 === 0) {
        console.log(`   Inserted: ${inserted}, Skipped: ${skipped}`);
      }

    } catch (error) {
      console.error(`Failed to insert ${video.spotify_track_id}:`, error);
    }
  }

  console.log(`\n✅ Pipeline populated:`);
  console.log(`   Inserted: ${inserted}`);
  console.log(`   Skipped: ${skipped}`);

  // Step 3: Upgrade tracks that already have data in our tables
  console.log('\n🔄 Checking for existing Spotify data...');

  // Check our existing spotify_tracks table (from previous enrichment)
  const upgraded = await sql`
    WITH tracks_with_isrc AS (
      SELECT
        tp.id,
        st.isrc
      FROM track_pipeline tp
      JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
      WHERE tp.status = 'scraped'
        AND st.isrc IS NOT NULL
    )
    UPDATE track_pipeline tp
    SET
      status = 'spotify_resolved',
      isrc = t.isrc,
      updated_at = NOW()
    FROM tracks_with_isrc t
    WHERE tp.id = t.id
    RETURNING tp.spotify_track_id
  `;

  console.log(`   ✅ Upgraded ${upgraded.length} tracks to 'spotify_resolved'`);

  // Step 4: Show pipeline summary
  const summary = await sql`
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
        ELSE 99
      END
  `;

  console.log('\n📊 Pipeline Summary:');
  for (const row of summary) {
    console.log(`   ${row.status}: ${row.count}`);
  }

  console.log('\n✅ Pipeline ready for processing!');
}

populatePipeline().catch(console.error);
