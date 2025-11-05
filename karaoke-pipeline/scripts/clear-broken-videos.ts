import { query } from '/media/t42/th42/Code/karaoke-school-v1/karaoke-pipeline/src/db/neon.ts';

console.log('🔄 Clearing broken video encodings...\n');

// Get all videos with Grove CIDs
const videos = await query(`
  SELECT video_id, grove_video_cid
  FROM tiktok_videos
  WHERE grove_video_cid IS NOT NULL
`);

console.log(`Total videos to check: ${videos.length}`);

// Check each video's MIME type and collect broken ones
const brokenVideos = [];
for (const v of videos) {
  const url = `https://api.grove.storage/${v.grove_video_cid}`;
  try {
    const resp = await fetch(url, { method: 'HEAD' });
    const mime = resp.headers.get('content-type');
    if (mime !== 'video/mp4') {
      brokenVideos.push(v.video_id);
    }
  } catch (e) {
    console.error(`Error checking ${v.video_id}: ${e.message}`);
  }
}

console.log(`Found ${brokenVideos.length} broken videos (not video/mp4)`);

if (brokenVideos.length > 0) {
  // Clear Grove data for broken videos
  const placeholders = brokenVideos.map((_, i) => `$${i + 1}`).join(',');
  const result = await query(
    `UPDATE tiktok_videos
     SET grove_video_cid = NULL,
         grove_video_url = NULL,
         grove_thumbnail_cid = NULL,
         grove_thumbnail_url = NULL
     WHERE video_id IN (${placeholders})
     RETURNING video_id`,
    brokenVideos
  );

  console.log(`✅ Cleared ${result.length} broken videos`);
  console.log('\nThese videos will be reprocessed through Step 11.5');
} else {
  console.log('✅ No broken videos found');
}

// Verify the fix
const remaining = await query(`
  SELECT COUNT(*) as count
  FROM tiktok_videos
  WHERE grove_video_cid IS NOT NULL
`);

console.log(`\nRemaining Grove videos: ${remaining[0].count}`);
