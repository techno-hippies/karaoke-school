#!/usr/bin/env node

/**
 * Encrypt API keys for Lit Actions v8
 *
 * Usage:
 *   node scripts/encrypt-keys-v8.mjs --cid QmXXX --key api_key_value --output path/to/output.json
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { writeFile } from 'fs/promises';

const args = process.argv.slice(2);
const cidIndex = args.indexOf('--cid');
const keyIndex = args.indexOf('--key');
const outputIndex = args.indexOf('--output');

if (cidIndex === -1 || keyIndex === -1 || outputIndex === -1) {
  console.error('Usage: node encrypt-keys-v8.mjs --cid <IPFS_CID> --key <API_KEY> --output <OUTPUT_PATH>');
  process.exit(1);
}

const ipfsCid = args[cidIndex + 1];
const keyName = args[keyIndex + 1];  // e.g., "voxstral_api_key"
const outputPath = args[outputIndex + 1];

// Convert key name to env var name (voxstral_api_key -> VOXSTRAL_API_KEY)
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

console.log('🔐 Connecting to Lit Protocol (v8 nagaDev)...');
console.log('✅ Connected to Lit Network');

// Access control conditions - lock to specific IPFS CID
const accessControlConditions = [
  {
    conditionType: "evmBasic",
    contractAddress: "",
    standardContractType: "",
    chain: "ethereum",
    method: "",
    parameters: [":currentActionIpfsId"],
    returnValueTest: {
      comparator: "=",
      value: ipfsCid  // Lock to this specific CID
    }
  }
];

// Encrypt the API key (v8 SDK)
console.log('🔐 Encrypting data...');
const { ciphertext, dataToEncryptHash } = await litClient.encrypt({
  accessControlConditions: accessControlConditions,
  dataToEncrypt: new TextEncoder().encode(apiKey),
});

console.log(`📍 Locked to CID: ${ipfsCid}`);
console.log('✅ Encryption complete!');

const encryptedData = {
  ciphertext,
  dataToEncryptHash,
  accessControlConditions,  // Store as accessControlConditions for Lit Action
  encryptedAt: new Date().toISOString(),
  cid: ipfsCid,
};

await writeFile(outputPath, JSON.stringify(encryptedData, null, 2));
console.log(`📝 Saved to ${outputPath}`);

await litClient.disconnect();
process.exit(0);
