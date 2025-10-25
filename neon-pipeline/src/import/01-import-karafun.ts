/**
 * Import Karafun Catalog (English-only)
 *
 * Reads karafuncatalog.csv and imports English songs into karaoke_sources table.
 * Does NOT create recordings yet - just tracks which songs are popular for karaoke.
 *
 * Usage:
 *   bun src/import/01-import-karafun.ts
 *   bun src/import/01-import-karafun.ts --dry-run
 */

import { parse } from 'csv-parse/sync';
import {
  parseKarafunRow,
  normalizeEntry,
  isEnglishOnly,
  type NormalizedKarafunEntry,
} from '../schemas/karafun.js';

const CSV_PATH = process.env.KARAFUN_CSV_PATH || '/media/t42/th42/Code/karaoke-school-v1/karafuncatalog.csv';
const DRY_RUN = process.argv.includes('--dry-run');
const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID;

interface ImportStats {
  total: number;
  english: number;
  otherLanguages: number;
  inserted: number;
  errors: number;
}

/**
 * Read and parse Karafun CSV
 */
async function readKarafunCsv(): Promise<NormalizedKarafunEntry[]> {
  console.log(`📖 Reading Karafun catalog: ${CSV_PATH}`);

  const csvContent = await Bun.file(CSV_PATH).text();

  // Parse CSV (semicolon-delimited)
  const records = parse(csvContent, {
    delimiter: ';',
    columns: false,
    skip_empty_lines: true,
    from: 2, // Skip header row
  });

  const entries: NormalizedKarafunEntry[] = [];
  const stats: ImportStats = {
    total: records.length,
    english: 0,
    otherLanguages: 0,
    inserted: 0,
    errors: 0,
  };

  for (const row of records) {
    try {
      const entry = parseKarafunRow(row);

      // Filter: English-only
      if (isEnglishOnly(entry)) {
        const normalized = normalizeEntry(entry);
        entries.push(normalized);
        stats.english++;
      } else {
        stats.otherLanguages++;
      }
    } catch (error) {
      console.error(`⚠️  Failed to parse row:`, row, error);
      stats.errors++;
    }
  }

  console.log(`\n📊 Import Stats:`);
  console.log(`   Total songs: ${stats.total.toLocaleString()}`);
  console.log(`   English-only: ${stats.english.toLocaleString()}`);
  console.log(`   Other languages: ${stats.otherLanguages.toLocaleString()}`);
  console.log(`   Parse errors: ${stats.errors}`);

  return entries;
}

/**
 * Insert entries into Neon DB (karaoke_sources table)
 */
async function insertToNeonDb(entries: NormalizedKarafunEntry[]): Promise<number> {
  if (!NEON_PROJECT_ID && !DRY_RUN) {
    throw new Error('NEON_PROJECT_ID environment variable not set');
  }

  console.log(`\n💾 Inserting ${entries.length.toLocaleString()} entries into Neon DB...`);

  if (DRY_RUN) {
    console.log('   [DRY RUN] Skipping database insert');
    console.log('\nSample entries:');
    entries.slice(0, 5).forEach((entry, i) => {
      console.log(`   ${i + 1}. "${entry.title}" by ${entry.artist} (${entry.year || 'N/A'})`);
      console.log(`      Styles: ${entry.styles.join(', ')}`);
      console.log(`      Karafun ID: ${entry.id}, Popularity: ${entry.popularityScore}`);
    });
    return 0;
  }

  // Generate SQL file for MCP execution
  const batchSize = 100; // Smaller batches to avoid timeout
  const totalBatches = Math.ceil(entries.length / batchSize);

  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Total batches: ${totalBatches}\n`);

  // Generate SQL statements
  const sqlStatements: string[] = [];

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`   Generating batch ${batchNum}/${totalBatches}...`);

    const batchSql = generateBatchInsertSql(batch);
    sqlStatements.push(batchSql);
  }

  // Write SQL to file for execution
  const sqlContent = sqlStatements.join('\n\n');
  const sqlFilePath = './data/karafun-import.sql';

  await Bun.write(sqlFilePath, sqlContent);

  console.log(`\n✅ Generated SQL file: ${sqlFilePath}`);
  console.log(`   ${sqlStatements.length} batch INSERT statements`);
  console.log(`   ${entries.length.toLocaleString()} total records\n`);
  console.log('📋 To execute:');
  console.log('   1. Use Neon MCP: mcp__neon__run_sql with the generated SQL');
  console.log('   2. Or use psql: psql <connection-string> -f data/karafun-import.sql\n');

  return 0;
}

/**
 * Generate batch INSERT SQL for karaoke_sources table
 */
function generateBatchInsertSql(entries: NormalizedKarafunEntry[]): string {
  if (entries.length === 0) return '';

  // Generate VALUES for each entry
  const values = entries.map(entry => {
    const metadata = JSON.stringify({
      title: entry.title,
      artist: entry.artist,
      year: entry.year,
      styles: entry.styles,
      languages: entry.languages,
      is_duo: entry.duo,
      is_explicit: entry.explicit,
      artist_normalized: entry.artistNormalized,
      title_normalized: entry.titleNormalized,
    }).replace(/'/g, "''"); // Escape single quotes

    return `  ('karafun', '${entry.id}', '${metadata}'::jsonb, ${entry.popularityScore}, '${entry.dateAdded}', 1.0)`;
  }).join(',\n');

  return `
INSERT INTO karaoke_sources (source, source_song_id, metadata, popularity_rank, date_added, confidence_weight)
VALUES
${values}
ON CONFLICT (source, source_song_id) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  popularity_rank = EXCLUDED.popularity_rank,
  updated_at = NOW();
`.trim();
}

/**
 * Main execution
 */
async function main() {
  console.log('🎤 Karafun Catalog Importer (English-only)\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No database changes will be made\n');
  }

  try {
    // Step 1: Read and filter CSV
    const entries = await readKarafunCsv();

    if (entries.length === 0) {
      console.log('❌ No English-only entries found!');
      process.exit(1);
    }

    // Step 2: Insert to Neon DB
    const inserted = await insertToNeonDb(entries);

    console.log('\n✅ Import complete!');
    if (!DRY_RUN) {
      console.log(`   Inserted: ${inserted.toLocaleString()} entries`);
    }

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

main();
