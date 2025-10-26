/**
 * Batch Normalize Lyrics Pipeline
 * Normalizes all corroborated tracks using Gemini AI
 *
 * Run with: bun run src/batch-normalize-lyrics.ts [--limit N] [--dry-run]
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

interface NormalizationStats {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
}

async function getTracksToNormalize(limit?: number): Promise<any[]> {
  const query = `
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
    LEFT JOIN lyrics_sources ls_lrclib
      ON lv.spotify_track_id = ls_lrclib.spotify_track_id
      AND ls_lrclib.source = 'lrclib'
    LEFT JOIN lyrics_sources ls_ovh
      ON lv.spotify_track_id = ls_ovh.spotify_track_id
      AND ls_ovh.source = 'lyrics_ovh'
    WHERE lv.corroborated = true
      AND (lv.ai_normalized IS NULL OR lv.ai_normalized = false)
      AND (ls_lrclib.plain_lyrics IS NOT NULL OR ls_ovh.plain_lyrics IS NOT NULL)
    ORDER BY lv.similarity_score DESC
    ${limit ? `LIMIT ${limit}` : ''}
  `;

  const result = await pool.query(query);
  return result.rows;
}

async function normalizeTrack(
  openrouter: OpenRouterService,
  track: any,
  dryRun: boolean
): Promise<boolean> {
  try {
    console.log(`\n[${track.title}] by ${track.artist}`);
    console.log(`  Similarity: ${(track.similarity_score * 100).toFixed(1)}%`);

    // Handle single-source tracks
    if (!track.lrclib_lyrics && !track.ovh_lyrics) {
      console.log(`  ⚠️  Skipped: No lyrics from either source`);
      return false;
    }

    const lrclib = track.lrclib_lyrics || '';
    const ovh = track.ovh_lyrics || '';

    if (!lrclib) {
      console.log(`  ⚠️  Using only Lyrics.ovh (LRCLIB missing)`);
    } else if (!ovh) {
      console.log(`  ⚠️  Using only LRCLIB (Lyrics.ovh missing)`);
    }

    // If only one source, use it directly (no AI needed)
    if (!lrclib || !ovh) {
      const singleSource = lrclib || ovh;

      if (dryRun) {
        console.log(`  🔍 [DRY RUN] Would store single-source lyrics (${singleSource.length} chars)`);
        return true;
      }

      // Store single source as-is
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
        singleSource,
        singleSource.length,
        singleSource.split('\n').length,
      ]);

      await pool.query(`
        UPDATE lyrics_validations
        SET ai_normalized = true,
            normalized_at = NOW(),
            normalization_reasoning = 'Single source - used as-is without AI normalization'
        WHERE spotify_track_id = $1
      `, [track.spotify_track_id]);

      console.log(`  ✅ Stored single-source lyrics`);
      return true;
    }

    // Both sources available - use AI
    if (dryRun) {
      console.log(`  🔍 [DRY RUN] Would normalize with AI`);
      return true;
    }

    const normalized = await openrouter.normalizeLyrics(
      lrclib,
      ovh,
      track.title,
      track.artist
    );

    const origAvg = (lrclib.length + ovh.length) / 2;
    const compression = ((origAvg - normalized.normalizedLyrics.length) / origAvg) * 100;

    console.log(`  📊 LRCLIB: ${lrclib.length} chars | Lyrics.ovh: ${ovh.length} chars`);
    console.log(`  ✨ Normalized: ${normalized.normalizedLyrics.length} chars (${compression > 0 ? '-' : '+'}${Math.abs(compression).toFixed(1)}%)`);

    // Store normalized lyrics
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

    // Update validation record
    await pool.query(`
      UPDATE lyrics_validations
      SET ai_normalized = true,
          normalized_at = NOW(),
          normalization_reasoning = $2
      WHERE spotify_track_id = $1
    `, [track.spotify_track_id, normalized.reasoning]);

    console.log(`  ✅ Normalized and stored`);
    return true;

  } catch (error) {
    console.error(`  ❌ Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

  console.log('═'.repeat(80));
  console.log('BATCH LYRICS NORMALIZATION PIPELINE');
  console.log('═'.repeat(80));

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }

  if (limit) {
    console.log(`📊 Processing limit: ${limit} tracks`);
  }

  console.log();

  const stats: NormalizationStats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    startTime: new Date(),
  };

  // Get tracks to normalize
  console.log('📥 Fetching tracks to normalize...');
  const tracks = await getTracksToNormalize(limit);
  stats.total = tracks.length;

  console.log(`✓ Found ${tracks.length} corroborated tracks needing normalization\n`);

  if (tracks.length === 0) {
    console.log('✅ No tracks to normalize. All done!');
    process.exit(0);
  }

  const openrouter = new OpenRouterService(OPENROUTER_API_KEY);

  // Process each track
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    process.stdout.write(`[${i + 1}/${tracks.length}] `);

    const success = await normalizeTrack(openrouter, track, dryRun);

    if (success) {
      stats.succeeded++;
    } else {
      stats.failed++;
    }

    // Rate limiting: 1 second between requests
    if (i < tracks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  stats.endTime = new Date();
  const durationSeconds = (stats.endTime.getTime() - stats.startTime.getTime()) / 1000;

  // Print summary
  console.log('\n' + '═'.repeat(80));
  console.log('NORMALIZATION COMPLETE');
  console.log('═'.repeat(80));
  console.log(`Total tracks:    ${stats.total}`);
  console.log(`✅ Succeeded:    ${stats.succeeded}`);
  console.log(`❌ Failed:       ${stats.failed}`);
  console.log(`Duration:        ${durationSeconds.toFixed(1)}s`);
  console.log(`Rate:            ${(stats.total / durationSeconds * 60).toFixed(1)} tracks/min`);
  console.log('═'.repeat(80));

  // Show next steps
  if (!dryRun && stats.succeeded > 0) {
    console.log('\n📋 Next steps:');
    console.log('1. Review normalized lyrics in lyrics_sources (source=\'ai_normalized\')');
    console.log('2. Run sync-validated-lyrics.sql to copy to production table');
    console.log('3. Use for ElevenLabs forced alignment\n');
  }
}

main()
  .then(() => {
    console.log('✅ Pipeline complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Pipeline failed:', error);
    process.exit(1);
  });
