#!/usr/bin/env node

/**
 * Test Script for Match and Segment v2 Lit Action
 *
 * Tests song metadata preparation pipeline with combined query:
 * - Genius API → Song metadata
 * - LRClib API → Synced lyrics
 * - GPT-5-nano → Single query for match + segmentation
 *
 * Usage:
 *   bun run test:match-segment-v2
 *   bun run test:match-segment-v2 [genius-id]
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// Load PKP credentials
const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');

// Test songs
const TEST_SONGS = [
  {
    geniusId: 378195,
    name: 'Sia - Chandelier',
    expectSuccess: true,
    notes: 'Known good: has LRClib lyrics, SoundCloud link, full audio'
  },
  {
    geniusId: 395791,
    name: 'ABBA - Dancing Queen',
    expectSuccess: true,
    notes: 'Classic song with good lyrics availability'
  },
  {
    geniusId: 5665448,
    name: 'Blackpink - How You Like That',
    expectSuccess: true,
    notes: 'Mixed Korean/English lyrics - testing unicode handling'
  },
  {
    geniusId: 7076626,
    name: 'Unknown Song 7076626',
    expectSuccess: true,
    notes: 'User requested test'
  }
];

// CID for match-and-segment-v2 (Fire-and-forget with runOnce)
const MATCH_AND_SEGMENT_V2_CID = 'QmPkTKZjcvTZs74B6RdABGxiz9kcGaBWJGQjhH1Zw9wZj2';

// Encrypted key paths
const OPENROUTER_KEY_PATH = join(__dirname, '../karaoke/keys/openrouter_api_key_v6.json');
const GENIUS_KEY_PATH = join(__dirname, '../karaoke/keys/genius_api_key_v6.json');

// Contract configuration
const KARAOKE_CATALOG_ADDRESS = '0x0843DDB2F2ceCAB0644Ece0523328af2C7882032'; // Base Sepolia
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function checkPKPBalance(pkpAddress) {
  console.log('\n💰 Checking PKP balance on Base Sepolia...');
  try {
    const response = await fetch('https://sepolia.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [pkpAddress, 'latest'],
        id: 1
      })
    });
    const data = await response.json();
    const balanceWei = BigInt(data.result);
    const balanceEth = Number(balanceWei) / 1e18;

    console.log(`   Balance: ${balanceEth.toFixed(6)} ETH`);

    if (balanceWei === 0n) {
      console.log('   ⚠️  WARNING: PKP has no ETH on Base Sepolia!');
      console.log('   ⚠️  Blockchain writes will fail without gas.');
      console.log('   ⚠️  Fund the PKP at:', pkpAddress);
      console.log('   ⚠️  Get testnet ETH from: https://www.coinbase.com/faucets');
    } else if (balanceWei < 1000000000000000n) { // < 0.001 ETH
      console.log('   ⚠️  Low balance - may not be enough for gas fees');
    } else {
      console.log('   ✅ Sufficient balance for gas fees');
    }

    return balanceEth;
  } catch (error) {
    console.log('   ❌ Failed to check balance:', error.message);
    return null;
  }
}

async function loadEncryptedKeys() {
  console.log('🔐 Loading encrypted API keys...');

  const [openrouterKey, geniusKey] = await Promise.all([
    readFile(OPENROUTER_KEY_PATH, 'utf-8').then(JSON.parse),
    readFile(GENIUS_KEY_PATH, 'utf-8').then(JSON.parse)
  ]);

  console.log('✅ Encrypted keys loaded');
  console.log(`   OpenRouter CID: ${openrouterKey.cid || 'N/A'}`);
  console.log(`   Genius CID: ${geniusKey.cid || 'N/A'}`);

  return { openrouterKey, geniusKey };
}

async function testSong(geniusId, songName, litClient, authContext, pkpCreds, encryptedKeys) {
  console.log('\n' + '='.repeat(80));
  console.log(`🎵 Testing: ${songName} (Genius ID: ${geniusId})`);
  console.log('='.repeat(80));

  const { openrouterKey, geniusKey } = encryptedKeys;

  // Prepare jsParams
  // PKP public key should be the uncompressed public key (130 chars without 04 prefix)
  // If not available, we'll need to query it from the Lit network
  const pkpPublicKey = pkpCreds.publicKey;

  if (!pkpPublicKey) {
    console.log('   ⚠️  WARNING: PKP public key not found in credentials!');
    console.log('   ⚠️  Please update pkp-credentials.json with the public key');
  }

  const jsParams = {
    geniusId,
    pkpPublicKey: pkpPublicKey,

    // OpenRouter key encryption params
    openrouterKeyAccessControlConditions: openrouterKey.accessControlConditions,
    openrouterKeyCiphertext: openrouterKey.ciphertext,
    openrouterKeyDataToEncryptHash: openrouterKey.dataToEncryptHash,

    // Genius key encryption params
    geniusKeyAccessControlConditions: geniusKey.accessControlConditions,
    geniusKeyCiphertext: geniusKey.ciphertext,
    geniusKeyDataToEncryptHash: geniusKey.dataToEncryptHash,

    // Contract write params
    contractAddress: KARAOKE_CATALOG_ADDRESS,
    pkpAddress: pkpCreds.ethAddress,
    pkpTokenId: pkpCreds.tokenId,
    pkpPublicKey: pkpCreds.publicKey,
    writeToBlockchain: true  // Enabled - testing with enhanced logging
  };

  console.log('\n🚀 Executing Lit Action...');
  const startTime = Date.now();

  try {
    const result = await litClient.executeJs({
      ipfsId: MATCH_AND_SEGMENT_V2_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;

    console.log('✅ Lit Action execution completed');
    console.log(`⏱️  Execution time: ${executionTime}ms\n`);

    // Parse and display results
    console.log('━'.repeat(80));
    console.log('📊 RESULTS\n');

    const response = JSON.parse(result.response);

    // Save full response to output directory
    const outputDir = join(__dirname, '../../output');
    const outputFile = join(outputDir, `song-${geniusId}-result.json`);
    await writeFile(outputFile, JSON.stringify(response, null, 2));
    console.log(`💾 Saved full result to: ${outputFile}\n`);

    console.log('✅ Success:', response.success);
    if (!response.success && response.error) {
      console.log('❌ Error:', response.error);
      if (response.stack) {
        console.log('Stack:', response.stack);
      }
    }
    console.log('📝 Version:', response.version);
    console.log('🆔 Song ID:', response.songId || 'N/A');
    console.log('🔗 Genius ID:', response.geniusId);

    // Display step results
    if (response.steps) {
      console.log('\n--- Processing Steps ---\n');
      console.log('DEBUG - All steps:', JSON.stringify(response.steps, null, 2));
      console.log('');

      const stepOrder = ['genius', 'lrclib', 'maidzone', 'matching', 'chunking', 'grove', 'contract'];

      for (const stepName of stepOrder) {
        const step = response.steps[stepName];
        if (step) {
          const status = step.success ? '✅' : '❌';
          console.log(`${status} ${stepName.toUpperCase()}: ${step.durationMs || 0}ms`);

          if (stepName === 'genius' && step.data) {
            console.log(`   → ${step.data.artist} - ${step.data.title}`);
          } else if (stepName === 'lrclib' && step.data) {
            console.log(`   → Duration: ${step.data.duration}s`);
          } else if (stepName === 'maidzone' && step.data) {
            console.log(`   → Audio: ${step.data.audioUrl.substring(0, 50)}...`);
          } else if (stepName === 'matching' && step.data) {
            console.log(`   → Match: ${step.data.isMatch ? 'YES' : 'NO'} (${step.data.confidence} confidence, score: ${step.data.score})`);
            console.log(`   → Reason: ${step.data.reason}`);
          } else if (stepName === 'chunking' && step.data) {
            console.log(`   → Sections: ${step.data.sections.length}`);
            step.data.sections.forEach((section, i) => {
              console.log(`      ${i + 1}. ${section.label} (${section.type}) - ${section.duration}s - ${section.learningValue} value`);
            });
          } else if (stepName === 'grove' && step.data) {
            console.log(`   → URI: ${step.data.metadataUri || 'N/A'}`);
          } else if (stepName === 'contract' && step.data) {
            console.log(`   → TX Hash: ${step.data.txHash || 'N/A'}`);
            if (step.data.skipped) {
              console.log(`   → Skipped: ${step.data.reason}`);
            }
          }

          if (step.error) {
            console.log(`   ⚠️  Error: ${step.error}`);
          }
        }
      }
    }

    // Submit signed transaction if available
    let actualTxHash = null;
    if (response.signedTransaction) {
      console.log('\n--- Blockchain Write ---');
      console.log('📝 Signed transaction received from Lit Action');
      console.log('📤 Submitting transaction to Base Sepolia...');

      try {
        const { ethers } = await import('ethers');
        const provider = new ethers.providers.JsonRpcProvider('https://sepolia.base.org');

        const tx = await provider.sendTransaction(response.signedTransaction);
        actualTxHash = tx.hash;

        console.log('✅ Transaction submitted:', actualTxHash);
        console.log('🔍 Explorer:', `${BASE_SEPOLIA_EXPLORER}/tx/${actualTxHash}`);
        console.log('📝 Contract:', response.contractAddress);
        console.log('⏳ Waiting for confirmation...');

        const receipt = await tx.wait();
        console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

        // Update response with actual tx hash
        response.txHash = actualTxHash;
        await writeFile(outputFile, JSON.stringify(response, null, 2));
      } catch (error) {
        console.log('❌ Transaction submission failed:', error.message);
        response.contractError = error.message;
      }
    } else if (response.contractError) {
      console.log('\n--- Blockchain Write ---');
      console.log('❌ Contract Error:', response.contractError);
    } else if (!response.isMatch) {
      console.log('\n--- Blockchain Write ---');
      console.log('⏭️  Skipped (songs did not match)');
    } else {
      console.log('\n--- Blockchain Write ---');
      console.log('⏭️  Skipped (disabled or no sections)');
    }

    // Display metadata (legacy fields)
    if (response.groveMetadataUri) {
      console.log('\n--- Grove Storage ---');
      console.log('Metadata URI:', response.groveMetadataUri);
    }

    if (response.contractTxHash) {
      console.log('\n--- Contract Registration (Legacy) ---');
      console.log('TX Hash:', response.contractTxHash);
      console.log('Explorer:', `https://explorer.testnet.lens.xyz/tx/${response.contractTxHash}`);
    }

    // Display failure state
    if (response.failureState) {
      console.log('\n--- Failure State ---');
      console.log('State:', response.failureState);
      console.log('(This will be stored in contract to avoid retries)');
    }

    // Display timing
    console.log('\n--- Timing ---');
    console.log('Total Execution Time:', response.totalExecutionTime, 'ms');
    console.log('Timestamp:', response.timestamp);

    console.log('\n' + '━'.repeat(80));

    return {
      success: response.success,
      songId: response.songId,
      failureState: response.failureState,
      executionTime: response.totalExecutionTime,
      txHash: response.txHash,
      contractError: response.contractError
    };

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🎤 Match and Segment v2 Test (Combined Query)\n');
  console.log('━'.repeat(80));
  console.log('\nThis test will:');
  console.log('1. Fetch song metadata from Genius');
  console.log('2. Get synced lyrics from LRClib');
  console.log('3. Single GPT-5-nano query: match songs + segment if matched');
  console.log('\n━'.repeat(80));

  // Check if specific genius ID provided
  const customGeniusId = parseInt(process.argv[2]);
  const testSongs = customGeniusId
    ? [{ geniusId: customGeniusId, name: 'Custom Song', expectSuccess: true, notes: 'User provided' }]
    : TEST_SONGS;

  try {
    // Load credentials and keys
    const pkpCreds = await loadPKPCredentials();
    const encryptedKeys = await loadEncryptedKeys();

    // Check PKP balance for gas
    await checkPKPBalance(pkpCreds.ethAddress);

    // Check if CID is set
    if (MATCH_AND_SEGMENT_V2_CID === 'QmPLACEHOLDER') {
      console.log('\n⚠️  WARNING: Lit Action CID not set!');
      console.log('   Please update MATCH_AND_SEGMENT_V2_CID in this test file.');
      console.log('   Upload the lit action first with:');
      console.log('   bun run scripts/upload-lit-action.mjs src/karaoke/match-and-segment-v1.js "Match and Segment v1"');
      console.log('');
      process.exit(1);
    }

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "match-and-segment-v2-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // Fetch PKP public key if not in credentials
    if (!pkpCreds.publicKey) {
      console.log('\n🔑 Fetching PKP public key from Lit Protocol...');

      // Log available litClient methods for debugging
      console.log('   Available PKP-related methods:', Object.keys(litClient).filter(k => k.toLowerCase().includes('pkp')));

      try {
        // Use viewPKPsByAddress to get full PKP info including public key
        // Note: Use ownerAddress (not address) - this is the address that owns the PKP
        const pkpResponse = await litClient.viewPKPsByAddress({
          ownerAddress: pkpCreds.owner, // Use owner address from credentials
          pagination: { limit: 10, offset: 0 }
        });

        console.log('   Response type:', typeof pkpResponse);
        console.log('   Response keys:', pkpResponse ? Object.keys(pkpResponse) : 'null/undefined');

        // Handle different response formats
        const pkps = Array.isArray(pkpResponse) ? pkpResponse : (pkpResponse?.pkps || []);

        console.log(`✅ Found ${pkps.length} PKPs for owner ${pkpCreds.owner}`);

        if (pkps.length > 0) {
          // Find the PKP matching our token ID
          const matchingPkp = pkps.find(p => p.tokenId === pkpCreds.tokenId);

          if (matchingPkp && matchingPkp.publicKey) {
            pkpCreds.publicKey = matchingPkp.publicKey;
            console.log(`✅ Public key found: ${matchingPkp.publicKey.substring(0, 20)}...`);

            // Update credentials file
            await writeFile(PKP_CREDS_PATH, JSON.stringify(pkpCreds, null, 2));
            console.log('✅ Updated pkp-credentials.json with public key');
          } else if (pkps[0].publicKey) {
            // Fallback: use first PKP if token ID doesn't match
            pkpCreds.publicKey = pkps[0].publicKey;
            console.log(`✅ Public key found (from first PKP): ${pkps[0].publicKey.substring(0, 20)}...`);
            console.log(`   ⚠️  Token ID mismatch: expected ${pkpCreds.tokenId}, got ${pkps[0].tokenId}`);

            // Update credentials file
            await writeFile(PKP_CREDS_PATH, JSON.stringify(pkpCreds, null, 2));
            console.log('✅ Updated pkp-credentials.json with public key');
          } else {
            console.log('⚠️  Public key not found in PKP data');
            console.log('   PKP fields:', Object.keys(pkps[0]).join(', '));
          }
        } else {
          console.log('❌ No PKPs found for this address');
        }
      } catch (error) {
        console.log('❌ Failed to fetch PKP public key:', error.message);
        console.log('   Will attempt to retrieve in Lit Action...');
      }
    } else {
      console.log('\n✅ PKP public key already in credentials');
      console.log(`   Public key (first 20 chars): ${pkpCreds.publicKey.substring(0, 20)}...`);
    }

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

    // Wait a moment for auth context to fully initialize
    console.log('⏳ Waiting for auth context to initialize...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test songs
    const results = [];

    for (const song of testSongs) {
      const result = await testSong(
        song.geniusId,
        song.name,
        litClient,
        authContext,
        pkpCreds,
        encryptedKeys
      );

      results.push({
        ...song,
        ...result
      });
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 TEST SUMMARY');
    console.log('='.repeat(80));

    results.forEach((result, i) => {
      const status = result.success ? '✅' : '❌';
      console.log(`\n${i + 1}. ${status} ${result.name} (${result.geniusId})`);
      console.log(`   Expected: ${result.expectSuccess ? 'Success' : 'Failure'}`);
      console.log(`   Actual: ${result.success ? 'Success' : 'Failure'}`);
      if (result.songId) {
        console.log(`   Song ID: ${result.songId}`);
      }
      if (result.txHash) {
        console.log(`   TX Hash: ${result.txHash}`);
        console.log(`   Explorer: ${BASE_SEPOLIA_EXPLORER}/tx/${result.txHash}`);
      }
      if (result.contractError) {
        console.log(`   Contract Error: ${result.contractError}`);
      }
      if (result.failureState) {
        console.log(`   Failure State: ${result.failureState}`);
      }
      if (result.executionTime) {
        console.log(`   Execution Time: ${result.executionTime}ms`);
      }
      console.log(`   Notes: ${result.notes}`);
    });

    const allPassed = results.every(r => r.success === r.expectSuccess);

    console.log('\n' + '='.repeat(80));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED! 🎉');
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('='.repeat(80));

    await litClient.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test setup failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
