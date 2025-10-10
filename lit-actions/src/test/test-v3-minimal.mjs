#!/usr/bin/env node

/**
 * Minimal test to check if v3 Lit Action loads and executes at all
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

const MATCH_AND_SEGMENT_V3_CID = 'QmfGEJVFKnSN1EJKMhfRBeNvSZNRV4NCSmAQ7RPNufg26q';

async function main() {
  console.log('🔬 Minimal v3 Load Test\n');

  try {
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "v3-minimal-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });

    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network');

    const privateKey = process.env.PRIVATE_KEY;
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const viemAccount = privateKeyToAccount(cleanPrivateKey);

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

    console.log('✅ Auth context created');
    console.log('🚀 Testing if v3 action loads and executes...\n');

    // Try to execute with minimal/dummy params that won't trigger the full flow
    const jsParams = {
      geniusId: 999999999,  // Non-existent ID
      writeToBlockchain: false,
      runAlignment: false,
      // Provide dummy encryption params to avoid undefined errors
      geniusKeyAccessControlConditions: [],
      geniusKeyCiphertext: '',
      geniusKeyDataToEncryptHash: '',
      openrouterKeyAccessControlConditions: [],
      openrouterKeyCiphertext: '',
      openrouterKeyDataToEncryptHash: ''
    };

    const startTime = Date.now();
    const result = await litClient.executeJs({
      ipfsId: MATCH_AND_SEGMENT_V3_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = Date.now() - startTime;
    console.log(`✅ Execution completed in ${executionTime}ms\n`);
    console.log('Response:', result.response);

    await litClient.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

main();
