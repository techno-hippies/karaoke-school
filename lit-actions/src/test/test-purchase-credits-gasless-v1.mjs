#!/usr/bin/env node

/**
 * Test Purchase Credits Gasless V1
 *
 * Tests the gasless credit purchase flow where:
 * - User's PKP signs permit (has USDC, no ETH) - done in this test with viem
 * - Relayer PKP submits transaction (has ETH, pays gas) - done by Lit Action
 *
 * Prerequisites:
 * 1. User PKP must have USDC on Base Sepolia (can have 0 ETH)
 * 2. Relayer PKP must have ETH on Base Sepolia (already funded)
 * 3. USDC contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 * 4. Credits contract: 0x6de183934E68051c407266F877fafE5C20F74653
 *
 * Usage:
 *   bun run src/test/test-purchase-credits-gasless-v1.mjs [packageId]
 *   bun run src/test/test-purchase-credits-gasless-v1.mjs 0
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource, LitPKPResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { hexToSignature } from 'viem';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

// PKP credentials path (this is the RELAYER PKP, also used as test user)
const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');

// Contract addresses
const CREDITS_CONTRACT = "0x6de183934E68051c407266F877fafE5C20F74653";
const USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';
const BASE_SEPOLIA_CHAIN_ID = 84532;

// Lit Action CID (refactored version that accepts pre-signed permit)
const PURCHASE_CREDITS_GASLESS_V1_CID = 'QmV1aMpM5ripCEwndS7KwyvBvjsCFTnJ1QV9qbKYbsGX1R';

// Package to purchase (default: 0 = 1 credit for $0.50)
const PACKAGE_ID = parseInt(process.argv[2]) || 0;

async function loadPKPCredentials() {
  console.log('🔑 Loading PKP credentials...');
  const pkpData = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
  console.log(`✅ PKP loaded: ${pkpData.ethAddress}`);
  return pkpData;
}

async function main() {
  console.log('🧪 Purchase Credits Gasless V1 Test\n');
  console.log('━'.repeat(80));
  console.log(`Test scenario: Gasless credit purchase with EIP-2612 permit`);
  console.log(`📦 Package ID: ${PACKAGE_ID}`);
  console.log('━'.repeat(80));

  try {
    // Load PKP credentials (using same PKP as both user and relayer for testing)
    const pkpCreds = await loadPKPCredentials();
    const userAddress = pkpCreds.ethAddress;
    const relayerAddress = pkpCreds.ethAddress;

    // Check balances before purchase
    console.log('\n💰 Checking balances...');
    const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");

    // Check user USDC
    const usdcAbi = ["function balanceOf(address) view returns (uint256)", "function nonces(address) view returns (uint256)"];
    const usdcContract = new ethers.Contract(USDC_CONTRACT, usdcAbi, provider);
    const userUsdcBalance = await usdcContract.balanceOf(userAddress);
    const userUsdcFormatted = ethers.formatUnits(userUsdcBalance, 6);
    console.log(`  User USDC: ${userUsdcFormatted} USDC`);

    // Check user ETH
    const userEthBalance = await provider.getBalance(userAddress);
    const userEthFormatted = ethers.formatEther(userEthBalance);
    console.log(`  User ETH: ${userEthFormatted} ETH`);

    // Check user credits before
    const creditsAbi = ["function getCredits(address) view returns (uint256)", "function getPackage(uint8) view returns (uint16 credits, uint256 priceUSDC, uint256 priceETH, bool enabled)"];
    const creditsContract = new ethers.Contract(CREDITS_CONTRACT, creditsAbi, provider);
    const creditsBefore = await creditsContract.getCredits(userAddress);
    console.log(`  User credits (before): ${creditsBefore.toString()}\n`);

    if (userUsdcBalance === 0n) {
      console.error("❌ User has no USDC! Cannot test purchase.");
      console.error("   Send some USDC to:", userAddress);
      process.exit(1);
    }

    // Get package details
    console.log('📦 Fetching package details...');
    const packageDetails = await creditsContract.getPackage(PACKAGE_ID);
    const packagePrice = packageDetails.priceUSDC;
    const packagePriceFormatted = ethers.formatUnits(packagePrice, 6);
    console.log(`  Package ${PACKAGE_ID}: ${packageDetails.credits} credits for $${packagePriceFormatted} USDC\n`);

    // ============================================================================
    // Step 1: Sign EIP-2612 Permit with User's PKP (using viem)
    // ============================================================================

    console.log('✍️  Step 1: Signing EIP-2612 permit with user PKP...');

    // Get current nonce for permit
    const nonce = await usdcContract.nonces(userAddress);
    console.log(`  USDC nonce: ${nonce.toString()}`);

    // Create deadline (1 hour from now)
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    console.log(`  Deadline: ${deadline}\n`);

    // Create viem account for signing
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in .env');
    }
    const cleanPrivateKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const viemAccount = privateKeyToAccount(cleanPrivateKey);

    // EIP-2612 Permit domain and types
    const domain = {
      name: 'USD Coin',
      version: '2',
      chainId: BASE_SEPOLIA_CHAIN_ID,
      verifyingContract: USDC_CONTRACT
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    };

    const message = {
      owner: userAddress,
      spender: CREDITS_CONTRACT,
      value: packagePrice.toString(),
      nonce: nonce.toString(),
      deadline: deadline
    };

    // Sign typed data with viem
    const { signTypedData } = await import('viem/accounts');
    const permitSignature = await signTypedData({
      privateKey: cleanPrivateKey,
      domain,
      types,
      primaryType: 'Permit',
      message
    });

    console.log(`  Permit signature: ${permitSignature.substring(0, 20)}...`);

    // Split signature into v, r, s
    const { v, r, s } = hexToSignature(permitSignature);
    console.log(`  Signature split: v=${v}, r=${r.substring(0, 10)}..., s=${s.substring(0, 10)}...`);
    console.log('✅ Permit signed\n');

    // ============================================================================
    // Step 2: Set up Lit Protocol and Execute Lit Action
    // ============================================================================

    // Set up Auth Manager
    console.log('🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "purchase-credits-gasless-v1-test",
        networkName: "naga-dev",
        storagePath: "./lit-auth-storage"
      }),
    });
    console.log('✅ Auth Manager created');

    // Connect to Lit
    console.log('\n🔌 Connecting to Lit Protocol...');
    const litClient = await createLitClient({ network: nagaDev });
    console.log('✅ Connected to Lit Network (nagaDev)');

    // Create authentication context
    console.log('\n🔐 Creating authentication context...');

    const authContext = await authManager.createEoaAuthContext({
      authConfig: {
        chain: 'ethereum',
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        resources: [
          {
            resource: new LitActionResource('*'),
            ability: 'lit-action-execution'
          },
          {
            resource: new LitPKPResource('*'),
            ability: 'pkp-signing'
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });

    console.log('✅ Auth context created');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Execute Lit Action
    console.log('\n' + '='.repeat(80));
    console.log('🚀 Executing Gasless Purchase Lit Action');
    console.log('='.repeat(80));

    const jsParams = {
      userPkpAddress: userAddress,
      relayerPkpAddress: relayerAddress,
      relayerPkpPublicKey: pkpCreds.publicKey,
      packageId: PACKAGE_ID,
      permitDeadline: deadline,
      permitV: Number(v),
      permitR: r,
      permitS: s,
      creditsContract: CREDITS_CONTRACT,
      usdcContract: USDC_CONTRACT,
    };

    console.log('\n📋 Parameters:');
    console.log(`  User: ${jsParams.userPkpAddress}`);
    console.log(`  Relayer: ${jsParams.relayerPkpAddress}`);
    console.log(`  Package: ${jsParams.packageId}`);
    console.log(`  Permit deadline: ${jsParams.permitDeadline}`);
    console.log(`  Permit v: ${jsParams.permitV}`);
    console.log(`  Permit r: ${jsParams.permitR.substring(0, 10)}...`);
    console.log(`  Permit s: ${jsParams.permitS.substring(0, 10)}...`);
    console.log(`  Credits Contract: ${jsParams.creditsContract}`);
    console.log(`  USDC Contract: ${jsParams.usdcContract}\n`);

    const startTime = Date.now();

    const result = await litClient.executeJs({
      ipfsId: PURCHASE_CREDITS_GASLESS_V1_CID,
      authContext: authContext,
      jsParams: jsParams,
    });

    const executionTime = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + "=".repeat(80));
    console.log('📊 EXECUTION RESULT');
    console.log("=".repeat(80));
    console.log('⏱️  Execution time:', executionTime, 'seconds');

    if (result.response) {
      const parsedResponse = JSON.parse(result.response);

      // Save response
      const outputDir = join(__dirname, '../../output');
      const outputFile = join(outputDir, `gasless-purchase-${userAddress.substring(0, 10)}-result.json`);
      await writeFile(outputFile, JSON.stringify(parsedResponse, null, 2));
      console.log(`💾 Saved result to: ${outputFile}\n`);

      console.log('📦 Response:');
      console.log(JSON.stringify(parsedResponse, null, 2));

      if (parsedResponse.success) {
        console.log('\n🎉 PURCHASE SUCCESSFUL!');
        console.log('━'.repeat(80));
        console.log(`  Transaction Hash: ${parsedResponse.txHash}`);
        console.log(`  Credits Earned: ${parsedResponse.creditsEarned}`);
        console.log(`  Package Price: $${parsedResponse.packagePrice} USDC`);
        console.log(`  User Address: ${parsedResponse.userAddress}`);
        console.log(`  Relayer Address: ${parsedResponse.relayerAddress}`);
        console.log('━'.repeat(80));
        console.log(`\n🔗 View on BaseScan: ${BASE_SEPOLIA_EXPLORER}/tx/${parsedResponse.txHash}`);

        // Check credits after purchase
        console.log('\n⏳ Waiting 5 seconds for transaction confirmation...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        const creditsAfter = await creditsContract.getCredits(userAddress);
        console.log(`\n💳 Credits balance:`);
        console.log(`  Before: ${creditsBefore.toString()}`);
        console.log(`  After: ${creditsAfter.toString()}`);
        console.log(`  Gained: +${(creditsAfter - creditsBefore).toString()}`);

      } else {
        console.log(`\n❌ PURCHASE FAILED`);
        console.log(`Error: ${parsedResponse.error}`);
        if (parsedResponse.stack) {
          console.log('Stack:', parsedResponse.stack.substring(0, 500));
        }
        await litClient.disconnect();
        process.exit(1);
      }
    }

    console.log('\n' + "=".repeat(80) + '\n');

    // Logs
    if (result.logs) {
      console.log('📋 Lit Action Logs:');
      console.log(result.logs);
    }

    console.log('\n✅ TEST COMPLETED');
    await litClient.disconnect();

  } catch (error) {
    console.error('\n' + "=".repeat(80));
    console.error('❌ TEST FAILED');
    console.error("=".repeat(80));
    console.error('Error:', error.message);
    if (error.details) {
      console.error('\nDetails:', error.details);
    }
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    console.error("=".repeat(80));
    process.exit(1);
  }
}

main().catch(console.error);
