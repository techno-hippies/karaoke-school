import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const LIT_ACTION_CID = process.env.KARAOKE_GRADER_CID || 'QmUEXAWiN86KAXPzNWLTvnCW4mzLy3gWe7gLgvyBfUhnyk';

async function main() {
  console.log("🧪 Testing Karaoke Grader with testMode=FALSE (minimal data)\n");
  console.log("CID:", LIT_ACTION_CID);
  console.log("Network: nagaTest\n");

  const voxtralKey = JSON.parse(await readFile(join(__dirname, '../keys/voxtral_api_key.json'), 'utf-8'));
  const openRouterKey = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "karaoke-minimal-test",
      networkName: "naga-test",
      storagePath: "./lit-auth-storage"
    }),
  });

  const litClient = await createLitClient({ network: nagaTest });
  console.log("✅ Connected to nagaTest\n");

  const testPrivateKey = '0x' + '0'.repeat(63) + '1';
  const viemAccount = privateKeyToAccount(testPrivateKey);

  const authContext = await authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
      resources: [{
        resource: new LitActionResource('*'),
        ability: 'lit-action-execution'
      }]
    },
    config: { account: viemAccount },
    litClient
  });

  const jsParams = {
    performanceId: Date.now(),
    clipHash: '0x82fe906dd5a2cfe55f58c51dc2ba4f9054bc17b6dde8c38e5567490fdf10c070',
    spotifyTrackId: '0VjIjW4GlUZAMYd2vXMi3b',
    performer: '0x1111111111111111111111111111111111111111',
    voxtralEncryptedKey: voxtralKey,
    openRouterEncryptedKey: openRouterKey,
    transcriptOverride: "I can't feel my face when I'm with you",  // Short transcript
    lyricsOverride: [  // Only 2 lines
      { text: "I can't feel my face when I'm with you", startMs: 0, endMs: 2000 },
      { text: "But I love it", startMs: 2000, endMs: 3000 }
    ],
    testMode: false,  // *** REAL MODE - decrypt + API + PKP ***
    skipTx: process.env.KARAOKE_SKIP_TX === 'true',
    txDebugStage: process.env.KARAOKE_TX_STAGE || null,
  };

  console.log("🚀 Executing with testMode=FALSE (minimal payload)...\n");
  const start = Date.now();

  const result = await litClient.executeJs({
    ipfsId: LIT_ACTION_CID,
    authContext,
    jsParams
  });

  const elapsed = Date.now() - start;
  const response = JSON.parse(result.response);

  console.log(`✅ Completed in ${elapsed}ms`);
  console.log("Response:", JSON.stringify(response, null, 2));

  if (response.txHash) {
    console.log("\n🎉 PKP SIGNING WORKED!");
    console.log("TX:", response.txHash);
  }

  await litClient.disconnect();
  process.exit(response.success ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
