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
 * Post creation parameters
 */
export interface CreatePostParams {
  /** Account address that should create the post */
  accountAddress: Address;

  /** Post content (text) */
  content: string;

  /** Optional video/audio attachment URI */
  videoUri?: string;

  /** Optional cover/thumbnail image URI */
  coverImageUri?: string;

  /** Optional tags for discoverability */
  tags?: string[];

  /** Optional metadata attributes (song info, IDs, etc.) */
  attributes?: Array<{
    type: 'Boolean' | 'Date' | 'Number' | 'String' | 'JSON';
    key: string;
    value: string;
  }>;

  /** Optional app ID to associate post with custom feed */
  appId?: string;

  /** Optional content warning */
  contentWarning?: string;
}

/**
 * Post creation result
 */
export interface PostCreationResult {
  postId: string;                  // Lens post ID
  metadataUri: string;             // Grove URI to post metadata
  transactionHash: Hex;            // Post creation transaction
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
  pkpAddress: Address;             // PKP owner that should control the account
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
 * - Appends "-ks1" suffix by default (Karaoke School v1)
 * - If suffix already present, doesn't double-append
 *
 * Examples:
 * - "Ariana Grande" → "ariana-grande-ks1"
 * - "21 Savage!!!" → "21-savage-ks1"
 * - "---Bad-Name---" → "bad-name-ks1"
 * - "★★★" → "artist-{hash}-ks1" (symbols-only fallback)
 * - "luis-fonsi-ks2" → "luis-fonsi-ks2" (already has suffix)
 */
export function sanitizeHandle(name: string, suffix: string = '-ks1'): string {
  // Check if name already has a -ksN suffix
  const hasSuffix = /-ks\d+$/.test(name.toLowerCase());

  const maxLength = hasSuffix ? 30 : (30 - suffix.length);
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric with dashes
    .replace(/-+/g, '-')          // Collapse multiple dashes
    .replace(/^-|-$/g, '')        // Remove leading/trailing dashes
    .substring(0, maxLength);

  // Fallback for empty string (all symbols/special chars)
  if (!sanitized || sanitized.length === 0) {
    return `artist-${Date.now().toString(36)}${suffix}`;
  }

  // If already has suffix, return as-is
  if (hasSuffix) {
    return sanitized;
  }

  return `${sanitized}${suffix}`;
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
    const { staging } = await import('@lens-protocol/env');

    lensClient = PublicClient.create({
      environment: staging,
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
   * @returns Availability flag plus account data when taken
   */
  async function isHandleAvailable(handle: string): Promise<{
    available: boolean;
    account: any | null;
  }> {
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

    if (accountResult.isErr() || !accountResult.value) {
      return { available: true, account: null };
    }

    return { available: false, account: accountResult.value };
  }

  /**
   * Find an available Lens handle with collision handling while respecting ownership
   *
   * Strategy:
   * 1. Try base handle (e.g. "artist-ks1")
   * 2. If taken by this artist's PKP, reuse existing handle
   * 3. If taken by someone else, increment numeric suffix (artist-ks2, artist-ks3, ...)
   *
   * @param baseHandle - Sanitized handle to start with
   * @param pkpAddress - PKP address that should own the handle
   * @param maxAttempts - Maximum collision attempts (default: 10)
   * @returns Handle information including ownership status
   */
  async function findAvailableHandle(
    baseHandle: string,
    pkpAddress: Address,
    maxAttempts: number = 10
  ): Promise<{ handle: string; owned: boolean; account: any | null }> {
    const suffixMatch = baseHandle.match(/^(.*?)-ks(\d+)$/);
    const basePrefix = suffixMatch ? suffixMatch[1] : baseHandle;
    const baseNumber = suffixMatch ? parseInt(suffixMatch[2], 10) : 0;

    let attempt = 0;
    let handle = baseHandle;

    while (attempt <= maxAttempts) {
      console.log(`   🔍 Checking handle: ${handle}`);

      const { available, account } = await isHandleAvailable(handle);

      if (available) {
        console.log(`   ✓ Handle available: ${handle}`);
        return { handle, owned: false, account: null };
      }

      const attributes: Array<{ key: string; value: string }> = account?.metadata?.attributes ?? [];
      const hasMatchingPKP = attributes.some(
        (attr) =>
          attr &&
          attr.key === 'pkpAddress' &&
          typeof attr.value === 'string' &&
          attr.value.toLowerCase() === pkpAddress.toLowerCase()
      );

      if (account && hasMatchingPKP) {
        console.log(`   ✓ Handle already linked to PKP metadata: ${handle}`);
        return { handle, owned: true, account };
      }

      console.log(`   ⚠️  Handle taken by another account: ${handle}`);
      attempt++;

      const nextSuffixNumber = baseNumber > 0 ? baseNumber + attempt : attempt + 1;
      const suffix = `-ks${nextSuffixNumber}`;
      const maxPrefixLength = 30 - suffix.length;
      const truncatedPrefix = basePrefix.substring(0, Math.max(0, maxPrefixLength));

      if (truncatedPrefix.length === 0) {
        throw new Error('Unable to construct valid Lens handle within 30 character limit');
      }

      handle = `${truncatedPrefix}${suffix}`;
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
    const { handle: requestedHandle, name, bio, pictureUri, attributes = [], pkpAddress } = params;

    const sanitized = sanitizeHandle(requestedHandle);
    const { handle, owned, account: existingAccount } = await findAvailableHandle(sanitized, pkpAddress);

    if (handle !== sanitized && !owned) {
      console.log(`   ⚠️  Using alternate handle: ${handle} (requested: ${sanitized})`);
    }

    // REMOVED: Buggy "reuse" logic that created fake lens://metadata/{uuid} URIs
    // The Lens API sometimes returns stale/partial data with invalid metadata.id values
    // Always create accounts fresh to ensure real on-chain transactions
    if (owned && existingAccount) {
      console.log(`   ⚠️  Handle @${handle} appears to exist in Lens API, but creating fresh account to ensure on-chain validity`);
      // Fall through to real account creation below
    }

    // Initialize all clients required for account creation
    const client = await initLensClient();
    const walletClient = await createLensWalletClient();
    const storage = await initStorageClient();
    const chainsConfig = await initChains();

    const { evmAddress } = await import('@lens-protocol/client');
    const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');
    const { createAccountWithUsername, fetchAccount } = await import('@lens-protocol/client/actions');
    const { immutable } = await import('@lens-chain/storage-client');
    const { account: accountMetadata } = await import('@lens-protocol/metadata');

    const metadata = accountMetadata({
      name,
      bio: bio || `Official Karaoke School profile for ${name}`,
      picture: pictureUri,
      attributes,
    });

    console.log('   📤 Uploading metadata to Grove...');
    const uploadResult = await storage.uploadAsJson(metadata, {
      name: `${handle}-account-metadata.json`,
      acl: immutable(chainsConfig.testnet.id),
    });

    console.log(`   ✓ Metadata URI: ${uploadResult.uri}`);

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

    console.log(`   ⏳ Creating Lens account @${handle}...`);
    const operationResult = await createAccountWithUsername(sessionClient, {
      username: { localName: handle },
      metadataUri: uploadResult.uri,
    }).andThen(handleOperationWith(walletClient));

    if (operationResult.isErr()) {
      throw new Error(`Account creation failed: ${operationResult.error.message}`);
    }

    const txHash = operationResult.value;
    const waitResult = await sessionClient.waitForTransaction(txHash);

    if (waitResult.isErr()) {
      const message = waitResult.error.message || 'Unknown waitForTransaction error';
      if (!message.includes('Timeout waiting for transaction')) {
        throw new Error(`Account creation failed: ${message}`);
      }

      console.warn(`   ⚠️  ${message} — continuing to poll for indexing`);
    }

    const maxAttempts = 12;
    const delayMs = 5000;
    let createdAccount: any = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const accountResult = await fetchAccount(sessionClient, { txHash });

      if (accountResult.isOk() && accountResult.value) {
        createdAccount = accountResult.value;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    if (!createdAccount) {
      throw new Error('Lens account transaction mined but not indexed yet; please retry shortly');
    }

    return {
      lensHandle: handle,
      lensAccountAddress: createdAccount.address as Address,
      lensAccountId: createdAccount.address as Hex,
      metadataUri: uploadResult.uri,
      transactionHash: txHash as Hex,
    };
  }

  /**
   * Create a post on Lens Protocol
   *
   * Process:
   * 1. Build post metadata (text content + optional video attachment)
   * 2. Upload metadata to Grove (immutable IPFS storage)
   * 3. Login to Lens Protocol as account owner
   * 4. Create post with metadata URI
   * 5. Wait for transaction confirmation and indexing
   * 6. Return post details for database storage
   *
   * @param params - Post creation parameters (account, content, video, tags)
   * @returns Post creation result with transaction hash
   */
  async function createPost(
    params: CreatePostParams
  ): Promise<PostCreationResult> {
    const { accountAddress, content, videoUri, coverImageUri, tags = [], attributes, appId, contentWarning } = params;

    // Initialize required clients
    const client = await initLensClient();
    const walletClient = await createLensWalletClient();
    const storage = await initStorageClient();
    const chainsConfig = await initChains();

    // Import Lens SDK functions
    const { evmAddress } = await import('@lens-protocol/client');
    const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');
    const { post: createPostAction } = await import('@lens-protocol/client/actions');
    const { immutable } = await import('@lens-chain/storage-client');
    const { textOnly, video: videoMetadata, shortVideo, MediaVideoMimeType } = await import('@lens-protocol/metadata');

    // Build post metadata
    console.log('   📝 Building post metadata...');
    const metadata = videoUri
      ? shortVideo({
          content,
          video: {
            item: videoUri,
            type: MediaVideoMimeType.MP4,
            cover: coverImageUri,
          },
          tags,
          attributes,
          contentWarning: contentWarning || undefined,
        })
      : textOnly({
          content,
          tags,
          attributes,
          contentWarning: contentWarning || undefined,
        });

    // Upload metadata to Grove
    console.log('   📤 Uploading post metadata to Grove...');
    const uploadResult = await storage.uploadAsJson(metadata, {
      name: `post-${Date.now()}.json`,
      acl: immutable(chainsConfig.testnet.id),
    });

    console.log(`   ✓ Metadata URI: ${uploadResult.uri}`);

    // Login to Lens
    console.log('   🔐 Authenticating with Lens Protocol...');
    const authenticated = await client.login({
      accountOwner: {
        account: evmAddress(accountAddress),
        owner: evmAddress(walletClient.account.address),
        app: evmAddress(appId || LENS_APP_ADDRESS),
      },
      signMessage: signMessageWith(walletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    const sessionClient = authenticated.value;

    // Create post
    console.log('   ⏳ Creating Lens post...');
    const postParams: any = {
      contentUri: uploadResult.uri,
    };

    // Add app ID if specified (for custom feeds)
    if (appId) {
      postParams.appId = evmAddress(appId);
    }

    const operationResult = await createPostAction(sessionClient, postParams)
      .andThen(handleOperationWith(walletClient));

    if (operationResult.isErr()) {
      throw new Error(`Post creation failed: ${operationResult.error.message}`);
    }

    const txHash = operationResult.value;
    console.log(`   📡 Transaction: ${txHash}`);

    // Wait for transaction confirmation
    const waitResult = await sessionClient.waitForTransaction(txHash);

    if (waitResult.isErr()) {
      const message = waitResult.error.message || 'Unknown waitForTransaction error';
      if (!message.includes('Timeout waiting for transaction')) {
        throw new Error(`Post creation failed: ${message}`);
      }
      console.warn(`   ⚠️  ${message} — post may still be indexing`);
    }

    console.log('   ✓ Post created successfully');

    // Return post details
    // Note: Post ID is typically derived from transaction hash
    // We'll use txHash as postId for now (Lens indexer will assign final ID)
    return {
      postId: txHash,
      metadataUri: uploadResult.uri,
      transactionHash: txHash as Hex,
    };
  }

  /**
   * Update account metadata (avatar, bio, etc.)
   */
  async function updateAccountMetadata(params: {
    accountAddress: Address;
    name: string;
    bio?: string;
    pictureUri?: string;
    pkpAddress: Address;
  }): Promise<{ metadataUri: string; transactionHash: Hex }> {
    const { accountAddress, name, bio, pictureUri, pkpAddress } = params;

    console.log(`   📝 Building metadata for ${accountAddress}...`);

    const storage = await initStorageClient();
    const chainsConfig = await initChains();

    const { setAccountMetadata } = await import('@lens-protocol/client/actions');
    const { immutable } = await import('@lens-chain/storage-client');
    const { account: accountMetadata } = await import('@lens-protocol/metadata');

    const metadata = accountMetadata({
      name,
      bio: bio || `Karaoke School profile for ${name}`,
      picture: pictureUri,
    });

    console.log(`   📤 Uploading metadata to Grove...`);
    const uploadResult = await storage.uploadAsJson(metadata, {
      name: `${accountAddress}-account-metadata.json`,
      acl: immutable(chainsConfig.testnet.id),
    });
    console.log(`   ✓ Metadata URI: ${uploadResult.uri}`);

    // Initialize Lens client and wallet
    const client = await initLensClient();
    const walletClient = await createLensWalletClient();

    const { evmAddress } = await import('@lens-protocol/client');
    const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');

    console.log('   🔐 Authenticating with Lens Protocol...');
    const authenticated = await client.login({
      accountOwner: {
        account: evmAddress(accountAddress),
        owner: evmAddress(walletClient.account.address),
        app: evmAddress(LENS_APP_ADDRESS),
      },
      signMessage: signMessageWith(walletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    const sessionClient = authenticated.value;

    console.log(`   ⏳ Updating account metadata...`);
    const operationResult = await setAccountMetadata(sessionClient, {
      metadataUri: uploadResult.uri,
    }).andThen(handleOperationWith(walletClient));

    if (operationResult.isErr()) {
      throw new Error(`Metadata update failed: ${operationResult.error.message}`);
    }

    const txHash = operationResult.value;
    console.log(`   📡 Transaction: ${txHash}`);

    return {
      metadataUri: uploadResult.uri,
      transactionHash: txHash as Hex,
    };
  }

  return {
    createAccount,
    createPost,
    updateAccountMetadata,
    sanitizeHandle,
    findAvailableHandle,
    isHandleAvailable,
  };
}

/**
 * Export type for service instance
 */
export type LensService = ReturnType<typeof createLensService>;
