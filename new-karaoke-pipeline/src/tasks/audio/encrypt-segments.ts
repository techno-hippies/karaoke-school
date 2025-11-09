#!/usr/bin/env bun
/**
 * Encrypt Karaoke Segments with Lit Protocol
 *
 * Encrypts full-length karaoke segments and gates them with Unlock Protocol NFT keys.
 * Users must own a subscription key from the artist's Unlock lock to decrypt.
 *
 * Prerequisites:
 * - karaoke_segments has fal_enhanced_grove_url (audio to encrypt)
 * - lens_accounts has subscription_lock_address (Unlock lock)
 * - @lit-protocol/access-control-conditions installed
 * - @lit-protocol/lit-client installed
 *
 * Usage:
 *   bun src/tasks/audio/encrypt-segments.ts --limit=10
 *   bun task:encrypt --limit=5
 */

import '../../env';
import { parseArgs } from 'util';
import { query } from '../../db/connection';
import { createAccBuilder } from '@lit-protocol/access-control-conditions';
import { uploadToGrove } from '../../services/storage';
import { ethers } from 'ethers';
import SegmentEventsArtifact from '../../../../contracts/out/SegmentEvents.sol/SegmentEvents.json' assert { type: 'json' };
import { SEGMENT_EVENTS_ADDRESS, LENS_TESTNET_RPC } from '../../../../lit-actions/config/contracts.config.js';

// ============================================================================
// Types
// ============================================================================

interface SegmentToEncrypt {
  spotify_track_id: string;
  fal_enhanced_grove_url: string;
  clip_start_ms: number | null;
  clip_end_ms: number | null;
  primary_artist_id: string;
  artist_name: string;
  lens_account_id: number;
  subscription_lock_address: string;
  subscription_lock_chain: string;
}

interface SegmentEncryptedEventPayload {
  segmentHash: string;
  spotifyTrackId: string;
  encryptedFullUri: string;
  encryptedManifestUri: string;
  unlockLockAddress: string;
  unlockChainId: number;
  metadataUri: string;
}

const UNLOCK_CHAIN_ID_MAP: Record<string, number> = {
  basesepolia: 84532,
  basemainnet: 8453,
  mainnet: 1,
  ethereum: 1,
  lenstestnet: 37111,
};

