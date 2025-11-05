#!/usr/bin/env node

/**
 * Encrypt Voxtral API key for a specific Lit Action IPFS CID
 *
 * Usage:
 *   node scripts/encrypt-voxtral-key.mjs <IPFS_CID> <VOXTRAL_API_KEY>
 *
 * Example:
 *   node scripts/encrypt-voxtral-key.mjs QmRzSyBYnzbUrjJUwD52ERxT9oEovm41yxAt6u8RZpYXZn jbyqgl0xJjL3udvLt9dAP7yAQmq0ob0H
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function encryptVoxtralKey() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node scripts/encrypt-voxtral-key.mjs <IPFS_CID> <VOXTRAL_API_KEY>');
    console.error('Example: node scripts/encrypt-voxtral-key.mjs QmRzSyBYnzbUrjJUwD52ERxT9oEovm41yxAt6u8RZpYXZn jbyqgl0x...');
    process.exit(1);
  }

  const [ipfsCid, voxtralApiKey] = args;

  console.log('🔐 Encrypting Voxtral API key for CID:', ipfsCid);
  console.log('🔑 API key length:', voxtralApiKey.length);

  try {
    // Initialize Lit client (using new SDK pattern)
    console.log('⚡ Connecting to Lit network...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit network');

    // Define access control: only this specific Lit Action can decrypt
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
          value: ipfsCid,
        },
      },
    ];

    console.log('🔒 Encrypting with access control...');

    // Encrypt the API key using litClient.encrypt (compatible with Lit Actions decryptAndCombine)
    const encryptedData = await litClient.encrypt({
      dataToEncrypt: voxtralApiKey,  // Pass as string directly
      unifiedAccessControlConditions: accessControlConditions,
      chain: 'ethereum',
    });

    console.log('✅ Encryption complete!');

    // Create encrypted key object (using encryptedData structure)
    const encryptedKey = {
      ciphertext: encryptedData.ciphertext,
      dataToEncryptHash: encryptedData.dataToEncryptHash,
      accessControlConditions,
      encryptedAt: new Date().toISOString(),
      cid: ipfsCid,
    };

    // Save to keys directory
    const keyFilePath = resolve(__dirname, '../keys/voxtral_api_key.json');
    writeFileSync(keyFilePath, JSON.stringify(encryptedKey, null, 2));

    console.log('\n📁 Saved to:', keyFilePath);
    console.log('\n📋 Encrypted Key Object:');
    console.log('--------------------------------------------------');
    console.log(JSON.stringify(encryptedKey, null, 2));
    console.log('--------------------------------------------------');

    console.log('\n✅ Done! You can now use this encrypted key in your Lit Action.');
    console.log('\n💡 Next steps:');
    console.log('   1. Pass this encrypted key object as voxtralEncryptedKey in jsParams');
    console.log('   2. Lit Action will decrypt using Lit.Actions.decryptAndCombine()');
    console.log('   3. Test with: bun tests/test-sat-it-back-v1.mjs');

    await litClient.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

encryptVoxtralKey().catch(console.error);
