#!/usr/bin/env bun
/**
 * Artist Creation Wrapper
 *
 * Creates a verified artist account using the unified account system.
 * Automatically fetches avatar from Genius API.
 *
 * Usage:
 *   bun run artists/create-artist.ts --name franzferdinand --genius-id 21216
 *   bun run artists/create-artist.ts --name taylorswift --genius-id 498 --isni 0000000078519858
 */

import { parseArgs } from 'util';
import { $ } from 'bun';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      name: { type: 'string' },
      'genius-id': { type: 'string' },
      isni: { type: 'string' },
      'display-name': { type: 'string' },
    },
  });

  if (!values.name || !values['genius-id']) {
    console.log('Usage:');
    console.log('  bun run artists/create-artist.ts --name franzferdinand --genius-id 21216');
    console.log('  bun run artists/create-artist.ts --name taylorswift --genius-id 498 --isni 0000000078519858');
    console.log('  bun run artists/create-artist.ts --name beyonce --genius-id 498 --display-name "Beyoncé"\n');
    process.exit(1);
  }

  const artistName = values.name!;
  const geniusArtistId = values['genius-id']!;
  const isni = values.isni;
  const displayName = values['display-name'] || artistName;

  console.log(`🎨 Creating artist: ${artistName}`);
  console.log(`   Genius ID: ${geniusArtistId}`);
  console.log(`   Display Name: ${displayName}`);
  if (isni) {
    console.log(`   ISNI: ${isni}`);
  }
  console.log('');

  // Build command
  const args = [
    'run',
    'modules/accounts/01-create-account.ts',
    '--username', artistName,
    '--genius-artist-id', geniusArtistId,
    '--display-name', displayName,
    '--verify',
    '--emit-event',
  ];

  if (isni) {
    args.push('--isni', isni);
  }

  // Execute unified account creation
  await $`bun ${args}`;

  console.log(`\n✅ Artist ${artistName} created successfully!`);
  console.log(`   Profile: /u/${artistName}\n`);
}

main();
