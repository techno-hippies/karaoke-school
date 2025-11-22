/**
 * Lit Protocol Service
 *
 * Purpose: PKP (Programmable Key Pair) minting and management on Lit Protocol networks
 * Network: Configurable via LIT_NETWORK env (naga-dev | naga-test | naga-staging | naga-local)
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
import { getLitNetworkConfig } from '../config/lit';

const { litNetwork, networkModule, chainConfig, rpcUrl, networkName } = getLitNetworkConfig();

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
  let litAuthContext: any = null; // Store auth context for executeJs()

  /**
   * Initialize Lit Protocol client (lazy initialization)
   */
  async function initLitClient() {
    if (litClient) return litClient;

    // Dynamic import to avoid loading Lit SDK unless needed
    const { createLitClient } = await import('@lit-protocol/lit-client');
    const { createAuthManager, storagePlugins } = await import('@lit-protocol/auth');
    const { privateKeyToAccount } = await import('viem/accounts');

    // Get controller wallet (viem account for Auth Manager)
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }
    const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);

    console.log('   🔐 Creating Auth Manager for EOA...');

    // Create Auth Manager with node storage
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: 'karaoke-pipeline',
        networkName,
        storagePath: './.lit-auth-storage',
      }),
    });

    // Create Lit client first (required by createEoaAuthContext)
    console.log(`   🌐 Creating Lit client (${networkName})...`);
    litClient = await createLitClient({
      network: networkModule,
    });

    console.log('   🔑 Creating EOA auth context with resources...');

    // Create EOA auth context with lit-action-execution resource
    litAuthContext = await authManager.createEoaAuthContext({
      config: { account },
      authConfig: {
        statement: 'Lit Protocol Session for Karaoke Pipeline',
        domain: 'localhost',
        resources: [
          ['lit-action-execution', '*'],
          ['pkp-signing', '*'],
        ],
        expiration: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days
      },
      litClient,
    });

    console.log('   ✓ Auth context created with Auth Manager');

    return litClient;
  }

  /**
   * Create wallet client from PRIVATE_KEY environment variable
   *
   * This wallet pays gas fees for PKP minting on Chronicle Yellowstone.
   * The wallet must have sufficient tstLPX tokens.
   */
  function createLitWalletClient() {
    if (!chainConfig) {
      throw new Error(`Lit chain config not available for network ${networkName}`);
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }

    // Ensure private key has 0x prefix
    const formattedKey = (privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`) as `0x${string}`;

    const account = privateKeyToAccount(formattedKey);

    const transportRpc = rpcUrl || chainConfig?.rpcUrls?.default?.http?.[0];
    if (!transportRpc) {
      throw new Error(`RPC URL not configured for Lit network ${networkName}`);
    }

    const walletClient = createWalletClient({
      account,
      chain: chainConfig,
      transport: http(transportRpc),
    });

    return walletClient;
  }

  /**
   * Mint a new PKP on Chronicle Yellowstone
   *
   * Process:
   * 1. Initialize Lit Protocol client (nagaTest network)
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
    return chainConfig;
  }

  /**
   * Get Chronicle Yellowstone explorer URL for a transaction
   *
   * @param txHash - Transaction hash (with or without 0x prefix)
   */
  function getExplorerUrl(txHash: string): string {
    const hash = txHash.startsWith('0x') ? txHash : `0x${txHash}`;
    const explorer = chainConfig?.blockExplorers?.default?.url;
    if (!explorer) {
      throw new Error(`No block explorer configured for Lit network ${networkName}`);
    }
    return `${explorer}/tx/${hash}`;
  }

  /**
   * Create a viem WalletClient backed by a PKP
   *
   * APP-INSPIRED APPROACH: Uses executeJs() + custom LocalAccount pattern
   * instead of getPkpViemAccount() to avoid ReCap validation issues.
   *
   * This matches the working browser implementation but adapted for server-side.
   *
   * @param pkpPublicKey - The PKP's public key (from pkp_accounts.pkp_public_key)
   * @param pkpAddress - The PKP's address (from pkp_accounts.pkp_address) - MUST match minted PKP!
   * @param targetChain - The chain to use (e.g., Lens testnet)
   * @returns viem WalletClient that signs with the PKP via executeJs()
   */
  async function createPKPWalletClient(
    pkpPublicKey: string,
    pkpAddress: Address,
    targetChain: any
  ): Promise<any> {
    const client = await initLitClient();
    const controllerWallet = createLitWalletClient();

    console.log('   🔑 Creating PKP wallet with executeJs() pattern...');

    // Import viem utilities
    const { serializeTransaction, keccak256, hashTypedData } = await import('viem');

    console.log(`   ✓ PKP Address: ${pkpAddress}`);

    // Create custom LocalAccount that uses executeJs() for signing
    const pkpAccount = {
      address: pkpAddress as Address,
      publicKey: `0x${pkpPublicKey}` as Hex,
      type: 'local' as const,
      source: 'custom' as const,

      // Sign message using PKP via Lit Protocol
      async signMessage({ message }: { message: any }) {
        console.log('   📝 Signing message with PKP via executeJs()...');

        const litActionCode = `(async () => {
          const sigShare = await Lit.Actions.ethPersonalSignMessageEcdsa({
            message: jsParams.message,
            publicKey: jsParams.publicKey,
            sigName: "sig",
          });
        })();`;

        const result = await client.executeJs({
          code: litActionCode,
          authContext: litAuthContext,
          jsParams: {
            message: typeof message === 'string' ? message : message.raw,
            publicKey: pkpPublicKey,
          },
        });

        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig;
          if (sig.signature && sig.recoveryId !== undefined) {
            const v = (sig.recoveryId + 27).toString(16).padStart(2, '0');
            const signature = `${sig.signature}${v}` as Hex;
            console.log('   ✓ Message signed');
            return signature;
          }
        }

        throw new Error('No signature returned from Lit Action');
      },

      // Sign transaction using PKP
      async signTransaction(transaction: any) {
        console.log('   📝 Signing transaction with PKP via executeJs()...');

        const serializedTx = serializeTransaction(transaction);
        const txHash = keccak256(serializedTx);

        const litActionCode = `(async () => {
          const sigShare = await Lit.Actions.signEcdsa({
            toSign: jsParams.toSign,
            publicKey: jsParams.publicKey,
            sigName: "sig",
          });
        })();`;

        const result = await client.executeJs({
          code: litActionCode,
          authContext: litAuthContext,
          jsParams: {
            toSign: Array.from(Buffer.from(txHash.slice(2), 'hex')),
            publicKey: pkpPublicKey,
          },
        });

        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig;
          if (sig.signature && sig.recoveryId !== undefined) {
            const sigHex = sig.signature.startsWith('0x') ? sig.signature.slice(2) : sig.signature;
            const r = `0x${sigHex.slice(0, 64)}` as Hex;
            const s = `0x${sigHex.slice(64, 128)}` as Hex;

            const isEIP1559 = transaction.type === 'eip1559';
            const yParity = sig.recoveryId;
            const v = isEIP1559 ? BigInt(yParity) : BigInt(yParity + 27);

            const signedTx: any = {
              ...transaction,
              r,
              s,
              ...(isEIP1559 ? { yParity } : { v }),
            };

            console.log('   ✓ Transaction signed');
            return serializeTransaction(signedTx);
          }
        }

        throw new Error('No signature returned from Lit Action');
      },

      // Sign typed data (EIP-712)
      async signTypedData(typedData: any) {
        console.log('   📝 Signing typed data with PKP via executeJs()...');

        const hash = hashTypedData(typedData);

        const litActionCode = `(async () => {
          const sigShare = await Lit.Actions.signEcdsa({
            toSign: jsParams.toSign,
            publicKey: jsParams.publicKey,
            sigName: "sig",
          });
        })();`;

        const result = await client.executeJs({
          code: litActionCode,
          authContext: litAuthContext,
          jsParams: {
            toSign: Array.from(Buffer.from(hash.slice(2), 'hex')),
            publicKey: pkpPublicKey,
          },
        });

        if (result.signatures && result.signatures.sig) {
          const sig = result.signatures.sig;
          if (sig.signature && sig.recoveryId !== undefined) {
            const v = (sig.recoveryId + 27).toString(16).padStart(2, '0');
            console.log('   ✓ Typed data signed');
            return `${sig.signature}${v}` as Hex;
          }
        }

        throw new Error('No signature returned from Lit Action');
      },
    };

    // Create wallet client with custom PKP account
    const walletClient = createWalletClient({
      account: pkpAccount as any,
      chain: targetChain,
      transport: http(targetChain.rpcUrls.default.http[0]),
    });

    console.log('   ✓ PKP wallet client created with executeJs() pattern');

    return walletClient;
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
