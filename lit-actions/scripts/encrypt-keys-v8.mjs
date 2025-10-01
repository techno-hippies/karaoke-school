#!/usr/bin/env node

/**
 * Encrypt keys for Lit Actions (v8 SDK)
 * Uses jsParams pattern and locks keys to specific IPFS CIDs
 *
 * Usage:
 *   VOXSTRAL_API_KEY=xxx node scripts/encrypt-keys-v8.mjs --cid QmXXX --key voxstral_api_key --output src/stt/keys/voxstral_api_key.json
 *
 * Example:
 *   VOXSTRAL_API_KEY=xxx node scripts/encrypt-keys-v8.mjs --cid QmdN4nKcuYYQtNwDhMQA8v1QaiT9WzxMj8wuR6e6MdDgoM --key voxstral_api_key --output src/stt/keys/voxstral_api_key.json
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

// Key to environment variable mapping
const KEY_ENV_MAPPING = {
  voxstral_api_key: 'VOXSTRAL_API_KEY',
  db_auth_token: 'DB_AUTH_TOKEN',
  db_endpoint_url: 'DB_ENDPOINT_URL',
  genius_api_key: 'GENIUS_API_KEY',
  openrouter_api_key: 'OPENROUTER_API_KEY'
};

async function encryptForCID(keyValue, cid) {
  console.log('🔐 Connecting to Lit Protocol (v8 nagaDev)...');

  const litClient = await createLitClient({ network: nagaDev });

  console.log('✅ Connected to Lit Network');

  // Access control condition - only the specific Lit Action CID can decrypt (v8 format)
  const accessControlConditions = [
    {
      conditionType: 'evmBasic',
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':currentActionIpfsId'],
      returnValueTest: {
        comparator: '=',
        value: cid
      }
    }
  ];

  console.log('🔐 Encrypting data...');
  console.log('📍 Locked to CID:', cid);

  // Encrypt the key (v8 API - no authContext needed for encryption)
  const encryptedData = await litClient.encrypt({
    dataToEncrypt: keyValue,
    unifiedAccessControlConditions: accessControlConditions,
    chain: 'ethereum'
  });

  await litClient.disconnect();

  return {
    ciphertext: encryptedData.ciphertext,
    dataToEncryptHash: encryptedData.dataToEncryptHash,
    accessControlConditions,
    encryptedAt: new Date().toISOString(),
    litActionFile: 'stt/free.js',
    cid: cid
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (value !== true) i++;
    }
  }

  const { cid, key, output } = options;

  if (!cid || !key || !output) {
    console.log('Usage: node scripts/encrypt-keys-v8.mjs --cid <CID> --key <key_name> --output <path>');
    console.log('\nExample:');
    console.log('  VOXSTRAL_API_KEY=xxx node scripts/encrypt-keys-v8.mjs --cid QmdN4nKcuYYQtNwDhMQA8v1QaiT9WzxMj8wuR6e6MdDgoM --key voxstral_api_key --output src/stt/keys/voxstral_api_key.json');
    console.log('\nAvailable keys:');
    Object.entries(KEY_ENV_MAPPING).forEach(([k, env]) => console.log(`  ${k} → ${env}`));
    process.exit(1);
  }

  const envVar = KEY_ENV_MAPPING[key];
  if (!envVar) {
    console.error(`❌ Unknown key: ${key}`);
    console.log('Available keys:', Object.keys(KEY_ENV_MAPPING).join(', '));
    process.exit(1);
  }

  const keyValue = process.env[envVar];
  if (!keyValue) {
    console.error(`❌ ${envVar} not found in environment`);
    console.log(`Set it with: export ${envVar}=your_key_here`);
    process.exit(1);
  }

  try {
    console.log(`\n🔑 Encrypting ${key}...`);
    console.log(`📦 Environment variable: ${envVar}`);
    console.log(`📁 Output: ${output}`);

    const encrypted = await encryptForCID(keyValue, cid);

    // Create output directory if needed
    await mkdir(dirname(output), { recursive: true });

    // Save encrypted data
    await writeFile(output, JSON.stringify(encrypted, null, 2));

    console.log('✅ Encryption complete!');
    console.log(`📝 Saved to ${output}`);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();