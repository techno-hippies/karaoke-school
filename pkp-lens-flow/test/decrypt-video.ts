#!/usr/bin/env bun
/**
 * Test: Decrypt and Download Video (Hybrid Decryption)
 *
 * Full end-to-end test:
 * 1. Check test account has valid Unlock key
 * 2. Read encrypted video from local storage
 * 3. Use Lit Protocol to decrypt the symmetric key (proving key ownership)
 * 4. Decrypt video locally with AES-256-GCM
 * 5. Save decrypted video to test/output/
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';

/**
 * Decrypt data with AES-256-GCM using a symmetric key
 */
function decryptWithSymmetricKey(
  ciphertext: Buffer,
  key: Buffer,
  iv: Buffer,
  authTag: Buffer
): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
}

// PublicLock ABI
const PUBLIC_LOCK_ABI = [
  {
    inputs: [{ type: 'address' }],
    name: 'getHasValidKey',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface LensData {
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
  };
  encryption?: {
    encryptedSymmetricKey: string; // Lit-encrypted symmetric key (base64)
    dataToEncryptHash: string; // Hash for Lit decrypt verification
    iv: string; // AES-GCM IV (base64)
    authTag: string; // AES-GCM auth tag (base64)
    unifiedAccessControlConditions: any[]; // v8 unified format
  };
}

interface Manifest {
  videos: VideoData[];
}

async function decryptVideo(creator: string) {
  console.log('\n🔓 Decrypt & Download Video Test');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Load test account
  const testAccountPath = path.join(process.cwd(), 'test', 'test-account.json');
  let testAccount;

  try {
    const testAccountData = JSON.parse(await readFile(testAccountPath, 'utf-8'));
    const privateKey = testAccountData.privateKey as `0x${string}`;
    testAccount = privateKeyToAccount(privateKey);
    console.log(`👤 Test Account: ${testAccount.address}\n`);
  } catch (error) {
    console.error('❌ Test account not found!\n');
    console.log('Generate test account first:');
    console.log('   bun run test:generate-account\n');
    throw new Error('Test account required');
  }

  // 2. Load lock address
  const cleanHandle = creator.replace('@', '');
  const lensPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  const lensData: LensData = JSON.parse(await readFile(lensPath, 'utf-8'));

  if (!lensData.subscriptionLock?.address) {
    throw new Error('Lock not found');
  }

  const lockAddress = lensData.subscriptionLock.address as `0x${string}`;
  console.log(`🔒 Lock Address: ${lockAddress}\n`);

  // 3. Verify test account has valid key
  console.log('🔍 Verifying subscription key...');
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const hasValidKey = await publicClient.readContract({
    address: lockAddress,
    abi: PUBLIC_LOCK_ABI,
    functionName: 'getHasValidKey',
    args: [testAccount.address],
  });

  if (!hasValidKey) {
    console.log('❌ No valid subscription key!\n');
    console.log('Purchase a key first:');
    console.log('   bun run test:purchase-key @charlidamelio\n');
    throw new Error('Valid subscription key required');
  }

  console.log('✅ Valid subscription key confirmed\n');

  // 4. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  const manifest: Manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));

  // Pick first encrypted video
  const encryptedVideo = manifest.videos.find(v => v.encryption && v.localFiles.video);

  if (!encryptedVideo) {
    throw new Error('No encrypted videos found');
  }

  console.log(`📹 Selected Video:`);
  console.log(`   Post ID: ${encryptedVideo.postId}`);
  console.log(`   Type: ${encryptedVideo.copyrightType}\n`);

  // 5. Read encrypted video file
  let encryptedVideoPath = encryptedVideo.localFiles.video!;

  // Handle relative path
  if (encryptedVideoPath.startsWith('../../')) {
    encryptedVideoPath = encryptedVideoPath.substring(6);
  }
  encryptedVideoPath = path.join(process.cwd(), encryptedVideoPath);

  console.log('📂 Reading encrypted video...');
  const encryptedVideoCiphertext = await readFile(encryptedVideoPath);
  console.log(`   Size: ${(encryptedVideoCiphertext.length / 1024 / 1024).toFixed(2)} MB`);

  // Get encryption metadata
  const { encryptedSymmetricKey, dataToEncryptHash, iv, authTag, unifiedAccessControlConditions } = encryptedVideo.encryption!;
  console.log('   Loaded encryption metadata\n');

  // 6. Connect to Lit Protocol
  console.log('🔗 Connecting to Lit Protocol...');
  const litClient = await createLitClient({
    network: nagaDev,
  });
  console.log('✅ Connected to Lit Protocol\n');

  // 7. Create auth manager and auth context
  console.log('🔐 Creating auth context...');

  const authManager = createAuthManager({
    account: testAccount,
    litClient,
    storage: storagePlugins.localStorageNode({
      appName: 'pkp-lens-flow',
      networkName: 'nagaDev',
      storagePath: path.join(process.cwd(), 'test', '.lit-auth-cache'),
    }),
  });

  const authContext = await authManager.createEoaAuthContext({
    config: {
      account: testAccount,
    },
    authConfig: {
      domain: 'localhost',
      statement: 'Decrypt subscription content',
      resources: [
        ['access-control-condition-decryption', '*'],
      ],
      expiration: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    },
    litClient,
  });

  console.log('✅ Auth context created\n');

  // 8. Decrypt symmetric key with Lit Protocol
  console.log('🔓 Decrypting symmetric key...');
  console.log('   (This proves you own a valid Unlock key)\n');

  console.log('🔍 Unified Access Control Conditions:');
  console.log('   Contract:', unifiedAccessControlConditions[0].contractAddress);
  console.log('   Chain:', unifiedAccessControlConditions[0].chain);
  console.log('   Function:', unifiedAccessControlConditions[0].functionName);
  console.log('   Condition: must return true for :userAddress\n');

  try {
    console.log('🌐 Decrypting with Lit Protocol...');

    const decryptedKeyResponse = await litClient.decrypt({
      ciphertext: encryptedSymmetricKey,
      dataToEncryptHash,
      unifiedAccessControlConditions: unifiedAccessControlConditions as any,
      authContext,
      chain: 'baseSepolia',
    });

    console.log('✅ Symmetric key decrypted!\n');

    // 10. Decrypt video locally with AES-256-GCM
    console.log('🔒 Decrypting video with AES-256-GCM...');
    const decryptedData = (decryptedKeyResponse as any).decryptedData;
    const symmetricKeyBuffer = Buffer.from(decryptedData);
    const ivBuffer = Buffer.from(iv, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');

    const decryptedVideoBuffer = decryptWithSymmetricKey(
      encryptedVideoCiphertext,
      symmetricKeyBuffer,
      ivBuffer,
      authTagBuffer
    );

    console.log('✅ Video decrypted successfully!\n');

    // 11. Save decrypted video
    const outputDir = path.join(process.cwd(), 'test', 'output');
    await mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, `decrypted_${encryptedVideo.postId}.mp4`);
    await writeFile(outputPath, decryptedVideoBuffer);

    console.log('💾 Decrypted video saved to:');
    console.log(`   ${outputPath}\n`);

    const decryptedSize = (decryptedVideoBuffer.length / 1024 / 1024).toFixed(2);
    console.log('📊 File Info:');
    console.log(`   Encrypted size: ${(encryptedVideoCiphertext.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Decrypted size: ${decryptedSize} MB\n`);

    console.log('🎉 Success! You can now watch the video:\n');
    console.log(`   open ${outputPath}\n`);
    console.log('   or');
    console.log(`   vlc ${outputPath}\n`);

  } catch (error: any) {
    console.error('❌ Decryption failed:', error.message);
    console.log('\nPossible reasons:');
    console.log('   • Access control condition not met (shouldn\'t happen - we verified key)');
    console.log('   • Lit Protocol network issue');
    console.log('   • Encryption metadata mismatch\n');
    throw error;
  } finally {
    await litClient.disconnect();
  }

  console.log('✨ Test Complete!\n');
}

async function main() {
  const creator = process.argv[2];

  if (!creator) {
    console.error('\n❌ Error: Creator argument required\n');
    console.log('Usage: bun run test/decrypt-video.ts @charlidamelio\n');
    process.exit(1);
  }

  await decryptVideo(creator);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
