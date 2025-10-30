#!/usr/bin/env bun
/**
 * Process All Audio Separations
 * Submits all tracks with audio_downloaded status to demucs for separation
 */

import { createDemucsService } from './src/services/demucs';
import postgres from 'postgres';

async function main() {
  console.log('🎵 Processing All Audio Separations\n');

  const sql = postgres(process.env.DATABASE_URL!, { connect_timeout: 10 });

  try {
    // Warmup: Ping demucs health endpoint to load model into memory
    console.log('🔥 Warming up demucs server (loading model into GPU memory)...');
    const warmupStart = Date.now();
    const demucsEndpoint = process.env.DEMUCS_LOCAL_ENDPOINT || 'http://localhost:8001';

    try {
      const healthResp = await fetch(`${demucsEndpoint}/health`, {
        method: 'GET',
      });
      const warmupTime = ((Date.now() - warmupStart) / 1000).toFixed(1);
      if (healthResp.ok) {
        console.log(`   ✅ Server ready (warmup took ${warmupTime}s)\n`);
      } else {
        console.error(`   ❌ Health check failed: ${healthResp.status}`);
        process.exit(1);
      }
    } catch (error: any) {
      console.error(`   ❌ Could not reach demucs server: ${error.message}`);
      process.exit(1);
    }

    // Get all tracks ready for separation (have grove_url but not separated yet)
    console.log('📊 Fetching tracks ready for separation...');
    const tracks = await sql`
      SELECT spotify_track_id, grove_url
      FROM song_audio
      WHERE grove_url IS NOT NULL
        AND instrumental_grove_url IS NULL
      ORDER BY created_at ASC
    `;

    if (tracks.length === 0) {
      console.log('✅ No tracks need separation');
      await sql.end();
      return;
    }

    console.log(`   Found ${tracks.length} tracks to process\n`);

    const webhookUrl = 'http://localhost:36949/webhooks/demucs-complete';

    let submitted = 0;
    let failed = 0;

    // Submit directly to avoid health check cache issues
    for (const track of tracks) {
      try {
        console.log(`[${submitted + failed + 1}/${tracks.length}] Submitting ${track.spotify_track_id}...`);

        // Submit directly via FormData
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
        console.log(`   ✅ Queued (position: ${result.queue_position || 'N/A'})`);
        submitted++;

        // Small delay between submissions
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error: any) {
        console.error(`   ❌ Failed: ${error.message}`);
        failed++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Submitted: ${submitted}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total: ${tracks.length}`);
    console.log('\n⏳ Jobs are now processing...');
    console.log('   Demucs will POST results to webhook as they complete');
    console.log('   Monitor the wrangler dev logs for completion status');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
