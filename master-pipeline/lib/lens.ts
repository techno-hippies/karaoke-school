/**
 * Lens Protocol utilities
 * Wraps Lens account creation and management
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
import type { ArtistLens } from './types';
import { requireEnv } from './config';

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
 * Create wallet client for signing
 */
export function createLensWalletClient() {
  const privateKey = requireEnv('PRIVATE_KEY');
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  return createWalletClient({
    account,
    chain: chains.testnet,
    transport: http(),
  });
}

/**
 * Create Lens account for artist
 */
export async function createLensAccount(params: {
  pkpAddress: Address;
  handle: string;
  artistName: string;
  geniusArtistId: number;
  luminateId: string;
  musicbrainzId?: string;
  spotifyArtistId?: string;
  avatarUri?: string;
}): Promise<ArtistLens> {
  const { pkpAddress, handle, artistName, geniusArtistId, luminateId, musicbrainzId, spotifyArtistId, avatarUri } = params;

  console.log(`\n🌿 Creating Lens account for ${artistName}...`);

  // Initialize clients
  const lensClient = initLensClient();
  const walletClient = createLensWalletClient();
  const storage = initGroveClient();

  // App address for the Lens app
  const appAddress = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

  console.log('   Owner Address: ' + walletClient.account.address);
  console.log('   PKP Address: ' + pkpAddress);

  // Login to Lens as onboarding user
  console.log('\n🔐 Authenticating with Lens Protocol...');
  const authenticated = await lensClient.login({
    onboardingUser: {
      app: evmAddress(appAddress),
      wallet: evmAddress(walletClient.account.address),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`);
  }

  console.log('✅ Authenticated with Lens');
  const sessionClient = authenticated.value;

  // Create metadata
  console.log('\n📝 Creating account metadata...');
  const attributes = [
    { type: 'String', key: 'pkpAddress', value: pkpAddress },
    { type: 'Number', key: 'geniusArtistId', value: geniusArtistId.toString() },
    { type: 'String', key: 'luminateId', value: luminateId },
    { type: 'String', key: 'artistType', value: 'music-artist' },
  ];

  if (musicbrainzId) {
    attributes.push({ type: 'String', key: 'musicbrainzId', value: musicbrainzId });
  }
  if (spotifyArtistId) {
    attributes.push({ type: 'String', key: 'spotifyArtistId', value: spotifyArtistId });
  }

  const metadata = accountMetadata({
    name: artistName,
    bio: `Official Karaoke School profile for ${artistName}`,
    picture: avatarUri,
    attributes,
  });

  // Upload metadata to Grove
  console.log('☁️  Uploading metadata to Grove...');
  const uploadResult = await storage.uploadAsJson(metadata, {
    name: `${handle}-account-metadata.json`,
    acl: immutable(chains.testnet.id),
  });
  console.log(`✅ Metadata uploaded: ${uploadResult.uri}`);

  // Create account with username
  console.log('\n👤 Creating Lens account...');
  console.log(`   Lens Handle: @${handle}`);

  const createResult = await createAccountWithUsername(sessionClient, {
    username: {
      localName: handle,
    },
    metadataUri: uploadResult.uri,
  })
    .andThen(handleOperationWith(walletClient))
    .andThen(sessionClient.waitForTransaction);

  if (createResult.isErr()) {
    throw new Error(`Account creation failed: ${createResult.error.message}`);
  }

  const txHash = createResult.value;
  console.log('✅ Lens Account Created!');
  console.log(`   Tx: ${txHash}`);

  // Fetch account details
  const accountResult = await fetchAccount(sessionClient, {
    username: { localName: handle },
  });

  if (accountResult.isErr() || !accountResult.value) {
    throw new Error('Failed to fetch created account');
  }

  const createdAccount = accountResult.value;

  const lensData: ArtistLens = {
    lensHandle: handle,
    lensAccountAddress: createdAccount.address as Address,
    lensAccountId: createdAccount.address as Hex, // Using address as ID for now
    network: 'lens-testnet',
    createdAt: new Date().toISOString(),
    metadataUri: uploadResult.uri,
    transactionHash: txHash as Hex,
  };

  console.log(`   Address: ${lensData.lensAccountAddress}`);

  return lensData;
}

/**
 * Create username for existing Lens account (not needed - done in createAccountWithUsername)
 */
export async function createLensUsername(params: {
  accountAddress: Address;
  username: string;
}): Promise<void> {
  console.log(`\n🏷️  Username already created with account: @${params.username}`);
  // Username is created with the account in createAccountWithUsername
}

/**
 * Fetch Lens account by username
 */
export async function fetchLensAccount(username: string) {
  const lensClient = initLensClient();

  const accountResult = await fetchAccount(lensClient, {
    username: { localName: username },
  });

  if (accountResult.isErr()) {
    return null;
  }

  return accountResult.value;
}

/**
 * Upload JSON to Grove storage
 */
export async function uploadToGrove(params: {
  json: any;
  accessControl?: 'immutable' | 'lensAccountOnly';
  accountId?: Hex;
}): Promise<string> {
  const { json, accessControl = 'immutable', accountId } = params;

  const storage = initGroveClient();

  const uri = await storage.uploadJson({
    json,
    accessControl:
      accessControl === 'immutable'
        ? { type: 'immutable' }
        : { type: 'lensAccountOnly', account: accountId! },
  });

  return uri;
}

/**
 * Fetch data from Grove storage
 */
export async function fetchFromGrove(uri: string): Promise<any> {
  const storage = initGroveClient();

  // Extract hash from lens:// URI
  const hash = uri.replace('lens://', '');

  // Fetch from Grove
  const response = await fetch(`https://grove.infra.lens.build/${hash}`);
  return await response.json();
}
