#!/usr/bin/env node

/**
 * Direct Lit Action Test - Force contract transaction without audio
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

async function main() {
  console.log('🚀 Direct Lit Action Test - PerformanceGrader');
  console.log('============================================\n');

  try {
    // Load Lit Action code directly from file
    const actionPath = join(__dirname, '../../src/karaoke/karaoke-scorer-v4-simplified.js');
    const litActionCode = await readFile(actionPath, 'utf-8');
    console.log('✅ Loaded Lit Action from:', actionPath);

    // Connect to Lit Protocol
    console.log('🔌 Connecting to Lit Protocol (nagaDev)...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Protocol\n');

    // Test parameters - intentionally missing audio to test error handling
    const testParams = {
      audioDataBase64: '', // Empty - will cause STT to fail but should reach contract
      language: 'en',
      userAddress: '0x742d35Cc6634C0532925a3b8D40715c3F0532926',
      songId: 'test-song-direct',
      segmentId: 'verse-1',
      accessControlConditions: [],
      ciphertext: '',
      dataToEncryptHash: ''
    };

    console.log('🧪 Test Parameters:');
    console.log('  Audio Data: (empty - will test STT error handling)');
    console.log('  Song ID:', testParams.songId);
    console.log('  Segment ID:', testParams.segmentId);
    console.log('  User Address:', testParams.userAddress);
    console.log('  Contract Address: 0xaB92C2708D44fab58C3c12aAA574700E80033B7D\n');

    // Execute Lit Action
    console.log('⚡ Executing Lit Action...');
    console.log('   This will fail at STT but should attempt contract call\n');

    const result = await litClient.executeJs({
      code: litActionCode,
      jsParams: testParams
    });

    console.log('📊 Results:');
    console.log('Success:', result.success);
    
    if (result.response) {
      try {
        const responseData = JSON.parse(result.response);
        console.log('\n📋 Response Data:');
        console.log(JSON.stringify(responseData, null, 2));
        
        if (responseData.txHash) {
          if (responseData.txHash.startsWith('TX_SUBMIT_ERROR:')) {
            console.log('\n❌ Transaction submission failed:');
            console.log('   ', responseData.txHash);
          } else {
            console.log('\n🎉 TRANSACTION SUCCESSFUL!');
            console.log('   Hash:', responseData.txHash);
            console.log('   🌐 Explorer: https://block-explorer.testnet.lens.xyz/tx/' + responseData.txHash);
            
            // Verify transaction
            console.log('\n🔍 Verifying transaction on-chain...');
          }
        }
        
        if (responseData.errorType) {
          console.log('\n⚠️ Error Type:', responseData.errorType);
        }
        
        if (responseData.score !== undefined) {
          console.log('\n📈 Score:', responseData.score + '%');
        }
        
      } catch (e) {
        console.log('\n📄 Raw Response:', result.response);
      }
    }
    
    if (result.error) {
      console.log('\n❌ Lit Action Error:', result.error);
      if (result.error.includes('not permitted')) {
        console.log('\n💡 Fix: Add IPFS CID to PKP permissions');
        console.log('   CID: QmeSgWA2ZUAijd8GiU4yfNnhvRgNh2TUrKnJCE74Z8HEGj');
      }
    }

    console.log('\n' + '='.repeat(50));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);
