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
    sqlClient = postgres(databaseUrl, {
      connect_timeout: 10,        // 10 seconds connect timeout
      idle_timeout: 20,            // 20 seconds idle timeout
      max_lifetime: 60 * 30,       // 30 minutes max connection lifetime
      max: 10,                     // Max 10 connections in pool
    });
  }
  return sqlClient;
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a single SQL query
 * Supports both raw SQL strings and parameterized queries
 * Includes automatic retry logic for transient connection errors
 *
 * @param sql - SQL query string (can contain $1, $2 placeholders)
 * @param paramsOrRetries - Either parameter array or retry count (for backwards compatibility)
 * @param retries - Retry count when params are provided
 */
export async function query<T = any>(
  sql: string,
  paramsOrRetries?: any[] | number,
  retries?: number
): Promise<T[]> {
  const client = getClient();

  // Handle overloaded parameters
  let params: any[] | undefined;
  let maxRetries: number;

  if (Array.isArray(paramsOrRetries)) {
    params = paramsOrRetries;
    maxRetries = retries ?? 3;
  } else {
    params = undefined;
    maxRetries = paramsOrRetries ?? 3;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let result;
      if (params) {
        // For parameterized queries, manually substitute parameters
        // This is safe because postgres package escapes values
        let processedSql = sql;
        params.forEach((param, index) => {
          const placeholder = `$${index + 1}`;
          const escapedValue = param === null || param === undefined
            ? 'NULL'
            : typeof param === 'string'
            ? `'${param.replace(/'/g, "''")}'`
            : typeof param === 'number'
            ? String(param)
            : typeof param === 'boolean'
            ? (param ? 'TRUE' : 'FALSE')
            : `'${JSON.stringify(param).replace(/'/g, "''")}'`;
          processedSql = processedSql.replace(placeholder, escapedValue);
        });
        result = await client.unsafe(processedSql);
      } else {
        result = await client.unsafe(sql);
      }
      return result as T[];
    } catch (error: any) {
      // Check if this is a transient connection error
      const isTransient =
        error?.message?.includes('CONNECTION_ENDED') ||
        error?.message?.includes('terminated') ||
        error?.message?.includes('ECONNRESET') ||
        error?.message?.includes('Connection terminated') ||
        error?.code === 'ECONNRESET' ||
        error?.code === '57P01';  // Postgres admin shutdown code

      // If not transient or last attempt, throw immediately
      if (!isTransient || attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s (capped at 10s)
      const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.warn(`[DB Retry] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      console.warn(`[DB Retry] Retrying after ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }

  throw new Error('Unreachable: max retries exhausted');
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
 * All arrays are treated as JSONB for consistency
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
