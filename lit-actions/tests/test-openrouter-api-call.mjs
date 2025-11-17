#!/usr/bin/env node
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

const TEST_ACTION_CODE = `
const go = async () => {
  const start = Date.now();
  try {
    console.log("Step 1: Decrypting OpenRouter key...");
    const { openRouterEncryptedKey } = jsParams || {};

    const apiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: openRouterEncryptedKey.accessControlConditions,
      ciphertext: openRouterEncryptedKey.ciphertext,
      dataToEncryptHash: openRouterEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: "ethereum",
    });
    console.log("✅ Key decrypted, length:", apiKey.length);

    console.log("Step 2: Calling OpenRouter API...");
    const body = {
      model: "google/gemini-2.5-flash-lite-preview-09-2025",
      messages: [{ role: "user", content: "Say hello" }],
      max_tokens: 10
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: \`Bearer \${apiKey}\`
      },
      body: JSON.stringify(body)
    });

    console.log("✅ API responded, status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(\`OpenRouter API failed: \${response.status} \${errorText.substring(0, 200)}\`);
    }

    const json = await response.json();
    const message = json?.choices?.[0]?.message?.content || "(no content)";

    const elapsed = Date.now() - start;
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: true,
        message,
        elapsed
      })
    });
  } catch (error) {
    Lit.Actions.setResponse({
      response: JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack,
        elapsed: Date.now() - start
      })
    });
  }
};

go();
`;

async function main() {
  console.log("🧪 Testing OpenRouter API Call from Lit Action\n");
  console.log("This test will:");
  console.log("1. Decrypt openRouter key via IPFS CID");
  console.log("2. Call OpenRouter API with a simple request");
  console.log("3. Return the response\n");

  const openRouterKey = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));
  const CID = openRouterKey.cid;

  console.log("Using CID:", CID);
  console.log();

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "openrouter-api-test",
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

  console.log("🚀 Executing test via IPFS CID...\n");
  const start = Date.now();

  const result = await litClient.executeJs({
    ipfsId: CID,
    authContext,
    jsParams: {
      openRouterEncryptedKey: openRouterKey
    }
  });

  const elapsed = Date.now() - start;
  const response = JSON.parse(result.response);

  console.log(`\n✅ Completed in ${elapsed}ms`);
  console.log("Response:", JSON.stringify(response, null, 2));

  await litClient.disconnect();
  process.exit(response.success ? 0 : 1);
}

main().catch(err => {
  console.error("❌ Test failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
