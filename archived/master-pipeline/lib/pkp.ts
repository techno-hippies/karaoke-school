/**
 * PKP (Programmable Key Pair) utilities
 * Wraps Lit Protocol PKP minting and management
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { ArtistPKP } from './types';
import { requireEnv } from './config';

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

/**
 * Initialize Lit client for PKP operations
 */
export async function initLitClient() {
  console.log('🔧 Initializing Lit Protocol client...');

  const litClient = await createLitClient({
    network: nagaDev,
  });

  console.log('✅ Lit client initialized');
  return litClient;
}

/**
 * Create wallet client from private key
 */
export function createWalletFromPrivateKey() {
  const privateKey = requireEnv('PRIVATE_KEY');
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const walletClient = createWalletClient({
    account,
    chain: chronicleChain,
    transport: http('https://yellowstone-rpc.litprotocol.com/'),
  });

  return walletClient;
}

/**
 * Mint a new PKP for an artist
 */
export async function mintPKP(params: {
  artistName: string;
  geniusArtistId: number;
}): Promise<ArtistPKP> {
  const { artistName, geniusArtistId } = params;

  console.log(`\n🎨 Minting PKP for ${artistName} (Genius ID: ${geniusArtistId})...`);

  // Initialize Lit client
  const litClient = await initLitClient();
  const walletClient = createWalletFromPrivateKey();

  console.log(`🔑 EOA Address: ${walletClient.account.address}`);
  console.log('💰 Note: Make sure you have Chronicle Yellowstone test tokens');
  console.log('   Get from: https://chronicle-yellowstone-faucet.getlit.dev/\n');

  // Mint PKP
  console.log('⏳ Minting PKP on Chronicle Yellowstone...');
  const mintResult = await litClient.mintWithEoa({
    account: walletClient.account,
  });

  const pkpData: ArtistPKP = {
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
  console.log(`   Explorer: https://yellowstone-explorer.litprotocol.com/tx/${pkpData.transactionHash}`);

  return pkpData;
}

/**
 * Get PKP info from token ID
 */
export async function getPKPInfo(tokenId: string) {
  const litClient = await initLitClient();

  // TODO: Implement fetching PKP info from token ID
  // This would query the PKP contract on Chronicle Yellowstone

  return {
    tokenId,
    ethAddress: '0x...', // Derive from public key
    publicKey: '0x...',
  };
}

/**
 * Sign a message with PKP
 */
export async function signWithPKP(params: {
  pkpPublicKey: string;
  message: string;
}): Promise<string> {
  const { pkpPublicKey, message } = params;

  const litClient = await initLitClient();

  // TODO: Implement signing with PKP
  throw new Error('PKP signing not yet implemented');
}
