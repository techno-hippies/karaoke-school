/**
 * Generate embeddings for LRCLIB corpus using DeepInfra
 *
 * Usage:
 *   # Generate for all pending (no embeddings)
 *   bun scripts/lrclib/generate-embeddings.ts
 *
 *   # Test with limited rows
 *   bun scripts/lrclib/generate-embeddings.ts --limit=100
 *
 *   # Process specific batch
 *   bun scripts/lrclib/generate-embeddings.ts --offset=10000 --limit=1000
 */

import { query } from '../../src/db/neon';
import { DeepInfraEmbeddingService } from '../../src/services/deepinfra-embedding';

const BATCH_SIZE = 100; // DeepInfra batch size
const DB_BATCH_SIZE = 100; // Database update batch size

interface LyricsRecord {
  id: number;
  track_name: string;
  artist_name: string;
  plain_lyrics: string;
}

async function generateEmbeddings(options: {
  limit?: number;
  offset?: number;
}) {
  console.log('>à LRCLIB Embedding Generation');
  console.log('================================');
  console.log(`Model: google/embeddinggemma-300m (768 dims)`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  if (options.limit) {
    console.log(`Limit: ${options.limit} rows`);
  }
  if (options.offset) {
    console.log(`Offset: ${options.offset} rows`);
  }
  console.log();

  // Initialize DeepInfra service
  const embeddingService = new DeepInfraEmbeddingService();
  console.log(` DeepInfra service initialized`);
  console.log();

  // Get pending records (no embeddings)
  console.log('=Ê Checking for pending embeddings...');
  const countQuery = `
    SELECT COUNT(*) as pending
    FROM lrclib_corpus
    WHERE lyrics_embedding IS NULL
      AND has_plain_lyrics = TRUE
      AND plain_lyrics IS NOT NULL
      AND plain_lyrics != ''
  `;
  const countResult = await query(countQuery);
  const pendingTotal = parseInt(countResult[0].pending, 10);
  console.log(` Pending embeddings: ${pendingTotal.toLocaleString()}`);
  console.log();

  if (pendingTotal === 0) {
    console.log('<‰ No pending embeddings! All done.');
    return;
  }

  // Fetch records to process
  let selectQuery = `
    SELECT
      id,
      track_name,
      artist_name,
      plain_lyrics
    FROM lrclib_corpus
    WHERE lyrics_embedding IS NULL
      AND has_plain_lyrics = TRUE
      AND plain_lyrics IS NOT NULL
      AND plain_lyrics != ''
    ORDER BY id
  `;

  if (options.limit || options.offset) {
    selectQuery += ` LIMIT ${options.limit || -1} OFFSET ${options.offset || 0}`;
  } else if (!options.limit) {
    // Default limit for safety
    selectQuery += ` LIMIT 10000`;
  }

  console.log('=Ö Fetching records from Neon...');
  const records = (await query(selectQuery)) as LyricsRecord[];
  console.log(` Fetched ${records.length.toLocaleString()} records`);
  console.log();

  if (records.length === 0) {
    console.log(' No records to process');
    return;
  }

  // Process in batches
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    console.log(`\n=. Batch ${batchNum}/${totalBatches} (${batch.length} records)`);
    console.log(`   Records: ${batch[0].track_name} - ${batch[0].artist_name} ... ${batch[batch.length - 1].track_name} - ${batch[batch.length - 1].artist_name}`);

    try {
      // Generate embeddings
      console.log(`   >à Generating embeddings...`);
      const startTime = Date.now();

      const embeddings = await embeddingService.embedLyricsBatch(
        batch.map((r) => r.plain_lyrics),
        (completed, total) => {
          // Progress callback (optional)
        }
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`    Generated ${embeddings.length} embeddings in ${elapsed}s`);

      // Update database
      console.log(`   =¾ Updating database...`);
      let updated = 0;

      for (let j = 0; j < batch.length; j++) {
        const record = batch[j];
        const embedding = embeddings[j];

        try {
          const updateQuery = `
            UPDATE lrclib_corpus
            SET
              lyrics_embedding = $1::vector,
              embedding_model = $2,
              embedding_generated_at = NOW(),
              updated_at = NOW()
            WHERE id = $3
          `;

          await query(updateQuery, [
            `[${embedding.join(',')}]`,
            embeddingService.getModel(),
            record.id,
          ]);

          updated++;
        } catch (error) {
          console.error(`      Failed to update record ${record.id}:`, error);
          failed++;
        }
      }

      succeeded += updated;
      processed += batch.length;

      console.log(`    Updated ${updated}/${batch.length} records`);
      console.log(`   =Ê Progress: ${processed}/${records.length} (${((processed / records.length) * 100).toFixed(1)}%)`);
      console.log(`   ñ  Rate: ${(processed / ((Date.now() - startTime) / 1000)).toFixed(1)} records/sec`);
    } catch (error) {
      console.error(`   L Batch ${batchNum} failed:`, error);
      failed += batch.length;
      processed += batch.length;

      // Continue with next batch (don't fail entire job)
      console.log(`   í  Skipping to next batch...`);
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < records.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log('\n( Embedding Generation Complete!');
  console.log('====================================');
  console.log(` Succeeded: ${succeeded.toLocaleString()} records`);
  if (failed > 0) {
    console.log(`L Failed: ${failed.toLocaleString()}`);
  }
  console.log();

  // Show updated stats
  const stats = await query('SELECT * FROM lrclib_corpus_stats');
  console.log('=Ê Updated Stats:');
  console.table(stats);
}

// Parse CLI args
const args = process.argv.slice(2);
const options: { limit?: number; offset?: number } = {};

for (const arg of args) {
  if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10);
  } else if (arg.startsWith('--offset=')) {
    options.offset = parseInt(arg.split('=')[1], 10);
  }
}

// Run generation
generateEmbeddings(options).catch(console.error);
