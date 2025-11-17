#!/usr/bin/env bun

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config({ path: './.env' });

const TEST_ACTION = `
const go = async () => {
  try {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_blockNumber",
      params: [],
      id: 1,
    });

    const response = await fetch("https://rpc.testnet.lens.xyz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const text = await response.text();

    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: response.ok,
        status: response.status,
        body: text.slice(0, 500),
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
  console.log('🧪 Testing Lens RPC reachability from Lit Actions (nagaTest)');

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'lens-rpc-test',
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

  console.log('✅ Connected to nagaTest, executing inline action...');
  const start = Date.now();

  const result = await litClient.executeJs({ code: TEST_ACTION, authContext });
  const elapsed = Date.now() - start;

  console.log('⏱️  Completed in', elapsed, 'ms');
  console.log('Response:', result.response);

  await litClient.disconnect();
}

main().catch((err) => {
  console.error('❌ Lens RPC test failed:', err.message);
  process.exit(1);
});
