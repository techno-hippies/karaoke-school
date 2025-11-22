/**
 * Database Connection Layer
 * Clean abstraction over Neon PostgreSQL
 */

import { neon } from '@neondatabase/serverless';

let databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL or NEON_DATABASE_URL environment variable required');
}

if (!/[?&]sslmode=/i.test(databaseUrl)) {
  databaseUrl += databaseUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

if (/channel_binding=require/i.test(databaseUrl)) {
  databaseUrl = databaseUrl.replace(/channel_binding=require/gi, 'channel_binding=prefer');
}

if (!/[?&]channel_binding=/i.test(databaseUrl)) {
  databaseUrl += databaseUrl.includes('?') ? '&channel_binding=prefer' : '?channel_binding=prefer';
}

// Create SQL query function
export const sql = neon(databaseUrl);

/**
 * Simple query wrapper with type safety
 */
export async function query<T = any>(
  queryText: string,
  params: any[] = []
): Promise<T[]> {
  try {
    const result = await sql(queryText, params);
    return result as T[];
  } catch (error) {
    console.error('❌ Query failed:', error);
    console.error('   Query:', queryText);
    console.error('   Params:', params);
    throw error;
  }
}

/**
 * Transaction helper
 */
export async function transaction<T>(
  callback: (sql: typeof query) => Promise<T>
): Promise<T> {
  // Note: Neon serverless doesn't support traditional transactions
  // For now, just execute callback directly
  // TODO: Implement transaction logic if needed
  return callback(query);
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await query('SELECT 1 as health');
    return result[0]?.health === 1;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

/**
 * SQL Helper: Convert value to SQL literal
 */
export function sqlValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value) || typeof value === 'object') {
    // All arrays and objects are JSONB
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return String(value);
}

/**
 * SQL Helper: Build INSERT statement
 */
export function buildInsert(table: string, data: Record<string, any>): string {
  const columns = Object.keys(data);
  const values = columns.map(col => sqlValue(data[col]));

  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
}

/**
 * SQL Helper: Build UPSERT statement
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
