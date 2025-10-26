/**
 * Test AI Lyrics Normalization
 * Tests Gemini Flash 2.5 normalization on a medium-confidence track
 *
 * Run with: bun run src/test-lyrics-normalize.ts
 */

import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { OpenRouterService } from './openrouter';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_zSPoW2j6RZIb@ep-shiny-star-a182o113-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function testNormalization() {
  console.log('═'.repeat(60));
  console.log('AI LYRICS NORMALIZATION TEST');
  console.log('═'.repeat(60));

  // Get a medium confidence track
  const result = await pool.query(`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists[1] as artist,
      lv.similarity_score,
      ls_lrclib.plain_lyrics as lrclib_lyrics,
      ls_ovh.plain_lyrics as ovh_lyrics
    FROM lyrics_validations lv
    JOIN spotify_tracks st ON lv.spotify_track_id = st.spotify_track_id
    JOIN lyrics_sources ls_lrclib
      ON lv.spotify_track_id = ls_lrclib.spotify_track_id
      AND ls_lrclib.source = 'lrclib'
    JOIN lyrics_sources ls_ovh
      ON lv.spotify_track_id = ls_ovh.spotify_track_id
      AND ls_ovh.source = 'lyrics_ovh'
    WHERE lv.validation_status = 'medium_confidence'
    ORDER BY lv.similarity_score DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.error('❌ No medium confidence tracks found');
    process.exit(1);
  }

  const track = result.rows[0];

  console.log(`\nTrack: "${track.title}" by ${track.artist}`);
  console.log(`Similarity: ${(track.similarity_score * 100).toFixed(1)}%\n`);

  console.log('Original lengths:');
  console.log(`  LRCLIB: ${track.lrclib_lyrics.length} chars`);
  console.log(`  Lyrics.ovh: ${track.ovh_lyrics.length} chars\n`);

  // Normalize with AI
  const openrouter = new OpenRouterService(OPENROUTER_API_KEY);

  console.log('Calling Gemini Flash 2.5 Lite for normalization...\n');

  const normalized = await openrouter.normalizeLyrics(
    track.lrclib_lyrics,
    track.ovh_lyrics,
    track.title,
    track.artist
  );

  console.log('═'.repeat(60));
  console.log('NORMALIZED LYRICS');
  console.log('═'.repeat(60));
  console.log(normalized.normalizedLyrics);
  console.log('\n' + '═'.repeat(60));

  console.log('\nAI REASONING:');
  console.log('─'.repeat(60));
  console.log(normalized.reasoning);
  console.log('─'.repeat(60));

  console.log(`\nNormalized length: ${normalized.normalizedLyrics.length} chars`);

  // Store normalized version in database
  console.log('\nStoring normalized lyrics in database...');

  await pool.query(`
    INSERT INTO lyrics_sources (
      spotify_track_id,
      source,
      plain_lyrics,
      char_count,
      line_count
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (spotify_track_id, source)
    DO UPDATE SET
      plain_lyrics = EXCLUDED.plain_lyrics,
      char_count = EXCLUDED.char_count,
      line_count = EXCLUDED.line_count,
      fetched_at = NOW()
  `, [
    track.spotify_track_id,
    'ai_normalized',
    normalized.normalizedLyrics,
    normalized.normalizedLyrics.length,
    normalized.normalizedLyrics.split('\n').length,
  ]);

  console.log('✅ Stored as source="ai_normalized"');

  console.log('\n' + '═'.repeat(60));
  console.log('TEST COMPLETE');
  console.log('═'.repeat(60));
}

testNormalization()
  .then(() => {
    console.log('\n✅ Normalization test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Normalization test failed:', error);
    process.exit(1);
  });
