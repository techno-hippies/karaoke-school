#!/usr/bin/env bun
/**
 * Fix Scarlett Account Script
 *
 * Creates a username for Scarlett's existing Lens account and updates metadata.
 */

import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PRIVATE_KEY, LENS_APP_ADDRESS, LENS_NAMESPACE_ADDRESS, LENS_NAMESPACE_NAME } from '../config';
import { query } from '../db/connection';

const SCARLETT_LENS_ADDRESS = '0xe8981b02561f4AfE1A629274fDf25b21e82d9e4B';
const SCARLETT_HANDLE = 'scarlett';
const LENS_HANDLE = 'scarlett-ks';
const AVATAR_URL = 'https://api.grove.storage/dce706da6b11df0607c8dc7655ca30e8ab26675697242ea0bb21f5c06dce24cf';

async function main() {
  console.log('\n🔧 Fix Scarlett Account');
  console.log('========================');

  // Dynamic imports for Lens SDK
  const { PublicClient } = await import('@lens-protocol/client');
  const { staging } = await import('@lens-protocol/env');
  const { evmAddress } = await import('@lens-protocol/client');
  const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');
  const { createUsername, setAccountMetadata } = await import('@lens-protocol/client/actions');
  const { StorageClient, immutable } = await import('@lens-chain/storage-client');
  const { chains } = await import('@lens-chain/sdk/viem');
  const { profile: profileMetadata, MetadataAttributeType } = await import('@lens-protocol/metadata');

  // Create wallet client
  let privateKey = PRIVATE_KEY;
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const walletAccount = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`   Wallet: ${walletAccount.address}`);

  const walletClient = createWalletClient({
    account: walletAccount,
    chain: chains.testnet,
    transport: http(),
  });

  // Create Lens client
  console.log('\n🔌 Connecting to Lens Protocol...');
  const lensClient = PublicClient.create({
    environment: staging,
    origin: 'http://localhost:3000',
  });

  // Login as account owner
  console.log('\n🔐 Authenticating as account owner...');
  const authenticated = await lensClient.login({
    accountOwner: {
      account: evmAddress(SCARLETT_LENS_ADDRESS),
      owner: evmAddress(walletAccount.address),
      app: evmAddress(LENS_APP_ADDRESS),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    console.error('❌ Login failed:', authenticated.error);
    process.exit(1);
  }

  const sessionClient = authenticated.value;
  console.log('   ✓ Authenticated');

  // Create storage client for metadata
  const storageClient = StorageClient.create();

  // Step 1: Create username
  console.log(`\n📝 Creating username: ${LENS_NAMESPACE_NAME}/${LENS_HANDLE}`);
  const usernameResult = await createUsername(sessionClient, {
    username: {
      localName: LENS_HANDLE,
      namespace: evmAddress(LENS_NAMESPACE_ADDRESS),
    },
  }).andThen(handleOperationWith(walletClient) as any);

  if (usernameResult.isErr()) {
    console.error('❌ Username creation failed:', usernameResult.error);
    // Continue anyway - might already exist or we can try later
  } else {
    const txHash = usernameResult.value as Hex;
    console.log(`   📡 Transaction: ${txHash}`);

    // Wait for transaction
    console.log('   ⏳ Waiting for confirmation...');
    const waitResult = await sessionClient.waitForTransaction(txHash as any);
    if (waitResult.isErr() && !waitResult.error.message?.includes('Timeout')) {
      console.error('   ⚠️  Wait failed:', waitResult.error.message);
    }
    console.log('   ✓ Username created');
  }

  // Step 2: Upload and set metadata
  console.log('\n📝 Building account metadata...');
  const metadata = profileMetadata({
    name: 'Scarlett',
    bio: 'AI karaoke coach helping you sing like a star',
    picture: AVATAR_URL,
    attributes: [
      { type: MetadataAttributeType.STRING, key: 'handle', value: SCARLETT_HANDLE },
      { type: MetadataAttributeType.STRING, key: 'accountType', value: 'ai' },
    ],
  });

  console.log('📤 Uploading metadata to Grove...');
  const uploadResult = await storageClient.uploadAsJson(metadata, {
    name: `${LENS_HANDLE}-metadata.json`,
    acl: immutable(chains.testnet.id),
  });
  console.log(`   ✓ Metadata URI: ${uploadResult.uri}`);

  console.log('\n⏳ Setting account metadata...');
  const metadataResult = await setAccountMetadata(sessionClient, {
    metadataUri: uploadResult.uri,
  }).andThen(handleOperationWith(walletClient));

  if (metadataResult.isErr()) {
    console.error('❌ Set metadata failed:', metadataResult.error);
  } else {
    const txHash = metadataResult.value as Hex;
    console.log(`   📡 Transaction: ${txHash}`);

    console.log('   ⏳ Waiting for confirmation...');
    const waitResult = await sessionClient.waitForTransaction(txHash as any);
    if (waitResult.isErr() && !waitResult.error.message?.includes('Timeout')) {
      console.error('   ⚠️  Wait failed:', waitResult.error.message);
    }
    console.log('   ✓ Metadata set');
  }

  // Step 3: Update database
  console.log('\n💾 Updating database...');
  await query(
    `UPDATE accounts
     SET lens_handle = $1, lens_metadata_uri = $2, updated_at = NOW()
     WHERE handle = $3`,
    [LENS_HANDLE, uploadResult.uri, SCARLETT_HANDLE]
  );
  console.log('   ✓ Database updated');

  console.log('\n✅ Scarlett account fixed!');
  console.log(`   Username: ${LENS_NAMESPACE_NAME}/${LENS_HANDLE}`);
  console.log(`   Address: ${SCARLETT_LENS_ADDRESS}`);
  console.log(`   Avatar: ${AVATAR_URL}`);
  console.log(`\n   View: https://testnet.lens.xyz/u/${LENS_HANDLE}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
