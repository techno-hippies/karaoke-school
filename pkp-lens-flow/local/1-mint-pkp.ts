#!/usr/bin/env bun
/**
 * Step 1: Mint PKP for TikTok Creator
 *
 * Uses Lit Protocol SDK v7 with mintWithEoa() method
 *
 * Prerequisites:
 * - Chronicle Yellowstone test tokens: https://chronicle-yellowstone-faucet.getlit.dev/
 * - PRIVATE_KEY in blockchain/.env
 *
 * Usage:
 *   bun run local/1-mint-pkp.ts --creator @charlidamelio
 *
 * Output:
 *   data/pkps/charlidamelio.json
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { writeFile, mkdir } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http } from 'viem';

// Environment loaded by dotenvx run command

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

interface PKPData {
  tiktokHandle: string;
  pkpPublicKey: string;
  pkpEthAddress: string;
  pkpTokenId: string;
  ownerEOA: string;
  network: string;
  mintedAt: string;
  transactionHash?: string;
}

async function mintPKP(tiktokHandle: string): Promise<PKPData> {
  console.log('\n🪙 Step 1: Minting PKP for TikTok Creator');
  console.log('═══════════════════════════════════════\n');

  // 1. Setup account from private key
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in blockchain/.env');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  console.log(`🔑 EOA Address: ${account.address}\n`);

  // 2. Create Lit client
  console.log('🌐 Connecting to Lit Network (naga-dev)...');
  const litClient = await createLitClient({
    network: nagaDev,
  });
  console.log('✅ Connected to Lit Protocol\n');

  // 3. Create wallet client for signing (Chronicle Yellowstone)
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

  const walletClient = createWalletClient({
    account,
    chain: chronicleChain,
    transport: http('https://yellowstone-rpc.litprotocol.com/'),
  });

  console.log('💰 Note: Make sure you have Chronicle Yellowstone test tokens');
  console.log('   Get from: https://chronicle-yellowstone-faucet.getlit.dev/\n');

  // 4. Mint PKP with EOA
  console.log('🪙 Minting PKP on Chronicle Yellowstone...');
  console.log(`   Creator: ${tiktokHandle}`);
  console.log('   Method: mintWithEoa()\n');

  const mintResult = await litClient.mintWithEoa({
    account: walletClient.account,
  });

  console.log('✅ PKP Minted!\n');
  console.log('📊 PKP Details:');
  console.log(`   Public Key: ${mintResult.data.pubkey}`);
  console.log(`   ETH Address: ${mintResult.data.ethAddress}`);
  console.log(`   Token ID: ${mintResult.data.tokenId.toString()}`);
  console.log(`   Tx Hash: ${mintResult.txHash}`);
  console.log(`   Explorer: https://yellowstone-explorer.litprotocol.com/tx/${mintResult.txHash}`);
  console.log('');

  // 5. Save PKP data
  const pkpData: PKPData = {
    tiktokHandle,
    pkpPublicKey: mintResult.data.pubkey,
    pkpEthAddress: mintResult.data.ethAddress,
    pkpTokenId: mintResult.data.tokenId.toString(),
    ownerEOA: account.address,
    network: 'chronicle-yellowstone',
    mintedAt: new Date().toISOString(),
    transactionHash: mintResult.txHash,
  };

  const cleanHandle = tiktokHandle.replace('@', '');
  const outputPath = path.join(process.cwd(), 'data', 'pkps', `${cleanHandle}.json`);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(pkpData, null, 2));

  console.log('💾 Saved to:', outputPath);
  console.log('');
  console.log('⚠️  Note: This PKP needs permissions before it can sign!');
  console.log('   Next: bun run local/2-register-pkp.ts --creator ' + tiktokHandle);
  console.log('');

  return pkpData;
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run local/1-mint-pkp.ts --creator @charlidamelio\n');
      process.exit(1);
    }

    await mintPKP(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message?.includes('insufficient')) {
      console.error('\n💡 Get test tokens: https://chronicle-yellowstone-faucet.getlit.dev/\n');
    }
    process.exit(1);
  }
}

main();
