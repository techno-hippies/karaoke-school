#!/usr/bin/env node

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const MINIMAL_CID = 'QmVuDeeYkFvdbQ6vgUPVq3gpFtZGv43t3BxB33E36fE1sC';

async function main() {
  console.log('🧪 Testing minimal v3...\n');

  try {
    // Set up Auth Manager
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "minimal-v3-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });

    // Connect to Lit
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)\n');

    // Create authentication context
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in .env');
    }

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
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('🚀 Executing minimal v3...\n');

    const result = await litClient.executeJs({
      ipfsId: MINIMAL_CID,
      authContext: authContext,
      jsParams: {},
    });

    console.log('✅ Execution completed!\n');
    console.log('Response:', JSON.parse(result.response));

    await litClient.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
