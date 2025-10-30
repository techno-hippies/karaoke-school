#!/usr/bin/env bun
/**
 * Test Single Audio Separation
 */

import postgres from 'postgres';

async function main() {
  console.log('🧪 Testing Single Separation\n');

  const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 10 });

  try {
    // Get just ONE track
    const tracks = await sql`
      SELECT spotify_track_id, grove_url
      FROM song_audio
      WHERE grove_url IS NOT NULL
        AND instrumental_grove_url IS NULL
      LIMIT 1
    `;

    if (tracks.length === 0) {
      console.log('✅ No tracks need separation');
      await sql.end();
      return;
    }

    const track = tracks[0];
    console.log(`Testing with track: ${track.spotify_track_id}\n`);

    const demucsEndpoint = process.env.DEMUCS_LOCAL_ENDPOINT || 'http://localhost:8001';
    const webhookUrl = 'http://localhost:36949/webhooks/demucs-complete';

    const formData = new FormData();
    formData.append('job_id', track.spotify_track_id);
    formData.append('audio_url', track.grove_url);
    formData.append('webhook_url', webhookUrl);
    formData.append('model', 'mdx_extra');
    formData.append('output_format', 'mp3');
    formData.append('mp3_bitrate', '192');

    const response = await fetch(`${demucsEndpoint}/separate-async`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json() as any;
    console.log(`✅ Queued (position: ${result.queue_position || 'N/A'})`);
    console.log('\n⏳ Processing... Check webhook logs for completion');
    console.log('   Monitor: tail -f demucs.log');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
