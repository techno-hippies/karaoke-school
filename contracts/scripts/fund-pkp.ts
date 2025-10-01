#!/usr/bin/env bun

/**
 * Fund PKP with Gas Tokens
 *
 * This script sends gas tokens to your PKP address on Lens Chain testnet
 * so it can submit score update transactions.
 *
 * Prerequisites:
 * - PRIVATE_KEY set in .env (your deployer wallet with funds)
 * - PKP_ADDRESS set in .env (from mint-pkp script)
 *
 * Usage:
 *   bun run fund-pkp
 *   bun run fund-pkp --amount 0.5  # Send custom amount
 */

import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as dotenv from 'dotenv';

dotenv.config();

// Lens Chain testnet configuration
const lensChainTestnet = {
  id: 37111,
  name: 'Lens Chain Testnet',
  network: 'lens-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.lens.xyz'] },
    public: { http: ['https://rpc.testnet.lens.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Lens Explorer', url: 'https://explorer.testnet.lens.xyz' },
  },
};

async function main() {
  console.log('💰 Fund PKP with Gas Tokens');
  console.log('============================\n');

  // Check environment variables
  let privateKey = process.env.PRIVATE_KEY;
  const pkpAddress = process.env.PKP_ADDRESS;

  if (!privateKey) {
    console.error('❌ PRIVATE_KEY not found in .env file');
    process.exit(1);
  }

  if (!pkpAddress) {
    console.error('❌ PKP_ADDRESS not found in .env file');
    console.log('   Run "bun run mint-pkp" first to create a PKP');
    process.exit(1);
  }

  // Add 0x prefix if missing (dotenvx decryption strips it)
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  // Parse amount from args or use default
  const args = process.argv.slice(2);
  const amountIndex = args.indexOf('--amount');
  const amountGrass = amountIndex >= 0 && args[amountIndex + 1]
    ? args[amountIndex + 1]
    : '0.5'; // Default 0.5 $GRASS

  console.log('📝 Configuration:');
  console.log('   From:', privateKeyToAccount(privateKey as `0x${string}`).address);
  console.log('   To (PKP):', pkpAddress);
  console.log('   Amount:', amountGrass, '$GRASS');
  console.log('   Network: Lens Chain Testnet\n');

  // Create wallet client
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: lensChainTestnet,
    transport: http(),
  });

  // Check sender balance
  console.log('🔍 Checking sender balance...');
  const publicClient = await import('viem').then(m => m.createPublicClient({
    chain: lensChainTestnet,
    transport: http(),
  }));

  const balance = await publicClient.getBalance({ address: account.address });
  console.log('   Sender balance:', formatEther(balance), '$GRASS');

  const amountWei = parseEther(amountGrass);
  if (balance < amountWei) {
    console.error('\n❌ Insufficient balance');
    console.log('   Required:', formatEther(amountWei), '$GRASS');
    console.log('   Available:', formatEther(balance), '$GRASS');
    process.exit(1);
  }

  // Send transaction
  console.log('\n💸 Sending funds to PKP...');
  const hash = await walletClient.sendTransaction({
    to: pkpAddress as `0x${string}`,
    value: amountWei,
  });

  console.log('✅ Transaction sent!');
  console.log('   Hash:', hash);
  console.log('   Explorer:', `https://explorer.testnet.lens.xyz/tx/${hash}`);

  // Wait for confirmation
  console.log('\n⏳ Waiting for confirmation...');
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('✅ Transaction confirmed!');
    console.log('   Block:', receipt.blockNumber);
    console.log('   Gas used:', receipt.gasUsed.toString());

    // Check new balance
    const newBalance = await publicClient.getBalance({ address: pkpAddress as `0x${string}` });
    console.log('\n💰 PKP Balance:', formatEther(newBalance), '$GRASS');
    console.log('\n✨ PKP is now funded and ready to submit transactions!');
  } else {
    console.error('❌ Transaction failed');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
