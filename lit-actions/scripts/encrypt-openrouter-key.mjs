#!/usr/bin/env node

/**
 * Encrypt OpenRouter API key for a specific Lit Action IPFS CID
 *
 * Usage:
 *   node scripts/encrypt-openrouter-key.mjs <IPFS_CID> <OPENROUTER_API_KEY> [network]
 *
 * Network options (optional, defaults to nagaDev):
 *   nagaDev  - Naga development network
 *   nagaTest - Naga test network
 *
 * Examples:
 *   node scripts/encrypt-openrouter-key.mjs QmRzS... sk-or-v1-...
 *   node scripts/encrypt-openrouter-key.mjs QmRzS... sk-or-v1-... nagaTest
 */

import { createLitClient } from "@lit-protocol/lit-client";
import { nagaDev, nagaTest } from "@lit-protocol/networks";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function encryptOpenRouterKey() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(
      "Usage: node scripts/encrypt-openrouter-key.mjs <IPFS_CID> <OPENROUTER_API_KEY> [network]"
    );
    console.error('Example: node scripts/encrypt-openrouter-key.mjs QmRzS... sk-or-v1-... nagaTest');
    process.exit(1);
  }

  const [ipfsCid, apiKey, networkArg = 'nagaDev'] = args;

  const networkMap = { nagaDev, nagaTest };
  const network = networkMap[networkArg];

  if (!network) {
    console.error(`❌ Invalid network: ${networkArg}`);
    console.error('Valid options: nagaDev, nagaTest');
    process.exit(1);
  }

  console.log("🔐 Encrypting OpenRouter API key for CID:", ipfsCid);
  console.log('🔑 API key length:', apiKey.length);
  console.log('📡 Network:', networkArg);

  const litClient = await createLitClient({ network });

  const accessControlConditions = [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":currentActionIpfsId"],
      returnValueTest: { comparator: "=", value: ipfsCid },
    },
  ];

  const encryptedData = await litClient.encrypt({
    dataToEncrypt: apiKey,
    unifiedAccessControlConditions: accessControlConditions,
    chain: "ethereum",
  });

  const output = {
    ciphertext: encryptedData.ciphertext,
    dataToEncryptHash: encryptedData.dataToEncryptHash,
    accessControlConditions,
    encryptedAt: new Date().toISOString(),
    cid: ipfsCid,
  };

  const keyPath = resolve(__dirname, "../keys/openrouter_api_key.json");
  writeFileSync(keyPath, JSON.stringify(output, null, 2));

  console.log("✅ Saved encrypted key to", keyPath);

  await litClient.disconnect();
}

encryptOpenRouterKey().catch((error) => {
  console.error("❌ Encryption failed", error);
  process.exit(1);
});
