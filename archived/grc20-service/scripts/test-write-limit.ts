/**
 * Test Neon Write Limit
 * Quick test to see if we can still write to the database
 */

import postgres from 'postgres';
import { config } from '../config';

async function main() {
  console.log('🧪 Testing Neon write limit...\n');

  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    // Create test table
    console.log('⏳ Creating test table...');
    await sql`
      CREATE TABLE IF NOT EXISTS test_write_limit (
        id SERIAL PRIMARY KEY,
        test_data TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    console.log('✅ Test table created\n');

    // Insert test data
    console.log('⏳ Inserting test data...');
    const result = await sql`
      INSERT INTO test_write_limit (test_data)
      VALUES ('Testing write limit - ' || NOW())
      RETURNING id, test_data, created_at
    `;
    console.log('✅ Test data inserted successfully!');
    console.log('   Result:', result[0]);

    // Try updating existing data
    console.log('\n⏳ Testing UPDATE...');
    await sql`
      UPDATE test_write_limit
      SET test_data = test_data || ' (updated)'
      WHERE id = ${result[0].id}
    `;
    console.log('✅ Update successful!');

    // Clean up
    console.log('\n⏳ Cleaning up test table...');
    await sql`DROP TABLE test_write_limit`;
    console.log('✅ Cleanup complete!');

    console.log('\n🎉 All write operations successful! No write limit issues detected.');

  } catch (error) {
    console.error('\n❌ Write operation failed!');
    console.error('Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('limit')) {
        console.error('\n🚨 WRITE LIMIT DETECTED! You may have hit Neon free tier limits.');
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
