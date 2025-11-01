/**
 * Transaction utility for safe database operations
 *
 * Ensures atomic operations across multiple queries
 * Automatic rollback on errors
 */

import { query } from './neon';

export interface TransactionClient {
  query: (sql: string, values?: any[]) => Promise<any[]>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

/**
 * Execute a function within a database transaction
 * Automatically commits on success, rolls back on error
 *
 * @example
 * await withTransaction(async (tx) => {
 *   await tx.query('INSERT INTO grc20_works...');
 *   await tx.query('INSERT INTO grc20_work_recordings...');
 *   // Auto-commits if no errors
 * });
 */
export async function withTransaction<T>(
  fn: (tx: TransactionClient) => Promise<T>
): Promise<T> {
  await query('BEGIN');

  const tx: TransactionClient = {
    query: async (sql: string, values?: any[]) => {
      return query(sql, values);
    },
    commit: async () => {
      await query('COMMIT');
    },
    rollback: async () => {
      await query('ROLLBACK');
    },
  };

  try {
    const result = await fn(tx);
    await query('COMMIT');
    return result;
  } catch (err) {
    await query('ROLLBACK');
    throw err;
  }
}

/**
 * Validate that all required foreign key references exist
 * Throws error if any dependencies are missing
 */
export async function validateDependencies(config: {
  artists?: boolean;
  works?: boolean;
  recordings?: boolean;
}): Promise<void> {
  const errors: string[] = [];

  if (config.works && config.artists) {
    // Check for works with missing artist references
    const orphanedWorks = await query(`
      SELECT gw.id, gw.title, gw.primary_artist_id
      FROM grc20_works gw
      LEFT JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
      WHERE gw.primary_artist_id IS NOT NULL
        AND ga.id IS NULL
      LIMIT 5
    `);

    if (orphanedWorks.length > 0) {
      errors.push(
        `Found ${orphanedWorks.length} works with missing artists: ` +
        orphanedWorks.map((w: any) => `${w.id} (artist_id: ${w.primary_artist_id})`).join(', ')
      );
    }
  }

  if (config.recordings && config.works) {
    // Check for recordings with missing work references
    const orphanedRecordings = await query(`
      SELECT gwr.id, gwr.work_id, gwr.spotify_track_id
      FROM grc20_work_recordings gwr
      LEFT JOIN grc20_works gw ON gw.id = gwr.work_id
      WHERE gw.id IS NULL
      LIMIT 5
    `);

    if (orphanedRecordings.length > 0) {
      errors.push(
        `Found ${orphanedRecordings.length} recordings with missing works: ` +
        orphanedRecordings.map((r: any) => `${r.id} (work_id: ${r.work_id})`).join(', ')
      );
    }

    // Check for works without recordings (1:1 relationship expected)
    const worksWithoutRecordings = await query(`
      SELECT gw.id, gw.title
      FROM grc20_works gw
      LEFT JOIN grc20_work_recordings gwr ON gwr.work_id = gw.id
      WHERE gwr.id IS NULL
      LIMIT 5
    `);

    if (worksWithoutRecordings.length > 0) {
      errors.push(
        `Found ${worksWithoutRecordings.length} works without recordings: ` +
        worksWithoutRecordings.map((w: any) => `${w.id}: ${w.title}`).join(', ')
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      'Data integrity check failed:\n' +
      errors.map(e => `  - ${e}`).join('\n')
    );
  }
}
