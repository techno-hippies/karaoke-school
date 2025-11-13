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

  /**
   * Create a viem WalletClient backed by a PKP
   *
   * This creates a wallet where all signing operations (signMessage, signTypedData, etc.)
   * are performed by the PKP via Lit Actions, not by exposing a private key.
   *
   * @param pkpPublicKey - The PKP's public key (from pkp_accounts.pkp_public_key)
   * @param targetChain - The chain to use (e.g., Lens testnet)
   * @returns viem WalletClient that signs with the PKP
   */
  async function createPKPWalletClient(
    pkpPublicKey: string,
    targetChain: any
  ): Promise<any> {
    // Import utilities from viem
    const viem = await import('viem');
    const { publicKeyToAddress } = await import('viem/utils');

    const client = await initLitClient();
    const controllerWallet = createLitWalletClient();

    // Derive PKP address from public key
    const pkpAddress = publicKeyToAddress(`0x${pkpPublicKey}`) as Address;

    // Create custom account object that delegates signing to Lit
    const pkpAccount = {
      address: pkpAddress,
      type: 'custom' as const,

      // Sign message via Lit Actions
      async signMessage({ message }: { message: any }) {
        const toSignHex = typeof message === 'string'
          ? viem.hashMessage(message)
          : viem.hashMessage({ raw: message.raw });
        const toSign = viem.hexToBytes(toSignHex);

        const litActionCode = `
          (async () => {
            const { toSign, publicKey } = Lit.Actions.getJsParams();

            const sigShare = await Lit.Actions.signEcdsa({
              toSign,
              publicKey,
              sigName: "sig",
            });
          })();
        `;

        // Generate auth signature for Lit Protocol
        const { generateAuthSig } = await import('@lit-protocol/auth-helpers');

        const authSig = await generateAuthSig({
          signer: controllerWallet,
          toSign: `Lit Protocol PKP Auth: ${Date.now()}`,
          address: controllerWallet.account.address,
        });

        const results = await client.executeJs({
          code: litActionCode,
          jsParams: {
            toSign: Array.from(toSign),
            publicKey: pkpPublicKey,
          },
          authSig,
        });

        const sig = results.signatures.sig;
        return viem.joinSignature({ r: `0x${sig.r}`, s: `0x${sig.s}`, v: sig.recid });
      },

      // Sign typed data via Lit Actions
      async signTypedData(typedData: any) {
        const hash = viem.hashTypedData(typedData);

        const litActionCode = `
          (async () => {
            const { toSign, publicKey } = Lit.Actions.getJsParams();

            const sigShare = await Lit.Actions.signEcdsa({
              toSign,
              publicKey,
              sigName: "sig",
            });
          })();
        `;

        // Generate auth signature for Lit Protocol
        const { generateAuthSig } = await import('@lit-protocol/auth-helpers');

        const authSig = await generateAuthSig({
          signer: controllerWallet,
          toSign: `Lit Protocol PKP Auth: ${Date.now()}`,
          address: controllerWallet.account.address,
        });

        const results = await client.executeJs({
          code: litActionCode,
          jsParams: {
            toSign: Array.from(viem.hexToBytes(hash)),
            publicKey: pkpPublicKey,
          },
          authSig,
        });

        const sig = results.signatures.sig;
        return viem.joinSignature({ r: `0x${sig.r}`, s: `0x${sig.s}`, v: sig.recid });
      },

      // Sign transaction via Lit Actions
      async signTransaction(tx: any) {
        throw new Error('PKP transaction signing not yet implemented - use signTypedData for EIP-712');
      },
    };

    return createWalletClient({
      account: pkpAccount,
      chain: targetChain,
      transport: http(targetChain.rpcUrls.default.http[0]),
    });
  }

  return {
    mintPKP,
    createPKPWalletClient,
    getChainConfig,
    getExplorerUrl,
  };
}

/**
 * Export type for service instance
 */
export type LitService = ReturnType<typeof createLitService>;
