#!/usr/bin/env node

/**
 * Simple test to get transaction hash from Lens testnet
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

async function executeTransaction() {
  try {
    console.log('🚀 EXECUTING TRANSACTION TO LENS TESTNET');
    console.log('========================================\n');

    // Load Lit Action code (the working one with correct contract address)
    const actionCode = await readFile(join(__dirname, '../../src/stt/karaoke-scorer-v4.js'), 'utf-8');
    console.log('✅ Lit Action loaded from src/stt/karaoke-scorer-v4.js');
    console.log('📏 Size:', actionCode.length, 'bytes');
    
    // Check contract address in the code
    const contractMatch = actionCode.match(/0x[a-fA-F0-9]{40}/g);
    console.log('📍 Contract Address:', contractMatch ? contractMatch[0] : 'NOT FOUND');

    // Connect to Lit Protocol
    console.log('\n🔌 Connecting to Lit Protocol (nagaDev)...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Protocol\n');

    // Test parameters
    const testParams = {
      audioDataBase64: '', // Empty for now
      language: 'en',
      userAddress: '0x742d35Cc6634C0532925a3b8D40715c3F0532926',
      songId: 'execute-transaction',
      segmentId: 'verse-1',
      accessControlConditions: [],
      ciphertext: '',
      dataToEncryptHash: ''
    };

    console.log('🧪 Test Parameters:');
    console.log('   User Address:', testParams.userAddress);
    console.log('   Song ID:', testParams.songId);
    console.log('   Segment ID:', testParams.segmentId);
    console.log('   Audio: (empty - will fail STT but try contract call)');
    console.log('');

    console.log('⚡ Executing Lit Action...');
    console.log('   Expected: STT fails → Error handling → Contract submission attempt\n');

    const startTime = Date.now();
    
    const result = await litClient.executeJs({
      code: actionCode,
      jsParams: testParams
    });

    const executionTime = Date.now() - startTime;

    console.log('📊 EXECUTION RESULT:');
    console.log('Success:', result.success);
    console.log(`Execution time: ${executionTime}ms`);
    
    if (result.response) {
      try {
        const responseData = JSON.parse(result.response);
        console.log('\n📋 Response Data:');
        console.log(JSON.stringify(responseData, null, 2));
        
        if (responseData.txHash) {
          if (responseData.txHash.startsWith('TX_SUBMIT_ERROR:')) {
            console.log('\n❌ TRANSACTION SUBMISSION FAILED:');
            console.log('   ', responseData.txHash);
          } else {
            console.log('\n🎉 TRANSACTION SUCCESSFUL!');
            console.log('   TX HASH:', responseData.txHash);
            console.log('\n🌐 VIEW ON EXPLORER:');
            console.log('   https://block-explorer.testnet.lens.xyz/tx/' + responseData.txHash);
            console.log('\n✅ DATA IS NOW IN THE CONTRACT ON LENS TESTNET!');
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
    console.error('\n❌ Execution failed:', error.message);
    
    if (error.message.includes('Position')) {
      console.log('\n💡 Lit Protocol connection issue detected');
    } else if (error.message.includes('not permitted')) {
      console.log('\n💡 IPFS CID may not be permitted yet');
    }
  }
}

executeTransaction();
