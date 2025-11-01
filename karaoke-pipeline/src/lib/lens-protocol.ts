/**
 * Lens Protocol utilities
 * Handles Lens account creation and management
 */

import { PublicClient, evmAddress } from '@lens-protocol/client';
import { createAccountWithUsername, fetchAccount } from '@lens-protocol/client/actions';
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
 * Create Lens account
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
  const { handle, name, bio, pictureUri, attributes = [] } = params;

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
