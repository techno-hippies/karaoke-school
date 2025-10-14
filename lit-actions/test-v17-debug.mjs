#!/usr/bin/env node
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import dotenv from 'dotenv';

dotenv.config();

const geniusKey = JSON.parse(await readFile('src/karaoke/keys/genius_api_key_v17.json', 'utf-8'));
const openrouterKey = JSON.parse(await readFile('src/karaoke/keys/openrouter_api_key_v17.json', 'utf-8'));

const litClient = await createLitClient({ network: nagaDev });
const authManager = createAuthManager({
  storage: storagePlugins.localStorageNode({
    appName: "test-v17-debug",
    networkName: "naga-dev",
    storagePath: "./lit-auth-storage"
  }),
});

const viemAccount = privateKeyToAccount(process.env.PRIVATE_KEY.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`);
const authContext = await authManager.createEoaAuthContext({
  authConfig: {
    chain: 'ethereum',
    expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    resources: [
      { resource: new LitActionResource('*'), ability: 'lit-action-execution' },
      { resource: new LitPKPResource('*'), ability: 'pkp-signing' }
    ]
  },
  config: { account: viemAccount },
  litClient: litClient
});

await new Promise(resolve => setTimeout(resolve, 2000));

const result = await litClient.executeJs({
  ipfsId: 'QmV6qNYCB2GvWa6qtRr1hXLU9T4YTE2Z3TQcipQafQwCBw',
  authContext: authContext,
  jsParams: {
    geniusId: 378195,
    geniusKeyAccessControlConditions: geniusKey.accessControlConditions,
    geniusKeyCiphertext: geniusKey.ciphertext,
    geniusKeyDataToEncryptHash: geniusKey.dataToEncryptHash,
    openrouterKeyAccessControlConditions: openrouterKey.accessControlConditions,
    openrouterKeyCiphertext: openrouterKey.ciphertext,
    openrouterKeyDataToEncryptHash: openrouterKey.dataToEncryptHash,
    contractAddress: '0x422f686f5CdFB48d962E1D7E0F5035D286a1ccAa',
    writeToBlockchain: true
  },
});

const response = JSON.parse(result.response);
console.log('\n=== FULL RESPONSE ===');
console.log(JSON.stringify(response, null, 2));

await litClient.disconnect();
process.exit(0);
