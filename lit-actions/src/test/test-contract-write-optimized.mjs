#!/usr/bin/env node

/**
 * Test Script: Optimized Contract Write
 *
 * Tests the complete flow:
 * 1. Optimize ElevenLabs alignment data (remove loss, round decimals)
 * 2. Upload to Grove
 * 3. Write Grove URI to contract's metadataUri field
 *
 * Usage:
 *   bun run src/test/test-contract-write-optimized.mjs [--write]
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Load PKP credentials
const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');

// Contract configuration
const KARAOKE_CATALOG_ADDRESS = '0x0843DDB2F2ceCAB0644Ece0523328af2C7882032'; // Base Sepolia
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

// CID will be set after upload
let TEST_CID = null;

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function main() {
  console.log('📝 Optimized Contract Write Test\n');
  console.log('━'.repeat(80));
  console.log('\nThis test will:');
  console.log('1. Optimize alignment data (remove loss, round to 2 decimals)');
  console.log('2. Upload optimized data to Grove');
  console.log('3. [Optional] Write Grove URI to contract metadataUri field');
  console.log('\n━'.repeat(80));

  // Check for --write flag
  const writeToBlockchain = process.argv.includes('--write');
  if (!writeToBlockchain) {
    console.log('\n⚠️  Running in DRY RUN mode (no contract write)');
    console.log('   Use --write flag to enable blockchain writing');
  }

  try {
    // Load PKP credentials
    const pkpCreds = await loadPKPCredentials();

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "contract-write-test",
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
          },
          {
            resource: new LitPKPResource('*'),
            ability: 'pkp-signing'
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('✅ Auth context created');

    // CID for test-contract-write-optimized.js
    TEST_CID = 'QmaPio4KFhyKTtuAqstAHg5B9xLeWaMqDLqsVeWkGhb67L';

    const jsParams = {
      pkpPublicKey: pkpCreds.publicKey,
      pkpAddress: pkpCreds.ethAddress,
      contractAddress: KARAOKE_CATALOG_ADDRESS,
      writeToBlockchain: writeToBlockchain
    };

    console.log('\n🚀 Executing Lit Action...');
    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: TEST_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Execution completed');
    console.log(`⏱️  Execution time: ${(executionTime / 1000).toFixed(1)}s\n`);

    // Parse and display results
    console.log('━'.repeat(80));
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    if (!response.success) {
      console.log('❌ Test failed:', response.error);
      if (response.stack) {
        console.log('Stack trace:', response.stack.substring(0, 500));
      }
      await litClient.disconnect();
      process.exit(1);
    }

    console.log('✅ Success!\n');

    // Display optimization results
    console.log('--- Data Optimization ---');
    console.log(`Original size: ${response.optimization.originalSize} bytes`);
    console.log(`Optimized size: ${response.optimization.optimizedSize} bytes`);
    console.log(`Reduction: ${response.optimization.reduction}`);
    console.log(`Words count: ${response.optimization.wordsCount}`);

    // Display Grove upload results
    console.log('\n--- Grove Upload ---');
    console.log(`✅ Upload successful`);
    console.log(`Storage Key: ${response.grove.storageKey}`);
    console.log(`URI: ${response.grove.uri}`);
    console.log(`Gateway: ${response.grove.gatewayUrl}`);

    // Display contract write results
    console.log('\n--- Contract Write ---');
    if (response.contract.txHash) {
      console.log(`✅ Transaction submitted: ${response.contract.txHash}`);
      console.log(`🔍 Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${response.contract.txHash}`);
      console.log(`📝 Contract: ${KARAOKE_CATALOG_ADDRESS}`);
      console.log(`📦 Metadata URI: ${response.contract.metadataUri}`);
    } else if (response.contract.error) {
      console.log(`❌ Contract Error: ${response.contract.error}`);
    } else {
      console.log('⏭️  Skipped (dry run mode)');
      console.log(`📦 Metadata URI (would be written): ${response.contract.metadataUri}`);
    }

    // Display sample data
    console.log('\n--- Sample Data (First 3 Words) ---');
    response.sample.forEach((word, i) => {
      console.log(`${i + 1}. "${word.text}" (${word.start}s - ${word.end}s)`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('✅ TEST COMPLETED SUCCESSFULLY! 🎉');
    console.log('━'.repeat(80));

    if (!writeToBlockchain) {
      console.log('\n💡 To test contract write, run: bun run src/test/test-contract-write-optimized.mjs --write');
    }

    await litClient.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
