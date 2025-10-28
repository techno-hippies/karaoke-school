/**
 * Neon Database Connection
 * Direct connection using postgres package
 */

import postgres from 'postgres';

export const NEON_PROJECT_ID = 'frosty-smoke-70266868';

let sqlClient: ReturnType<typeof postgres> | null = null;

/**
 * Get or create SQL client
 */
function getClient() {
  if (!sqlClient) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not found in environment');
    }
    sqlClient = postgres(databaseUrl);
  }
  return sqlClient;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a single SQL query (raw SQL string)
 */
export async function query<T = any>(sql: string): Promise<T[]> {
  const client = getClient();
  const result = await client.unsafe(sql);
  return result as T[];
}

/**
 * Execute a transaction (multiple SQL statements)
 */
export async function transaction(sqlStatements: string[]): Promise<any[]> {
  const client = getClient();
  const results: any[] = [];

  for (const sql of sqlStatements) {
    const result = await client.unsafe(sql);
    results.push(result);
  }

  return results;
}

/**
 * Close the database connection
 */
export async function close(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
  }
}

/**
 * Helper to format values for SQL
 */
export function sqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return String(value);
}

/**
 * Helper to build INSERT statement
 */
export function buildInsert(table: string, data: Record<string, any>): string {
  const columns = Object.keys(data);
  const values = columns.map(col => sqlValue(data[col]));

  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
}

/**
 * Helper to build UPSERT statement
 */
export function buildUpsert(
  table: string,
  data: Record<string, any>,
  conflictTarget: string,
  updateColumns?: string[]
): string {
  const insert = buildInsert(table, data);
  const updates = (updateColumns || Object.keys(data).filter(k => k !== conflictTarget))
    .map(col => `${col} = EXCLUDED.${col}`)
    .join(', ');

  return `${insert} ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updates}`;
}
