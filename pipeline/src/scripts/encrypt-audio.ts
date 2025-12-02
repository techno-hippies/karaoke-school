#!/usr/bin/env bun
/**
 * Encrypt Full Audio with Hybrid Encryption
 *
 * Uses hybrid encryption to avoid Lit Protocol 413 errors:
 * 1. Generate random AES-256 symmetric key (32 bytes)
 * 2. Encrypt audio locally with WebCrypto AES-GCM
 * 3. Encrypt ONLY the symmetric key with Lit Protocol (tiny - 32 bytes)
 * 4. Upload encrypted audio and encrypted key separately to Grove
 *
 * On decrypt (frontend):
 * 1. Fetch encrypted key metadata from Grove (tiny)
 * 2. Call Lit with just the key ciphertext + hash (no 413 error!)
 * 3. Get back decrypted AES key
 * 4. Fetch encrypted audio from Grove
 * 5. Decrypt audio locally with WebCrypto
 *
 * Usage:
 *   bun src/scripts/encrypt-audio.ts --iswc=T0101545054
 *   bun src/scripts/encrypt-audio.ts --iswc=T0101545054 --env=mainnet
 *   bun src/scripts/encrypt-audio.ts --iswc=T0101545054 --dry-run
 */

import { parseArgs } from 'util';
import { getSongByISWC, getArtistById, updateSongEncryption } from '../db/queries';
import { uploadToGrove } from '../services/grove';
import { getEnvironment, getLitNetwork, type Environment } from '../config/networks';

// SongAccess contract addresses (per-song USDC purchase)
const SONG_ACCESS_CONTRACT = {
  testnet: '0x8d5C708E4e91d17De2A320238Ca1Ce12FcdFf545', // Base Sepolia
  mainnet: '0x0000000000000000000000000000000000000000', // TODO: Deploy to Base
};

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    env: { type: 'string', default: 'testnet' },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
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
 * Generate a random AES-256 key using WebCrypto
 */
async function generateSymmetricKey(): Promise<Uint8Array> {
  const key = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(key);
  return key;
}

/**
 * Encrypt audio locally with AES-256-GCM
 * Returns ciphertext, IV, and authTag
 */
async function encryptWithAesGcm(
  data: Buffer,
  symmetricKey: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; authTag: Uint8Array }> {
  // Generate random IV (12 bytes recommended for AES-GCM)
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Import key for WebCrypto
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    symmetricKey.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt with AES-GCM (includes authentication)
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128, // 16 bytes auth tag
    },
    cryptoKey,
    new Uint8Array(data).buffer as ArrayBuffer
  );

  // AES-GCM appends the auth tag to the ciphertext
  // Split them apart for clarity
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const ciphertext = encryptedArray.slice(0, encryptedArray.length - 16);
  const authTag = encryptedArray.slice(encryptedArray.length - 16);

  return { ciphertext, iv, authTag };
}

/**
 * Initialize Lit Protocol client
 */
