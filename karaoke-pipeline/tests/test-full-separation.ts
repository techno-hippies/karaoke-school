#!/usr/bin/env bun
/**
 * Test Full Track Separation
 * Submits a complete track from song_audio to demucs for separation
 */

import { createDemucsService } from './src/services/demucs';
import postgres from 'postgres';

async function main() {
  console.log('🧪 Testing Full Track Separation\n');

  // Get real audio URL from database
  const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 10 });

  try {
    console.log('📊 Fetching track from song_audio...');
    const tracks = await sql`
      SELECT sa.spotify_track_id, sa.grove_url
      FROM song_audio sa
      WHERE sa.grove_url IS NOT NULL
      LIMIT 1
    `;

    if (tracks.length === 0) {
      console.error('❌ No tracks with audio URLs found in database');
      process.exit(1);
    }

    const track = tracks[0];
    const spotifyTrackId = track.spotify_track_id;
    const audioUrl = track.grove_url;
    const webhookUrl = 'http://localhost:36949/webhooks/demucs-complete';

    console.log(`   ✅ Found track in database`);
    console.log(`   Spotify ID: ${spotifyTrackId}`);
    console.log(`   Audio URL: ${audioUrl}`);
    console.log(`   Webhook: ${webhookUrl}\n`);

    console.log('🎵 Submitting to demucs for full track separation...');
    const demucs = createDemucsService();

    const result = await demucs.separateAsync(
      spotifyTrackId,
      audioUrl,
      webhookUrl
    );

    console.log('\n✅ Job submitted successfully!');
    console.log(`   Job ID: ${result.jobId}`);
    console.log(`   Mode: ${result.mode}`);
    console.log(`   Status: ${result.status}`);
    console.log('\n⏳ Demucs is now processing the full track...');
    console.log('   Expected time: 20-40s on RTX 3080');
    console.log('   Output: Full instrumental + vocals');
    console.log('\n📡 When complete, demucs will POST to:');
    console.log(`   ${webhookUrl}`);
    console.log('\n🔄 Webhook will:');
    console.log('   1. Receive instrumental_base64 from demucs');
    console.log('   2. Upload to Grove');
    console.log('   3. Store Grove URL in karaoke_segments');
    console.log('   4. Update song_pipeline status → stems_separated');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    await sql.end();
    process.exit(1);
  }
}

main();
