#!/usr/bin/env bun
/**
 * Encrypt Full Audio with Lit Protocol
 *
 * Encrypts the full enhanced instrumental with Lit Protocol,
 * gated by Unlock Protocol NFT ownership.
 *
 * Non-subscribers see the free clip (0 → clip_end_ms).
 * Subscribers can decrypt the full audio via Lit + their Unlock key.
 *
 * Usage:
 *   bun src/scripts/encrypt-audio.ts --iswc=T0101545054
 *   bun src/scripts/encrypt-audio.ts --iswc=T0101545054 --env=mainnet
 *   bun src/scripts/encrypt-audio.ts --iswc=T0101545054 --dry-run
 */

import { parseArgs } from 'util';
import { getSongByISWC, getArtistById, updateSongEncryption } from '../db/queries';
import { uploadToGrove } from '../services/grove';
import { getEnvironment, getNetworkConfig, getLitNetwork, type Environment } from '../config/networks';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    env: { type: 'string', default: 'testnet' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

/**
 * Download audio from Grove URL
 */
async function downloadAudio(url: string): Promise<Buffer> {
  console.log(`   Downloading: ${url.substring(0, 60)}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  console.log(`   Downloaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  return buffer;
}

/**
 * Initialize Lit Protocol client
 */
async function initLitClient(litNetwork: string): Promise<any> {
  const { createLitClient } = await import('@lit-protocol/lit-client');
  const networks = await import('@lit-protocol/networks');

  // Map network name to module
  const networkMap: Record<string, any> = {
    'naga-dev': networks.nagaDev,
    'naga-test': networks.nagaTest,
    'naga-staging': networks.nagaStaging,
  };

  const networkModule = networkMap[litNetwork];
  if (!networkModule) {
    throw new Error(`Unsupported Lit network: ${litNetwork}`);
  }

  console.log(`   Initializing Lit Protocol (${litNetwork})...`);
  const litClient = await createLitClient({
    network: networkModule,
  });

  console.log('   Lit Protocol connected');
  return litClient;
}

/**
 * Build Access Control Conditions for Unlock NFT
 *
 * Condition: User must own a key (any tokenId) from the Unlock lock.
 * Uses ERC-721 balanceOf check: balanceOf(:userAddress) > 0
 */
function buildAccessControlConditions(
  lockAddress: string,
  chain: string
): any {
  const { createAccBuilder } = require('@lit-protocol/access-control-conditions');

  console.log(`   Building ACC: NFT required from ${lockAddress} on ${chain}`);

  const builder = createAccBuilder();

  // Build condition: must own ERC-721 token from Unlock lock
  // tokenId='1' triggers ERC-721 mode; actual check is balanceOf > 0
  const accs = builder
    .requireNftOwnership(lockAddress.toLowerCase(), '1')
    .on(chain as any)
    .build();

  console.log('   Access Control Conditions built');
  return accs;
}

/**
 * Encrypt audio data with Lit Protocol
 */
async function encryptAudio(
  litClient: any,
  audioBuffer: Buffer,
  accs: any,
  chain: string
): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
  console.log(`   Encrypting ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB...`);

  const encrypted = await litClient.encrypt({
    dataToEncrypt: audioBuffer,
    unifiedAccessControlConditions: accs,
    chain: chain,
  });

  console.log('   Encryption complete');
  return encrypted;
}

/**
 * Normalize ACCs (convert BigInts to strings for JSON serialization)
 */
function normalizeAccs(accs: any): any {
  const serialized = JSON.stringify(accs, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
  return JSON.parse(serialized);
}

async function main() {
  const iswc = values.iswc;
  const env = (values.env as Environment) || getEnvironment();
  const dryRun = values['dry-run'];
  const networkConfig = getNetworkConfig(env);
  const litNetwork = getLitNetwork(env);

  if (!iswc) {
    console.error('❌ Must specify --iswc');
    process.exit(1);
  }

  console.log('\n🔐 Encrypt Full Audio');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Environment: ${env}`);
  console.log(`   Lit network: ${litNetwork}`);
  console.log(`   Unlock chain: ${networkConfig.unlock.chainName}`);
  if (dryRun) console.log('   Mode: DRY RUN');

  // Get song
  const song = await getSongByISWC(iswc);
  if (!song) {
    console.error('❌ Song not found');
    process.exit(1);
  }

  console.log(`\n🎵 ${song.title}`);

  // Check prerequisites
  if (!song.enhanced_instrumental_url) {
    console.error('❌ No enhanced instrumental - run process-audio.ts first');
    process.exit(1);
  }

  if (!song.artist_id) {
    console.error('❌ No artist linked to song');
    process.exit(1);
  }

  // Get artist and their Unlock lock
  const artist = await getArtistById(song.artist_id);
  if (!artist) {
    console.error('❌ Artist not found');
    process.exit(1);
  }

  console.log(`   Artist: ${artist.name}`);

  // Get the lock address for this environment
  const lockAddress = env === 'testnet'
    ? artist.unlock_lock_address_testnet
    : artist.unlock_lock_address_mainnet;

  if (!lockAddress) {
    console.error(`❌ No Unlock lock deployed for ${artist.name} on ${env}`);
    console.log('   Run: bun src/scripts/deploy-artist-lock.ts --artist-id=' + artist.id);
    process.exit(1);
  }

  console.log(`   Lock: ${lockAddress}`);

  // Check if already encrypted for this environment
  const existingEncryption = env === 'testnet'
    ? song.encrypted_full_url_testnet
    : song.encrypted_full_url_mainnet;

  if (existingEncryption) {
    console.log(`\n⚠️  Already encrypted for ${env}: ${existingEncryption.substring(0, 50)}...`);
    console.log('   To re-encrypt, manually clear the encryption columns first');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete');
    console.log('   Would encrypt full audio with:');
    console.log(`   - Lit network: ${litNetwork}`);
    console.log(`   - Unlock lock: ${lockAddress}`);
    console.log(`   - Chain: ${networkConfig.unlock.chainName}`);
    process.exit(0);
  }

  // Download full audio
  console.log('\n📥 Downloading full instrumental...');
  const audioBuffer = await downloadAudio(song.enhanced_instrumental_url);

  // Initialize Lit Protocol
  console.log('\n🔐 Setting up Lit Protocol...');
  const litClient = await initLitClient(litNetwork);

  // Build Access Control Conditions
  console.log('\n🔒 Building access control...');
  const accs = buildAccessControlConditions(lockAddress, networkConfig.lit.accChain);
  const normalizedAccs = normalizeAccs(accs);

  // Encrypt audio
  console.log('\n🔐 Encrypting audio...');
  const encrypted = await encryptAudio(litClient, audioBuffer, accs, networkConfig.lit.accChain);

  // Upload encrypted data to Grove
  console.log('\n☁️  Uploading encrypted data to Grove...');
  const encryptedBuffer = Buffer.from(JSON.stringify(encrypted));
  const encryptedUpload = await uploadToGrove(
    encryptedBuffer,
    `${iswc}-encrypted-full.json`,
    'application/json'
  );
  console.log(`   Encrypted: ${encryptedUpload.url}`);

  // Build and upload manifest
  console.log('\n📋 Uploading encryption manifest...');
  const manifest = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    iswc,
    spotifyTrackId: song.spotify_track_id,
    environment: env,
    source: {
      enhancedInstrumentalUrl: song.enhanced_instrumental_url,
    },
    unlock: {
      lockAddress,
      chainId: networkConfig.unlock.chainId,
      chainName: networkConfig.unlock.chainName,
    },
    lit: {
      network: litNetwork,
      conditions: normalizedAccs,
      dataToEncryptHash: encrypted.dataToEncryptHash,
    },
    encryptedFull: {
      url: encryptedUpload.url,
      cid: encryptedUpload.cid,
    },
  };

  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
  const manifestUpload = await uploadToGrove(
    manifestBuffer,
    `${iswc}-encryption-manifest.json`,
    'application/json'
  );
  console.log(`   Manifest: ${manifestUpload.url}`);

  // Update database
  console.log('\n💾 Updating database...');
  await updateSongEncryption(iswc, env, {
    encrypted_full_url: encryptedUpload.url,
    encryption_manifest_url: manifestUpload.url,
    lit_network: litNetwork,
  });

  console.log('\n✅ Encryption complete!');
  console.log(`   Environment: ${env}`);
  console.log(`   Encrypted URL: ${encryptedUpload.url}`);
  console.log(`   Manifest URL: ${manifestUpload.url}`);
  console.log(`   Lit network: ${litNetwork}`);
  console.log(`   Unlock lock: ${lockAddress}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
