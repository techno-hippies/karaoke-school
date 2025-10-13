#!/usr/bin/env node

/**
 * Encrypt API keys for Lit Actions v9 - Contract-Based Access Control
 *
 * This version uses contract-based access control instead of CID-locking.
 * Any user with credits in the KaraokeCreditsV1 contract can decrypt the keys.
 *
 * Usage:
 *   node scripts/encrypt-keys-v9-contract-based.mjs --key api_key_value --output path/to/output.json
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { writeFile } from 'fs/promises';

const args = process.argv.slice(2);
const keyIndex = args.indexOf('--key');
const outputIndex = args.indexOf('--output');

if (keyIndex === -1 || outputIndex === -1) {
  console.error('Usage: node encrypt-keys-v9-contract-based.mjs --key <API_KEY> --output <OUTPUT_PATH>');
  process.exit(1);
}

const keyName = args[keyIndex + 1];  // e.g., "openrouter_api_key"
const outputPath = args[outputIndex + 1];

// Convert key name to env var name (openrouter_api_key -> OPENROUTER_API_KEY)
const envVarName = keyName.toUpperCase();
const apiKey = process.env[envVarName];

if (!apiKey) {
  console.error(`❌ ${envVarName} not found in environment`);
  console.error(`   Set it with: export ${envVarName}=your_key_here`);
  process.exit(1);
}

console.log(`🔑 Encrypting ${keyName}...`);
console.log(`📦 Environment variable: ${envVarName}`);
console.log(`📁 Output: ${outputPath}`);

const litClient = await createLitClient({
  network: nagaDev
});

console.log('🔐 Connecting to Lit Protocol (v9 nagaDev)...');
console.log('✅ Connected to Lit Network');

// Contract-based access control - check if user has credits
// KaraokeCreditsV1: 0x6de183934E68051c407266F877fafE5C20F74653 on Base Sepolia
const accessControlConditions = [
  {
    conditionType: "evmContract",
    contractAddress: "0x6de183934E68051c407266F877fafE5C20F74653",
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
      value: "0"  // User must have at least 1 credit
    }
  }
];

// Encrypt the API key (v8 SDK)
console.log('🔐 Encrypting data with contract-based access control...');
console.log('📋 Access rule: User must have credits in KaraokeCreditsV1 contract');
console.log('📍 Contract: 0x6de183934E68051c407266F877fafE5C20F74653 (Base Sepolia)');

const { ciphertext, dataToEncryptHash } = await litClient.encrypt({
  unifiedAccessControlConditions: accessControlConditions,
  dataToEncrypt: new TextEncoder().encode(apiKey),
});

console.log('✅ Encryption complete!');

const encryptedData = {
  ciphertext,
  dataToEncryptHash,
  accessControlConditions,  // Store as accessControlConditions for Lit Action
  encryptedAt: new Date().toISOString(),
  accessType: 'contract-based',
  contractAddress: '0x6de183934E68051c407266F877fafE5C20F74653',
  chain: 'baseSepolia',
  rule: 'User must have at least 1 credit',
};

await writeFile(outputPath, JSON.stringify(encryptedData, null, 2));
console.log(`📝 Saved to ${outputPath}`);

await litClient.disconnect();
process.exit(0);
