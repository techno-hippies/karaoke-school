#!/usr/bin/env bun
/**
 * Step 3: Encrypt HLS Segments with Lit Protocol (Hybrid Encryption)
 *
 * Uses symmetric encryption for video segments (AES-256-GCM), then encrypts
 * the symmetric key with Lit Protocol access control conditions.
 *
 * Flow:
 * 1. Generate ONE AES-256 key per video (shared across all segments)
 * 2. Encrypt each segment with unique IV but same key
 * 3. Use Lit Protocol to encrypt the symmetric key with Unlock ACC
 * 4. Store encrypted segments + per-segment metadata (IV, authTag)
 *
 * This enables streaming decryption:
 * - Frontend decrypts symmetric key ONCE via Lit Protocol
 * - Frontend decrypts each segment on-the-fly with unique IV
 * - HLS.js handles progressive loading and playback
 *
 * Prerequisites:
 * - Unlock lock deployed (from step 2.5)
 * - Videos segmented to HLS (from step 2.9)
 * - data/videos/{handle}/manifest.json exists
 *
 * Usage:
 *   bun run local/3-encrypt-videos.ts --creator @charlidamelio
 *
 * Output:
 *   - Encrypted segment files (replaces plaintext .ts files)
 *   - Updated manifest with encryption metadata + segment IVs
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { parseArgs } from 'util';
import path from 'path';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import crypto from 'crypto';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

interface LensData {
  tiktokHandle: string;
  pkpEthAddress: string;
  lensHandle: string;
  lensAccountAddress: string;
  subscriptionLock?: {
    address: string;
    chain: string;
  };
}

interface SegmentEncryption {
  filename: string;
  iv: string; // base64
  authTag: string; // base64
}

interface VideoData {
  postId: string;
  copyrightType: string;
  localFiles: {
    video: string | null;
    thumbnail: string | null;
  };
  hls?: {
    segmented: boolean;
    segmentedAt: string;
    segmentDuration: number;
    segmentCount: number;
    playlistFile: string;
    segmentsDir: string;
  };
  encryption?: {
    encryptedSymmetricKey: string; // Lit-encrypted symmetric key (base64)
    dataToEncryptHash: string; // Hash for Lit decrypt verification
    unifiedAccessControlConditions: any[]; // v8 unified format
    segments: SegmentEncryption[]; // Per-segment IV and authTag
    encryptedAt: string;
  };
}

/**
 * Encrypt data with AES-256-GCM using a symmetric key
 */
function encryptWithSymmetricKey(data: Buffer, key: Buffer): {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
} {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv,
    authTag,
  };
}

interface Manifest {
  tiktokHandle: string;
  lensHandle: string;
  videos: VideoData[];
}

