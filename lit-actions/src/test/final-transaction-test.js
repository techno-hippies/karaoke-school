#!/usr/bin/env node

/**
 * Final test - Execute Lit Action and get transaction hash
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
  console.log('🚀 FINAL TEST - Lit Action → Contract Transaction');
  console.log('================================================\n');

  try {
    // Connect to Lit Protocol
    console.log('🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Protocol\n');

    // Load Lit Action
    const actionPath = join(__dirname, '../../src/karaoke/karaoke-scorer-v4-simplified.js');
    const litActionCode = await readFile(actionPath, 'utf-8');
    console.log('✅ Loaded Lit Action:', actionPath);
    console.log('📏 Size:', litActionCode.length, 'bytes');
    console.log('📜 CID: QmeSgWA2ZUAijd8GiU4yfNnhvRgNh2TUrKnJCE74Z8HEGj\n');

    // Test parameters (intentionally minimal to reach contract)
    const testParams = {
      audioDataBase64: '', // Empty - will fail STT but should attempt contract
      language: 'en',
      userAddress: '0x742d35Cc6634C0532925a3b8D40715c3F0532926',
      songId: 'final-test-transaction',
      segmentId: 'verse-1',
      accessControlConditions: [],
      ciphertext: '',
      dataToEncryptHash: ''
    };

    console.log('🧪 Test Parameters:');
    console.log('  Song ID:', testParams.songId);
    console.log('  Segment ID:', testParams.segmentId);
    console.log('  User Address:', testParams.userAddress);
    console.log('  Contract: 0xaB92C2708D44fab58C3c12aAA574700E80033B7D');
    console.log('  PKP Permissions: ✅ Added\n');

    console.log('⚡ Executing Lit Action...');
    console.log('   Expected: STT fails → Error in scoring → Contract call attempt\n');

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
            console.log('\n⚠️ Transaction submission error:');
            console.log('   ', responseData.txHash);
          } else {
            console.log('\n🎉 SUCCESS! TRANSACTION HASH:');
            console.log('   ', responseData.txHash);
            console.log('\n🌐 View on Explorer:');
            console.log('   https://block-explorer.testnet.lens.xyz/tx/' + responseData.txHash);
            console.log('\n✅ DATA IS NOW IN THE CONTRACT!');
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
    }

    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('not permitted')) {
      console.log('\n💡 CID might not be synced yet. The Lit Protocol may need time to propagate.');
    } else if (error.message.includes('Position')) {
      console.log('\n💡 Lit Protocol infrastructure issue. Try again in a moment.');
    }
  }
}

main().catch(console.error);
