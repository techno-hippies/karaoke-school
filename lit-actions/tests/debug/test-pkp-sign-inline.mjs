#!/usr/bin/env bun

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const PKP_PUBLIC_KEY = '0x04bc29b899d12c9bbbe0834f34adc73e6dc7dcc2ba79309c9c53249b06327f09abdd20f194979d13e390e8ba235db6ec1523cac332439f9eccafe5c4b8c12e726b';

const TEST_ACTION = `
const go = async () => {
  try {
    const message = new Uint8Array(32);
    for (let i = 0; i < message.length; i++) {
      message[i] = i;
    }

    const signStart = Date.now();
    const signature = await Lit.Actions.signAndCombineEcdsa({
      toSign: message,
      publicKey: '${PKP_PUBLIC_KEY}',
      sigName: 'pkpSignDebug'
    });

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        elapsedMs: Date.now() - signStart,
        signature
      })
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({ success: false, error: error.message })
    });
  }
};

go();
`;

async function main() {
  console.log('🧪 Testing PKP signAndCombineEcdsa latency (nagaTest)');

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'pkp-sign-inline',
      networkName: 'naga-test',
      storagePath: './lit-auth-storage',
    }),
  });

  const litClient = await createLitClient({ network: nagaTest });
  const viemAccount = privateKeyToAccount('0x' + '0'.repeat(63) + '1');

  const authContext = await authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resources: [{ resource: new LitActionResource('*'), ability: 'lit-action-execution' }],
    },
    config: { account: viemAccount },
    litClient,
  });

  const start = Date.now();
  const result = await litClient.executeJs({ code: TEST_ACTION, authContext });
  const elapsed = Date.now() - start;

  console.log('⏱️  Total elapsed:', elapsed, 'ms');
  console.log('Response:', result.response);

  await litClient.disconnect();
}

main().catch((err) => {
  console.error('❌ PKP sign test failed:', err.message);
  process.exit(1);
});
