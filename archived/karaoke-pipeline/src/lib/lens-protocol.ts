/**
 * Lens Protocol utilities
 * Handles Lens account creation and management
 */

import { PublicClient, evmAddress } from '@lens-protocol/client';
import { createAccountWithUsername, fetchAccount, setAccountMetadata } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { account as accountMetadata } from '@lens-protocol/metadata';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// Lens app address (required for account creation)
const LENS_APP_ADDRESS = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

/**
 * Initialize Lens SDK client
 */
export function initLensClient() {
  return PublicClient.create({
    environment: testnet,
    origin: 'http://localhost:3000', // Required for non-browser environments
  });
}

/**
 * Initialize Grove storage client
 */
export function initGroveClient() {
  return StorageClient.create();
}

/**
 * Create wallet client for signing Lens transactions
 */
export function createLensWalletClient() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  return createWalletClient({
    account,
    chain: chains.testnet,
    transport: http(),
  });
}

/**
 * Sanitize name to create valid Lens handle
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
 * Check if a Lens handle is available
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const lensClient = initLensClient();
  const walletClient = createLensWalletClient();

  // Login to Lens
  const authenticated = await lensClient.login({
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
  // If account doesn't exist (error or null), handle IS available
  return accountResult.isErr() || !accountResult.value;
}

/**
 * Find an available Lens handle with collision handling
 * Tries base handle, then "-ks" (Karaoke School), then "-ks-2", "-ks-3", etc.
 */
export async function findAvailableHandle(baseHandle: string, maxAttempts = 10): Promise<string> {
  let handle = baseHandle;
  let attempt = 0;

  while (attempt <= maxAttempts) {
    console.log(`   🔍 Checking handle availability: ${handle}`);

    const available = await isHandleAvailable(handle);

    if (available) {
      console.log(`   ✅ Handle available: ${handle}`);
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

  throw new Error(`Could not find available handle after ${maxAttempts} attempts (base: ${baseHandle})`);
}

/**
 * Update Lens account metadata (including profile picture)
 */
export async function updateLensAccountMetadata(params: {
  accountAddress: Address;
  handle: string;
  name: string;
  bio?: string;
  pictureUri?: string;
  attributes?: Array<{ type: string; key: string; value: string }>;
}): Promise<{
  metadataUri: string;
  transactionHash: Hex;
}> {
  const { accountAddress, handle, name, bio, pictureUri, attributes = [] } = params;

  // Initialize clients
  const lensClient = initLensClient();
  const walletClient = createLensWalletClient();
  const storage = initGroveClient();

  // Create metadata
  const metadata = accountMetadata({
    name,
    bio: bio || `Official Karaoke School profile for ${name}`,
    picture: pictureUri,
    attributes,
  });

  // Upload metadata to Grove
  const uploadResult = await storage.uploadAsJson(metadata, {
    name: `${handle}-account-metadata-${Date.now()}.json`,
    acl: immutable(chains.testnet.id),
  });

  // Login to Lens as account owner (not onboarding user)
  const authenticated = await lensClient.login({
    accountOwner: {
      account: evmAddress(accountAddress),
      owner: evmAddress(walletClient.account.address),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`);
  }

  const sessionClient = authenticated.value;

  // Update account metadata via Lens
  const updateResult = await setAccountMetadata(sessionClient, {
    metadataUri: uploadResult.uri,
  })
    .andThen(handleOperationWith(walletClient))
    .andThen(sessionClient.waitForTransaction);

  if (updateResult.isErr()) {
    throw new Error(`Set account metadata failed: ${updateResult.error.message}`);
  }

  return {
    metadataUri: uploadResult.uri,
    transactionHash: updateResult.value as Hex,
  };
}

/**
 * Create Lens account with automatic collision handling
 */
export async function createLensAccount(params: {
  handle: string;
  name: string;
  bio?: string;
  pictureUri?: string;
  attributes?: Array<{ type: string; key: string; value: string }>;
}): Promise<{
  lensHandle: string;
  lensAccountAddress: Address;
  lensAccountId: Hex;
  metadataUri: string;
  transactionHash: Hex;
}> {
  const { handle: requestedHandle, name, bio, pictureUri, attributes = [] } = params;

  // Find available handle (handles collisions automatically)
  const handle = await findAvailableHandle(requestedHandle);

  if (handle !== requestedHandle) {
    console.log(`   ⚠️  Using alternate handle: ${handle} (requested: ${requestedHandle})`);
  }

  // Initialize clients
  const lensClient = initLensClient();
  const walletClient = createLensWalletClient();
  const storage = initGroveClient();

  // Create metadata
  const metadata = accountMetadata({
    name,
    bio: bio || `Official Karaoke School profile for ${name}`,
    picture: pictureUri,
    attributes,
  });

  // Upload metadata to Grove
  const uploadResult = await storage.uploadAsJson(metadata, {
    name: `${handle}-account-metadata.json`,
    acl: immutable(chains.testnet.id),
  });

  // Login to Lens
  const authenticated = await lensClient.login({
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
