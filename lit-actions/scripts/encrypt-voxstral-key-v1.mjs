#!/usr/bin/env node

/**
 * Encrypt Voxstral API Key for study-scorer-v1 Lit Action
 *
 * Uses contract-based access control - any user with credits can decrypt.
 * This allows the study-scorer Lit Action to transcribe audio for paying users.
 *
 * Usage:
 *   export VOXSTRAL_API_KEY=your_mistral_key_here
 *   bun run scripts/encrypt-voxstral-key-v1.mjs
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const KEY_NAME = 'voxstral_api_key';
const OUTPUT_DIR = join(__dirname, '../src/karaoke/keys');
const OUTPUT_FILE = join(OUTPUT_DIR, `${KEY_NAME}_v1.json`);

console.log('🎤 Encrypting Voxstral API Key for study-scorer-v1\n');
console.log('━'.repeat(80));

// Get API key from environment
const apiKey = process.env.VOXSTRAL_API_KEY || process.env.MISTRAL_API_KEY;

if (!apiKey) {
  console.error('❌ VOXSTRAL_API_KEY or MISTRAL_API_KEY not found in environment');
  console.error('');
  console.error('Set it with:');
  console.error('  export VOXSTRAL_API_KEY=your_mistral_key_here');
  console.error('');
  console.error('Get your key from: https://console.mistral.ai/api-keys/');
  process.exit(1);
}

console.log('✅ API key found in environment');
console.log(`📁 Output: ${OUTPUT_FILE}\n`);

try {
  // Connect to Lit Protocol
  console.log('🔌 Connecting to Lit Protocol (nagaDev)...');
  const litClient = await createLitClient({
    network: nagaDev
  });
  console.log('✅ Connected to Lit Network\n');

  // Contract-based access control
  // User must have at least 1 credit in KaraokeCreditsV1
  const accessControlConditions = [
    {
      conditionType: "evmContract",
      contractAddress: "0x6de183934E68051c407266F877fafE5C20F74653", // KaraokeCreditsV1 on Base Sepolia
      chain: "baseSepolia",
      functionName: "credits",
      functionParams: [":userAddress"],
      functionAbi: {
        type: "function",
        name: "credits",
        inputs: [{ name: "user", type: "address" }],
        outputs: [{ name: "balance", type: "uint256" }],
        stateMutability: "view",
      },
      returnValueTest: {
        key: "",
        comparator: ">",
        value: "0"  // Must have at least 1 credit
      }
    }
  ];

  console.log('🔐 Encrypting with contract-based access control...');
  console.log('📋 Access rule: User must have credits in KaraokeCreditsV1');
  console.log('📍 Contract: 0x6de183934E68051c407266F877fafE5C20F74653 (Base Sepolia)\n');

  // Encrypt the API key
  const { ciphertext, dataToEncryptHash } = await litClient.encrypt({
    unifiedAccessControlConditions: accessControlConditions,
    dataToEncrypt: new TextEncoder().encode(apiKey),
  });

  console.log('✅ Encryption complete!\n');

  // Prepare encrypted data
  const encryptedData = {
    ciphertext,
    dataToEncryptHash,
    accessControlConditions,
    encryptedAt: new Date().toISOString(),
    accessType: 'contract-based',
    contractAddress: '0x6de183934E68051c407266F877fafE5C20F74653',
    chain: 'baseSepolia',
    rule: 'User must have at least 1 credit',
    keyName: KEY_NAME,
    version: 'v1',
    purpose: 'Voxstral STT API for study-scorer-v1 Lit Action'
  };

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Save encrypted data
  await writeFile(OUTPUT_FILE, JSON.stringify(encryptedData, null, 2));
  console.log(`📝 Saved to ${OUTPUT_FILE}\n`);

  console.log('━'.repeat(80));
  console.log('✅ Voxstral API key encrypted successfully!\n');
  console.log('Next steps:');
  console.log('1. Update study-scorer-v1.js to use this encrypted key');
  console.log('2. Test with test-study-scorer-v1.mjs');
  console.log('3. Deploy to IPFS for production use\n');
  console.log('━'.repeat(80));

  await litClient.disconnect();
  process.exit(0);

} catch (error) {
  console.error('\n❌ Encryption failed:', error.message);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}
