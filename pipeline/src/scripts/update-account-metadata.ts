#!/usr/bin/env bun
/**
 * Update Account Metadata Script
 *
 * Updates the Grove metadata for an existing Lens account (e.g., to add systemPrompt).
 *
 * Usage:
 *   bun src/scripts/update-account-metadata.ts --handle=scarlett --system-prompt-file=accounts/scarlett/system-prompt.txt
 *   bun src/scripts/update-account-metadata.ts --handle=scarlett --system-prompt="Your prompt here"
 */

import { parseArgs } from 'util';
import { readFileSync, existsSync } from 'fs';
import { createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getAccountByHandle, updateAccountLens } from '../db/queries';
import {
  validateEnv,
  PRIVATE_KEY,
  LENS_APP_ADDRESS,
} from '../config';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    handle: { type: 'string' },
    'system-prompt': { type: 'string' },
    'system-prompt-file': { type: 'string' },
    bio: { type: 'string' },
  },
  strict: true,
});

async function main() {
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  if (!values.handle) {
    console.error('❌ Missing required argument: --handle');
    console.log('\nUsage:');
    console.log('  bun src/scripts/update-account-metadata.ts --handle=scarlett --system-prompt-file=accounts/scarlett/system-prompt.txt');
    process.exit(1);
  }

  const handle = values.handle;

  console.log('\n🔄 Update Account Metadata');
  console.log('===========================');
  console.log(`   Handle: ${handle}`);

  // Get account from database
  const account = await getAccountByHandle(handle);
  if (!account) {
    console.error(`\n❌ Account not found: ${handle}`);
    process.exit(1);
  }

  if (!account.lens_account_address) {
    console.error(`\n❌ Account has no Lens account. Create one first.`);
    process.exit(1);
  }

  console.log(`   Lens Handle: ${account.lens_handle}`);
  console.log(`   Lens Address: ${account.lens_account_address}`);
  console.log(`   Current Metadata: ${account.lens_metadata_uri}`);

  // Load system prompt
  let systemPrompt: string | undefined;
  if (values['system-prompt-file']) {
    if (!existsSync(values['system-prompt-file'])) {
      console.error(`❌ System prompt file not found: ${values['system-prompt-file']}`);
      process.exit(1);
    }
    systemPrompt = readFileSync(values['system-prompt-file'], 'utf-8').trim();
    console.log(`\n📄 System prompt loaded from file (${systemPrompt.length} chars)`);
  } else if (values['system-prompt']) {
    systemPrompt = values['system-prompt'];
    console.log(`\n📄 System prompt provided (${systemPrompt.length} chars)`);
  }

  if (!systemPrompt && !values.bio) {
    console.error('\n❌ Nothing to update. Provide --system-prompt, --system-prompt-file, or --bio');
    process.exit(1);
  }

  // Dynamic imports
  const { PublicClient } = await import('@lens-protocol/client');
  const { staging } = await import('@lens-protocol/env');
  const { evmAddress } = await import('@lens-protocol/client');
  const { signMessageWith, handleOperationWith } = await import('@lens-protocol/client/viem');
  const { setAccountMetadata } = await import('@lens-protocol/client/actions');
  const { StorageClient } = await import('@lens-chain/storage-client');
  const { immutable } = await import('@lens-chain/storage-client');
  const { chains } = await import('@lens-chain/sdk/viem');
  const { account: accountMetadata, MetadataAttributeType } = await import('@lens-protocol/metadata');

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

  // Connect to Lens
  console.log('\n🔌 Connecting to Lens Protocol...');
  const lensClient = PublicClient.create({
    environment: staging,
    origin: 'http://localhost:3000',
  });

  // Create storage client
  const storageClient = StorageClient.create();

  // Build new metadata with systemPrompt
  console.log('\n📝 Building new metadata...');

  const bio = values.bio || account.bio || `${account.display_name} on Karaoke School`;

  const attributes: any[] = [
    { type: MetadataAttributeType.STRING, key: 'pkpAddress', value: account.pkp_address || '' },
    { type: MetadataAttributeType.STRING, key: 'accountType', value: account.account_type },
    { type: MetadataAttributeType.STRING, key: 'handle', value: handle },
  ];

  if (systemPrompt) {
    attributes.push({ type: MetadataAttributeType.STRING, key: 'systemPrompt', value: systemPrompt });
    console.log('   ✓ Added systemPrompt attribute');
  }

  const metadata = accountMetadata({
    name: account.display_name || handle,
    bio,
    picture: account.avatar_grove_url || undefined,
    attributes,
  });

  // Upload new metadata to Grove
  console.log('\n📤 Uploading new metadata to Grove...');
  const uploadResult = await storageClient.uploadAsJson(metadata, {
    name: `${account.lens_handle}-account-metadata.json`,
    acl: immutable(chains.testnet.id),
  });
  console.log(`   ✓ New Metadata URI: ${uploadResult.uri}`);

  // Login to Lens with the account
  console.log('\n🔐 Authenticating with Lens Protocol...');
  const authenticated = await lensClient.login({
    accountOwner: {
      account: evmAddress(account.lens_account_address!),
      app: evmAddress(LENS_APP_ADDRESS),
      owner: evmAddress(walletAccount.address),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    console.error('❌ Lens login failed:', authenticated.error);
    process.exit(1);
  }

  const sessionClient = authenticated.value;
  console.log('   ✓ Authenticated');

  // Update account metadata on-chain
  console.log('\n⏳ Updating account metadata on-chain...');
  const updateResult = await setAccountMetadata(sessionClient, {
    metadataUri: uploadResult.uri,
  }).andThen(handleOperationWith(walletClient));

  if (updateResult.isErr()) {
    console.error('❌ Metadata update failed:', updateResult.error);
    process.exit(1);
  }

  const txHash = updateResult.value as Hex;
  console.log(`   📡 Transaction: ${txHash}`);

  // Wait for confirmation
  console.log('   ⏳ Waiting for confirmation...');
  const waitResult = await sessionClient.waitForTransaction(txHash as any);

  if (waitResult.isErr()) {
    const message = waitResult.error.message || 'Unknown error';
    if (!message.includes('Timeout')) {
      console.error('❌ Transaction failed:', message);
      process.exit(1);
    }
    console.log('   ⚠️  Timeout waiting, but transaction likely succeeded');
  }

  // Update database
  console.log('\n💾 Updating database...');
  await updateAccountLens(handle, {
    lens_handle: account.lens_handle!,
    lens_account_address: account.lens_account_address!,
    lens_account_id: account.lens_account_id || account.lens_account_address!,
    lens_metadata_uri: uploadResult.uri,
    lens_transaction_hash: txHash,
  });
  console.log('   ✓ Database updated');

  console.log('\n✅ Account metadata updated successfully!');
  console.log(`   New Metadata URI: ${uploadResult.uri}`);
  console.log(`   Grove URL: ${uploadResult.uri.replace('lens://', 'https://api.grove.storage/')}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
