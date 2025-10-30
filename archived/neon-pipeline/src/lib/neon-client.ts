/**
 * Neon DB Client
 *
 * Helper for batch inserts via Neon MCP
 */

export interface NeonConfig {
  projectId: string;
  branchId?: string;
}

export interface BatchInsertResult {
  inserted: number;
  errors: number;
  duration: number;
}

/**
 * Insert records in batches
 *
 * Note: This uses console.log to communicate with Claude MCP
 * The actual DB operations will be performed by the user via MCP
 */
export async function batchInsert(
  config: NeonConfig,
  tableName: string,
  records: any[],
  batchSize: number = 100
): Promise<BatchInsertResult> {
  const startTime = Date.now();
  let inserted = 0;
  let errors = 0;

  console.log(`\n📦 Batch inserting ${records.length.toLocaleString()} records into ${tableName}...`);
  console.log(`   Batch size: ${batchSize}`);
  console.log(`   Project: ${config.projectId}`);
  console.log(`   Branch: ${config.branchId || 'default'}\n`);

  // Calculate total batches
  const totalBatches = Math.ceil(records.length / batchSize);

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`\n-- Batch ${batchNum}/${totalBatches} (${batch.length} records)`);
    console.log(`-- Records ${i + 1} to ${Math.min(i + batchSize, records.length)}`);

    // Generate SQL for this batch
    const sql = generateBatchInsertSQL(tableName, batch);
    console.log(sql);

    inserted += batch.length;
  }

  const duration = Date.now() - startTime;

  return {
    inserted,
    errors,
    duration,
  };
}

/**
 * Generate batch INSERT SQL with ON CONFLICT handling
 */
function generateBatchInsertSQL(tableName: string, records: any[]): string {
  if (records.length === 0) return '';

  // Get column names from first record
  const columns = Object.keys(records[0]);
  const columnList = columns.join(', ');

  // Generate VALUES for each record
  const values = records.map(record => {
    const vals = columns.map(col => {
      const value = record[col];
      if (value === null || value === undefined) return 'NULL';
      if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
      if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
      if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
      return value;
    });
    return `(${vals.join(', ')})`;
  }).join(',\n  ');

  // Generate UPDATE clause for ON CONFLICT
  const updateClauses = columns
    .filter(col => col !== 'id' && col !== 'created_at')
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(',\n  ');

  return `
INSERT INTO ${tableName} (${columnList})
VALUES
  ${values}
ON CONFLICT (source, source_song_id) DO UPDATE SET
  ${updateClauses},
  updated_at = NOW();
`.trim();
}
