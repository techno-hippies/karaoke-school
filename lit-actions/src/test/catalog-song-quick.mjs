#!/usr/bin/env node

/**
 * Quick script to catalog a song using match-and-segment-v7
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');
const GENIUS_KEY_PATH = join(__dirname, '../karaoke/keys/genius_api_key_v6.json');
const OPENROUTER_KEY_PATH = join(__dirname, '../karaoke/keys/openrouter_api_key_v12.json');
const KARAOKE_CATALOG_ADDRESS = '0x17D3BB01ACe342Fa85A5B9a439feEa65e2f1D726';
const MATCH_AND_SEGMENT_V7_CID = 'QmWh1BhvziAXVgxqp6n1EoqfVxbq8FkmBx5we6XBoH7Y1e';

const TEST_SONG = {
  geniusId: 378195,
  name: 'Sia - Chandelier'
};

async function main() {
  console.log('🎵 Cataloging song:', TEST_SONG.name);
  console.log('   Genius ID:', TEST_SONG.geniusId);

  try {
    const pkpCreds = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
    const geniusKey = JSON.parse(await readFile(GENIUS_KEY_PATH, 'utf-8'));
    const openrouterKey = JSON.parse(await readFile(OPENROUTER_KEY_PATH, 'utf-8'));

    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "catalog-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });

    console.log('🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });

    const privateKey = process.env.PRIVATE_KEY;
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const viemAccount = privateKeyToAccount(cleanPrivateKey);

    const authContext = await authManager.createEoaAuthContext({
      authConfig: {
        chain: 'ethereum',
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        resources: [
          {
            resource: new LitActionResource('*'),
            ability: 'lit-action-execution'
          },
          {
            resource: new LitPKPResource('*'),
            ability: 'pkp-signing'
          }
        ]
      },
      config: { account: viemAccount },
      litClient: litClient
    });

    console.log('✅ Auth context created\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🚀 Executing match-and-segment-v7...');
    const jsParams = {
      geniusId: TEST_SONG.geniusId,
      geniusKeyAccessControlConditions: geniusKey.accessControlConditions,
      geniusKeyCiphertext: geniusKey.ciphertext,
      geniusKeyDataToEncryptHash: geniusKey.dataToEncryptHash,
      openrouterKeyAccessControlConditions: openrouterKey.accessControlConditions,
      openrouterKeyCiphertext: openrouterKey.ciphertext,
      openrouterKeyDataToEncryptHash: openrouterKey.dataToEncryptHash,
      contractAddress: KARAOKE_CATALOG_ADDRESS,
      writeToBlockchain: true
    };

    const result = await litClient.executeJs({
      ipfsId: MATCH_AND_SEGMENT_V7_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const response = JSON.parse(result.response);

    if (response.success && response.isMatch) {
      console.log('✅ Song cataloged successfully!');
      console.log('   TX:', response.txHash);
      console.log('   Sections:', response.sections?.length || 0);

      console.log('\n⏳ Waiting 15s for confirmation...');
      await new Promise(r => setTimeout(r, 15000));

      console.log('\n✅ Ready to test translation!');
    } else {
      console.error('❌ Failed:', response.error || 'No match');
    }

    await litClient.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
