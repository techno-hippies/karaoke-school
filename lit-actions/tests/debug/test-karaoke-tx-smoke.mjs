#!/usr/bin/env bun

import { createLitClient } from "@lit-protocol/lit-client";
import { nagaDev } from "@lit-protocol/networks";
import { createAuthManager, storagePlugins } from "@lit-protocol/auth";
import { LitActionResource } from "@lit-protocol/auth-helpers";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";

dotenv.config();

const LIT_ACTION_CID = process.env.KARAOKE_SMOKE_CID;
const PERFORMANCE_ID = process.env.KARAOKE_PERFORMANCE_ID || Date.now().toString();

if (!LIT_ACTION_CID) {
  console.error("KARAOKE_SMOKE_CID env var is required");
  process.exit(1);
}

async function main() {
  console.log("🎤 Karaoke Tx Smoke Test\n");

  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: "karaoke-tx-smoke",
      networkName: "naga-dev",
      storagePath: "./lit-auth-storage",
    }),
  });

  const litClient = await createLitClient({ network: nagaDev });

  const testPrivateKey = "0x" + "0".repeat(63) + "1";
  const viemAccount = privateKeyToAccount(testPrivateKey);

  const authContext = await authManager.createEoaAuthContext({
    authConfig: {
      chain: "ethereum",
      expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
      resources: [
        {
          resource: new LitActionResource("*"),
          ability: "lit-action-execution",
        },
      ],
    },
    config: { account: viemAccount },
    litClient,
  });

  const jsParams = {
    performanceId: PERFORMANCE_ID,
  };

  console.log("🚀 Executing Lit Action", LIT_ACTION_CID);

  const start = Date.now();
  const result = await litClient.executeJs({
    ipfsId: LIT_ACTION_CID,
    authContext,
    jsParams,
  });
  const elapsed = Date.now() - start;

  console.log("✅ Execution finished in", elapsed, "ms");
  console.log(result.response);
}

main().catch((err) => {
  console.error("❌ Smoke test failed", err);
  process.exit(1);
});
