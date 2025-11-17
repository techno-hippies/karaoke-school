import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const NEW_CID = 'QmeCn2FS15yAwZPjTCG4V5C3qhgYBn4BdmL1C1MGY1uFP1';

// Minimal test action that just decrypts the openRouter key
const TEST_ACTION_CODE = `
const go = async () => {
  try {
    console.log("Starting openRouter key decrypt test...");
    const { openRouterEncryptedKey } = jsParams || {};
    
    if (!openRouterEncryptedKey) {
      throw new Error("openRouterEncryptedKey missing");
    }
    
    console.log("Decrypting...");
    const apiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: openRouterEncryptedKey.accessControlConditions,
      ciphertext: openRouterEncryptedKey.ciphertext,
      dataToEncryptHash: openRouterEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: "ethereum",
    });
    
    console.log("Decrypt successful, key length:", apiKey.length);
    
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 10)
      })
    });
  } catch (error) {
    console.error("Error:", error.message);
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
  console.log("🧪 Testing OpenRouter Key Decryption with New CID\n");
  console.log("New CID:", NEW_CID, "\n");

  const openRouterKey = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));
  console.log("OpenRouter key CID:", openRouterKey.cid);
  console.log("Match:", openRouterKey.cid === NEW_CID ? "✅" : "❌", "\n");

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "decrypt-test",
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

  console.log("🚀 Testing via IPFS CID (uses access control)...\n");
  const start = Date.now();

  const result = await litClient.executeJs({
    ipfsId: NEW_CID,
    authContext,
    jsParams: {
      openRouterEncryptedKey: openRouterKey,
      testMode: false  // Force it to try decryption
    }
  });

  const elapsed = Date.now() - start;
  const response = JSON.parse(result.response);

  console.log(`✅ Completed in ${elapsed}ms\n`);
  console.log("Response:", JSON.stringify(response, null, 2));

  await litClient.disconnect();
  process.exit(response.success ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Test failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
