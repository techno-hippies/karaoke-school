/**
 * Database Migration Runner
 * Applies schema files to Neon database using psql
 */

import { spawn } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';

async function applySQL(filePath: string, fileName: string, dbUrl: string) {
  return new Promise((resolve, reject) => {
    const psql = spawn('psql', [dbUrl, '-f', filePath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    psql.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    psql.on('close', (code) => {
      if (code === 0) {
        resolve(null);
      } else {
        reject(new Error(`psql exited with code ${code}: ${stderr}`));
      }
    });
  });
}

async function migrate() {
  console.log('🔄 Running database migrations...\n');

  const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable required');
  }

  // Step 1: Apply base schema files (01-*, 02-*, etc.)
  const schemaDir = join(import.meta.dir, '../../schema');
  const files = await readdir(schemaDir);
  const sqlFiles = files
    .filter(f => f.endsWith('.sql') && f.match(/^\d/))
    .sort();

  console.log(`📦 Applying ${sqlFiles.length} schema files:\n`);

  for (const file of sqlFiles) {
    try {
      console.log(`   📄 ${file}...`);
      const filePath = join(schemaDir, file);
      await applySQL(filePath, file, DATABASE_URL);
      console.log(`   ✅ ${file} applied`);
    } catch (error: any) {
      console.error(`   ❌ Failed to apply ${file}:`, error.message);
      throw error;
    }
  }

  // Step 2: Apply incremental migrations (001-*, 002-*, etc.)
  const migrationsDir = join(schemaDir, 'migrations');
  try {
    const migrationFiles = await readdir(migrationsDir);
    const sortedMigrations = migrationFiles
      .filter(f => f.endsWith('.sql') && f.match(/^\d/))
      .sort();

    if (sortedMigrations.length > 0) {
      console.log(`\n🔧 Applying ${sortedMigrations.length} incremental migrations:\n`);

      for (const file of sortedMigrations) {
        try {
          console.log(`   📄 ${file}...`);
          const filePath = join(migrationsDir, file);
          await applySQL(filePath, file, DATABASE_URL);
          console.log(`   ✅ ${file} applied`);
        } catch (error: any) {
          console.error(`   ❌ Failed to apply ${file}:`, error.message);
          throw error;
        }
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('\n📂 No migrations directory found (this is OK for initial setup)');
    } else {
      throw error;
    }
  }

  console.log('\n✨ All migrations applied successfully!\n');
}

// Run if called directly
if (import.meta.main) {
  migrate()
    .catch(error => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

export { migrate };
