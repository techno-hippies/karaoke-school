#!/usr/bin/env bun
/**
 * Apply karaoke_segments migration
 */

import { query, close } from '../../src/db/neon';
import { readFileSync } from 'fs';

async function main() {
  try {
    console.log('📦 Applying karaoke_segments migration...\n');

    const sql = readFileSync('./schema/migrations/009-karaoke-segments.sql', 'utf-8');

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await query(statement);
        console.log('✓ Executed statement');
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log('  (already exists, skipping)');
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ Migration complete!');
    console.log('   - Table: karaoke_segments');
    console.log('   - Indexes: 4');
    console.log('   - Views: 2');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await close();
  }
}

main();
