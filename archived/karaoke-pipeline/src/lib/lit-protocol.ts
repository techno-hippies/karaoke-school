/**
 * Lit Protocol utilities
 * Handles PKP minting and management on Chronicle Yellowstone
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaTest } from '@lit-protocol/networks';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Chronicle Yellowstone chain config (Naga-test network)
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
 * Initialize Lit Protocol client
 */
export async function initLitClient() {
  const litClient = await createLitClient({
    network: nagaTest,
  });
  return litClient;
}

/**
 * Create wallet client from private key
 */
export function createLitWalletClient() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

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
 * Mint a new PKP
 */
export async function mintPKP(): Promise<{
  pkpAddress: Address;
  pkpTokenId: string;
  pkpPublicKey: string;
  ownerEOA: Address;
  transactionHash: Hex;
}> {
  const litClient = await initLitClient();
  const walletClient = createLitWalletClient();

  const mintResult = await litClient.mintWithEoa({
    account: walletClient.account,
  });

  return {
    pkpAddress: mintResult.data.ethAddress as Address,
    pkpTokenId: mintResult.data.tokenId.toString(),
    pkpPublicKey: mintResult.data.pubkey,
    ownerEOA: walletClient.account.address as Address,
    transactionHash: mintResult.txHash as Hex,
  };
}
