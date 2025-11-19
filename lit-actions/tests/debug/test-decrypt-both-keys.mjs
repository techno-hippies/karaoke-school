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

const TEST_ACTION = `
const go = async () => {
  const startTime = Date.now();
  try {
    const { voxtralEncryptedKey, openRouterEncryptedKey } = jsParams || {};

    console.log("Step 1: Decrypting Voxtral key...");
    const voxtralKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: voxtralEncryptedKey.accessControlConditions,
      ciphertext: voxtralEncryptedKey.ciphertext,
      dataToEncryptHash: voxtralEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: "ethereum",
    });
    console.log("✅ Voxtral key decrypted, length:", voxtralKey.length);

    console.log("Step 2: Decrypting OpenRouter key...");
    const openRouterKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: openRouterEncryptedKey.accessControlConditions,
      ciphertext: openRouterEncryptedKey.ciphertext,
      dataToEncryptHash: openRouterEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: "ethereum",
    });
    console.log("✅ OpenRouter key decrypted, length:", openRouterKey.length);

    const elapsed = Date.now() - startTime;
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        voxtralKeyLength: voxtralKey.length,
        openRouterKeyLength: openRouterKey.length,
        elapsed
      })
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      })
    });
  }
};

go();
`;

async function main() {
  console.log("🧪 Testing Sequential Key Decryption on nagaTest\n");

  const voxtralKey = JSON.parse(await readFile(join(__dirname, '../keys/voxtral_api_key.json'), 'utf-8'));
  const openRouterKey = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));

  console.log("Voxtral key CID:", voxtralKey.cid);
  console.log("OpenRouter key CID:", openRouterKey.cid);
  console.log();

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "decrypt-both-test",
      networkName: "naga-test",
      storagePath: join(__dirname, '../lit-auth-storage')
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

  console.log("🚀 Testing sequential decryption...\n");
  const start = Date.now();

  const result = await litClient.executeJs({
    code: TEST_ACTION,
    authContext,
    jsParams: {
      voxtralEncryptedKey: voxtralKey,
      openRouterEncryptedKey: openRouterKey
    }
  });

  const elapsed = Date.now() - start;
  const response = JSON.parse(result.response);

  console.log(`\n✅ Completed in ${elapsed}ms`);
  console.log("Response:", response);

  await litClient.disconnect();
  process.exit(response.success ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
