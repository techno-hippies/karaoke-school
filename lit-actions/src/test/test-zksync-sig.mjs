#!/usr/bin/env node

/**
 * Minimal zkSync Signature Test
 * Tests ONLY signing and transaction submission - no audio, no encryption
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const PKP_CREDS_PATH = '/media/t42/th42/Code/site/root/lit-actions/output/pkp-credentials.json';
const LIT_ACTION_PATH = '/media/t42/th42/Code/site/root/lit-actions/src/test/zksync-sig-test.js';

async function main() {
  console.log('🧪 zkSync EIP-712 Signature Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Load PKP credentials
    console.log('🔑 Loading PKP credentials...');
    const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
    console.log(`✅ PKP loaded: ${pkpData.ethAddress}\n`);

    // Load Lit Action code
    console.log('📄 Loading Lit Action...');
    const litActionCode = await readFile(LIT_ACTION_PATH, 'utf-8');
    console.log('✅ Lit Action loaded\n');

    // Set up Auth Manager
    console.log('🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "zksync-sig-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created\n');

    // Connect to Lit
    console.log('🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network\n');

    // Create authentication context
    console.log('🔐 Creating authentication context...');
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

    console.log('✅ Auth context created\n');

    // Prepare jsParams - minimal, no encryption needed
    // Use a proper test address instead of timestamp-based (which has leading zeros)
    const testUserAddress = '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049';
    const jsParams = {
      pkpPublicKey: pkpData.publicKey || pkpData.ethAddress,
      userAddress: testUserAddress,
      testScore: 100
    };

    console.log('📝 Test Parameters:');
    console.log('   PKP:', pkpData.ethAddress);
    console.log('   User:', testUserAddress);
    console.log('   Score:', 100);
    console.log();

    // Execute Lit Action
    console.log('🚀 Executing Lit Action...\n');
    const startTime = Date.now();

    const result = await litClient.executeJs({
      code: litActionCode,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\n');

    const response = typeof result.response === 'string' ? JSON.parse(result.response) : result.response;
    console.log(JSON.stringify(response, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Test assertions
    console.log('\n🧪 Test Result:\n');

    if (response.success) {
      console.log('✅ SUCCESS! Transaction submitted');
      console.log(`   TX Hash: ${response.txHash}`);
      console.log(`   Explorer: https://explorer.testnet.lens.xyz/tx/${response.txHash}`);
    } else {
      console.log('❌ FAILED');
      console.log(`   Error: ${response.error}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await litClient.disconnect();
    process.exit(response.success ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
