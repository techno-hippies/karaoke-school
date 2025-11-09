/**
 * SQL Query Helper Functions
 * Utilities for building INSERT and UPSERT statements
 */

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
