#!/usr/bin/env bun

import { query } from './src/db/neon.ts';

console.log('📊 Pipeline Status Report\n');

try {
  // Check creators
  console.log('🎬 TikTok Creators:');
  const creators = await query(
    `SELECT username, COUNT(*) as videos FROM tiktok_videos 
     GROUP BY username ORDER BY videos DESC LIMIT 10`
  );
  console.table(creators);

  // Check pipeline status distribution
  console.log('\n📈 Pipeline Status Distribution:');
  const statuses = await query(
    `SELECT status, COUNT(*) as count FROM song_pipeline GROUP BY status ORDER BY count DESC`
  );
  console.table(statuses);

  // Check charleenweiss specifically
  console.log('\n👤 Charleenweiss Videos:');
  const charleen = await query(
    `SELECT COUNT(*) as total_videos, 
            COUNT(CASE WHEN spotify_track_id IS NOT NULL THEN 1 END) as with_spotify_id,
            COUNT(CASE WHEN is_copyrighted = true THEN 1 END) as copyrighted
     FROM tiktok_videos WHERE creator_username = 'charleenweiss'`
  );
  console.table(charleen);

  // Show charleenweiss videos in pipeline
  console.log('\n📋 Charleenweiss Videos in Pipeline:');
  const charleenPipeline = await query(
    `SELECT sp.status, COUNT(*) as count FROM song_pipeline sp
     JOIN tiktok_videos tv ON tv.spotify_track_id = sp.spotify_track_id
     WHERE tv.creator_username = 'charleenweiss'
     GROUP BY sp.status ORDER BY count DESC`
  );
  console.table(charleenPipeline);

} catch (error: any) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
