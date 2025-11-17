#!/usr/bin/env node

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CID = 'QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq';

async function main() {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const voxtralKey = process.env.VOXTRAL_API_KEY;

  if (!openRouterKey || !voxtralKey) {
    console.error('Missing API keys in environment');
    process.exit(1);
  }

  console.log('Encrypting for CID:', CID);
  console.log('OpenRouter key length:', openRouterKey.length);
  console.log('Voxtral key length:', voxtralKey.length);

  const litClient = await createLitClient({ network: nagaTest });
  console.log('Connected to Lit');

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
        value: CID,
      },
    },
  ];

  // Encrypt OpenRouter key
  const encryptedOpenRouter = await litClient.encrypt({
    dataToEncrypt: openRouterKey,
    unifiedAccessControlConditions: accessControlConditions,
    chain: 'ethereum',
  });

  const openRouterData = {
    ciphertext: encryptedOpenRouter.ciphertext,
    dataToEncryptHash: encryptedOpenRouter.dataToEncryptHash,
    accessControlConditions,
    encryptedAt: new Date().toISOString(),
    cid: CID,
  };

  writeFileSync(
    resolve(__dirname, '../keys/openrouter_api_key.json'),
    JSON.stringify(openRouterData, null, 2)
  );

  // Encrypt Voxtral key
  const encryptedVoxtral = await litClient.encrypt({
    dataToEncrypt: voxtralKey,
    unifiedAccessControlConditions: accessControlConditions,
    chain: 'ethereum',
  });

  const voxtralData = {
    ciphertext: encryptedVoxtral.ciphertext,
    dataToEncryptHash: encryptedVoxtral.dataToEncryptHash,
    accessControlConditions,
    encryptedAt: new Date().toISOString(),
    cid: CID,
  };

  writeFileSync(
    resolve(__dirname, '../keys/voxtral_api_key.json'),
    JSON.stringify(voxtralData, null, 2)
  );

  console.log('✅ Keys encrypted and saved');
  console.log('OpenRouter hash:', encryptedOpenRouter.dataToEncryptHash);
  console.log('Voxtral hash:', encryptedVoxtral.dataToEncryptHash);

  await litClient.disconnect();
}

main().catch(console.error);
