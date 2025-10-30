/**
 * Test Lyrics Validation Pipeline
 * Validates 20 sample tracks from both LRCLIB and Lyrics.ovh
 *
 * Run with: bun run src/test-lyrics-validation.ts
 */

import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { LyricsValidationService } from './lyrics-validation';
import type { TrackMetadata, ValidationResult } from './lyrics-validation';
import type { LyricsSourceInsert, LyricsValidationInsert } from './types/lyrics';

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_zSPoW2j6RZIb@ep-shiny-star-a182o113-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

interface TestSummary {
  total: number;
  both_sources: number;
  only_lrclib: number;
  only_lyrics_ovh: number;
  no_lyrics: number;
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
  conflict: number;
  avg_similarity: number | null;
}

async function getSampleTracks(limit: number = 20): Promise<TrackMetadata[]> {
  const result = await pool.query(`
    SELECT
      st.spotify_track_id,
      st.title,
      st.artists[1] as artist,
      st.album,
      st.duration_ms
    FROM spotify_tracks st
    WHERE st.duration_ms IS NOT NULL
      AND st.title IS NOT NULL
      AND st.artists IS NOT NULL
      AND array_length(st.artists, 1) > 0
    ORDER BY RANDOM()
    LIMIT $1
  `, [limit]);

  return result.rows as TrackMetadata[];
}

async function storeLyricsSources(sources: LyricsSourceInsert[]): Promise<void> {
  if (sources.length === 0) return;

  for (const source of sources) {
    await pool.query(`
      INSERT INTO lyrics_sources (
        spotify_track_id,
        source,
        plain_lyrics,
        synced_lyrics,
        source_track_id,
        char_count,
        line_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (spotify_track_id, source)
      DO UPDATE SET
        plain_lyrics = EXCLUDED.plain_lyrics,
        char_count = EXCLUDED.char_count,
        line_count = EXCLUDED.line_count,
        fetched_at = NOW()
    `, [
      source.spotify_track_id,
      source.source,
      source.plain_lyrics,
      source.synced_lyrics || null,
      source.source_track_id || null,
      source.char_count || null,
      source.line_count || null,
    ]);
  }
}

async function storeLyricsValidation(validation: LyricsValidationInsert): Promise<void> {
  await pool.query(`
    INSERT INTO lyrics_validations (
      spotify_track_id,
      sources_compared,
      primary_source,
      similarity_score,
      jaccard_similarity,
      levenshtein_distance,
      corroborated,
      validation_status,
      validation_notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (spotify_track_id)
    DO UPDATE SET
      sources_compared = EXCLUDED.sources_compared,
      primary_source = EXCLUDED.primary_source,
      similarity_score = EXCLUDED.similarity_score,
      jaccard_similarity = EXCLUDED.jaccard_similarity,
      levenshtein_distance = EXCLUDED.levenshtein_distance,
      corroborated = EXCLUDED.corroborated,
      validation_status = EXCLUDED.validation_status,
      validation_notes = EXCLUDED.validation_notes,
      validated_at = NOW()
  `, [
    validation.spotify_track_id,
    validation.sources_compared,
    validation.primary_source,
    validation.similarity_score,
    validation.jaccard_similarity,
    validation.levenshtein_distance || null,
    validation.corroborated,
    validation.validation_status,
    validation.validation_notes,
  ]);
}

async function runValidationTest(sampleSize: number = 20) {
  console.log('═'.repeat(60));
  console.log('LYRICS VALIDATION TEST');
  console.log('═'.repeat(60));
  console.log(`Sample size: ${sampleSize} tracks\n`);

  const validationService = new LyricsValidationService(0.80);

  // Fetch sample tracks
  console.log('Fetching sample tracks from database...');
  const tracks = await getSampleTracks(sampleSize);
  console.log(`✓ Loaded ${tracks.length} tracks\n`);

  // Validate each track
  const results: ValidationResult[] = [];
  let processed = 0;

  for (const track of tracks) {
    processed++;
    console.log(`[${processed}/${tracks.length}]`, track.title, '-', track.artist);

    const validation = await validationService.validateTrack(track);
    results.push(validation);

    // Store in database
    const dbInserts = validationService.prepareDatabaseInserts(track, validation);

    if (dbInserts.lyricsSources.length > 0) {
      await storeLyricsSources(dbInserts.lyricsSources);
    }

    if (dbInserts.lyricsValidation) {
      await storeLyricsValidation(dbInserts.lyricsValidation);
    }

    // Small delay to be respectful to APIs
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Calculate summary
  const summary: TestSummary = {
    total: results.length,
    both_sources: 0,
    only_lrclib: 0,
    only_lyrics_ovh: 0,
    no_lyrics: 0,
    high_confidence: 0,
    medium_confidence: 0,
    low_confidence: 0,
    conflict: 0,
    avg_similarity: null,
  };

  const similarities: number[] = [];

  for (const result of results) {
    // Count source availability
    if (result.lrclib_lyrics && result.lyrics_ovh_lyrics) {
      summary.both_sources++;
      if (result.similarity_score !== null) {
        similarities.push(result.similarity_score);
      }
    } else if (result.lrclib_lyrics) {
      summary.only_lrclib++;
    } else if (result.lyrics_ovh_lyrics) {
      summary.only_lyrics_ovh++;
    } else {
      summary.no_lyrics++;
    }

    // Count validation status
    switch (result.validation_status) {
      case 'high_confidence':
        summary.high_confidence++;
        break;
      case 'medium_confidence':
        summary.medium_confidence++;
        break;
      case 'low_confidence':
        summary.low_confidence++;
        break;
      case 'conflict':
        summary.conflict++;
        break;
    }
  }

  if (similarities.length > 0) {
    summary.avg_similarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('VALIDATION SUMMARY');
  console.log('═'.repeat(60));
  console.log('\nSource Coverage:');
  console.log(`  Both sources:     ${summary.both_sources}/${summary.total} (${((summary.both_sources / summary.total) * 100).toFixed(1)}%)`);
  console.log(`  Only LRCLIB:      ${summary.only_lrclib}/${summary.total} (${((summary.only_lrclib / summary.total) * 100).toFixed(1)}%)`);
  console.log(`  Only Lyrics.ovh:  ${summary.only_lyrics_ovh}/${summary.total} (${((summary.only_lyrics_ovh / summary.total) * 100).toFixed(1)}%)`);
  console.log(`  No lyrics:        ${summary.no_lyrics}/${summary.total} (${((summary.no_lyrics / summary.total) * 100).toFixed(1)}%)`);

  console.log('\nValidation Status:');
  console.log(`  High confidence:   ${summary.high_confidence} (>90% similarity)`);
  console.log(`  Medium confidence: ${summary.medium_confidence} (70-90% similarity)`);
  console.log(`  Low confidence:    ${summary.low_confidence} (50-70% similarity)`);
  console.log(`  Conflict:          ${summary.conflict} (<50% similarity)`);

  if (summary.avg_similarity !== null) {
    console.log(`\nAverage Similarity: ${(summary.avg_similarity * 100).toFixed(1)}%`);
  }

  console.log('\n' + '═'.repeat(60));

  return summary;
}

// Run the test
runValidationTest(20)
  .then(() => {
    console.log('\n✅ Validation test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Validation test failed:', error);
    process.exit(1);
  });
