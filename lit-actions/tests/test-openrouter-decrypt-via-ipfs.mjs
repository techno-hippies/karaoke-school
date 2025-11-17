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

const DECRYPT_ACTION = `
const go = async () => {
  try {
    const { openRouterEncryptedKey } = jsParams || {};

    console.log("Decrypting OpenRouter key via currentActionIpfsId...");
    const apiKey = await Lit.Actions.decryptAndCombine({
      accessControlConditions: openRouterEncryptedKey.accessControlConditions,
      ciphertext: openRouterEncryptedKey.ciphertext,
      dataToEncryptHash: openRouterEncryptedKey.dataToEncryptHash,
      authSig: null,
      chain: "ethereum",
    });
    console.log("✅ Decryption successful, key length:", apiKey.length);

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
        error: error.message,
        stack: error.stack
      })
    });
  }
};

go();
`;

async function main() {
  console.log("🧪 Testing OpenRouter Key Decryption via IPFS CID\n");

  const openRouterKey = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));
  const CID = openRouterKey.cid;

  console.log("OpenRouter key CID:", CID);
  console.log("Access control value:", openRouterKey.accessControlConditions[0].returnValueTest.value);
  console.log();

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "openrouter-ipfs-decrypt-test",
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

  console.log("🚀 Uploading and executing decrypt action via code...\n");
  const start = Date.now();

  // First try with code (should fail)
  try {
    const result = await litClient.executeJs({
      code: DECRYPT_ACTION,
      authContext,
      jsParams: {
        openRouterEncryptedKey: openRouterKey
      }
    });
    const response = JSON.parse(result.response);
    console.log("Code execution result:", response);
  } catch (err) {
    console.log("Code execution failed (expected):", err.message.substring(0, 100));
  }

  console.log("\n🚀 Now executing via IPFS CID...\n");

  // Upload the decrypt action to IPFS
  const { IpfsHash } = await uploadToPinata(DECRYPT_ACTION);
  console.log("Uploaded decrypt test to IPFS:", IpfsHash);

  // Add PKP permission for this CID
  console.log("Adding PKP permission for test CID...");
  await addPKPPermission(IpfsHash);

  // Re-encrypt the key for this CID
  console.log("Re-encrypting key for test CID...");
  const testKey = await reencryptKey(IpfsHash);

  // Now try with IPFS CID
  const result2 = await litClient.executeJs({
    ipfsId: IpfsHash,
    authContext,
    jsParams: {
      openRouterEncryptedKey: testKey
    }
  });

  const elapsed = Date.now() - start;
  const response2 = JSON.parse(result2.response);

  console.log(`\n✅ IPFS execution completed in ${elapsed}ms`);
  console.log("Response:", response2);

  await litClient.disconnect();
  process.exit(response2.success ? 0 : 1);
}

async function uploadToPinata(code) {
  const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PINATA_JWT}`
    },
    body: JSON.stringify({
      pinataContent: code,
      pinataMetadata: { name: 'openrouter-decrypt-test' }
    })
  });
  return await response.json();
}

async function addPKPPermission(ipfsId) {
  // Simplified - would need actual implementation
  console.log("(Skipping PKP permission - using '*' resource)");
}

async function reencryptKey(ipfsId) {
  // Simplified - would need actual implementation
  const original = JSON.parse(await readFile(join(__dirname, '../keys/openrouter_api_key.json'), 'utf-8'));
  return {
    ...original,
    accessControlConditions: [{
      ...original.accessControlConditions[0],
      returnValueTest: { comparator: '=', value: ipfsId }
    }]
  };
}

main().catch(err => {
  console.error("❌ Test failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
