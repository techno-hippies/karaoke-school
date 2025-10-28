/**
 * Import CISAC Works
 *
 * Runs the CISAC works import SQL to dramatically increase work count
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
    console.log('📥 Importing CISAC works...\n');

    // Read and execute CISAC import SQL
    const cisacImportSQL = fs.readFileSync(
      path.join(__dirname, '../sql/03b-import-cisac-works.sql'),
      'utf-8'
    );

    const result = await sql.unsafe(cisacImportSQL);
    console.log('✅ CISAC works import complete\n');

    // Print summary
    if (result && result.length > 0) {
      const summary = result[result.length - 1];
      console.log('📊 CISAC Import Summary:');
      console.log(`   Total CISAC Imports: ${summary.total_cisac_imports}`);
      console.log(`   Ready to Mint: ${summary.ready_to_mint}`);
      console.log(`   Has Artist Linkage: ${summary.has_artist_linkage}`);
      console.log(`   Has Composers: ${summary.has_composers}`);
      console.log(`   Avg Completeness: ${summary.avg_completeness}`);
      console.log(`   Avg Composers per Work: ${summary.avg_composers_per_work}`);
    }

    // Show total stats across all works
    console.log('\n📊 Total Works Stats:');
    const totalStats = await sql`
      SELECT
        COUNT(*) as total_works,
        COUNT(*) FILTER (WHERE ready_to_mint) as ready_to_mint,
        COUNT(*) FILTER (WHERE source_flags->>'genius' = 'true') as from_genius,
        COUNT(*) FILTER (WHERE source_flags->>'cisac' = 'true' AND source_flags->>'genius' IS NULL) as from_cisac_only
      FROM grc20_works
    `;
    console.log(`   Total Works: ${totalStats[0].total_works}`);
    console.log(`   Ready to Mint: ${totalStats[0].ready_to_mint}`);
    console.log(`   From Genius: ${totalStats[0].from_genius}`);
    console.log(`   From CISAC Only: ${totalStats[0].from_cisac_only}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
