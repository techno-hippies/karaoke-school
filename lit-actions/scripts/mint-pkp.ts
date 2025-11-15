#!/usr/bin/env bun

/**
 * Mint PKP for Karaoke Scoreboard
 *
 * This script:
 * 1. Connects to Lit Protocol (configurable network)
 * 2. Uses your EOA to mint a PKP
 * 3. Adds signing permissions to the PKP
 * 4. Saves PKP credentials to .env file
 *
 * Prerequisites:
 * - PRIVATE_KEY set in .env (your deployer wallet)
 * - Chronicle Yellowstone testnet tokens (for PKP minting gas)
 *
 * Usage:
 *   bun run scripts/mint-pkp.ts [network]
 *
 * Network options:
 *   nagaDev (default) - Naga development network
 *   nagaTest         - Naga test network
 *
 * Examples:
 *   bun run scripts/mint-pkp.ts
 *   bun run scripts/mint-pkp.ts nagaTest
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev, nagaTest } from '@lit-protocol/networks';
import { createWalletClient, http, type Account, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import * as dotenv from 'dotenv';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Chronicle Yellowstone chain config (for PKP minting)
const chronicleYellowstone = defineChain({
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
  blockExplorers: {
    default: { name: 'Chronicle Explorer', url: 'https://yellowstone-explorer.litprotocol.com' },
  },
});

async function main() {
  console.log('🔐 Lit Protocol PKP Minting Script');
  console.log('===================================\n');

  // 1. Parse network argument
  const networkArg = process.argv[2] || 'nagaDev';
  const networkMap: Record<string, any> = {
    nagaDev,
    nagaTest,
  };

  const network = networkMap[networkArg];
  if (!network) {
    console.error(`❌ Invalid network: ${networkArg}`);
    console.log('\nValid options: nagaDev, nagaTest');
    process.exit(1);
  }

  console.log(`📡 Network: ${networkArg}\n`);

  // 2. Check for private key
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env file');
    console.log('\nPlease create a .env file with:');
    console.log('PRIVATE_KEY="0x..."');
    process.exit(1);
  }

  // Add 0x prefix if missing
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  // 3. Create account from private key
  console.log('📝 Creating account from private key...');
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log('✅ Account address:', account.address);

  // 3. Create wallet client for Chronicle Yellowstone (Lit's testnet)
  const walletClient = createWalletClient({
    account,
    chain: chronicleYellowstone,
    transport: http(),
  });

  console.log('\n💰 Checking balance on Chronicle Yellowstone...');
  console.log('⚠️  You need tstLPX tokens to mint a PKP');
  console.log('   Get tokens from: https://chronicle-yellowstone-faucet.getlit.dev/');

  // 4. Connect to Lit Protocol
  console.log(`\n🔌 Connecting to Lit Protocol (${networkArg} network)...`);
  const litClient = await createLitClient({
    network
  });
  console.log('✅ Connected to Lit Network');

  // 5. Mint PKP with EOA
  console.log('\n🪙 Minting PKP with your EOA...');
  console.log('   This may take a minute...');

  const mintedPkp = await litClient.mintWithEoa({
    account: walletClient.account as Account,
  });

  if (!mintedPkp.data) {
    console.error('❌ Failed to mint PKP');
    process.exit(1);
  }

  console.log('✅ PKP Minted Successfully!');
  console.log('\n📊 PKP Details:');
  console.log('   Token ID:', mintedPkp.data.tokenId);
  console.log('   Public Key:', mintedPkp.data.publicKey);
  console.log('   ETH Address:', mintedPkp.data.ethAddress);

  // 6. Get PKP Permissions Manager
  console.log('\n🔧 Setting up PKP permissions manager...');
  const pkpPermissionsManager = await litClient.getPKPPermissionsManager({
    pkpIdentifier: {
      tokenId: mintedPkp.data.tokenId,
    },
    account: walletClient.account as Account,
  });
  console.log('✅ PKP Permissions Manager ready');

  // 7. Add signing permissions
  console.log('\n🔑 Adding signing permissions to PKP...');
  console.log('   Granting "sign-anything" scope...');

  // For now, we'll add a placeholder IPFS ID
  // You'll update this later with your actual Lit Action IPFS CID
  const placeholderIpfsId = "QmWGkjZKcfsE9nabey7cXf8ViZ5Mf5CvLFTHbsYa79s3ER";

  const addPermissionsTx = await pkpPermissionsManager.addPermittedAction({
    ipfsId: placeholderIpfsId,
    scopes: ["sign-anything"],
  });

  console.log('✅ Signing permissions added');
  console.log('   Transaction:', addPermissionsTx);

  // 8. Verify permissions
  console.log('\n🔍 Verifying PKP permissions...');
  const permissions = await litClient.viewPKPPermissions({
    tokenId: mintedPkp.data.tokenId,
  });
  console.log('✅ Current PKP permissions:', permissions);

  // 9. Save to file
  console.log('\n💾 Saving PKP credentials...');

  const pkpInfo = {
    tokenId: mintedPkp.data.tokenId.toString(), // Convert BigInt to string
    publicKey: mintedPkp.data.publicKey,
    ethAddress: mintedPkp.data.ethAddress,
    owner: account.address,
    network: networkArg,
    mintedAt: new Date().toISOString(),
    permittedActions: [
      {
        ipfsId: placeholderIpfsId,
        scopes: ["sign-anything"],
      }
    ],
  };

  // Save to JSON file
  const outputDir = dirname(__dirname) + '/output';
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const outputPath = `${outputDir}/pkp-credentials.json`;
  await writeFile(outputPath, JSON.stringify(pkpInfo, null, 2));
  console.log('✅ Saved to:', outputPath);

  // 10. Update .env file
  console.log('\n📝 Updating .env file...');
  const envPath = dirname(__dirname) + '/.env';
  let envContent = '';

  if (existsSync(envPath)) {
    const { readFile } = await import('fs/promises');
    envContent = await readFile(envPath, 'utf-8');
  }

  // Check if PKP_ADDRESS already exists
  if (envContent.includes('PKP_ADDRESS=')) {
    // Update existing
    envContent = envContent.replace(
      /PKP_ADDRESS=.*/,
      `PKP_ADDRESS="${mintedPkp.data.ethAddress}"`
    );
  } else {
    // Append new
    envContent += `\n# PKP for Karaoke Scoreboard\nPKP_ADDRESS="${mintedPkp.data.ethAddress}"\n`;
  }

  await writeFile(envPath, envContent);
  console.log('✅ Updated .env with PKP_ADDRESS');

  // 11. Next steps
  console.log('\n✨ PKP Setup Complete!');
  console.log('\n📋 Next Steps:');
  console.log('1. Fund PKP with gas tokens on Lens Chain:');
  console.log(`   cast send ${mintedPkp.data.ethAddress} --value 0.1ether \\`);
  console.log('     --rpc-url https://rpc.testnet.lens.xyz \\');
  console.log('     --private-key $PRIVATE_KEY');
  console.log('\n2. Deploy the scoreboard contract:');
  console.log('   FOUNDRY_PROFILE=zksync forge create \\');
  console.log('     --rpc-url https://rpc.testnet.lens.xyz \\');
  console.log('     --private-key $PRIVATE_KEY \\');
  console.log(`     --constructor-args "${mintedPkp.data.ethAddress}" \\`);
  console.log('     src/KaraokeScoreboardV1.sol:KaraokeScoreboardV1 \\');
  console.log('     --zksync --gas-limit 10000000 --gas-price 300000000 --broadcast');
  console.log('\n3. Update your Lit Action with the scoreboard contract address');
  console.log('\n4. Upload Lit Action to IPFS and update PKP permissions with the CID');

  await litClient.disconnect();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
