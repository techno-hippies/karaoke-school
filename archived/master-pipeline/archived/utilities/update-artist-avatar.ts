#!/usr/bin/env bun
/**
 * Update Artist Avatar
 * Updates an existing Lens account's metadata to include avatar from Genius
 */

import { parseArgs } from 'util';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { account as accountMetadata } from '@lens-protocol/metadata';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireEnv } from '../lib/config.js';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      username: { type: 'string' },
      'genius-id': { type: 'string' },
    },
  });

  if (!values.username || !values['genius-id']) {
    console.log('Usage: bun run scripts/update-artist-avatar.ts --username franzferdinand --genius-id 21216\n');
    process.exit(1);
  }

  const username = values.username;
  const geniusArtistId = parseInt(values['genius-id']!);

  console.log(`\n🎨 Updating avatar for @${username}...`);

  // Fetch avatar from Genius
  console.log(`   Fetching from Genius (ID: ${geniusArtistId})...`);
  const geniusApiKey = requireEnv('GENIUS_API_KEY');
  const geniusResponse = await fetch(`https://api.genius.com/artists/${geniusArtistId}`, {
    headers: { 'Authorization': `Bearer ${geniusApiKey}` },
  });

  if (!geniusResponse.ok) {
    throw new Error(`Genius API error: ${geniusResponse.status}`);
  }

  const geniusData = await geniusResponse.json();
  const avatarUri = geniusData?.response?.artist?.image_url;

  if (!avatarUri) {
    throw new Error('No image_url found in Genius API response');
  }

  console.log(`   ✅ Avatar: ${avatarUri}\n`);

  // Initialize clients
  const privateKey = requireEnv('PRIVATE_KEY');
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const walletClient = createWalletClient({
    account,
    chain: chains.testnet,
    transport: http(),
  });

  const lensClient = PublicClient.create({
    environment: testnet,
    origin: 'http://localhost:3000',
  });

  const storage = StorageClient.create();

  // Login to Lens
  console.log('🔐 Authenticating with Lens...');
  const appAddress = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';
  const authenticated = await lensClient.login({
    onboardingUser: {
      app: evmAddress(appAddress),
      wallet: evmAddress(walletClient.account.address),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`);
  }

  const sessionClient = authenticated.value;
  console.log('✅ Authenticated\n');

  // Create new metadata with avatar
  console.log('📝 Creating updated metadata...');
  const metadata = accountMetadata({
    name: username,
    bio: `Official Karaoke School profile for ${username}`,
    picture: avatarUri,
    attributes: [
      { type: 'String', key: 'pkpAddress', value: '0xB9C328Cd3A664A059d2669f9EeE2Ef05911658D9' },
      { type: 'Number', key: 'geniusArtistId', value: geniusArtistId.toString() },
      { type: 'String', key: 'artistType', value: 'music-artist' },
    ],
  });

  console.log('☁️  Uploading to Grove...');
  const uploadResult = await storage.uploadAsJson(metadata, {
    name: `${username}-account-metadata-updated.json`,
    acl: immutable(chains.testnet.id),
  });
  console.log(`✅ Uploaded: ${uploadResult.uri}\n`);

  console.log(`✅ Avatar updated for @${username}`);
  console.log(`   New metadata URI: ${uploadResult.uri}`);
  console.log(`\n⚠️  Note: You need to call setMetadataUri() on the Lens account to apply this change\n`);
}

main();
