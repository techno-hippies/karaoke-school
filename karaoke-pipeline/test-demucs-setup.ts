#!/usr/bin/env bun
/**
 * Test Demucs Integration Setup
 * Verifies all components are ready
 */

import { query, close } from './src/db/neon';
import { createDemucsService } from './src/services/demucs';

async function main() {
  console.log('🧪 Testing Demucs Integration Setup\n');

  try {
    // 1. Check Demucs server health
    console.log('1️⃣  Checking Demucs server...');
    const demucsService = createDemucsService();

    try {
      const healthCheck = await fetch('http://localhost:8000/health');
      const health = await healthCheck.json();
      console.log(`   ✅ Demucs server healthy`);
      console.log(`      GPU: ${health.device}`);
      console.log(`      Model: ${health.model}\n`);
    } catch (error: any) {
      console.log(`   ⚠️  Demucs server unavailable: ${error.message}\n`);
    }

    // 2. Check database table
    console.log('2️⃣  Checking database tables...');
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'karaoke_segments'
      ) as exists
    `);

    if (tableCheck[0].exists) {
      console.log(`   ✅ karaoke_segments table exists\n`);
    } else {
      console.log(`   ❌ karaoke_segments table missing\n`);
    }

    // 3. Check for tracks ready for separation
    console.log('3️⃣  Checking for tracks ready for separation...');
    const tracks = await query(`
      SELECT
        sp.spotify_track_id,
        sp.status,
        CASE WHEN sa.grove_url IS NOT NULL THEN 'yes' ELSE 'no' END as has_audio_url
      FROM song_pipeline sp
      LEFT JOIN song_audio sa ON sp.spotify_track_id = sa.spotify_track_id
      WHERE sp.status = 'audio_downloaded'
      LIMIT 5
    `);

    console.log(`   Found ${tracks.length} tracks with status='audio_downloaded'`);

    if (tracks.length > 0) {
      console.log(`\n   Sample tracks:`);
      tracks.forEach((t: any) => {
        console.log(`   - ${t.spotify_track_id} (audio URL: ${t.has_audio_url})`);
      });
    }
    console.log('');

    // 4. Check separation progress
    console.log('4️⃣  Checking separation progress...');
    const segments = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE separation_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE separation_status = 'processing') as processing,
        COUNT(*) FILTER (WHERE separation_status = 'completed') as completed,
        COUNT(*) FILTER (WHERE separation_status = 'failed') as failed
      FROM karaoke_segments
    `);

    const stats = segments[0];
    console.log(`   Total segments: ${stats.total}`);
    console.log(`   - Pending: ${stats.pending}`);
    console.log(`   - Processing: ${stats.processing}`);
    console.log(`   - Completed: ${stats.completed}`);
    console.log(`   - Failed: ${stats.failed}\n`);

    // 5. Environment check
    console.log('5️⃣  Environment configuration...');
    console.log(`   DEMUCS_MODE: ${process.env.DEMUCS_MODE || 'local (default)'}`);
    console.log(`   DEMUCS_LOCAL_ENDPOINT: ${process.env.DEMUCS_LOCAL_ENDPOINT || 'http://localhost:8000 (default)'}`);
    console.log(`   PIPELINE_WEBHOOK_DOMAIN: ${process.env.PIPELINE_WEBHOOK_DOMAIN || '❌ NOT SET'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET'}\n`);

    console.log('✅ Setup verification complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Ensure PIPELINE_WEBHOOK_DOMAIN is set');
    console.log('   2. Ensure tracks have grove_url in song_audio table');
    console.log('   3. Run: bun src/processors/08-separate-audio.ts 1');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await close();
  }
}

main();
