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

interface SongLock {
  spotify_track_id: string;
  unlock_lock_address_testnet: string | null;
}

async function main() {
  console.log('🔄 Fetching lock addresses from database...\n');

  const artists = await query<Artist>(
    `SELECT slug, unlock_lock_address_testnet
     FROM artists
     WHERE unlock_lock_address_testnet IS NOT NULL
     ORDER BY slug`
  );

  const songs = await query<SongLock>(
    `SELECT spotify_track_id, unlock_lock_address_testnet
     FROM songs
     WHERE unlock_lock_address_testnet IS NOT NULL AND spotify_track_id IS NOT NULL
     ORDER BY spotify_track_id`
  );

  if (artists.length === 0 && songs.length === 0) {
    console.log('⚠️  No locks found for artists or songs');
    process.exit(0);
  }

  if (artists.length > 0) {
    console.log('Found artists with locks:');
    artists.forEach(a => {
      console.log(`  ${a.slug}: ${a.unlock_lock_address_testnet}`);
    });
  }

  if (songs.length > 0) {
    console.log('\nFound songs with locks:');
    songs.forEach(s => {
      console.log(`  ${s.spotify_track_id}: ${s.unlock_lock_address_testnet}`);
    });
  }

  // Generate the config object
  const artistConfigLines = artists.map(a =>
    `  '${a.slug}': {\n    lockAddress: '${a.unlock_lock_address_testnet}',\n    chainId: 84532, // Base Sepolia\n  },`
  ).join('\n');

  const songConfigLines = songs.map(s =>
    `  '${s.spotify_track_id}': {\n    lockAddress: '${s.unlock_lock_address_testnet}',\n    chainId: 84532, // Base Sepolia\n  },`
  ).join('\n');

  const artistConfigBlock = `export const ARTIST_SUBSCRIPTION_LOCKS: Record<string, { lockAddress: \`0x\${string}\`, chainId: number }> = {\n${artistConfigLines}\n}`;

  const songConfigBlock = `export const SONG_PURCHASE_LOCKS: Record<string, { lockAddress: \`0x\${string}\`, chainId: number }> = {\n${songConfigLines}\n}`;

  // Read current addresses.ts
  const addressesPath = join(import.meta.dir, '../../../app/src/lib/contracts/addresses.ts');
  let content = readFileSync(addressesPath, 'utf-8');

  const replaceBlock = (name: string, block: string) => {
    const regex = new RegExp(`export const ${name}[^}]+\\{[\\s\\S]*?\\n\\}`);
    if (regex.test(content)) {
      content = content.replace(regex, block);
      return true;
    }
    return false;
  };

  const artistReplaced = replaceBlock('ARTIST_SUBSCRIPTION_LOCKS', artistConfigBlock);
  const songReplaced = replaceBlock('SONG_PURCHASE_LOCKS', songConfigBlock);

  if (!artistReplaced) {
    console.error('\n❌ Could not find ARTIST_SUBSCRIPTION_LOCKS in addresses.ts');
  }

  if (!songReplaced) {
    console.error('\n❌ Could not find SONG_PURCHASE_LOCKS in addresses.ts');
  }

  if (!artistReplaced && !songReplaced) {
    console.log('\nGenerated configs (add manually):');
    console.log(artistConfigBlock);
    console.log('\n');
    console.log(songConfigBlock);
    process.exit(1);
  }

  writeFileSync(addressesPath, content);
  console.log('\n✅ Updated app/src/lib/contracts/addresses.ts');
  console.log('\nDon\'t forget to rebuild the frontend!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
