import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
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

const LIT_ACTION_CID = process.env.KARAOKE_GRADER_CID || 'QmWAKj9fULe2TVnkd9z49WadxrL957DSmDKquL75jcK9aq';

async function main() {
  console.log("🧪 Testing Karaoke Grader on nagaDev network\n");
  console.log("CID:", LIT_ACTION_CID);
  console.log("Network: nagaDev\n");

  const voxtralKey = JSON.parse(await readFile(join(__dirname, '../keys/voxtral_api_key.json'), 'utf-8'));
  const openRouterKey = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "karaoke-nagadev-test",
      networkName: "naga-dev",
      storagePath: "./lit-auth-storage-dev"
    }),
  });

  const litClient = await createLitClient({ network: nagaDev });
  console.log("✅ Connected to nagaDev\n");

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
    transcriptOverride: "I can't feel my face when I'm with you",
    lyricsOverride: [
      { text: "I can't feel my face when I'm with you", startMs: 0, endMs: 2000 },
      { text: "But I love it", startMs: 2000, endMs: 3000 }
    ],
    testMode: false,
    skipTx: process.env.KARAOKE_SKIP_TX === 'true',
    txDebugStage: process.env.KARAOKE_TX_STAGE || null,
  };

  console.log("🚀 Executing with PKP signing test...\n");
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
    console.log("\n🎉 PKP SIGNING WORKED ON NAGADEV!");
    console.log("TX:", response.txHash);
  }

  await litClient.disconnect();
  process.exit(response.success ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
