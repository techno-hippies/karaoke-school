#!/usr/bin/env node

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const LIT_ACTION_CID = 'QmbV3NTurgXwMqkaAD1z8t43iWAPNoBMHW9cMWk1LjTbfB';
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_SEGMENT_HASH = `0x${'a'.repeat(64)}`;
const TEST_ATTEMPT_ID = Date.now();

async function loadVoxtralEncryptedKey() {
  const keyPath = join(__dirname, '../keys/voxtral_api_key.json');
  return JSON.parse(await readFile(keyPath, 'utf-8'));
}

async function loadTestAudio() {
  const audioPath = join(__dirname, 'hey-im-scarlett-how-are-you-doing.wav');
  const audioBuffer = await readFile(audioPath);
  return audioBuffer.toString('base64');
}

async function main() {
  console.log('🎤 Exercise Grader PKP Signing Test (nagaTest)\n');
  console.log('CID:', LIT_ACTION_CID);
  console.log('Network: nagaTest');
  console.log('Test Mode: FALSE (PKP signing enabled)\n');

  const audioDataBase64 = await loadTestAudio();
  const voxtralEncryptedKey = await loadVoxtralEncryptedKey();

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "exercise-grader-pkp-test",
      networkName: "naga-test",
      storagePath: "./lit-auth-storage"
    }),
  });

  console.log('⚡ Connecting to nagaTest...');
  const litClient = await createLitClient({ network: nagaTest });
  console.log('✅ Connected\n');

  const testPrivateKey = '0x' + '0'.repeat(63) + '1';
  const viemAccount = privateKeyToAccount(testPrivateKey);

  const authContext = await authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
      resources: [{
        resource: new LitActionResource('*'),
        ability: 'lit-action-execution'
      }]
    },
    config: { account: viemAccount },
    litClient
  });

  const jsParams = {
    exerciseType: 'SAY_IT_BACK',
    audioDataBase64,
    userAddress: TEST_USER_ADDRESS,
    segmentHash: TEST_SEGMENT_HASH,
    attemptId: TEST_ATTEMPT_ID,
    metadataUri: 'grove://test123',
    expectedText: "Hey I'm Scarlett, how are you doing?",
    language: "en",
    voxtralEncryptedKey,
    lineId: '0x64befe066b9b4a39813f96144552a1de00000000000000000000000000000000',
    lineIndex: 8,
    testMode: false,  // *** PKP SIGNING ENABLED ***
  };

  console.log('🚀 Executing Exercise Grader with PKP signing...\n');

  const start = Date.now();
  const result = await litClient.executeJs({
    ipfsId: LIT_ACTION_CID,
    authContext,
    jsParams,
  });
  const elapsed = Date.now() - start;

  console.log('✅ Execution finished in', elapsed, 'ms\n');
  
  const response = JSON.parse(result.response);
  console.log('Response:', JSON.stringify(response, null, 2));
  
  if (response.success && response.txHash) {
    console.log('\n✅ PKP SIGNING WORKS IN EXERCISE GRADER!');
    console.log('TX Hash:', response.txHash);
    console.log('Execution time:', response.executionTime, 'ms');
    await litClient.disconnect();
    process.exit(0);
  } else {
    console.log('\n❌ PKP signing failed');
    console.log('Error:', response.errorType);
    await litClient.disconnect();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