async function encryptVideos(tiktokHandle: string): Promise<void> {
  console.log('\n🔐 Step 3: Encrypting HLS Segments with Lit Protocol');
  console.log('═══════════════════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load Lens data to get lock address
  console.log('📂 Loading lock data...');
  const lensPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  const lensData: LensData = JSON.parse(await readFile(lensPath, 'utf-8'));

  if (!lensData.subscriptionLock?.address) {
    throw new Error('Unlock lock not found. Run step 2.5 first (bun run deploy-lock)');
  }

  const lockAddress = lensData.subscriptionLock.address;
  const lockChain = lensData.subscriptionLock.chain;

  console.log(`✅ Lock Address: ${lockAddress}`);
  console.log(`   Chain: ${lockChain}\n`);

  // 2. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  const manifest: Manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const manifestDir = path.dirname(manifestPath);

  // Only encrypt copyrighted videos (copyright-free videos remain public)
  const videosToEncrypt = manifest.videos.filter(v =>
    v.hls?.segmented && v.copyrightType === 'copyrighted'
  );
  const copyrightFreeCount = manifest.videos.filter(v => v.copyrightType === 'copyright-free').length;

  console.log(`📹 Found ${videosToEncrypt.length} copyrighted videos to encrypt`);
  console.log(`📹 Found ${copyrightFreeCount} copyright-free videos (will remain unencrypted)\n`);

  if (videosToEncrypt.length === 0) {
    console.log('⚠️  No HLS segments found. Run step 2.9 first (bun run convert-videos).\n');
    return;
  }

  // 3. Initialize Lit Protocol client
  console.log('🔗 Connecting to Lit Protocol (nagaDev)...');
  const litClient = await createLitClient({
    network: nagaDev, // Using v8 dev network
  });

  console.log('✅ Connected to Lit Protocol\n');

  // 4. Define v8 unified access control conditions
  // User must have a valid Unlock key to decrypt
  const unifiedAccessControlConditions = [
    {
      conditionType: 'evmContract',
      contractAddress: lockAddress,
      chain: lockChain === 'base-sepolia' ? 'baseSepolia' : lockChain,
      functionName: 'getHasValidKey',
      functionParams: [':userAddress'],
      functionAbi: {
        inputs: [{ type: 'address', name: '' }],
        name: 'getHasValidKey',
        outputs: [{ type: 'bool', name: '' }],
        stateMutability: 'view',
        type: 'function',
      },
      returnValueTest: {
        key: '',
        comparator: '=',
        value: 'true',
      },
    },
  ];

  console.log('🔑 Unified Access Control Conditions (v8):');
  console.log('   Contract:', lockAddress);
  console.log('   Function: getHasValidKey(address)');
  console.log('   Condition: must return true\n');

  // 5. Encrypt segments for each video
  for (let i = 0; i < videosToEncrypt.length; i++) {
    const video = videosToEncrypt[i];

    // Skip if already encrypted
    if (video.encryption) {
      console.log(`⏭️  Skipping video ${i + 1}/${videosToEncrypt.length} (already encrypted)`);
      console.log(`   Post ID: ${video.postId}\n`);
      continue;
    }

    if (!video.hls) {
      console.log(`⏭️  Skipping video ${i + 1}/${videosToEncrypt.length} (not segmented)`);
      console.log(`   Post ID: ${video.postId}\n`);
      continue;
    }

    const segmentsDir = path.join(manifestDir, video.hls.segmentsDir);

    if (!existsSync(segmentsDir)) {
      console.log(`⏭️  Skipping video ${i + 1}/${videosToEncrypt.length} (segments dir not found)`);
      console.log(`   Post ID: ${video.postId}`);
      console.log(`   Expected: ${segmentsDir}\n`);
      continue;
    }

    console.log(`🔐 Encrypting video ${i + 1}/${videosToEncrypt.length}`);
    console.log(`   Post ID: ${video.postId}`);
    console.log(`   Type: ${video.copyrightType}`);
    console.log(`   Segments dir: ${segmentsDir}`);

    try {
      // Get list of .ts segment files
      const files = await readdir(segmentsDir);
      const segmentFiles = files.filter(f => f.endsWith('.ts')).sort();

      console.log(`   Found ${segmentFiles.length} segments to encrypt`);

      // Step 1: Generate ONE symmetric key for ALL segments
      console.log('   🔑 Generating symmetric key...');
      const symmetricKey = crypto.randomBytes(32); // 256 bits

      // Step 2: Encrypt each segment with unique IV but same key
      const segments: SegmentEncryption[] = [];

      for (let j = 0; j < segmentFiles.length; j++) {
        const filename = segmentFiles[j];
        const segmentPath = path.join(segmentsDir, filename);

        // Read plaintext segment
        const segmentBuffer = await readFile(segmentPath);

        // Encrypt with unique IV
        const { ciphertext, iv, authTag } = encryptWithSymmetricKey(segmentBuffer, symmetricKey);

        // Overwrite with encrypted version
        await writeFile(segmentPath, ciphertext);

        // Store segment metadata
        segments.push({
          filename,
          iv: iv.toString('base64'),
          authTag: authTag.toString('base64'),
        });

        // Progress indicator
        if ((j + 1) % 5 === 0 || j === segmentFiles.length - 1) {
          console.log(`   🔒 Encrypted ${j + 1}/${segmentFiles.length} segments`);
        }
      }

      console.log('   ✅ All segments encrypted locally');

      // Step 3: Encrypt the symmetric key with Lit Protocol (ONCE per video)
      console.log('   🌐 Encrypting symmetric key with Lit Protocol...');
      const encryptedKeyData = await litClient.encrypt({
        dataToEncrypt: symmetricKey,
        unifiedAccessControlConditions: unifiedAccessControlConditions as any,
        chain: lockChain === 'base-sepolia' ? 'baseSepolia' : lockChain,
      });
      console.log('   ✅ Symmetric key encrypted with Lit\n');

      // Store encryption metadata in manifest
      video.encryption = {
        encryptedSymmetricKey: encryptedKeyData.ciphertext, // Base64 Lit-encrypted key
        dataToEncryptHash: encryptedKeyData.dataToEncryptHash, // Hash for decrypt verification
        unifiedAccessControlConditions,
        segments, // Per-segment IV and authTag
        encryptedAt: new Date().toISOString(),
      };

    } catch (error: any) {
      console.error(`   ❌ Encryption failed: ${error.message}\n`);
      throw error;
    }
  }

  // 6. Save updated manifest
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Updated manifest with encryption metadata');
  console.log(`   Saved to: ${manifestPath}\n`);

  // 7. Disconnect from Lit
  await litClient.disconnect();

  console.log('✅ Encryption Complete!\n');
  console.log('📊 Summary:');
  console.log(`   Videos encrypted: ${videosToEncrypt.length}`);
  console.log(`   Lock address: ${lockAddress}`);
  console.log(`   Access control: Unlock key holders only`);
  console.log(`   Encryption strategy: One key per video, unique IV per segment\n`);

  console.log('📱 Next Steps:');
  console.log('   1. Upload encrypted segments to Grove (bun run upload-grove)');
  console.log('   2. Users must own a valid Unlock key to decrypt');
  console.log('   3. Frontend will decrypt key once, then decrypt segments on-the-fly\n');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run local/3-encrypt-videos.ts --creator @charlidamelio\n');
      process.exit(1);
    }

    await encryptVideos(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
