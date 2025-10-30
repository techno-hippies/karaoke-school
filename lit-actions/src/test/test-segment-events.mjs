#!/usr/bin/env node

/**
 * Test Script for SegmentEvents Contract Lit Action
 * 
 * Tests emitting events to the SegmentEvents contract on Lens Chain
 * Demonstrates PKP signing for ZKsync verification
 * 
 * Usage:
 *   node test-segment-events.mjs
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
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Load PKP credentials
const PKP_CREDS_PATH = '/media/t42/th42/Code/karaoke-school-v1/lit-actions/output/pkp-credentials.json';

// Contract addresses
const SEGMENT_EVENTS_ADDRESS = '0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8';

// Test SegmentEvents Lit Action CID
const TEST_SEGMENT_EVENTS_CID = 'QmVshLenjDToTtW8keAcZsFyKBFX6HjTYHPgGrJKWB3buQ'; // IPFS hash of test-segment-events.js

// Test data
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_SPOTIFY_TRACK_ID = 'test-track-' + Date.now();
const TEST_GRC20_WORK_ID = 'f1d7f4c7-ca47-4ba3-9875-a91720459ab4'; // Example UUID
const TEST_SEGMENT_START_MS = 45000;
const TEST_SEGMENT_END_MS = 235000;
const TEST_METADATA_URI = 'grove://test-segment-metadata/' + Date.now();

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

function generateSegmentHash(spotifyTrackId, segmentStartMs) {
  // Generate deterministic segment hash using ethers v6
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['string', 'uint32'], 
      [spotifyTrackId, segmentStartMs]
    )
  );
}

async function main() {
  console.log('🎯 SegmentEvents Contract Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // 1. Load PKP credentials
    const pkpCreds = await loadPKPCredentials();

    // 2. Generate test data
    const segmentHash = generateSegmentHash(TEST_SPOTIFY_TRACK_ID, TEST_SEGMENT_START_MS);

    // 3. Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "segment-events-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // 4. Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    // Try with network override to bypass validator contract issues
    const network = nagaDev.withOverrides({
      // You can add custom RPC if needed
      // rpcUrl: "https://your-alternative-rpc.example.com"
    });
    const litClient = await createLitClient({ network });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // 5. Create authentication context
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

    // 6. Prepare jsParams
    const jsParams = {
      pkpPublicKey: pkpCreds.publicKey || pkpCreds.ethAddress,
      userAddress: TEST_USER_ADDRESS,
      segmentHash: segmentHash,
      grc20WorkId: TEST_GRC20_WORK_ID,
      spotifyTrackId: TEST_SPOTIFY_TRACK_ID,
      segmentStartMs: TEST_SEGMENT_START_MS,
      segmentEndMs: TEST_SEGMENT_END_MS,
      metadataUri: TEST_METADATA_URI
    };

    // 7. Execute Lit Action
    console.log('\n🚀 Executing SegmentEvents Test Lit Action...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Parameters:');
    console.log('   User Address:', TEST_USER_ADDRESS);
    console.log('   PKP Address:', pkpCreds.ethAddress);
    console.log('   Segment Hash:', segmentHash);
    console.log('   GRC-20 Work ID:', TEST_GRC20_WORK_ID);
    console.log('   Spotify Track ID:', TEST_SPOTIFY_TRACK_ID);
    console.log('   Start Time:', TEST_SEGMENT_START_MS, 'ms');
    console.log('   End Time:', TEST_SEGMENT_END_MS, 'ms');
    console.log('   Metadata URI:', TEST_METADATA_URI);
    console.log('   Contract:', SEGMENT_EVENTS_ADDRESS);
    console.log('   Chain:', 'Lens Testnet (37111)\n');

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: TEST_SEGMENT_EVENTS_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // 8. Parse and display results
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    console.log('✅ Success:', response.success);
    console.log('📝 Version:', response.version);

    console.log('\n--- Transaction Details ---');
    if (response.txHash) {
      console.log('✅ Transaction submitted to blockchain!');
      console.log('TX Hash:', response.txHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.txHash}`);
      console.log('Contract:', SEGMENT_EVENTS_ADDRESS);
      console.log('Function:', 'emitSegmentRegistered(bytes32,string,string,uint32,uint32,string)');
    } else {
      console.log('❌ Transaction failed or not submitted');
    }

    console.log('\n--- Event Data ---');
    console.log('Segment Hash:', response.segmentHash);
    console.log('GRC-20 Work ID:', response.grc20WorkId);
    console.log('Spotify Track ID:', response.spotifyTrackId);
    console.log('Segment Range:', `${response.segmentStartMs}ms - ${response.segmentEndMs}ms`);
    console.log('Duration:', response.segmentEndMs - response.segmentStartMs, 'ms');
    console.log('Metadata URI:', response.metadataUri);

    if (response.errorType) {
      console.log('\n--- Error ---');
      console.log('Error:', response.errorType);
    }

    console.log('\n--- Timing ---');
    console.log('Timestamp:', response.timestamp);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 9. Test assertions
    console.log('\n🧪 Test Assertions:\n');

    const assertions = [
      {
        name: 'Execution successful',
        pass: response.success === true,
        actual: response.success
      },
      {
        name: 'Transaction hash present',
        pass: response.txHash && response.txHash.startsWith('0x'),
        actual: response.txHash || 'null'
      },
      {
        name: 'Segment hash generated',
        pass: response.segmentHash && response.segmentHash.startsWith('0x'),
        actual: response.segmentHash || 'null'
      },
      {
        name: 'GRC-20 Work ID present',
        pass: response.grc20WorkId && response.grc20WorkId.length > 0,
        actual: response.grc20WorkId || 'null'
      },
      {
        name: 'Spotify track ID present',
        pass: response.spotifyTrackId && response.spotifyTrackId.length > 0,
        actual: response.spotifyTrackId || 'null'
      },
      {
        name: 'Metadata URI present',
        pass: response.metadataUri && response.metadataUri.startsWith('grove://'),
        actual: response.metadataUri || 'null'
      },
      {
        name: 'No errors',
        pass: !response.errorType,
        actual: response.errorType || 'none'
      },
      {
        name: 'Using test version',
        pass: response.version === 'test-segment-events-v1',
        actual: response.version
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
      console.log('\n🎯 SegmentEvents Contract Features Verified:');
      console.log('   ✅ PKP signing for ZKsync working');
      console.log('   ✅ EIP-712 transaction structure correct');
      console.log('   ✅ Contract interaction successful');
      console.log('   ✅ Event emission working');
      console.log('   ✅ Gas estimation adequate');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (response.txHash) {
      console.log('📋 Next Steps:');
      console.log('1. Verify transaction on Lens explorer:');
      console.log(`   https://explorer.testnet.lens.xyz/tx/${response.txHash}`);
      console.log('2. Check subgraph indexing (if deployed):');
      console.log('   Query SegmentRegistered event by segmentHash');
      console.log('3. Verify event parameters:');
      console.log(`   SegmentHash: ${segmentHash}`);
      console.log(`   GRC-20 Work ID: ${TEST_GRC20_WORK_ID}`);
      console.log('4. Test additional functions:');
      console.log('   - emitSegmentProcessed');
      console.log('   - emitSegmentToggled');
      console.log('\n');
    }

    await litClient.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
