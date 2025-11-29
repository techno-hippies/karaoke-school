/**
 * Database Connection
 *
 * Neon serverless PostgreSQL connection with type-safe queries.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { DATABASE_URL } from '../config';

// Enable connection pooling
neonConfig.fetchConnectionCache = true;

// Create SQL client
const sql = neon(DATABASE_URL);

/**
 * Execute a parameterized SQL query
 *
 * @param query - SQL query string with $1, $2, etc. placeholders
 * @param params - Array of parameter values
 * @returns Array of rows
 */
export async function query<T = Record<string, unknown>>(
  queryText: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    const result = await sql(queryText, params);
    return result as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Execute a single query and return first row or null
 */
export async function queryOne<T = Record<string, unknown>>(
  queryText: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(queryText, params);
  return rows[0] || null;
}

/**
 * Execute multiple statements in a transaction
 */
export async function transaction<T>(
  fn: (query: typeof sql) => Promise<T>
): Promise<T> {
  // Note: Neon serverless doesn't support traditional transactions
  // For now, execute sequentially (consider using Neon's transaction API if needed)
  return fn(sql);
}

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT NOW() as now`;
    console.log('Database connected:', result[0].now);
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
