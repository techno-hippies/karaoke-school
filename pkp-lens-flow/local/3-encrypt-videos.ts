#!/usr/bin/env bun
/**
 * Step 3: Encrypt Videos with Lit Protocol (Hybrid Encryption)
 *
 * Uses symmetric encryption for videos (AES-256-GCM), then encrypts
 * the symmetric key with Lit Protocol access control conditions.
 *
 * Flow:
 * 1. Generate random AES-256 key per video
 * 2. Encrypt video locally with symmetric key
 * 3. Use Lit Protocol to encrypt the symmetric key with Unlock ACC
 * 4. Store encrypted video + encrypted key metadata
 *
 * Prerequisites:
 * - Unlock lock deployed (from step 2.5)
 * - Videos downloaded locally (from crawler)
 * - data/videos/{handle}/manifest.json exists
 *
 * Usage:
 *   bun run local/3-encrypt-videos.ts --creator @charlidamelio
 *
 * Output:
 *   - Encrypted video files (replaces plaintext videos)
 *   - Updated manifest with encryption metadata
 */

import { readFile, writeFile } from 'fs/promises';
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

interface VideoData {
  postId: string;
  copyrightType: string;
  localFiles: {
    video: string | null;
    thumbnail: string | null;
  };
  encryption?: {
    encryptedSymmetricKey: string; // Lit-encrypted symmetric key (base64)
    dataToEncryptHash: string; // Hash for Lit decrypt verification
    iv: string; // AES-GCM IV (base64)
    authTag: string; // AES-GCM auth tag (base64)
    unifiedAccessControlConditions: any[]; // v8 unified format
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
  console.log('\n🔐 Step 3: Encrypting Videos with Lit Protocol');
  console.log('═══════════════════════════════════════════════════\n');

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
    v.localFiles.video && v.copyrightType === 'copyrighted'
  );
  const copyrightFreeCount = manifest.videos.filter(v => v.copyrightType === 'copyright-free').length;

  console.log(`📹 Found ${videosToEncrypt.length} copyrighted videos to encrypt`);
  console.log(`📹 Found ${copyrightFreeCount} copyright-free videos (will remain unencrypted)\n`);

  if (videosToEncrypt.length === 0) {
    console.log('⚠️  No videos found. Run crawler first.\n');
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

  // 5. Encrypt each video
  for (let i = 0; i < videosToEncrypt.length; i++) {
    const video = videosToEncrypt[i];

    // Skip if already encrypted
    if (video.encryption) {
      console.log(`⏭️  Skipping video ${i + 1}/${videosToEncrypt.length} (already encrypted)`);
      console.log(`   Post ID: ${video.postId}\n`);
      continue;
    }

    let relativePath = video.localFiles.video!;

    // Manifest stores paths relative to crawler directory (../../data/...)
    // Strip the ../../ prefix to get path relative to project root
    if (relativePath.startsWith('../../')) {
      relativePath = relativePath.substring(6);
    }

    // Convert to absolute path from project root
    const videoPath = path.join(process.cwd(), relativePath);

    console.log(`🔐 Encrypting video ${i + 1}/${videosToEncrypt.length}`);
    console.log(`   Post ID: ${video.postId}`);
    console.log(`   Type: ${video.copyrightType}`);
    console.log(`   File: ${videoPath}`);

    try {
      // Read video file
      const videoBuffer = await readFile(videoPath);
      console.log(`   Size: ${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Step 1: Generate random AES-256 key
      console.log('   🔑 Generating symmetric key...');
      const symmetricKey = crypto.randomBytes(32); // 256 bits

      // Step 2: Encrypt video locally with AES-256-GCM
      console.log('   🔒 Encrypting video with AES-256-GCM...');
      const { ciphertext, iv, authTag } = encryptWithSymmetricKey(videoBuffer, symmetricKey);
      console.log('   ✅ Video encrypted locally');

      // Step 3: Encrypt the symmetric key with Lit Protocol
      console.log('   🌐 Encrypting symmetric key with Lit Protocol...');
      const encryptedKeyData = await litClient.encrypt({
        dataToEncrypt: symmetricKey,
        unifiedAccessControlConditions: unifiedAccessControlConditions as any,
        chain: lockChain === 'base-sepolia' ? 'baseSepolia' : lockChain,
      });
      console.log('   ✅ Symmetric key encrypted with Lit');

      // Step 4: Save encrypted video
      await writeFile(videoPath, ciphertext);
      console.log('   💾 Saved encrypted video\n');

      // Store encryption metadata in manifest
      video.encryption = {
        encryptedSymmetricKey: encryptedKeyData.ciphertext, // Base64 Lit-encrypted key
        dataToEncryptHash: encryptedKeyData.dataToEncryptHash, // Hash for decrypt verification
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        unifiedAccessControlConditions,
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
  console.log(`   Access control: Unlock key holders only\n`);

  console.log('📱 Next Steps:');
  console.log('   1. Upload encrypted videos to Grove (bun run upload-grove)');
  console.log('   2. Users must own a valid Unlock key to decrypt');
  console.log('   3. Decryption requires Lit Protocol v8 authentication (nagaDev)\n');
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
