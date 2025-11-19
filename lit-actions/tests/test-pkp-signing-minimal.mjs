import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toHex } from 'viem';

console.log("🧪 Minimal PKP Signing Test\n");

const PKP_PUBLIC_KEY = "0x04bc29b899d12c9bbbe0834f34adc73e6dc7dcc2ba79309c9c53249b06327f09abdd20f194979d13e390e8ba235db6ec1523cac332439f9eccafe5c4b8c12e726b"; // Same as karaoke-grader
const LIT_ACTION_CID = process.env.LIT_ACTION_CID || "QmTB4STmeyVUatxtt3MZD4a8E61rYVncU5dZT7Y5k66TDk";

async function main() {
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "pkp-test",
      networkName: "naga-test",
      storagePath: "./lit-auth-storage-pkp-test"
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

  // Simple message to sign
  const messageToSign = "Hello from PKP test!";
  const messageHash = keccak256(toHex(messageToSign));

  console.log("📝 Test Parameters:");
  console.log("   CID:", LIT_ACTION_CID);
  console.log("   PKP Public Key:", PKP_PUBLIC_KEY);
  console.log("   Message:", messageToSign);
  console.log("   Message Hash:", messageHash);
  console.log();

  console.log("🚀 Executing PKP signing test...\n");
  const start = Date.now();

  try {
    const result = await litClient.executeJs({
      ipfsId: LIT_ACTION_CID,
      authContext,
      jsParams: {
        messageToSign: Array.from(Buffer.from(messageHash.slice(2), 'hex')),
        pkpPublicKey: PKP_PUBLIC_KEY
      }
    });

    const elapsed = Date.now() - start;
    const response = JSON.parse(result.response);

    console.log(`✅ Completed in ${elapsed}ms`);
    console.log("Response:", JSON.stringify(response, null, 2));

    if (response.success) {
      console.log("\n🎉 PKP SIGNING WORKS!");
      console.log("Signature:", response.signature);
    } else {
      console.log("\n❌ PKP SIGNING FAILED");
      console.log("Error:", response.error);
    }

    await litClient.disconnect();
    process.exit(response.success ? 0 : 1);

  } catch (error) {
    const elapsed = Date.now() - start;
    console.error(`❌ Test failed after ${elapsed}ms:`, error.message);
    await litClient.disconnect();
    process.exit(1);
  }
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
