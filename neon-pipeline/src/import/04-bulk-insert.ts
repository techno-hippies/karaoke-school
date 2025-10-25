/**
 * Bulk Insert Karafun Data
 *
 * Executes the SQL batches using Neon's serverless driver with proper connection handling.
 *
 * Usage:
 *   bun src/import/04-bulk-insert.ts
 */

import { neon } from '@neondatabase/serverless';

const CONNECTION_STRING = process.env.NEON_CONNECTION_STRING ||
  'postgresql://neondb_owner:npg_zSPoW2j6RZIb@ep-withered-bush-a1lyp178-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const CHUNK_SIZE = 10; // 10 INSERT statements = ~1000 songs per batch

async function main() {
  console.log('🎤 Karafun Bulk Insert\n');

  const sql = neon(CONNECTION_STRING);

  // Read SQL file
  const sqlContent = await Bun.file('./data/karafun-import.sql').text();

  // Split into individual INSERT statements
  const statements = sqlContent
    .split('\n\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`📊 Found ${statements.length} INSERT statements`);
  console.log(`   Will execute in batches of ${CHUNK_SIZE}\n`);

  const totalBatches = Math.ceil(statements.length / CHUNK_SIZE);
  let totalInserted = 0;

  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    const batch = statements.slice(i, i + CHUNK_SIZE);
    const batchNum = Math.floor(i / CHUNK_SIZE) + 1;

    console.log(`\n[${batchNum}/${totalBatches}] Executing batch ${i + 1}-${Math.min(i + CHUNK_SIZE, statements.length)}...`);

    try {
      // Execute each statement in the batch
      for (const stmt of batch) {
        await sql.query(stmt);
      }

      totalInserted += batch.length;
      console.log(`   ✅ Inserted ${batch.length * 100} songs (total: ${totalInserted * 100})`);

    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      console.error(`   Statement:`, batch[0].substring(0, 200) + '...');
      throw error;
    }

    // Progress update every 10 batches
    if (batchNum % 10 === 0) {
      const progress = ((totalInserted / statements.length) * 100).toFixed(1);
      console.log(`\n📈 Progress: ${progress}% (${totalInserted}/${statements.length} statements)`);
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Total statements: ${totalInserted}`);
  console.log(`   Total songs: ~${totalInserted * 100}`);

  // Verify
  const result = await sql`SELECT COUNT(*) as count FROM karaoke_sources`;
  console.log(`\n🔍 Verification: ${result[0].count} songs in database\n`);
}

main().catch(console.error);
