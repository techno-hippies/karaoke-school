#!/usr/bin/env node
import { createLitClient } from '@lit-protocol/lit-client'
import { nagaDev, nagaTest } from '@lit-protocol/networks'
import { createAuthManager, storagePlugins } from '@lit-protocol/auth'
import { LitActionResource } from '@lit-protocol/auth-helpers'
import { privateKeyToAccount } from 'viem/accounts'

const LIT_NETWORK = (process.env.LIT_NETWORK || 'naga-test').toLowerCase()
const IS_NAGA_TEST = LIT_NETWORK === 'naga-test'
const litNetwork = IS_NAGA_TEST ? nagaTest : nagaDev
const USER_MAX_PRICE = process.env.LIT_USER_MAX_PRICE
  ? BigInt(process.env.LIT_USER_MAX_PRICE)
  : 500_000_000_000_000_000n // 0.5 for debugging

async function main() {
  console.log('🧪 Billing smoke test')
  console.log('Network:', LIT_NETWORK, IS_NAGA_TEST ? '(paid)' : '(free)')

  const payerPrivateKey =
    process.env.PAYER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    ('0x' + '0'.repeat(63) + '1')
  const account = privateKeyToAccount(
    payerPrivateKey.startsWith('0x') ? payerPrivateKey : `0x${payerPrivateKey}`
  )

  console.log('Payer:', account.address)

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'billing-smoke',
      networkName: LIT_NETWORK,
      storagePath: `./lit-auth-storage-${LIT_NETWORK}`,
    }),
  })

  const litClient = await createLitClient({ network: litNetwork })
  const authContext = await authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resources: [{ resource: new LitActionResource('*'), ability: 'lit-action-execution' }],
    },
    config: { account },
    litClient,
  })

  const code = `(() => {
    Lit.Actions.setResponse({ response: JSON.stringify({ ok: true }) });
  })();`

  const start = Date.now()
  const result = await litClient.executeJs({ code, authContext, userMaxPrice: USER_MAX_PRICE })
  const ms = Date.now() - start
  console.log('Execution time:', ms, 'ms')
  console.log('Response:', result.response)
}

main().catch((err) => {
  console.error('❌ Billing smoke test failed:', err)
  process.exit(1)
})
