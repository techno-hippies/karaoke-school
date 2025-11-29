#!/usr/bin/env bun
/**
 * Create Lens Account Script
 *
 * Creates a Lens Protocol account for an existing account with PKP.
 *
 * Usage:
 *   bun src/scripts/create-lens-account.ts --handle=scarlett
 *   bun src/scripts/create-lens-account.ts --handle=scarlett --lens-handle=scarlett-ks
 */

import { parseArgs } from 'util';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getAccountByHandle, updateAccountLens } from '../db/queries';
import {
  validateEnv,
  PRIVATE_KEY,
  LENS_APP_ADDRESS,
  LENS_NAMESPACE_ADDRESS,
  LENS_NAMESPACE_NAME,
} from '../config';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    handle: { type: 'string' },
    'lens-handle': { type: 'string' },
    bio: { type: 'string' },
  },
  strict: true,
});

/**
 * Sanitize name to create valid Lens handle
 */
function sanitizeHandle(name: string, suffix: string = '-ks'): string {
  const maxLength = 30 - suffix.length;
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, maxLength);

  if (!sanitized || sanitized.length === 0) {
    return `account-${Date.now().toString(36)}${suffix}`;
  }

  return `${sanitized}${suffix}`;
}

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  if (!values.handle) {
    console.error('❌ Missing required argument: --handle');
    console.log('\nUsage:');
    console.log('  bun src/scripts/create-lens-account.ts --handle=scarlett');
    process.exit(1);
  }

  const handle = values.handle;

  console.log('\n🌿 Create Lens Account Script');
  console.log('==============================');
  console.log(`   Handle: ${handle}`);

  // Check if account exists and has PKP
  const account = await getAccountByHandle(handle);
  if (!account) {
    console.error(`\n❌ Account not found: ${handle}`);
    process.exit(1);
  }

  if (!account.pkp_address) {
    console.error(`\n❌ Account has no PKP. Mint one first:`);
    console.log(`   bun src/scripts/mint-pkp.ts --handle=${handle}`);
    process.exit(1);
  }

  if (account.lens_handle) {
    console.log('\n⚠️  Account already has a Lens account:');
    console.log(`   Lens Handle: ${account.lens_handle}`);
    console.log(`   Lens Address: ${account.lens_account_address}`);
    process.exit(0);
  }

  // Determine Lens handle
  const lensHandle = values['lens-handle'] || sanitizeHandle(account.display_name || handle);
  const bio = values.bio || account.bio || `${account.display_name} on Karaoke School`;

  console.log(`   Lens Handle: ${LENS_NAMESPACE_NAME}/${lensHandle}`);
  console.log(`   PKP Address: ${account.pkp_address}`);

  // Dynamic imports for Lens SDK
  const { PublicClient } = await import('@lens-protocol/client');
  const { staging } = await import('@lens-protocol/env');
  const { evmAddress } = await import('@lens-protocol/client');
  const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');
  const { createAccountWithUsername, fetchAccount } = await import('@lens-protocol/client/actions');
  const { StorageClient } = await import('@lens-chain/storage-client');
  const { immutable } = await import('@lens-chain/storage-client');
  const { chains } = await import('@lens-chain/sdk/viem');
  const { profile: profileMetadata, MetadataAttributeType } = await import('@lens-protocol/metadata');

  // Create wallet client
  let privateKey = PRIVATE_KEY;
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const walletAccount = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`\n📝 Using wallet: ${walletAccount.address}`);

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
  console.log('   ✓ Connected');

  // Create storage client
  const storageClient = StorageClient.create();

  // Build account metadata
  console.log('\n📝 Building account metadata...');
  const metadata = profileMetadata({
    name: account.display_name || handle,
    bio,
    attributes: [
      { type: MetadataAttributeType.STRING, key: 'pkpAddress', value: account.pkp_address },
      { type: MetadataAttributeType.STRING, key: 'accountType', value: account.account_type },
      { type: MetadataAttributeType.STRING, key: 'handle', value: handle },
    ],
  });

  // Upload metadata to Grove
  console.log('📤 Uploading metadata to Grove...');
  const uploadResult = await storageClient.uploadAsJson(metadata, {
    name: `${lensHandle}-account-metadata.json`,
    acl: immutable(chains.testnet.id),
  });
  console.log(`   ✓ Metadata URI: ${uploadResult.uri}`);

  // Login to Lens
  console.log('\n🔐 Authenticating with Lens Protocol...');
  const authenticated = await lensClient.login({
    onboardingUser: {
      app: evmAddress(LENS_APP_ADDRESS),
      wallet: evmAddress(walletAccount.address),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    console.error('❌ Lens login failed:', authenticated.error);
    process.exit(1);
  }

  const sessionClient = authenticated.value;
  console.log('   ✓ Authenticated');

  // Create account
  console.log(`\n⏳ Creating Lens account ${LENS_NAMESPACE_NAME}/${lensHandle}...`);
  const createResult = await createAccountWithUsername(sessionClient, {
    username: {
      localName: lensHandle,
      namespace: evmAddress(LENS_NAMESPACE_ADDRESS),
    },
    metadataUri: uploadResult.uri,
  }).andThen(handleOperationWith(walletClient));

  if (createResult.isErr()) {
    console.error('❌ Account creation failed:', createResult.error);
    process.exit(1);
  }

  const txHash = createResult.value as Hex;
  console.log(`   📡 Transaction: ${txHash}`);

  // Wait for transaction
  console.log('   ⏳ Waiting for confirmation...');
  const waitResult = await sessionClient.waitForTransaction(txHash as any);

  if (waitResult.isErr()) {
    const message = waitResult.error.message || 'Unknown error';
    if (!message.includes('Timeout')) {
      console.error('❌ Transaction failed:', message);
      process.exit(1);
    }
    console.log('   ⚠️  Timeout waiting, continuing to poll...');
  }

  // Fetch created account
  console.log('   🔍 Fetching account...');
  let createdAccount: any = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const accountResult = await fetchAccount(sessionClient, { txHash: txHash as any });

    if (accountResult.isOk() && accountResult.value) {
      createdAccount = accountResult.value;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  if (!createdAccount) {
    console.error('❌ Could not fetch created account after 60 seconds');
    console.log('   Transaction may still be indexing. Check manually.');
    process.exit(1);
  }

  console.log('   ✓ Account created!');
  console.log(`   Address: ${createdAccount.address}`);

  // Update database
  console.log('\n💾 Updating database...');
  const updated = await updateAccountLens(handle, {
    lens_handle: lensHandle,
    lens_account_address: createdAccount.address,
    lens_account_id: createdAccount.address,
    lens_metadata_uri: uploadResult.uri,
    lens_transaction_hash: txHash,
  });

  if (!updated) {
    console.error('❌ Failed to update database');
    process.exit(1);
  }

  console.log('   ✓ Database updated');

  console.log('\n✅ Lens account created successfully!');
  console.log(`   Handle: ${LENS_NAMESPACE_NAME}/${lensHandle}`);
  console.log(`   Address: ${createdAccount.address}`);
  console.log(`   Explorer: https://explorer.testnet.lens.xyz/address/${createdAccount.address}`);

  console.log('\n💡 Next steps:');
  console.log(`   Post a clip: bun src/scripts/post-clip.ts --handle=${handle} --song=<iswc>`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
