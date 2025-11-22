#!/usr/bin/env bun

/**
 * Billing smoke test - verifies Lit billing delegation works.
 *
 * Usage:
 *   LIT_NETWORK=naga-dev bun tests/shared/test-lit-billing-smoke.ts
 *   LIT_NETWORK=naga-test bun tests/shared/test-lit-billing-smoke.ts
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from './env';

const USER_MAX_PRICE = process.env.LIT_USER_MAX_PRICE
  ? BigInt(process.env.LIT_USER_MAX_PRICE)
  : 500_000_000_000_000_000n; // 0.5 for debugging

async function main() {
  console.log('🧪 Billing smoke test');
  console.log('Network:', Env.name, Env.isTest ? '(payments enforced)' : '(free)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const payerPrivateKey = (
    process.env.PAYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    ('0x' + '0'.repeat(63) + '1')
  ) as `0x${string}`;
  const account = privateKeyToAccount(payerPrivateKey);

  console.log('Payer:', account.address, Env.isTest ? '(needs tstLPX/delegation)' : '(free)');

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'billing-smoke',
      networkName: Env.name,
      storagePath: Env.getAuthStoragePath('billing'),
    }),
  });

  const litClient = await createLitClient({ network: Env.litNetwork });
  const authContext = await authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resources: [{ resource: new LitActionResource('*'), ability: 'lit-action-execution' }],
    },
    config: { account },
    litClient,
  });

  const code = `(() => {
    Lit.Actions.setResponse({ response: JSON.stringify({ ok: true }) });
  })();`;

  const start = Date.now();
  const result = await litClient.executeJs({ code, authContext, userMaxPrice: USER_MAX_PRICE });
  const ms = Date.now() - start;
  console.log('Execution time:', ms, 'ms');
  console.log('Response:', result.response);
  await litClient.disconnect();
  process.exit(0);
}

main().catch((err: any) => {
  console.error('❌ Billing smoke test failed:', err.message);
  process.exit(1);
});
