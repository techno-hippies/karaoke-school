/**
 * Lit Protocol Service
 *
 * Purpose: PKP (Programmable Key Pair) minting and management on Chronicle Yellowstone
 * Network: Naga-test (Chronicle Yellowstone testnet, chain ID 175188)
 *
 * PKPs are Ethereum wallets controlled by Lit Actions (decentralized serverless functions).
 * Used as owners for Lens Protocol accounts in the karaoke pipeline.
 *
 * Prerequisites:
 * - PRIVATE_KEY environment variable (EOA that pays gas fees for PKP minting)
 * - @lit-protocol/lit-client installed
 * - @lit-protocol/networks installed
 * - viem installed
 *
 * Usage:
 *   import { createLitService } from './services/lit-protocol';
 *   const litService = createLitService();
 *   const pkp = await litService.mintPKP();
 */

import type { Address, Hex } from 'viem';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Chronicle Yellowstone chain configuration (Naga-test network)
const chronicleChain = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: {
    name: 'Chronicle Yellowstone',
    symbol: 'tstLPX',
    decimals: 18
  },
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
} as const;

/**
 * PKP minting result
 */
export interface PKPMintResult {
  pkpAddress: Address;      // Ethereum address derived from PKP public key
  pkpTokenId: string;        // ERC-721 token ID for the PKP NFT
  pkpPublicKey: string;      // Public key (uncompressed)
  ownerEOA: Address;         // EOA that minted the PKP (pays gas)
  transactionHash: Hex;      // Minting transaction hash
}

/**
 * Create Lit Protocol service instance
 *
 * Factory function that returns service methods for PKP operations.
 * Lazily initializes Lit client on first use.
 */
export function createLitService() {
  let litClient: any = null;

  /**
   * Initialize Lit Protocol client (lazy initialization)
   */
  async function initLitClient() {
    if (litClient) return litClient;

    // Dynamic import to avoid loading Lit SDK unless needed
    const { createLitClient } = await import('@lit-protocol/lit-client');
    const { nagaTest } = await import('@lit-protocol/networks');

    litClient = await createLitClient({
      network: nagaTest,
    });

    return litClient;
  }

  /**
   * Create wallet client from PRIVATE_KEY environment variable
   *
   * This wallet pays gas fees for PKP minting on Chronicle Yellowstone.
   * The wallet must have sufficient tstLPX tokens.
   */
  function createLitWalletClient() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }

    // Ensure private key has 0x prefix
    const formattedKey = (privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`) as `0x${string}`;

    const account = privateKeyToAccount(formattedKey);

    const walletClient = createWalletClient({
      account,
      chain: chronicleChain,
      transport: http('https://yellowstone-rpc.litprotocol.com/'),
    });

    return walletClient;
  }

  /**
   * Mint a new PKP on Chronicle Yellowstone
   *
   * Process:
   * 1. Initialize Lit Protocol client (Naga-test network)
   * 2. Create wallet client from PRIVATE_KEY
   * 3. Call mintWithEoa() to create new PKP
   * 4. Return PKP data for database storage
   *
   * Cost: ~0.001 tstLPX (testnet tokens, free from faucet)
   * Time: ~30-60 seconds (blockchain confirmation)
   *
   * @throws Error if PRIVATE_KEY not set or minting fails
   */
  async function mintPKP(): Promise<PKPMintResult> {
    const client = await initLitClient();
    const walletClient = createLitWalletClient();

    console.log(`   Minting PKP with EOA: ${walletClient.account.address}`);

    const mintResult = await client.mintWithEoa({
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

  /**
   * Get Chronicle Yellowstone chain configuration
   *
   * Useful for adding network to wallets or verifying transactions.
   */
  function getChainConfig() {
    return chronicleChain;
  }

  /**
   * Get Chronicle Yellowstone explorer URL for a transaction
   *
   * @param txHash - Transaction hash (with or without 0x prefix)
   */
  function getExplorerUrl(txHash: string): string {
    const hash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
    return `${chronicleChain.blockExplorers.default.url}/tx/${hash}`;
  }

  return {
    mintPKP,
    getChainConfig,
    getExplorerUrl,
  };
}

/**
 * Export type for service instance
 */
export type LitService = ReturnType<typeof createLitService>;
