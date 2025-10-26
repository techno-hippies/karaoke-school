/**
 * Batch Test AI Lyrics Normalization
 * Compare normalization quality across multiple tracks
 *
 * Run with: bun run src/test-lyrics-normalize-batch.ts
 */

import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { OpenRouterService } from './openrouter';

neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_zSPoW2j6RZIb@ep-shiny-star-a182o113-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

interface TrackComparison {
  title: string;
  artist: string;
  similarity: number;
  lrclib_chars: number;
  ovh_chars: number;
  normalized_chars: number;
  compression_pct: number;
  first_line_lrclib: string;
  first_line_ovh: string;
  first_line_normalized: string;
  reasoning: string;
}

async function normalizeTrack(
  openrouter: OpenRouterService,
  track: any
): Promise<TrackComparison> {
  console.log(`\nProcessing: "${track.title}" by ${track.artist}`);

  const normalized = await openrouter.normalizeLyrics(
    track.lrclib_lyrics,
    track.ovh_lyrics,
    track.title,
    track.artist
  );

  // Store in database
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

  const lrclibLines = track.lrclib_lyrics.split('\n');
  const ovhLines = track.ovh_lyrics.split('\n');
  const normalizedLines = normalized.normalizedLyrics.split('\n');

  const originalAvg = (track.lrclib_lyrics.length + track.ovh_lyrics.length) / 2;
  const compression = ((originalAvg - normalized.normalizedLyrics.length) / originalAvg) * 100;

  return {
    title: track.title,
    artist: track.artist,
    similarity: track.similarity_score,
    lrclib_chars: track.lrclib_lyrics.length,
    ovh_chars: track.ovh_lyrics.length,
    normalized_chars: normalized.normalizedLyrics.length,
    compression_pct: compression,
    first_line_lrclib: lrclibLines[0]?.substring(0, 60) || '',
    first_line_ovh: ovhLines[0]?.substring(0, 60) || '',
    first_line_normalized: normalizedLines[0]?.substring(0, 60) || '',
    reasoning: normalized.reasoning.substring(0, 200) + '...',
  };
}

async function batchTest() {
  console.log('═'.repeat(80));
  console.log('BATCH AI LYRICS NORMALIZATION TEST');
  console.log('═'.repeat(80));

  // Get both medium confidence and high confidence tracks for comparison
  const result = await pool.query(`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists[1] as artist,
      lv.similarity_score,
      lv.validation_status,
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
    WHERE lv.validation_status IN ('medium_confidence', 'high_confidence')
    ORDER BY lv.similarity_score ASC
    LIMIT 5
  `);

  console.log(`\nProcessing ${result.rows.length} tracks...\n`);

  const openrouter = new OpenRouterService(OPENROUTER_API_KEY);
  const comparisons: TrackComparison[] = [];

  for (const track of result.rows) {
    const comparison = await normalizeTrack(openrouter, track);
    comparisons.push(comparison);

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print comparison table
  console.log('\n' + '═'.repeat(80));
  console.log('NORMALIZATION COMPARISON');
  console.log('═'.repeat(80));

  for (const comp of comparisons) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Track: "${comp.title}" by ${comp.artist}`);
    console.log(`Similarity: ${(comp.similarity * 100).toFixed(1)}%`);
    console.log(`\nCharacter counts:`);
    console.log(`  LRCLIB:     ${comp.lrclib_chars} chars`);
    console.log(`  Lyrics.ovh: ${comp.ovh_chars} chars`);
    console.log(`  Normalized: ${comp.normalized_chars} chars (${comp.compression_pct > 0 ? '-' : '+'}${Math.abs(comp.compression_pct).toFixed(1)}%)`);

    console.log(`\nFirst lines (truncated):`);
    console.log(`  LRCLIB:     "${comp.first_line_lrclib}"`);
    console.log(`  Lyrics.ovh: "${comp.first_line_ovh}"`);
    console.log(`  Normalized: "${comp.first_line_normalized}"`);

    console.log(`\nAI Reasoning:`);
    console.log(`  ${comp.reasoning}`);
  }

  // Summary statistics
  console.log('\n' + '═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total tracks processed: ${comparisons.length}`);
  console.log(`Average compression: ${(comparisons.reduce((sum, c) => sum + c.compression_pct, 0) / comparisons.length).toFixed(1)}%`);
  console.log(`All stored as source='ai_normalized' in lyrics_sources table`);
  console.log('═'.repeat(80));
}

batchTest()
  .then(() => {
    console.log('\n✅ Batch normalization test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Batch test failed:', error);
    process.exit(1);
  });
