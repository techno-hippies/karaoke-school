#!/usr/bin/env node

/**
 * Direct execution to force transaction submission
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

async function forceTransaction() {
  try {
    console.log('🔄 FORCING TRANSACTION SUBMISSION...');
    
    // Load Lit Action directly
    const actionCode = await readFile(join(__dirname, '../../src/karaoke/karaoke-scorer-v4-simplified.js'), 'utf-8');
    console.log('✅ Lit Action loaded');
    
    // Connect to Lit
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Protocol');
    
    // Minimal test params - force execution to reach contract
    const params = {
      audioDataBase64: '',
      language: 'en',
      userAddress: '0x742d35Cc6634C0532925a3b8D40715c3F0532926',
      songId: 'force-tx-submission',
      segmentId: 'verse-1',
      accessControlConditions: [],
      ciphertext: '',
      dataToEncryptHash: ''
    };
    
    console.log('⚡ Executing Lit Action...');
    const result = await litClient.executeJs({
      code: actionCode,
      jsParams: params
    });
    
    console.log('📊 EXECUTION RESULT:');
    console.log('Success:', result.success);
    
    if (result.response) {
      const data = JSON.parse(result.response);
      console.log('Response:', JSON.stringify(data, null, 2));
      
      if (data.txHash && !data.txHash.startsWith('TX_SUBMIT_ERROR:')) {
        console.log('\n🎉 TRANSACTION SUCCESSFUL!');
        console.log('TX HASH:', data.txHash);
        console.log('EXPLORER: https://block-explorer.testnet.lens.xyz/tx/' + data.txHash);
        console.log('\n✅ DATA IS NOW IN THE CONTRACT!');
      } else if (data.txHash) {
        console.log('\n⚠️ Transaction error:', data.txHash);
      }
      
      if (data.errorType) {
        console.log('\nError:', data.errorType);
      }
    }
    
    if (result.error) {
      console.log('\n❌ Error:', result.error);
    }
    
  } catch (error) {
    console.log('\n❌ Failed:', error.message);
  }
}

forceTransaction();
