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
  try {
    const { openRouterEncryptedKey } = jsParams || {};
    
    const apiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: openRouterEncryptedKey.accessControlConditions,
      ciphertext: openRouterEncryptedKey.ciphertext,
      dataToEncryptHash: openRouterEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: "ethereum",
    });
    
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        keyLength: apiKey.length
      })
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message
      })
    });
  }
};

go();
`;

async function main() {
  console.log("🧪 Testing OpenRouter Key Decryption on nagaTest\n");

  const openRouterKey = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "openrouter-decrypt-test",
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

  console.log("🚀 Testing key decryption...\n");
  const start = Date.now();

  const result = await litClient.executeJs({
    code: TEST_ACTION,
    authContext,
    jsParams: {
      openRouterEncryptedKey: openRouterKey
    }
  });

  const elapsed = Date.now() - start;
  const response = JSON.parse(result.response);

  console.log(`✅ Completed in ${elapsed}ms`);
  console.log("Response:", response);

  await litClient.disconnect();
  process.exit(response.success ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
