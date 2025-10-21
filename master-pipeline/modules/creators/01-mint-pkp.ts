#!/usr/bin/env bun
/**
 * Creator Module 01: Mint PKP
 *
 * Creates a Programmable Key Pair (PKP) on Lit Protocol for a TikTok creator
 *
 * Usage:
 *   bun run creators/01-mint-pkp.ts --tiktok-handle @brookemonk_ --lens-handle brookemonk
 *   bun run creators/01-mint-pkp.ts --tiktok-handle @karaokeking99
 */

import { parseArgs } from 'util';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireEnv, paths } from '../../lib/config.js';
import { writeJson, ensureDir } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import type { CreatorPKP } from '../../lib/schemas/index.js';

// Chronicle Yellowstone chain config
const chronicleChain = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'Chronicle Yellowstone', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com/'] },
    public: { http: ['https://yellowstone-rpc.litprotocol.com/'] },
  },
  blockExplorers: {
    default: {
      name: 'Yellowstone Explorer',
      url: 'https://yellowstone-explorer.litprotocol.com/',
    },
  },
};

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'lens-handle': { type: 'string' }, // Optional: custom Lens handle
    },
  });

  if (!values['tiktok-handle']) {
    logger.error('Missing required parameter: --tiktok-handle');
    console.log('\nUsage:');
    console.log('  bun run creators/01-mint-pkp.ts --tiktok-handle @brookemonk_ --lens-handle brookemonk');
    console.log('  bun run creators/01-mint-pkp.ts --tiktok-handle @karaokeking99\n');
    console.log('Options:');
    console.log('  --tiktok-handle  TikTok username (with or without @)');
    console.log('  --lens-handle    Custom Lens handle (defaults to TikTok handle without @ and _)\n');
    process.exit(1);
  }

  // Clean handles
  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const lensHandle = values['lens-handle'] || tiktokHandle.replace(/_/g, ''); // Remove underscores by default

  logger.header(`Mint PKP: @${tiktokHandle}`);
  console.log(`   TikTok Handle: @${tiktokHandle}`);
  console.log(`   Lens Handle: @${lensHandle}\n`);

  try {
    // Initialize Lit client
    console.log('🔧 Initializing Lit Protocol client...');
    const litClient = await createLitClient({
      network: nagaDev,
    });
    console.log('✅ Lit client initialized');

    // Create wallet from private key
    const privateKey = requireEnv('PRIVATE_KEY');
    const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);

    const walletClient = createWalletClient({
      account,
      chain: chronicleChain,
      transport: http('https://yellowstone-rpc.litprotocol.com/'),
    });

    console.log(`🔑 EOA Address: ${walletClient.account.address}`);
    console.log('💰 Note: Make sure you have Chronicle Yellowstone test tokens');
    console.log('   Get from: https://chronicle-yellowstone-faucet.getlit.dev/\n');

    // Mint PKP
    console.log('⏳ Minting PKP on Chronicle Yellowstone...');
    const mintResult = await litClient.mintWithEoa({
      account: walletClient.account,
    });

    const pkpData: CreatorPKP = {
      pkpPublicKey: mintResult.data.pubkey,
      pkpEthAddress: mintResult.data.ethAddress as Address,
      pkpTokenId: mintResult.data.tokenId.toString(),
      ownerEOA: walletClient.account.address as Address,
      network: 'chronicle-yellowstone',
      mintedAt: new Date().toISOString(),
      transactionHash: mintResult.txHash as Hex,
    };

    console.log(`✅ PKP minted successfully`);
    console.log(`   Address: ${pkpData.pkpEthAddress}`);
    console.log(`   Token ID: ${pkpData.pkpTokenId}`);
    console.log(`   Tx: ${pkpData.transactionHash}`);
    console.log(`   Explorer: https://yellowstone-explorer.litprotocol.com/tx/${pkpData.transactionHash}\n`);

    // Save to file (use TikTok handle for filesystem)
    const pkpPath = paths.creatorPkp(tiktokHandle);
    writeJson(pkpPath, pkpData);

    logger.success(`PKP data saved to: ${pkpPath}`);

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/02-create-lens.ts --tiktok-handle @${tiktokHandle} --lens-handle ${lensHandle}\n`);

  } catch (error: any) {
    logger.error(`Failed to mint PKP: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
