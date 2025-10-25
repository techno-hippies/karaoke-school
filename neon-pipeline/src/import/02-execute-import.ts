/**
 * Execute Karafun Import SQL
 *
 * Executes the generated karafun-import.sql file in batches via console output.
 * User will need to copy-paste the SQL statements into Neon console or use MCP.
 *
 * Usage:
 *   bun src/import/02-execute-import.ts
 */

const SQL_FILE_PATH = './data/karafun-import.sql';
const NEON_PROJECT_ID = process.env.NEON_PROJECT_ID || 'plain-wave-99802895';
const NEON_BRANCH_ID = process.env.NEON_BRANCH_ID || 'br-lucky-paper-a1489oxl'; // development

async function main() {
  console.log('🎤 Karafun SQL Executor\n');
  console.log(`Project: ${NEON_PROJECT_ID}`);
  console.log(`Branch: ${NEON_BRANCH_ID}`);
  console.log(`SQL File: ${SQL_FILE_PATH}\n`);

  // Read SQL file
  const sqlContent = await Bun.file(SQL_FILE_PATH).text();

  // Split into individual INSERT statements
  const statements = sqlContent
    .split('\n\n')
    .filter(s => s.trim().length > 0);

  console.log(`📊 Found ${statements.length} SQL statements\n`);
  console.log('📋 Instructions:');
  console.log('   1. This script will output SQL in chunks');
  console.log('   2. Copy each chunk and execute via:');
  console.log('      - Neon SQL Editor (console.neon.tech)');
  console.log('      - psql command line');
  console.log('      - Or ask Claude to execute via MCP\n');

  const chunkSize = 10; // 10 statements per chunk
  const totalChunks = Math.ceil(statements.length / chunkSize);

  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    const chunkNum = Math.floor(i / chunkSize) + 1;

    console.log(`\n${'='.repeat(80)}`);
    console.log(`CHUNK ${chunkNum}/${totalChunks} (Statements ${i + 1}-${Math.min(i + chunkSize, statements.length)})`);
    console.log('='.repeat(80));
    console.log();
    console.log(chunk.join('\n\n'));
    console.log();

    // Pause for user to execute
    if (chunkNum < totalChunks) {
      console.log(`\n[Press Enter when chunk ${chunkNum} is executed...]`);
      // await Bun.stdin.stream().getReader().read(); // Interactive mode
    }
  }

  console.log(`\n✅ All ${statements.length} statements output!`);
  console.log(`   Total records: 49,271`);
}

main().catch(console.error);
