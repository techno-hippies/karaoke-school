/**
 * Run Corroboration ETL
 *
 * Executes SQL files to create and populate corroboration tables
 */

import postgres from 'postgres';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

async function main() {
  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    console.log('🗑️  Dropping existing tables...\n');

    // Drop existing tables first
    await sql.unsafe(`
      DROP TABLE IF EXISTS grc20_artists CASCADE;
      DROP TABLE IF EXISTS grc20_works CASCADE;
      DROP TABLE IF EXISTS grc20_corroboration_log CASCADE;
      DROP VIEW IF EXISTS high_consensus_isni_artists CASCADE;
      DROP VIEW IF EXISTS mintable_artists_summary CASCADE;
      DROP VIEW IF EXISTS isrc_consensus_works CASCADE;
      DROP VIEW IF EXISTS data_quality_dashboard CASCADE;
    `);

    console.log('🔧 Creating corroboration schema...\n');

    // Read and execute schema creation
    const schemaSQL = fs.readFileSync(
      path.join(__dirname, '../sql/01-create-corroboration-schema.sql'),
      'utf-8'
    );

    await sql.unsafe(schemaSQL);
    console.log('✅ Schema created successfully\n');

    console.log('🔄 Running artist corroboration ETL...\n');

    // Read and execute artist corroboration
    const artistETL = fs.readFileSync(
      path.join(__dirname, '../sql/02-corroborate-artists.sql'),
      'utf-8'
    );

    const artistResult = await sql.unsafe(artistETL);
    console.log('✅ Artist corroboration complete\n');

    // Print artist summary
    if (artistResult && artistResult.length > 0) {
      const summary = artistResult[artistResult.length - 1];
      console.log('📊 Artist Summary:');
      console.log(`   Total Artists: ${summary.total_artists}`);
      console.log(`   Ready to Mint: ${summary.ready_to_mint}`);
      console.log(`   Avg Completeness: ${summary.avg_completeness}`);
      console.log(`   Avg Consensus: ${summary.avg_consensus}`);
      console.log(`   Has MBID: ${summary.has_mbid}`);
      console.log(`   Has ISNI: ${summary.has_isni}`);
      console.log(`   Has Image: ${summary.has_image}`);
      console.log(`   Has 2+ Social: ${summary.has_2plus_social}`);
    }

    console.log('\n🔄 Running work corroboration ETL...\n');

    // Read and execute work corroboration
    const workETL = fs.readFileSync(
      path.join(__dirname, '../sql/03-corroborate-works.sql'),
      'utf-8'
    );

    const workResult = await sql.unsafe(workETL);
    console.log('✅ Work corroboration complete\n');

    // Print work summary
    if (workResult && workResult.length > 0) {
      const summary = workResult[workResult.length - 1];
      console.log('📊 Work Summary:');
      console.log(`   Total Works: ${summary.total_works}`);
      console.log(`   Ready to Mint: ${summary.ready_to_mint}`);
      console.log(`   Avg Completeness: ${summary.avg_completeness}`);
      console.log(`   Avg Consensus: ${summary.avg_consensus}`);
      console.log(`   Has ISRC: ${summary.has_isrc}`);
      console.log(`   Has ISWC: ${summary.has_iswc}`);
      console.log(`   Has Primary Artist: ${summary.has_primary_artist}`);
      console.log(`   Has 2+ Sources: ${summary.has_2plus_sources}`);
    }

    console.log('\n📋 Next steps:');
    console.log('   1. Review artists: SELECT * FROM grc20_artists WHERE ready_to_mint LIMIT 10;');
    console.log('   2. Review works: SELECT * FROM grc20_works WHERE ready_to_mint LIMIT 10;');
    console.log('   3. Check stats: bun scripts/check-stats.ts');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