function normalizeChainKey(chain: string): string {
  return chain.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveUnlockChainId(chain: string): number {
  const chainId = UNLOCK_CHAIN_ID_MAP[normalizeChainKey(chain)];
  if (!chainId) {
    throw new Error(`Unsupported Unlock chain: ${chain}`);
  }
  return chainId;
}

let segmentEventsContract: ethers.Contract | null = null;

function getFormattedPrivateKey(): `0x${string}` {
  const rawKey = process.env.PRIVATE_KEY?.trim();
  if (!rawKey) {
    throw new Error('PRIVATE_KEY environment variable required for contract emission');
  }

  return (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
}

function getSegmentEventsContract(): ethers.Contract {
  if (segmentEventsContract) {
    return segmentEventsContract;
  }

  const provider = new ethers.JsonRpcProvider(LENS_TESTNET_RPC);
  const wallet = new ethers.Wallet(getFormattedPrivateKey(), provider);

  segmentEventsContract = new ethers.Contract(
    SEGMENT_EVENTS_ADDRESS,
    SegmentEventsArtifact.abi,
    wallet
  );

  return segmentEventsContract;
}

async function emitSegmentEncryptedEvent(payload: SegmentEncryptedEventPayload): Promise<void> {
  const contract = getSegmentEventsContract();

  console.log('   ⛓️  Emitting SegmentEncrypted event...');
  const tx = await contract.emitSegmentEncrypted(
    payload.segmentHash,
    payload.spotifyTrackId,
    payload.encryptedFullUri,
    payload.encryptedManifestUri,
    payload.unlockLockAddress,
    payload.unlockChainId,
    payload.metadataUri
  );

  console.log(`   📝 TX: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
}

function generateSegmentHash(spotifyTrackId: string, clipStartMs: number): string {
  return ethers.solidityPackedKeccak256(
    ['string', 'uint32'],
    [spotifyTrackId, clipStartMs]
  );
}

function normalizeAccs(accs: any): any {
  const serialized = JSON.stringify(accs, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );

  return JSON.parse(serialized);
}

// ============================================================================
// Main Processing Logic
// ============================================================================

/**
 * Find segments that need encryption
 *
 * Criteria:
 * - Has enhanced audio (fal_enhanced_grove_url)
 * - Not yet encrypted (encrypted_full_cid IS NULL)
 * - Artist has Unlock lock deployed
 */
async function findSegmentsToEncrypt(limit: number): Promise<SegmentToEncrypt[]> {
  const sql = `
    SELECT
      ks.spotify_track_id,
      ks.fal_enhanced_grove_url,
      ks.clip_start_ms,
      ks.clip_end_ms,
      t.primary_artist_id,
      sa.name as artist_name,
      la.id as lens_account_id,
      la.subscription_lock_address,
      la.subscription_lock_chain
    FROM karaoke_segments ks
    JOIN tracks t ON t.spotify_track_id = ks.spotify_track_id
    JOIN spotify_artists sa ON sa.spotify_artist_id = t.primary_artist_id
    JOIN lens_accounts la ON la.spotify_artist_id = t.primary_artist_id
    WHERE ks.fal_enhanced_grove_url IS NOT NULL
      AND ks.encrypted_full_cid IS NULL
      AND la.subscription_lock_address IS NOT NULL
    ORDER BY ks.created_at DESC
    LIMIT $1
  `;

  return await query<SegmentToEncrypt>(sql, [limit]);
}

/**
 * Download audio from Grove
 */
async function downloadFromGrove(groveUrl: string): Promise<Buffer> {
  console.log(`   📥 Downloading from Grove: ${groveUrl}`);

  const response = await fetch(groveUrl);
  if (!response.ok) {
    throw new Error(`Grove download failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log(`   ✓ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
  return buffer;
}

/**
 * Initialize Lit Protocol client
 */
async function initLitClient(): Promise<any> {
  const { createLitClient } = await import('@lit-protocol/lit-client');
  const { nagaTest } = await import('@lit-protocol/networks');

  console.log('   🔐 Initializing Lit Protocol client...');

  const litClient = await createLitClient({
    network: nagaTest as any, // Type assertion for network module compatibility
  });

  console.log('   ✓ Lit Protocol connected');
  return litClient;
}

/**
 * Build Access Control Conditions for Unlock NFT
 *
 * Requirements: User must own a key (any tokenId) from the Unlock lock
 *
 * How it works:
 * - requireNftOwnership(address, tokenId) with tokenId generates ERC-721 balanceOf check
 * - The condition checks: balanceOf(:userAddress) > 0
 * - This accepts ANY valid subscription key from the Unlock lock
 */
function buildAccessControlConditions(
  lockAddress: string,
  chain: string
): any {
  console.log(`   🔒 Building ACC: NFT required from ${lockAddress} on ${chain}`);

  const builder = createAccBuilder();

  // Build condition: must own ERC-721 token from Unlock lock
  // Providing tokenId='1' generates: balanceOf(:userAddress) > 0
  // This checks if user owns ANY key, not just tokenId 1
  const accs = builder
    .requireNftOwnership(
      lockAddress.toLowerCase(), // Normalize address
      '1' // Triggers ERC-721 mode; actual check is balanceOf > 0
    )
    .on(chain as any) // Chain where the lock is deployed (e.g., 'base-sepolia')
    .build();

  console.log(`   ✓ Access Control Conditions built`);
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
  console.log(`   🔐 Encrypting ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB with Lit Protocol...`);

  const encrypted = await litClient.encrypt({
    dataToEncrypt: audioBuffer,
    unifiedAccessControlConditions: accs,
    chain: chain,
  });

  console.log(`   ✓ Encryption complete`);
  return encrypted;
}

/**
 * Update database with encrypted data
 */
async function saveEncryptedData(
  spotifyTrackId: string,
  encryptedCid: string,
  encryptedUrl: string,
  lensAccountId: number,
  encryptionRecord: any
): Promise<void> {
  const sql = `
    UPDATE karaoke_segments
    SET
      encrypted_full_cid = $1,
      encrypted_full_url = $2,
      lens_account_row_id = $3,
      encryption_accs = $4,
      updated_at = NOW()
    WHERE spotify_track_id = $5
  `;

  await query(sql, [
    encryptedCid,
    encryptedUrl,
    lensAccountId,
    JSON.stringify(encryptionRecord),
    spotifyTrackId,
  ]);

  console.log(`   ✓ Database updated`);
}

/**
 * Process a single segment: download, encrypt, upload, save
 */
async function processSegment(
  segment: SegmentToEncrypt,
  litClient: any
): Promise<void> {
  console.log(`\n🎵 Processing: ${segment.artist_name} - ${segment.spotify_track_id}`);
  console.log(`   Lock: ${segment.subscription_lock_address} (${segment.subscription_lock_chain})`);

  try {
    if (segment.clip_start_ms == null) {
      throw new Error('Segment is missing clip_start_ms; cannot derive segment hash');
    }

    const unlockLockAddress = ethers.getAddress(segment.subscription_lock_address);
    const unlockChainId = resolveUnlockChainId(segment.subscription_lock_chain);
    const segmentHash = generateSegmentHash(segment.spotify_track_id, segment.clip_start_ms);

    console.log(`   Segment hash: ${segmentHash}`);
    if (segment.clip_end_ms != null) {
      const clipDuration = (segment.clip_end_ms - segment.clip_start_ms) / 1000;
      console.log(`   Clip window: ${(segment.clip_start_ms / 1000).toFixed(1)}s → ${(segment.clip_end_ms / 1000).toFixed(1)}s (${clipDuration.toFixed(1)}s)`);
    }

    // 1. Download audio from Grove
    const audioBuffer = await downloadFromGrove(segment.fal_enhanced_grove_url);

    // 2. Build Access Control Conditions
    const accs = buildAccessControlConditions(
      segment.subscription_lock_address,
      segment.subscription_lock_chain
    );

    // 3. Encrypt audio with Lit Protocol
    const encrypted = await encryptAudio(
      litClient,
      audioBuffer,
      accs,
      segment.subscription_lock_chain
    );

    const normalizedAccs = normalizeAccs(accs);

    // 4. Upload encrypted data to Grove
    console.log(`   📤 Uploading encrypted data to Grove...`);
    const encryptedBuffer = Buffer.from(JSON.stringify(encrypted));
    const encryptedUpload = await uploadToGrove(
      encryptedBuffer,
      'application/json',
      `encrypted-${segment.spotify_track_id}.json`
    );

    console.log(`   ✓ Encrypted data uploaded: ${encryptedUpload.cid}`);

    // 5. Build and upload manifest (ACC + metadata)
    console.log(`   🧾 Uploading encryption manifest...`);
    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      spotifyTrackId: segment.spotify_track_id,
      segmentHash,
      clipStartMs: segment.clip_start_ms,
      clipEndMs: segment.clip_end_ms,
      source: {
        falEnhancedGroveUrl: segment.fal_enhanced_grove_url,
      },
      unlock: {
        lockAddress: unlockLockAddress,
        chain: segment.subscription_lock_chain,
        chainId: unlockChainId,
      },
      lit: {
        conditions: normalizedAccs,
        dataToEncryptHash: encrypted.dataToEncryptHash,
      },
      encryptedFull: {
        cid: encryptedUpload.cid,
        url: encryptedUpload.url,
        provider: encryptedUpload.provider,
        size: encryptedUpload.size,
        timestamp: encryptedUpload.timestamp,
      },
    };

    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    const manifestUpload = await uploadToGrove(
      manifestBuffer,
      'application/json',
      `encrypted-manifest-${segment.spotify_track_id}.json`
    );

    console.log(`   ✓ Manifest uploaded: ${manifestUpload.cid}`);

    // 6. Emit SegmentEncrypted event
    await emitSegmentEncryptedEvent({
      segmentHash,
      spotifyTrackId: segment.spotify_track_id,
      encryptedFullUri: encryptedUpload.url,
      encryptedManifestUri: manifestUpload.url,
      unlockLockAddress,
      unlockChainId,
      metadataUri: manifestUpload.url,
    });

    // 7. Save to database (include manifest + metadata)
    const encryptionRecord = {
      conditions: normalizedAccs,
      manifest: {
        cid: manifestUpload.cid,
        url: manifestUpload.url,
        provider: manifestUpload.provider,
        timestamp: manifestUpload.timestamp,
      },
      encryptedFull: {
        cid: encryptedUpload.cid,
        url: encryptedUpload.url,
        provider: encryptedUpload.provider,
        size: encryptedUpload.size,
        timestamp: encryptedUpload.timestamp,
      },
      dataToEncryptHash: encrypted.dataToEncryptHash,
      unlock: {
        lockAddress: unlockLockAddress,
        chain: segment.subscription_lock_chain,
        chainId: unlockChainId,
      },
      lensAccountRowId: segment.lens_account_id,
    };

    await saveEncryptedData(
      segment.spotify_track_id,
      encryptedUpload.cid,
      encryptedUpload.url,
      segment.lens_account_id,
      encryptionRecord
    );

    console.log(`   ✅ Segment encrypted successfully!`);

  } catch (error: any) {
    console.error(`   ❌ Failed to encrypt segment:`, error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔐 Lit Protocol Segment Encryption Task\n');

  // Parse CLI arguments
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '10' },
    },
  });

  const limit = parseInt(values.limit || '10', 10);

  console.log(`📋 Configuration:`);
  console.log(`   Batch size: ${limit}`);
  console.log();

  // 1. Find segments to encrypt
  console.log('🔍 Finding segments to encrypt...');
  const segments = await findSegmentsToEncrypt(limit);

  if (segments.length === 0) {
    console.log('✓ No segments need encryption');
    return;
  }

  console.log(`✓ Found ${segments.length} segment(s) to encrypt\n`);

  // 2. Initialize Lit Protocol
  const litClient = await initLitClient();

  // 3. Process each segment
  let successCount = 0;
  let errorCount = 0;

  for (const segment of segments) {
    try {
      await processSegment(segment, litClient);
      successCount++;
    } catch (error: any) {
      console.error(`Failed to process ${segment.spotify_track_id}:`, error.message);
      errorCount++;
    }
  }

  // 4. Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Encryption Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors:  ${errorCount}`);
  console.log(`📦 Total:   ${segments.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run the task
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
