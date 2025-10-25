/**
 * Execute Karafun Import via Neon MCP
 *
 * Reads the generated SQL file and executes it in chunks via MCP.
 * This bypasses the psql connection timeout issue.
 *
 * Usage:
 *   bun src/import/03-execute-via-mcp.ts
 */

const SQL_FILE_PATH = './data/karafun-import.sql';
const CHUNK_SIZE = 5; // Execute 5 INSERT statements at a time (~500 songs)

async function main() {
  console.log('🎤 Karafun MCP Executor\n');
  console.log(`SQL File: ${SQL_FILE_PATH}`);
  console.log(`Chunk size: ${CHUNK_SIZE} statements\n`);

  // Read SQL file
  const sqlContent = await Bun.file(SQL_FILE_PATH).text();

  // Split into individual INSERT statements (separated by blank lines)
  const statements = sqlContent
    .split('\n\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`📊 Found ${statements.length} INSERT statements\n`);

  const totalChunks = Math.ceil(statements.length / CHUNK_SIZE);

  console.log(`📋 Will execute in ${totalChunks} chunks of ${CHUNK_SIZE} statements each\n`);
  console.log('📝 Output SQL chunks for MCP execution:\n');
  console.log('=' .repeat(80));

  // Output chunks for execution
  for (let i = 0; i < statements.length; i += CHUNK_SIZE) {
    const chunk = statements.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const startRecord = i * 100 + 1; // Approximate (100 records per statement)
    const endRecord = Math.min((i + CHUNK_SIZE) * 100, 49271);

    console.log(`\n-- CHUNK ${chunkNum}/${totalChunks} (Statements ${i + 1}-${Math.min(i + CHUNK_SIZE, statements.length)})`);
    console.log(`-- Records ~${startRecord.toLocaleString()}-${endRecord.toLocaleString()}`);
    console.log(`-- Execute this chunk via: mcp__neon__run_sql_transaction\n`);

    const chunkSql = chunk.join(';\n\n') + ';';

    // Write chunk to temp file for easier MCP execution
    const chunkFilePath = `./data/karafun-chunk-${chunkNum.toString().padStart(3, '0')}.sql`;
    await Bun.write(chunkFilePath, chunkSql);

    console.log(`✅ Written to: ${chunkFilePath}`);
    console.log(`   Size: ${(chunkSql.length / 1024).toFixed(1)} KB`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Generated SQL chunks!');
  console.log(`   Total chunks: ${totalChunks}`);
  console.log(`   Location: ./data/karafun-chunk-*.sql\n`);
  console.log('📋 Next steps:');
  console.log('   1. Execute chunks via MCP in order (001, 002, 003, ...)');
  console.log('   2. Or ask Claude to execute them automatically\n');
}

main().catch(console.error);
