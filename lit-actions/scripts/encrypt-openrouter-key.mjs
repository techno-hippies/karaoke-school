#!/usr/bin/env node

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev, nagaTest } from '@lit-protocol/networks';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function encryptOpenRouterKey() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node scripts/encrypt-openrouter-key.mjs <IPFS_CID> <OPENROUTER_API_KEY> [network]');
    process.exit(1);
  }

  const [ipfsCid, openRouterApiKey, networkArg = 'nagaDev'] = args;

  const networkMap = { nagaDev, nagaTest };
  const network = networkMap[networkArg];

  if (!network) {
    console.error(`❌ Invalid network: ${networkArg}`);
    console.error('Valid options: nagaDev, nagaTest');
    process.exit(1);
  }

  console.log('🔐 Encrypting OpenRouter API key for CID:', ipfsCid);
  console.log('🔑 API key length:', openRouterApiKey.length);
  console.log('📡 Network:', networkArg);

  try {
    console.log('⚡ Connecting to Lit network...');
    const litClient = await createLitClient({ network });
    console.log('✅ Connected to Lit network');

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

    const encryptedData = await litClient.encrypt({
      dataToEncrypt: openRouterApiKey,
      unifiedAccessControlConditions: accessControlConditions,
      chain: 'ethereum',
    });

    console.log('✅ Encryption complete!');

    const encryptedKey = {
      ciphertext: encryptedData.ciphertext,
      dataToEncryptHash: encryptedData.dataToEncryptHash,
      accessControlConditions,
      encryptedAt: new Date().toISOString(),
      cid: ipfsCid,
    };

    const keyFilePath = resolve(__dirname, '../keys/openrouter_api_key.json');
    writeFileSync(keyFilePath, JSON.stringify(encryptedKey, null, 2));

    console.log('\n📁 Saved to:', keyFilePath);
    console.log('\n📋 Encrypted Key Object:');
    console.log('--------------------------------------------------');
    console.log(JSON.stringify(encryptedKey, null, 2));
    console.log('--------------------------------------------------');

    console.log('\n✅ Done!');

    await litClient.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

encryptOpenRouterKey().catch(console.error);
