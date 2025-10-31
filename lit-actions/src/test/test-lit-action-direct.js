#!/usr/bin/env node

/**
 * Test the karaoke scorer Lit Action directly
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🚀 Testing Karaoke Scorer Lit Action');
  console.log('=====================================\n');

  try {
    // Load the Lit Action code
    const actionPath = join(__dirname, '../src/karaoke/karaoke-scorer-v4-simplified.js');
    const litActionCode = await readFile(actionPath, 'utf-8');
    console.log('✅ Lit Action code loaded');

    // Connect to Lit Protocol
    console.log('🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Protocol');

    // Create test parameters
    const testParams = {
      audioDataBase64: '', // Empty for now - we'll test without audio
      language: 'en',
      userAddress: '0x742d35Cc6634C0532925a3b8D40715c3F0532926', // Random test address
      songId: 'test-song-123',
      segmentId: 'verse-1',
      accessControlConditions: [],
      ciphertext: '',
      dataToEncryptHash: ''
    };

    console.log('\n🧪 Executing Lit Action with test parameters...');
    console.log('Song ID:', testParams.songId);
    console.log('Segment ID:', testParams.segmentId);
    console.log('User Address:', testParams.userAddress);

    // Execute the Lit Action
    const result = await litClient.executeJs({
      code: litActionCode,
      jsParams: testParams
    });

    console.log('\n📊 Results:');
    console.log('Success:', result.success);
    console.log('Response:', result.response);
    
    if (result.error) {
      console.log('Error:', result.error);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);
