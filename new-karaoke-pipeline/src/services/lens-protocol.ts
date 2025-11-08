/**
 * Lens Protocol Service
 *
 * Purpose: Lens account creation and management for artists and TikTok creators
 * Network: Lens testnet
 *
 * Lens accounts are social profiles linked to PKPs (Programmable Key Pairs).
 * Used for artist/creator identity in the karaoke ecosystem.
 *
 * Prerequisites:
 * - PRIVATE_KEY environment variable (EOA for signing Lens transactions)
 * - PKP address (from pkp_accounts table)
 * - @lens-protocol/client installed
 * - @lens-chain/sdk installed
 * - @lens-chain/storage-client installed (Grove storage)
 *
 * Usage:
 *   import { createLensService } from './services/lens-protocol';
 *   const lensService = createLensService();
 *   const account = await lensService.createAccount({ handle, name, ... });
 */

import type { Address, Hex } from 'viem';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Lens app address (required for account creation on testnet)
const LENS_APP_ADDRESS = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

/**
 * Lens account creation result
 */
export interface LensAccountResult {
  lensHandle: string;              // Final username (may differ from requested due to collisions)
  lensAccountAddress: Address;     // Lens account contract address
  lensAccountId: Hex;              // Lens account ID (same as address)
  metadataUri: string;             // Grove URI to metadata JSON
  transactionHash: Hex;            // Account creation transaction
}

/**
 * Account creation parameters
 */
export interface CreateAccountParams {
  handle: string;                  // Requested username (will be sanitized)
  name: string;                    // Display name
  bio?: string;                    // Profile bio
  pictureUri?: string;             // Profile image (IPFS/Grove URI)
  attributes?: Array<{             // Custom metadata fields
    type: string;
    key: string;
    value: string;
  }>;
}

/**
 * Sanitize name to create valid Lens handle
 *
 * Rules:
 * - Lowercase only
 * - Alphanumeric and hyphens only
 * - No consecutive hyphens
 * - No leading/trailing hyphens
 * - Max 30 characters
 *
 * Examples:
 * - "Ariana Grande" → "ariana-grande"
 * - "21 Savage!!!" → "21-savage"
 * - "---Bad-Name---" → "bad-name"
 */
export function sanitizeHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with dashes
    .replace(/-+/g, '-')          // Collapse multiple dashes
    .replace(/^-|-$/g, '')        // Remove leading/trailing dashes
    .substring(0, 30);             // Lens handle max length
}

/**
 * Create Lens Protocol service instance
 *
 * Factory function that returns service methods for Lens operations.
 * Lazily initializes Lens client and storage on first use.
 */
