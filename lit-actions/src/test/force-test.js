#!/usr/bin/env node

/**
 * Simplified test to force a transaction to PerformanceGrader
 * This will fail at STT but prove the contract integration works
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// PKP credentials path (from existing setup)
const PKP_CREDS_PATH = '/media/t42/th42/Code/site/root/lit-actions/output/pkp-credentials.json';

async function main() {
  console.log('🚀 PerformanceGrader Integration Test');
  console.log('=====================================\n');

  try {
    // Connect to Lit Protocol 
    console.log('🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Protocol\n');

    // Load our updated Lit Action
    const actionPath = join(__dirname, '../../src/karaoke/karaoke-scorer-v4-simplified.js');
    const litActionCode = await readFile(actionPath, 'utf-8');
    console.log('✅ Loaded Lit Action:', actionPath);

    // Test parameters designed to work despite STT failure
    const testParams = {
      // Empty audio to force STT failure but reach contract
      audioDataBase64: '',
      language: 'en',
      userAddress: '0x742d35Cc6634C0532925a3b8D40715c3F0532926',
      songId: 'force-contract-test',
      segmentId: 'verse-1',
      // Mock encryption params (will cause decryption error but that's ok)
      accessControlConditions: [],
      ciphertext: '',
      dataToEncryptHash: ''
    };

    console.log('🧪 Test Parameters:');
    console.log('  Song ID:', testParams.songId);
    console.log('  Segment ID:', testParams.segmentId);
    console.log('  User Address:', testParams.userAddress);
    console.log('  Audio Data: (empty - will fail STT)');
    console.log('  Contract: 0xaB92C2708D44fab58C3c12aAA574700E80033B7D\n');

    console.log('⚡ Executing Lit Action...');
    console.log('   Expected flow: STT fails → Error → Contract never called');
    console.log('   We want to see if we can reach the contract call\n');

    const result = await litClient.executeJs({
      code: litActionCode,
      jsParams: testParams
    });

    console.log('📊 Results:');
    console.log('Success:', result.success);
    
    if (result.response) {
      try {
        const responseData = JSON.parse(result.response);
        console.log('\n📋 Response:', JSON.stringify(responseData, null, 2));
        
        if (responseData.txHash && !responseData.txHash.startsWith('TX_SUBMIT_ERROR:')) {
          console.log('\n🎉 UNEXPECTED SUCCESS! Transaction hash:', responseData.txHash);
          console.log('🌐 Explorer: https://block-explorer.testnet.lens.xyz/tx/' + responseData.txHash);
        } else if (responseData.txHash) {
          console.log('\n📤 Transaction submission attempted:', responseData.txHash);
        }
        
        if (responseData.errorType) {
          console.log('\n⚠️ Expected error:', responseData.errorType);
        }
        
      } catch (e) {
        console.log('\n📄 Raw response:', result.response);
      }
    }
    
    if (result.error) {
      console.log('\n❌ Error:', result.error);
    }

    console.log('\n' + '='.repeat(50));

  } catch (error) {
    console.error('❌ Failed:', error.message);
    if (error.message.includes('not permitted')) {
      console.log('\n💡 SOLUTION: Add IPFS CID to PKP permissions');
      console.log('   CID: QmeSgWA2ZUAijd8GiU4yfNnhvRgNh2TUrKnJCE74Z8HEGj');
      console.log('   Command: node scripts/add-pkp-permission.mjs QmeSgWA2ZUAijd8GiU4yfNnhvRgNh2TUrKnJCE74Z8HEGj');
    }
  }
}

main().catch(console.error);
