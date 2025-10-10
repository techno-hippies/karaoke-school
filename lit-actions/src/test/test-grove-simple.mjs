#!/usr/bin/env node

/**
 * Test Script for Simple Grove Upload
 *
 * Tests uploading a simple JSON object to Grove via Lit Action
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

// CID for simple Grove upload test
const GROVE_TEST_CID = 'QmcMNvaxk9ZgnmomTgczdWBZdveRGrn41c6UDpaQJcPLU1';

async function main() {
  console.log('🌳 Simple Grove Upload Test\n');
  console.log('━'.repeat(80));

  try {
    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "grove-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // Create authentication context
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

    // Execute the Lit Action
    console.log('\n🚀 Executing Grove upload test...');
    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: GROVE_TEST_CID,
      authContext: authContext,
      jsParams: {},
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Execution completed');
    console.log(`⏱️  Execution time: ${(executionTime / 1000).toFixed(1)}s\n`);

    // Parse and display results
    console.log('━'.repeat(80));
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    if (!response.success) {
      console.log('❌ Upload failed:', response.error);
      if (response.stack) {
        console.log('Stack trace:', response.stack.substring(0, 500));
      }
      await litClient.disconnect();
      process.exit(1);
    }

    console.log('✅ Success!');
    console.log(`📦 CID: ${response.cid}`);
    console.log(`🔑 Storage Key: ${response.storageKey || 'N/A'}`);
    console.log(`🔗 URI: ${response.uri || 'N/A'}`);
    console.log(`🌐 Gateway URL: ${response.gatewayUrl || 'N/A'}`);
    console.log(`📏 Data size: ${response.dataSize} bytes`);
    console.log('\n🔍 Raw Grove Response:');
    console.log(JSON.stringify(response.rawGroveResponse, null, 2));
    console.log('\nTest data uploaded:');
    console.log(JSON.stringify(response.testData, null, 2));

    console.log('\n━'.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY! 🎉');
    console.log('━'.repeat(80));

    await litClient.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
