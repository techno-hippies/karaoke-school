/**
 * Neon Database Base Class
 * Handles database connection
 */

import { neon } from '@neondatabase/serverless';

export class NeonDBBase {
  protected sql: ReturnType<typeof neon>;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }
}
