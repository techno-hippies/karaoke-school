#!/usr/bin/env node

/**
 * Test the deployed Karaoke Grader Lit Action directly
 */

import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { nagaDev } from '@lit-protocol/networks';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env') });

const LIT_ACTION_CID = 'QmdxjEKkbyRMx1HJ3VtT8t9gqVeiGytAXNyBJXHxnVULSd';

async function testLitAction() {
  console.log('🧪 Testing Karaoke Grader Lit Action');
  console.log('===================================');

  // Load PKP credentials
  const pkpCreds = JSON.parse(await readFile('output/pkp-credentials.json', 'utf8'));
  console.log('🔐 PKP Address:', pkpCreds.ethAddress);
  console.log('📦 Lit Action CID:', LIT_ACTION_CID);

  // Verify permission exists
  const hasPermission = pkpCreds.permittedActions.some(p => p.ipfsId === LIT_ACTION_CID);
  if (!hasPermission) {
    throw new Error('PKP does not have permission for this Lit Action');
  }
  console.log('✅ PKP has permission for this Lit Action');

  // Create wallet client for auth
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  const account = privateKeyToAccount(privateKey);

  // Connect to Lit Protocol
  console.log('🔌 Connecting to Lit Protocol...');
  const litNodeClient = new LitNodeClient({
    alertWhenUnauthorized: false,
    litNetwork: 'datil-dev',
  });
  await litNodeClient.connect();
  console.log('✅ Connected to Lit Protocol');

  // Prepare test data - minimal performance data
  console.log('🔍 Preparing test data...');
  const jsParams = {
    audioDataBase64: '',  // Empty for test mode
    userAddress: '0x123456789012345678901234567890',
    songId: 'heat-waves',
    segmentId: 'verse-1',
    expectedLyrics: [
      { lineIndex: 0, text: "Heat waves, vibrating through the night", startTime: 0 },
      { lineIndex: 1, text: "I can feel the rhythm in the pale moonlight", startTime: 5000 }
    ],
    performanceId: Date.now(),
    pkpPublicKey: '043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
    
    // Encrypted params (required even for test mode)
    voxstralKeyAccessControlConditions: [
      {
        contractAddress: '',
        standardContractType: '',
        chain: 'ethereum',
        method: '',
        parameters: [
          {
            name: '',
            value: '',
            newValue: ''
          }
        ]
      }
    ],
    voxstralKeyCiphertext: 'mock-ciphertext',
    voxstralKeyDataToEncryptHash: 'mock-hash',
    
    // Enable test mode to bypass audio processing
    testMode: true,
    writeToBlockchain: true
  };
  console.log('✅ Test data prepared');
    audioDataBase64: '',  // Empty for test mode
    userAddress: '0x123456789012345678901234567890',
    songId: 'heat-waves',
    segmentId: 'verse-1',
    expectedLyrics: [
      { lineIndex: 0, text: "Heat waves, vibrating through the night", startTime: 0 },
      { lineIndex: 1, text: "I can feel the rhythm in the pale moonlight", startTime: 5000 }
    ],
    performanceId: Date.now(),
    pkpPublicKey: '043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939',
    
    // Encrypted params (required even for test mode)
    voxstralKeyAccessControlConditions: [
      {
        contractAddress: '',
        standardContractType: '',
        chain: 'ethereum',
        method: '',
        parameters: [
          {
            name: '',
            value: '',
            newValue: ''
          }
        ]
      }
    ],
    voxstralKeyCiphertext: 'mock-ciphertext',
    voxstralKeyDataToEncryptHash: 'mock-hash',
    
    // Enable test mode to bypass audio processing
    testMode: true,
    writeToBlockchain: true
  };

  console.log('\n📊 Test Parameters:');
  console.log('  Performance ID:', jsParams.performanceId);
  console.log('  Song:', jsParams.songId);
  console.log('  Segment:', jsParams.segmentId);
  console.log('  Test Mode:', jsParams.testMode);
  console.log('  Write to Blockchain:', jsParams.writeToBlockchain);

  console.log('\n🚀 Executing Lit Action...');

  try {
    // Execute the Lit Action
    const result = await litNodeClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authSig: {
        sig: '0x', // Mock signature for testing
        derivedVia: 'web3.eth.personal.sign',
        signedMessage: 'test-auth',
        address: account.address,
      },
      jsParams: jsParams,
    });

    console.log('✅ Lit Action executed successfully!');
    console.log('\n📋 Results:');
    
    if (result && result.response) {
      const response = JSON.parse(result.response);
      console.log('  Success:', response.success);
      console.log('  Performance ID:', response.performanceId);
      console.log('  Average Score:', response.averageScore);
      console.log('  Transaction Hash:', response.txHash);
      
      if (response.transcript) {
        console.log('  Transcript:', response.transcript.substring(0, 100) + '...');
      }
      
      if (response.errorType) {
        console.log('  ⚠️  Error:', response.errorType);
      }
    } else {
      console.log('  Raw result:', result);
    }

    console.log('\n🎯 Lit Action Test Complete!');

  } catch (error) {
    console.error('❌ Lit Action execution failed:');
    console.error('  Error:', error.message);
    console.error('  Stack:', error.stack);
    
    if (error.errorDetails) {
      console.error('  Details:', error.errorDetails);
    }
    
    if (error.cause) {
      console.error('  Cause:', error.cause);
    }
  } finally {
    await litNodeClient.disconnect();
  }
}

testLitAction().catch(console.error);
