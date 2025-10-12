/**
 * Test Auto-Purchase Credits Lit Action
 *
 * Prerequisites:
 * 1. PKP must be funded with USDC on Base Sepolia
 * 2. Lit Action CID must be permitted on PKP
 * 3. USDC contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia)
 * 4. Credits contract: 0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6 (Base Sepolia)
 *
 * Usage:
 * DOTENV_PRIVATE_KEY=xxx dotenvx run -- node src/test/test-auto-purchase-credits.mjs
 */

import fs from "fs";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";
import { ethers } from "ethers";

const PKP_PUBLIC_KEY = process.env.PKP_PUBLIC_KEY;
const PKP_ETH_ADDRESS = process.env.PKP_ETH_ADDRESS;

if (!PKP_PUBLIC_KEY || !PKP_ETH_ADDRESS) {
  console.error("❌ Missing PKP_PUBLIC_KEY or PKP_ETH_ADDRESS in .env");
  process.exit(1);
}

console.log("🧪 Testing Auto-Purchase Credits Lit Action");
console.log("PKP Address:", PKP_ETH_ADDRESS);

// Initialize Lit client
console.log("Connecting to Lit Network...");
const litNodeClient = new LitJsSdk.LitNodeClient({
  litNetwork: LitNetwork.DatilDev,
  debug: false,
});

await litNodeClient.connect();
console.log("✅ Connected to Lit Network\n");

// Load Lit Action code
const litActionCode = fs.readFileSync(
  "src/karaoke/auto-purchase-credits.js",
  "utf8"
);

console.log("📋 Lit Action Parameters:");
console.log("  - pkpAddress:", PKP_ETH_ADDRESS);
console.log("  - publicKey:", PKP_PUBLIC_KEY);
console.log("  - creditsContract: 0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6");
console.log("  - usdcContract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e");
console.log("  - minCreditThreshold: 5\n");

try {
  console.log("🚀 Executing Lit Action...\n");
  const startTime = Date.now();

  const result = await litNodeClient.executeJs({
    code: litActionCode,
    sessionSigs: {}, // Using PKP auth context (zero sigs)
    jsParams: {
      pkpAddress: PKP_ETH_ADDRESS,
      publicKey: PKP_PUBLIC_KEY,
      creditsContract: "0x5AA8B71E835E0c5CCeCa6c4a1d98891839E416E6",
      usdcContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      minCreditThreshold: 5
    },
  });

  const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "=".repeat(80));
  console.log("📊 EXECUTION RESULT");
  console.log("=".repeat(80));
  console.log("Execution time:", executionTime, "seconds");
  console.log("Response:", result.response);

  if (result.response) {
    const parsedResponse = JSON.parse(result.response);
    console.log("\n📦 Parsed Response:");
    console.log(JSON.stringify(parsedResponse, null, 2));

    if (parsedResponse.success && parsedResponse.action === "purchased") {
      console.log("\n✅ Credits purchased successfully!");
      console.log(`  - Transaction: ${parsedResponse.txHash}`);
      console.log(`  - Credits earned: ${parsedResponse.creditsEarned}`);
      console.log(`  - Package price: $${parsedResponse.packagePrice}`);
      console.log(`  - Previous credits: ${parsedResponse.previousCredits}`);
      console.log(`  - USDC balance: ${parsedResponse.usdcBalance} USDC`);
      console.log(
        `\n🔗 View on BaseScan: https://sepolia.basescan.org/tx/${parsedResponse.txHash}`
      );
    } else if (parsedResponse.action === "none") {
      console.log(`\n⚠️ No purchase needed: ${parsedResponse.message}`);
    } else {
      console.log(`\n❌ Purchase failed: ${parsedResponse.message || parsedResponse.error}`);
    }
  }

  console.log("=".repeat(80) + "\n");

  // Logs
  if (result.logs) {
    console.log("📋 Lit Action Logs:");
    console.log(result.logs);
  }

  console.log("\n✅ TEST COMPLETED");

} catch (error) {
  console.error("\n❌ Test failed:", error.message);
  if (error.details) {
    console.error("Details:", error.details);
  }
  console.error("\nStack trace:", error.stack);
  process.exit(1);
} finally {
  process.exit(0);
}