async function initLitClient(litNetwork: string): Promise<any> {
  const { createLitClient } = await import('@lit-protocol/lit-client');
  const networks = await import('@lit-protocol/networks');

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
 * Build Access Control Conditions for SongAccess contract
 * Uses ownsSongByTrackId(address, string) which returns bool
 */
function buildSongAccessConditions(
  contractAddress: string,
  spotifyTrackId: string,
  chain: string
): any[] {
  console.log(`   Building ACC: SongAccess.ownsSongByTrackId on ${chain}`);
  console.log(`   Contract: ${contractAddress}`);
  console.log(`   SpotifyTrackId: ${spotifyTrackId}`);

  // Unified Access Control Condition for custom contract call
  // See: https://developer.litprotocol.com/sdk/access-control/evm/custom-contract-calls
  const accs = [
    {
      conditionType: 'evmContract',
      contractAddress: contractAddress.toLowerCase(),
      functionName: 'ownsSongByTrackId',
      functionParams: [':userAddress', spotifyTrackId],
      functionAbi: {
        inputs: [
          { name: 'user', type: 'address' },
          { name: 'spotifyTrackId', type: 'string' },
        ],
        name: 'ownsSongByTrackId',
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
        type: 'function',
      },
      chain,
      returnValueTest: {
        key: '',
        comparator: '=',
        value: 'true',
      },
    },
  ];

  console.log('   SongAccess Access Control Conditions built');
  return accs;
}


/**
 * Encrypt ONLY the symmetric key with Lit Protocol
 * This is tiny (32 bytes) - no 413 error!
 */
async function encryptSymmetricKeyWithLit(
  litClient: any,
  symmetricKey: Uint8Array,
  accs: any,
  chain: string
): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
  console.log(`   Encrypting symmetric key (${symmetricKey.length} bytes) with Lit...`);

  const encrypted = await litClient.encrypt({
    dataToEncrypt: symmetricKey,
    unifiedAccessControlConditions: accs,
    chain: chain,
  });

  console.log('   Symmetric key encrypted');
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

/**
 * Convert Uint8Array to base64 string
 */
function toBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

async function main() {
  const iswc = values.iswc;
  const env = (values.env as Environment) || getEnvironment();
  const dryRun = values['dry-run'];
  const force = values.force;
  const litNetwork = getLitNetwork(env);

  if (!iswc) {
    console.error('❌ Must specify --iswc');
    process.exit(1);
  }

  console.log('\n🔐 Encrypt Full Audio (Hybrid v2)');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Environment: ${env}`);
  console.log(`   Lit network: ${litNetwork}`);
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

  if (!song.spotify_track_id) {
    console.error('❌ No Spotify track ID - required for SongAccess contract');
    process.exit(1);
  }

  // Get artist for logging
  const artist = await getArtistById(song.artist_id);
  if (!artist) {
    console.error('❌ Artist not found');
    process.exit(1);
  }

  console.log(`   Artist: ${artist.name}`);

  // SongAccess contract is required for access control
  const songAccessAddress = env === 'testnet' ? SONG_ACCESS_CONTRACT.testnet : SONG_ACCESS_CONTRACT.mainnet;

  if (songAccessAddress === '0x0000000000000000000000000000000000000000') {
    console.error(`❌ SongAccess contract not deployed for ${env}`);
    process.exit(1);
  }

  console.log(`   Access: SongAccess contract (${songAccessAddress})`)

  // Check if already encrypted for this environment
  const existingEncryption = env === 'testnet'
    ? song.encrypted_full_url_testnet
    : song.encrypted_full_url_mainnet;

  if (existingEncryption && !force) {
    console.log(`\n⚠️  Already encrypted for ${env}: ${existingEncryption.substring(0, 50)}...`);
    console.log('   Use --force to re-encrypt');
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n✅ Dry run complete');
    console.log('   Would encrypt with hybrid approach:');
    console.log(`   - Lit network: ${litNetwork}`);
    console.log(`   - Access: SongAccess (${songAccessAddress}) on baseSepolia`);
    console.log('   - Method: AES-256-GCM (local) + Lit (key only)');
    process.exit(0);
  }

  // Download full audio
  console.log('\n📥 Downloading full instrumental...');
  const audioBuffer = await downloadAudio(song.enhanced_instrumental_url);

  // Generate symmetric key
  console.log('\n🔑 Generating symmetric key...');
  const symmetricKey = await generateSymmetricKey();
  console.log(`   Key size: ${symmetricKey.length} bytes (256 bits)`);

  // Encrypt audio locally with WebCrypto
  console.log('\n🔐 Encrypting audio with AES-256-GCM...');
  const startTime = Date.now();
  const { ciphertext, iv, authTag } = await encryptWithAesGcm(audioBuffer, symmetricKey);
  const encryptTime = Date.now() - startTime;
  console.log(`   Ciphertext: ${(ciphertext.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   IV: ${iv.length} bytes`);
  console.log(`   Auth tag: ${authTag.length} bytes`);
  console.log(`   Encryption time: ${encryptTime}ms`);

  // Initialize Lit Protocol
  console.log('\n🔐 Setting up Lit Protocol...');
  const litClient = await initLitClient(litNetwork);

  // Build Access Control Conditions for SongAccess contract
  console.log('\n🔒 Building access control...');
  const accChain = 'baseSepolia';
  const accs = buildSongAccessConditions(songAccessAddress, song.spotify_track_id, accChain);
  const normalizedAccs = normalizeAccs(accs);

  // Encrypt ONLY the symmetric key with Lit
  console.log('\n🔐 Encrypting symmetric key with Lit...');
  const encryptedKey = await encryptSymmetricKeyWithLit(
    litClient,
    symmetricKey,
    accs,
    accChain
  );

  // Clear symmetric key from memory
  symmetricKey.fill(0);

  // Upload encrypted audio (raw binary) to Grove
  console.log('\n☁️  Uploading encrypted audio to Grove...');
  const encryptedAudioUpload = await uploadToGrove(
    Buffer.from(ciphertext),
    `${iswc}-encrypted-audio.bin`,
    'application/octet-stream'
  );
  console.log(`   Encrypted audio: ${encryptedAudioUpload.url}`);

  // Build and upload encryption metadata (key + parameters)
  console.log('\n📋 Uploading encryption metadata...');
  const encryptionMetadata = {
    version: '2.1.0',
    method: 'hybrid-aes-gcm-lit',
    generatedAt: new Date().toISOString(),
    iswc,
    spotifyTrackId: song.spotify_track_id,
    environment: env,
    // AES-GCM parameters
    aes: {
      algorithm: 'AES-GCM',
      keyBits: 256,
      iv: toBase64(iv),
      authTag: toBase64(authTag),
    },
    // Lit-encrypted symmetric key
    lit: {
      network: litNetwork,
      encryptedKey: encryptedKey.ciphertext,
      dataToEncryptHash: encryptedKey.dataToEncryptHash,
      unifiedAccessControlConditions: normalizedAccs,
    },
    // Access control info (SongAccess contract)
    accessControl: {
      type: 'songAccess',
      contractAddress: songAccessAddress,
      chainId: 84532, // Base Sepolia
      chainName: 'baseSepolia',
    },
    // Encrypted audio location
    encryptedAudio: {
      url: encryptedAudioUpload.url,
      cid: encryptedAudioUpload.cid,
      sizeBytes: ciphertext.length,
    },
  };

  const metadataBuffer = Buffer.from(JSON.stringify(encryptionMetadata, null, 2));
  const metadataUpload = await uploadToGrove(
    metadataBuffer,
    `${iswc}-encryption-v2.json`,
    'application/json'
  );
  console.log(`   Metadata: ${metadataUpload.url}`);

  // Update database
  console.log('\n💾 Updating database...');
  await updateSongEncryption(iswc, env, {
    encrypted_full_url: encryptedAudioUpload.url,
    encryption_manifest_url: metadataUpload.url,
    lit_network: litNetwork,
  });

  console.log('\n✅ Hybrid encryption complete!');
  console.log(`   Environment: ${env}`);
  console.log(`   Method: AES-256-GCM (local) + Lit Protocol (key only)`);
  console.log(`   Encrypted audio: ${encryptedAudioUpload.url}`);
  console.log(`   Encryption metadata: ${metadataUpload.url}`);
  console.log(`   Lit network: ${litNetwork}`);
  console.log(`   Access: SongAccess (${songAccessAddress})`);
  console.log('\n   ✨ Frontend can now decrypt without 413 errors!');
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
