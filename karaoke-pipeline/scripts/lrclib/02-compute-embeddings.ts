#!/usr/bin/env bun
/**
 * Compute Embeddings for LRCLib Lyrics
 *
 * Processes lyrics in batches through EmbeddingGemma via Ollama to generate
 * 768-dimensional vector embeddings for similarity search.
 *
 * This script can be run multiple times - it only processes tracks without embeddings.
 *
 * Usage:
 *   bun scripts/lrclib/02-compute-embeddings.ts \
 *     --batch-size=100 \
 *     --concurrency=5 \
 *     --limit=10000
 *
 * Estimated time: 8-12 hours for 1M tracks (depends on CPU)
 *
 * Progress is saved after each batch, so you can stop/resume anytime.
 */

import { parseArgs } from 'util';
import { query } from '../../src/db/neon';
import {
  computeBatchEmbeddings,
  checkOllamaHealth,
  ensureModelAvailable,
  getEmbeddingDimension,
} from '../../src/services/ollama-embedding';

interface LyricsRecord {
  id: number;
  track_name: string;
  artist_name: string;
  plain_lyrics: string;
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'batch-size': { type: 'string', default: '100' },
      concurrency: { type: 'string', default: '5' },
      limit: { type: 'string' },  // For testing
      'skip-check': { type: 'boolean', default: false },
    },
  });

  const batchSize = parseInt(values['batch-size'] || '100');
  const concurrency = parseInt(values.concurrency || '5');
  const limit = values.limit ? parseInt(values.limit) : null;
  const skipCheck = values['skip-check'] === true;

  console.log('\n🧮 LRCLib Lyrics Embedding Computation\n');
  console.log(`Batch size: ${batchSize}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Expected dimension: ${getEmbeddingDimension()}`);
  if (limit) console.log(`Limit (testing): ${limit}`);
  console.log();

  // Check Ollama health
  if (!skipCheck) {
    console.log('🔍 Checking Ollama server...');
    const healthy = await checkOllamaHealth();
    if (!healthy) {
      console.error('❌ Ollama server is not running!');
      console.error('\nStart Ollama with: ollama serve');
      process.exit(1);
    }
    console.log('✅ Ollama server is healthy\n');

    // Ensure model is available
    await ensureModelAvailable();
  }

  // Get count of tracks without embeddings
  const countResult = await query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM lrclib_lyrics
    WHERE lyrics_embedding IS NULL
    ${limit ? `LIMIT ${limit}` : ''}
  `);
  const totalToProcess = parseInt(countResult[0].count);

  console.log(`📊 Tracks without embeddings: ${totalToProcess.toLocaleString()}\n`);

  if (totalToProcess === 0) {
    console.log('✅ All tracks already have embeddings!\n');
    process.exit(0);
  }

  // Process in batches
  let processed = 0;
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();

  while (true) {
    // Fetch batch
    const batch = await query<LyricsRecord>(`
      SELECT id, track_name, artist_name, plain_lyrics
      FROM lrclib_lyrics
      WHERE lyrics_embedding IS NULL
      ORDER BY id
      LIMIT $1
    `, [batchSize]);

    if (batch.length === 0) break;

    console.log(`\n📦 Processing batch of ${batch.length} tracks...`);

    // Compute embeddings
    const texts = batch.map(r => r.plain_lyrics);
    const results = await computeBatchEmbeddings(texts, concurrency);

    // Update database
    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const result = results[i];

      if (result.embedding) {
        try {
          await query(`
            UPDATE lrclib_lyrics
            SET lyrics_embedding = $1,
                embedded_at = NOW()
            WHERE id = $2
          `, [JSON.stringify(result.embedding), record.id]);

          successful++;
        } catch (error: any) {
          console.error(`   ❌ Failed to store embedding for ID ${record.id}: ${error.message}`);
          failed++;
        }
      } else {
        console.error(`   ❌ Failed to compute embedding for "${record.artist_name} - ${record.track_name}": ${result.error}`);
        failed++;
      }
    }

    processed += batch.length;

    // Progress report
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = processed / elapsed;
    const remaining = totalToProcess - processed;
    const eta = remaining / rate;

    const percentDone = ((processed / totalToProcess) * 100).toFixed(1);
    const avgTimePerBatch = elapsed / (processed / batchSize);

    console.log(`✅ Progress: ${processed.toLocaleString()}/${totalToProcess.toLocaleString()} (${percentDone}%)`);
    console.log(`   Successful: ${successful.toLocaleString()} | Failed: ${failed}`);
    console.log(`   Rate: ${rate.toFixed(1)} tracks/s (${avgTimePerBatch.toFixed(1)}s/batch)`);
    console.log(`   ETA: ${(eta / 3600).toFixed(1)} hours`);

    if (limit && processed >= limit) break;

    // Small delay to avoid overwhelming Ollama
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const totalTime = (Date.now() - startTime) / 1000;

  console.log('\n\n🎉 Embedding computation complete!\n');
  console.log(`Processed: ${processed.toLocaleString()}`);
  console.log(`Successful: ${successful.toLocaleString()}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total time: ${(totalTime / 3600).toFixed(2)} hours`);
  console.log(`Average rate: ${(processed / totalTime).toFixed(1)} tracks/second\n`);

  // Update corpus statistics
  console.log('📊 Updating corpus statistics...');
  await query('SELECT compute_lrclib_stats()');

  const stats = await query<{
    total_tracks: number;
    tracks_with_embeddings: number;
  }>(`
    SELECT total_tracks, tracks_with_embeddings
    FROM lrclib_corpus_stats
    ORDER BY computed_at DESC
    LIMIT 1
  `);

  if (stats.length > 0) {
    const embeddingPercent = ((stats[0].tracks_with_embeddings / stats[0].total_tracks) * 100).toFixed(1);
    console.log(`\nCorpus statistics:`);
    console.log(`  Total tracks: ${stats[0].total_tracks.toLocaleString()}`);
    console.log(`  With embeddings: ${stats[0].tracks_with_embeddings.toLocaleString()} (${embeddingPercent}%)`);
  }

  console.log('\n✅ Ready for similarity search!\n');
  console.log('Next steps:');
  console.log('  1. Run migrations: bun run migrate');
  console.log('  2. Process TikTok videos: bun src/processors/09-voxtral-lrclib-matching.ts\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
