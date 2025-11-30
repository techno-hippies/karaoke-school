#!/usr/bin/env bun
/**
 * Sync ARTIST_SUBSCRIPTION_LOCKS config from database to frontend
 *
 * Run this after deploying new artist locks to update the frontend config.
 *
 * Usage:
 *   bun src/scripts/sync-lock-config.ts
 *
 * This updates: ../app/src/lib/contracts/addresses.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { query } from '../db/connection';

interface Artist {
  slug: string;
  unlock_lock_address_testnet: string | null;
}

async function main() {
  console.log('🔄 Fetching artist lock addresses from database...\n');

  const artists = await query<Artist>(
    `SELECT slug, unlock_lock_address_testnet
     FROM artists
     WHERE unlock_lock_address_testnet IS NOT NULL
     ORDER BY slug`
  );

  if (artists.length === 0) {
    console.log('⚠️  No artists with lock addresses found');
    process.exit(0);
  }

  console.log('Found artists with locks:');
  artists.forEach(a => {
    console.log(`  ${a.slug}: ${a.unlock_lock_address_testnet}`);
  });

  // Generate the config object
  const configLines = artists.map(a =>
    `  '${a.slug}': {\n    lockAddress: '${a.unlock_lock_address_testnet}',\n    chainId: 84532, // Base Sepolia\n  },`
  ).join('\n');

  const configBlock = `export const ARTIST_SUBSCRIPTION_LOCKS: Record<string, { lockAddress: \`0x\${string}\`, chainId: number }> = {\n${configLines}\n}`;

  // Read current addresses.ts
  const addressesPath = join(import.meta.dir, '../../../app/src/lib/contracts/addresses.ts');
  let content = readFileSync(addressesPath, 'utf-8');

  // Replace the ARTIST_SUBSCRIPTION_LOCKS block
  const lockRegex = /export const ARTIST_SUBSCRIPTION_LOCKS[^}]+\{[\s\S]*?\n\}/;

  if (lockRegex.test(content)) {
    content = content.replace(lockRegex, configBlock);
    writeFileSync(addressesPath, content);
    console.log('\n✅ Updated app/src/lib/contracts/addresses.ts');
    console.log('\nDon\'t forget to rebuild the frontend!');
  } else {
    console.error('\n❌ Could not find ARTIST_SUBSCRIPTION_LOCKS in addresses.ts');
    console.log('\nGenerated config (add manually):');
    console.log(configBlock);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
