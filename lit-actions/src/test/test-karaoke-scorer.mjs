#!/usr/bin/env node

/**
 * Test Script for Karaoke Scorer v1 Lit Action
 *
 * Tests the complete flow:
 * 1. Load test audio (test-audio.mp3: "one two three four, this is me opening a door")
 * 2. Convert to base64
 * 3. Call karaoke-scorer-v1.js Lit Action
 * 4. Verify transcription
 * 5. Verify score calculation
 * 6. Verify contract submission
 *
 * Prerequisites:
 * - Lit Action uploaded to IPFS (or use inline code)
 * - Encrypted Voxstral API key
 * - Encrypted contract address
 * - PKP with sign-anything permissions
 *
 * Usage:
 *   bun run test:scorer
 *   # or
 *   node src/test/test-karaoke-scorer.mjs
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Load PKP credentials from contracts output
const PKP_CREDS_PATH = '/media/t42/th42/Code/site/contracts/output/pkp-credentials.json';
const CONTRACT_DEPLOYED_ADDRESS = '0x8D14f835fdA7b5349f6f1b1963EBA54FD058CF6A';

// Test data
const EXPECTED_LYRICS = "one two three four this is me opening a door";
const TEST_CLIP_ID = "test-clip-1";
const TEST_USER_ADDRESS = "0x0C6433789d14050aF47198B2751f6689731Ca79C"; // Your deployer wallet for testing

async function loadTestAudio() {
  console.log('📁 Loading test audio...');
  const audioPath = join(__dirname, 'test-audio.mp3');
  const audioBuffer = await readFile(audioPath);
  const audioBase64 = audioBuffer.toString('base64');
  console.log(`✅ Audio loaded: ${audioBuffer.length} bytes → ${audioBase64.length} chars base64`);
  return audioBase64;
}

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function loadVoxstralKey() {
  console.log('📦 Loading pre-encrypted Voxstral API key...');
  const keyPath = join(__dirname, '../stt/keys/voxstral_api_key.json');
  const encryptedKey = JSON.parse(await readFile(keyPath, 'utf-8'));
  console.log('✅ Voxstral API key loaded (locked to CID:', encryptedKey.cid + ')');

  return {
    ciphertext: encryptedKey.ciphertext,
    dataToEncryptHash: encryptedKey.dataToEncryptHash,
    accessControlConditions: encryptedKey.accessControlConditions
  };
}

async function loadOrEncryptContractAddress(litClient) {
  console.log('📦 Loading contract address encryption...');
  const keyPath = join(__dirname, '../stt/keys/contract_address.json');

  try {
    const encryptedContract = JSON.parse(await readFile(keyPath, 'utf-8'));
    console.log('✅ Contract address loaded (pre-encrypted)');

    return {
      ciphertext: encryptedContract.ciphertext,
      dataToEncryptHash: encryptedContract.dataToEncryptHash,
      accessControlConditions: encryptedContract.accessControlConditions
    };
  } catch (error) {
    console.log('⚠️  Contract address not encrypted yet, encrypting now...');

    // Same ACCs as Voxstral key (locked to IPFS CID)
    const voxstralKey = await loadVoxstralKey();

    const encryptedData = await litClient.encrypt({
      dataToEncrypt: CONTRACT_DEPLOYED_ADDRESS,
      unifiedAccessControlConditions: voxstralKey.accessControlConditions,
      chain: 'ethereum'
    });

    const contractEncrypted = {
      ciphertext: encryptedData.ciphertext,
      dataToEncryptHash: encryptedData.dataToEncryptHash,
      accessControlConditions: voxstralKey.accessControlConditions,
      encryptedAt: new Date().toISOString(),
      contractAddress: CONTRACT_DEPLOYED_ADDRESS,
      network: 'lens-testnet'
    };

    // Save for future use
    await mkdir(dirname(keyPath), { recursive: true });
    await writeFile(keyPath, JSON.stringify(contractEncrypted, null, 2));
    console.log('✅ Contract address encrypted and saved to:', keyPath);

    return {
      ciphertext: contractEncrypted.ciphertext,
      dataToEncryptHash: contractEncrypted.dataToEncryptHash,
      accessControlConditions: contractEncrypted.accessControlConditions
    };
  }
}

async function main() {
  console.log('🎤 Karaoke Scorer v1 Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Load test data
    const audioDataBase64 = await loadTestAudio();
    const pkpCreds = await loadPKPCredentials();

    // 2. Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "karaoke-scorer-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // 3. Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // 4. Create authentication context
    console.log('\n🔐 Creating authentication context...');
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in .env');
    }

    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const viemAccount = privateKeyToAccount(cleanPrivateKey);

    const authContext = await authManager.createEoaAuthContext({
      authConfig: {
        chain: 'ethereum',
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        resources: [
          {
            resource: new LitActionResource('*'),
            ability: 'lit-action-execution'
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('✅ Auth context created');

    // 5. Load pre-encrypted secrets
    const voxstralEncrypted = await loadVoxstralKey();
    const contractEncrypted = await loadOrEncryptContractAddress(litClient);

    // 6. Use IPFS CID for Lit Action
    console.log('\n📦 Using Lit Action from IPFS...');
    const IPFS_CID = 'QmZLFxWYVm7LFGHkdRaEwpngVDwvLzqbcPPvQo6DTRdjuu';
    console.log('✅ CID:', IPFS_CID);

    // 7. Prepare jsParams
    const jsParams = {
      audioDataBase64,
      userAddress: TEST_USER_ADDRESS,
      clipId: TEST_CLIP_ID,
      expectedLyrics: EXPECTED_LYRICS,
      pkpPublicKey: pkpCreds.publicKey || pkpCreds.ethAddress, // PKP public key
      language: 'en',
      sessionId: `test-${Date.now()}`,

      // Voxstral encryption params
      accessControlConditions: voxstralEncrypted.accessControlConditions,
      ciphertext: voxstralEncrypted.ciphertext,
      dataToEncryptHash: voxstralEncrypted.dataToEncryptHash,

      // Contract encryption params
      contractAddressCiphertext: contractEncrypted.ciphertext,
      contractAddressDataToEncryptHash: contractEncrypted.dataToEncryptHash,
      contractAddressAccessControlConditions: contractEncrypted.accessControlConditions,
    };

    // 8. Execute Lit Action
    console.log('\n🚀 Executing Lit Action...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Parameters:');
    console.log('   Clip ID:', TEST_CLIP_ID);
    console.log('   User:', TEST_USER_ADDRESS);
    console.log('   Expected:', EXPECTED_LYRICS);
    console.log('   Audio size:', audioDataBase64.length, 'chars\n');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: IPFS_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // 9. Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    console.log('✅ Success:', response.success);
    console.log('📝 Version:', response.version);
    console.log('\n--- Transcription ---');
    console.log('Transcript:', response.transcript || '(none)');
    console.log('Expected:  ', EXPECTED_LYRICS);

    console.log('\n--- Score ---');
    console.log('Score:', response.score, '/ 100');

    console.log('\n--- Contract Submission ---');
    if (response.txHash) {
      console.log('✅ Transaction submitted!');
      console.log('TX Hash:', response.txHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.txHash}`);
    } else if (response.txHash === null && !response.error) {
      console.log('⏳ Transaction pending or not yet confirmed');
    } else {
      console.log('❌ Transaction failed or not submitted');
    }

    if (response.error) {
      console.log('\n--- Error ---');
      console.log('Error:', response.error);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 10. Test assertions
    console.log('\n🧪 Test Assertions:\n');

    const assertions = [
      {
        name: 'Execution successful',
        pass: response.success === true,
        actual: response.success
      },
      {
        name: 'Transcript returned',
        pass: response.transcript && response.transcript.length > 0,
        actual: response.transcript ? `"${response.transcript.substring(0, 50)}..."` : 'null'
      },
      {
        name: 'Score calculated (0-100)',
        pass: typeof response.score === 'number' && response.score >= 0 && response.score <= 100,
        actual: response.score
      },
      {
        name: 'Transaction hash present',
        pass: response.txHash && response.txHash.startsWith('0x'),
        actual: response.txHash || 'null'
      },
      {
        name: 'No errors',
        pass: !response.error,
        actual: response.error || 'none'
      }
    ];

    assertions.forEach((assertion, i) => {
      const status = assertion.pass ? '✅' : '❌';
      console.log(`${i + 1}. ${status} ${assertion.name}`);
      if (!assertion.pass) {
        console.log(`   Expected: true, Got: ${assertion.actual}`);
      }
    });

    const allPassed = assertions.every(a => a.pass);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED! 🎉');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await litClient.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
