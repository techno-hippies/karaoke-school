#!/usr/bin/env bun
/**
 * Delete Lens Post
 *
 * Deletes a post from Lens Protocol.
 *
 * Usage:
 *   bun src/scripts/delete-post.ts --post-id=<id> --account=scarlett
 *   bun src/scripts/delete-post.ts --post-id=97445828599714327802685342222386677102754465843760231925456819797103117828909 --account=scarlett
 */

import { parseArgs } from 'util';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { chains } from '@lens-chain/sdk/viem';
import { PublicClient, evmAddress, postId } from '@lens-protocol/client';
import { deletePost } from '@lens-protocol/client/actions';
import { handleOperationWith } from '@lens-protocol/client/viem';
import { staging } from '@lens-protocol/env';
import { getAccountByHandle } from '../db/queries';
import { validateEnv, LENS_APP_ADDRESS } from '../config';
import type { Account } from '../types';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'post-id': { type: 'string' },
    account: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

async function main() {
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  if (!values['post-id']) {
    console.error('❌ Missing required argument: --post-id');
    console.log('\nUsage:');
    console.log('  bun src/scripts/delete-post.ts --post-id=<id> --account=scarlett');
    process.exit(1);
  }

  if (!values.account) {
    console.error('❌ Missing required argument: --account');
    process.exit(1);
  }

  console.log('\n🗑️  Deleting Lens Post');
  console.log(`   Post ID: ${values['post-id']}`);
  console.log(`   Account: ${values.account}`);

  if (values['dry-run']) {
    console.log('   Mode: DRY RUN (no transactions)');
  }

  // Get account
  const account = await getAccountByHandle(values.account);
  if (!account) {
    console.error(`❌ Account not found: ${values.account}`);
    process.exit(1);
  }

  if (!account.lens_account_address) {
    console.error(`❌ Account ${values.account} does not have a Lens account`);
    process.exit(1);
  }

  console.log(`   Lens Handle: ${account.lens_handle}`);
  console.log(`   Lens Address: ${account.lens_account_address}`);

  if (values['dry-run']) {
    console.log('\n✅ Dry run complete - would delete post');
    return;
  }

  // Setup viem wallet
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const viemAccount = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account: viemAccount,
    chain: chains.testnet,
    transport: http(),
  });

  // Create Lens client
  const lensClient = PublicClient.create({
    environment: staging,
    origin: 'https://karaoke.school',
  });

  // Authenticate
  console.log('\n🔐 Authenticating...');
  const authenticated = await lensClient.login({
    accountOwner: {
      account: evmAddress(account.lens_account_address),
      owner: viemAccount.address,
      app: evmAddress(LENS_APP_ADDRESS),
    },
    signMessage: (message) => viemAccount.signMessage({ message }),
  });

  if (authenticated.isErr()) {
    console.error('❌ Authentication failed:', authenticated.error);
    process.exit(1);
  }

  const sessionClient = authenticated.value;
  console.log('   ✓ Authenticated');

  // Delete the post
  console.log('\n🗑️  Deleting post...');
  const result = await deletePost(sessionClient, {
    post: postId(values['post-id']),
  }).andThen(handleOperationWith(walletClient));

  if (result.isErr()) {
    console.error('❌ Delete failed:', result.error);
    process.exit(1);
  }

  console.log('\n✅ Post deleted successfully');
  console.log(`   Transaction: ${result.value}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
