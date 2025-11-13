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
    const { createSiweMessage } = await import('@lit-protocol/auth-helpers');
    const { generateSessionKeyPair } = await import('@lit-protocol/crypto');
    const { randomBytes } = await import('crypto');

    // Get controller wallet for signing session auth messages
    const controllerWallet = createLitWalletClient();

    // Generate session key pair for Lit Protocol
    const sessionKeyPair = generateSessionKeyPair();

    // Create ethers-style signer for SIWE message signing
    const ethersSigner = {
      signMessage: async (message: string) => {
        return await controllerWallet.signMessage({ message });
      },
      getAddress: async () => controllerWallet.account.address,
    };

    // Create authContext with callback for Lit Protocol session management
    const authNeededCallback = async () => {
      console.log('   🔐 Lit Protocol session auth requested...');

      // Generate nonce for SIWE message (alphanumeric only, at least 8 chars)
      const nonce = randomBytes(16).toString('hex');

      // Create proper SIWE message with expiration
      const ONE_WEEK_FROM_NOW = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const siweMessage = await createSiweMessage({
        walletAddress: controllerWallet.account.address,
        nonce,
        expiration: ONE_WEEK_FROM_NOW,
        uri: 'https://localhost',  // Valid RFC 3986 URI
        domain: 'localhost',
        statement: 'Lit Protocol Session',
      });

      // Sign the SIWE message
      const signature = await ethersSigner.signMessage(siweMessage);

      // Return auth signature in expected format
      const authSig = {
        sig: signature,
        derivedVia: 'web3.eth.personal.sign',
        signedMessage: siweMessage,
        address: controllerWallet.account.address,
      };

      console.log('   ✓ Lit session auth signature generated');
      return authSig;
    };

    litClient = await createLitClient({
      network: nagaTest,
      authContext: {
        authNeededCallback,
        sessionKeyPair,
        authConfig: {
          capabilityAuthSigs: [],
          resources: [],
        },
      },
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
   * Uses Lit Protocol's official getPkpViemAccount API to create a wallet
   * where all signing operations are performed by the PKP via Lit Protocol.
   *
   * @param pkpPublicKey - The PKP's public key (from pkp_accounts.pkp_public_key)
   * @param pkpTokenId - The PKP's token ID (from pkp_accounts.pkp_token_id)
   * @param targetChain - The chain to use (e.g., Lens testnet)
   * @returns viem WalletClient that signs with the PKP
   */
  async function createPKPWalletClient(
    pkpPublicKey: string,
    pkpTokenId: string,
    targetChain: any
  ): Promise<any> {
    const client = await initLitClient();
    const controllerWallet = createLitWalletClient();

    // Import required utilities
    const { createSiweMessage, createSiweMessageWithResources, generateAuthSig } = await import('@lit-protocol/auth-helpers');
    const { LitPKPResource } = await import('@lit-protocol/auth-helpers');
    const { generateSessionKeyPair } = await import('@lit-protocol/crypto');
    const { randomBytes } = await import('crypto');

    console.log('   🔑 Generating PKP session capabilities...');

    // Generate session key pair for this PKP wallet
    const sessionKeyPair = generateSessionKeyPair();

    // Create PKP resource for this specific token ID (not wildcard)
    // Convert decimal token ID to 32-byte hex string (64 characters)
    const tokenIdHex = BigInt(pkpTokenId).toString(16).padStart(64, '0');
    const pkpResource = new LitPKPResource(tokenIdHex);

    // Create ethers-style signer for capability signatures
    const ethersSigner = {
      signMessage: async (message: string) => {
        return await controllerWallet.signMessage({ message });
      },
      getAddress: async () => controllerWallet.account.address,
    };

    // Generate session capability signature that authorizes this PKP for signing
    const sessionCapabilitySig = await generateAuthSig({
      signer: ethersSigner,
      toSign: await createSiweMessageWithResources({
        walletAddress: controllerWallet.account.address,
        nonce: randomBytes(16).toString('hex'),
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        uri: 'https://localhost/pkp',
        domain: 'localhost',
        statement: 'PKP Session Capability',
        resources: [
          {
            resource: pkpResource,
            ability: 'pkp-signing',  // LitAbility.PKPSigning
          },
        ],
      }),
      address: controllerWallet.account.address,
    });

    console.log('   ✓ PKP session capability signature generated');
    console.log('   📋 Session capability SIWE message:', sessionCapabilitySig.signedMessage.substring(0, 200) + '...');
    console.log('   📋 PKP Resource string:', pkpResource.toString());

    // Create authContext for PKP operations with capability signatures
    // authNeededCallback should return the same session capability signature
    const authNeededCallback = async () => {
      console.log('   🔐 PKP auth callback triggered - returning session capability');
      return sessionCapabilitySig;
    };

    const authContext = {
      authNeededCallback,
      sessionKeyPair,
      authConfig: {
        capabilityAuthSigs: [sessionCapabilitySig],
        resources: [{
          resource: pkpResource,
          ability: 'pkp-signing',
        }],
      },
    };

    // Use the official Lit Protocol API to get PKP viem account
    console.log('   📝 Creating PKP viem account via litClient.getPkpViemAccount...');
    const pkpAccount = await client.getPkpViemAccount({
      pkpPublicKey,
      authContext,
      chainConfig: targetChain,
    });
    console.log('   ✓ PKP viem account created');

    // Create wallet client with PKP account
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
