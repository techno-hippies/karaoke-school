/**
 * Simple Neon Database Client
 * Clean interface for pipeline queries
 */

import { neon } from '@neondatabase/serverless';

export class NeonDB {
  public sql: ReturnType<typeof neon>;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }
}