export function createLensService() {
  let lensClient: any = null;
  let storageClient: any = null;
  let chains: any = null;

  /**
   * Initialize Lens SDK client (lazy initialization)
   */
  async function initLensClient() {
    if (lensClient) return lensClient;

    // Dynamic import to avoid loading Lens SDK unless needed
    const { PublicClient } = await import('@lens-protocol/client');
    const { testnet } = await import('@lens-protocol/env');

    lensClient = PublicClient.create({
      environment: testnet,
      origin: 'http://localhost:3000', // Required for non-browser environments
    });

    return lensClient;
  }

  /**
   * Initialize Grove storage client (lazy initialization)
   */
  async function initStorageClient() {
    if (storageClient) return storageClient;

    const { StorageClient } = await import('@lens-chain/storage-client');
    storageClient = StorageClient.create();

    return storageClient;
  }

  /**
   * Initialize chains config (lazy initialization)
   */
  async function initChains() {
    if (chains) return chains;

    const sdk = await import('@lens-chain/sdk/viem');
    chains = sdk.chains;

    return chains;
  }

  /**
   * Create wallet client from PRIVATE_KEY environment variable
   *
   * This wallet signs Lens transactions and pays gas fees.
   */
  async function createLensWalletClient() {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }

    // Ensure private key has 0x prefix
    const formattedKey = (privateKey.startsWith('0x')
      ? privateKey
      : `0x${privateKey}`) as `0x${string}`;

    const account = privateKeyToAccount(formattedKey);
    const chainsConfig = await initChains();

    const walletClient = createWalletClient({
      account,
      chain: chainsConfig.testnet,
      transport: http(),
    });

    return walletClient;
  }

  /**
   * Check if a Lens handle is available
   *
   * @param handle - Username to check (already sanitized)
   * @returns True if available, false if taken
   */
  async function isHandleAvailable(handle: string): Promise<boolean> {
    const client = await initLensClient();
    const walletClient = await createLensWalletClient();

    // Dynamic imports for Lens functions
    const { evmAddress } = await import('@lens-protocol/client');
    const { signMessageWith } = await import('@lens-protocol/client/viem');
    const { fetchAccount } = await import('@lens-protocol/client/actions');

    // Login to Lens
    const authenticated = await client.login({
      onboardingUser: {
        app: evmAddress(LENS_APP_ADDRESS),
        wallet: evmAddress(walletClient.account.address),
      },
      signMessage: signMessageWith(walletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    const sessionClient = authenticated.value;

    // Try to fetch account - if it exists, handle is taken
    const accountResult = await fetchAccount(sessionClient, {
      username: { localName: handle },
    });

    // If account exists, handle is NOT available
    return accountResult.isErr() || !accountResult.value;
  }

  /**
   * Find an available Lens handle with collision handling
   *
   * Strategy:
   * 1. Try base handle
   * 2. Try "{base}-ks" (Karaoke School branding)
   * 3. Try "{base}-ks-2", "{base}-ks-3", etc.
   *
   * @param baseHandle - Sanitized handle to start with
   * @param maxAttempts - Maximum collision attempts (default: 10)
   * @returns Available handle
   */
  async function findAvailableHandle(
    baseHandle: string,
    maxAttempts: number = 10
  ): Promise<string> {
    let handle = baseHandle;
    let attempt = 0;

    while (attempt <= maxAttempts) {
      console.log(`   🔍 Checking handle: ${handle}`);

      const available = await isHandleAvailable(handle);

      if (available) {
        console.log(`   ✓ Handle available: ${handle}`);
        return handle;
      }

      console.log(`   ⚠️  Handle taken: ${handle}`);
      attempt++;

      // Build next variation
      let suffix: string;
      if (attempt === 1) {
        // First fallback: add "-ks" for Karaoke School branding
        suffix = '-ks';
      } else {
        // Subsequent fallbacks: "-ks-2", "-ks-3", etc.
        suffix = `-ks-${attempt}`;
      }

      // Ensure total length doesn't exceed 30 chars
      const maxBaseLength = 30 - suffix.length;
      const truncatedBase = baseHandle.substring(0, maxBaseLength);
      handle = `${truncatedBase}${suffix}`;
    }

    throw new Error(
      `Could not find available handle after ${maxAttempts} attempts (base: ${baseHandle})`
    );
  }

  /**
   * Create Lens account with metadata
   *
   * Process:
   * 1. Sanitize and find available handle (handles collisions automatically)
   * 2. Build account metadata JSON
   * 3. Upload metadata to Grove (immutable IPFS storage)
   * 4. Login to Lens Protocol
   * 5. Create account with username and metadata URI
   * 6. Return account details for database storage
   *
   * Cost: ~0.001 ETH on Lens testnet (free from faucet)
   * Time: ~60-120 seconds (blockchain confirmation + Grove upload)
   *
   * @throws Error if PRIVATE_KEY not set or account creation fails
   */
  async function createAccount(
    params: CreateAccountParams
  ): Promise<LensAccountResult> {
    const { handle: requestedHandle, name, bio, pictureUri, attributes = [] } = params;

    // Sanitize and find available handle
    const sanitized = sanitizeHandle(requestedHandle);
    const handle = await findAvailableHandle(sanitized);

    if (handle !== sanitized) {
      console.log(`   ⚠️  Using alternate handle: ${handle} (requested: ${sanitized})`);
    }

    // Initialize all clients
    const client = await initLensClient();
    const walletClient = await createLensWalletClient();
    const storage = await initStorageClient();
    const chainsConfig = await initChains();

    // Dynamic imports for Lens functions
    const { evmAddress } = await import('@lens-protocol/client');
    const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');
    const { createAccountWithUsername, fetchAccount } = await import('@lens-protocol/client/actions');
    const { immutable } = await import('@lens-chain/storage-client');
    const { account: accountMetadata } = await import('@lens-protocol/metadata');

    // Create metadata
    const metadata = accountMetadata({
      name,
      bio: bio || `Official Karaoke School profile for ${name}`,
      picture: pictureUri,
      attributes,
    });

    // Upload metadata to Grove
    console.log('   📤 Uploading metadata to Grove...');
    const uploadResult = await storage.uploadAsJson(metadata, {
      name: `${handle}-account-metadata.json`,
      acl: immutable(chainsConfig.testnet.id),
    });

    console.log(`   ✓ Metadata URI: ${uploadResult.uri}`);

    // Login to Lens
    console.log('   🔐 Authenticating with Lens Protocol...');
    const authenticated = await client.login({
      onboardingUser: {
        app: evmAddress(LENS_APP_ADDRESS),
        wallet: evmAddress(walletClient.account.address),
      },
      signMessage: signMessageWith(walletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    const sessionClient = authenticated.value;

    // Create account with username
    console.log(`   ⏳ Creating Lens account @${handle}...`);
    const createResult = await createAccountWithUsername(sessionClient, {
      username: { localName: handle },
      metadataUri: uploadResult.uri,
    })
      .andThen(handleOperationWith(walletClient))
      .andThen(sessionClient.waitForTransaction);

    if (createResult.isErr()) {
      throw new Error(`Account creation failed: ${createResult.error.message}`);
    }

    // Fetch account details
    const accountResult = await fetchAccount(sessionClient, {
      username: { localName: handle },
    });

    if (accountResult.isErr() || !accountResult.value) {
      throw new Error('Failed to fetch created account');
    }

    const createdAccount = accountResult.value;

    return {
      lensHandle: handle,
      lensAccountAddress: createdAccount.address as Address,
      lensAccountId: createdAccount.address as Hex,
      metadataUri: uploadResult.uri,
      transactionHash: createResult.value as Hex,
    };
  }

  return {
    createAccount,
    sanitizeHandle,
    findAvailableHandle,
    isHandleAvailable,
  };
}

/**
 * Export type for service instance
 */
export type LensService = ReturnType<typeof createLensService>;
