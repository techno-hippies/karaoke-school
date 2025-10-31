#!/usr/bin/env node

/**
 * Minimal test to execute Lit Action and get transaction to contract
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🚀 Testing Lit Action → Contract Transaction');
  console.log('===========================================\n');

  try {
    // Load the Lit Action code
    const actionPath = join(__dirname, '../../src/karaoke/karaoke-scorer-v4-simplified.js');
    const litActionCode = await readFile(actionPath, 'utf-8');
    console.log('✅ Lit Action loaded:', actionPath);

    // Connect to Lit Protocol
    console.log('🔌 Connecting to Lit Protocol (nagaDev)...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Protocol\n');

    // Create minimal test parameters that should work
    const testParams = {
      audioDataBase64: '', // Empty - will fail STT but should reach contract call
      language: 'en',
      userAddress: '0x742d35Cc6634C0532925a3b8D40715c3F0532926',
      songId: 'test-song-minimal',
      segmentId: 'verse-1',
      accessControlConditions: [],
      ciphertext: '',
      dataToEncryptHash: ''
    };

    console.log('🧪 Test Parameters:');
    console.log('  Song ID:', testParams.songId);
    console.log('  Segment ID:', testParams.segmentId);
    console.log('  User Address:', testParams.userAddress);
    console.log('  Audio Data: (empty - will test error handling)\n');

    // Execute the Lit Action
    console.log('⚡ Executing Lit Action...');
    const result = await litClient.executeJs({
      code: litActionCode,
      jsParams: testParams
    });

    console.log('\n📊 Execution Results:');
    console.log('Success:', result.success);
    
    if (result.response) {
      try {
        const responseData = JSON.parse(result.response);
        console.log('Response Data:', JSON.stringify(responseData, null, 2));
        
        if (responseData.txHash && !responseData.txHash.startsWith('TX_SUBMIT_ERROR:')) {
          console.log('\n🎉 SUCCESS! Transaction hash:', responseData.txHash);
          console.log('🌐 View on explorer: https://block-explorer.testnet.lens.xyz/tx/' + responseData.txHash);
        } else if (responseData.txHash) {
          console.log('\n⚠️ Transaction failed:', responseData.txHash);
        }
        
        if (responseData.errorType) {
          console.log('Error Type:', responseData.errorType);
        }
        
      } catch (e) {
        console.log('Raw Response:', result.response);
      }
    }
    
    if (result.error) {
      console.log('\n❌ Lit Action Error:', result.error);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.message.includes('not permitted')) {
      console.log('\n💡 The Lit Action IPFS CID needs to be added to PKP permissions');
      console.log('   Run: node scripts/add-pkp-permission.mjs <CID>');
    }
  }
}

main().catch(console.error);
