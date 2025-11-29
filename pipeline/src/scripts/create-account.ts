#!/usr/bin/env bun
/**
 * Create Account Script
 *
 * Creates a posting account (AI persona like Scarlett) with PKP and Lens.
 *
 * Usage:
 *   bun src/scripts/create-account.ts --handle=scarlett --name="Scarlett" --type=ai
 *   bun src/scripts/create-account.ts --handle=scarlett --name="Scarlett" --type=ai --bio="AI music enthusiast"
 */

import { parseArgs } from 'util';
import { createAccount, getAccountByHandle } from '../db/queries';
import { validateEnv } from '../config';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    handle: { type: 'string' },
    name: { type: 'string' },
    type: { type: 'string', default: 'ai' },
    bio: { type: 'string' },
    avatar: { type: 'string' },
    // PKP info (optional, can be added later)
    'pkp-address': { type: 'string' },
    'pkp-token-id': { type: 'string' },
    'pkp-public-key': { type: 'string' },
    'pkp-network': { type: 'string', default: 'naga-dev' },
    // Lens info (optional, can be added later)
    'lens-handle': { type: 'string' },
    'lens-account-address': { type: 'string' },
    'lens-account-id': { type: 'string' },
    'lens-metadata-uri': { type: 'string' },
    'lens-transaction-hash': { type: 'string' },
  },
  strict: true,
});

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL']);

  // Validate required args
  if (!values.handle) {
    console.error('❌ Missing required argument: --handle');
    console.log('\nUsage:');
    console.log('  bun src/scripts/create-account.ts --handle=scarlett --name="Scarlett" --type=ai');
    process.exit(1);
  }

  if (!values.name) {
    console.error('❌ Missing required argument: --name');
    process.exit(1);
  }

  const accountType = values.type as 'ai' | 'human';
  if (accountType !== 'ai' && accountType !== 'human') {
    console.error('❌ Invalid --type. Must be "ai" or "human"');
    process.exit(1);
  }

  console.log('\n📝 Creating Account');
  console.log(`   Handle: ${values.handle}`);
  console.log(`   Name: ${values.name}`);
  console.log(`   Type: ${accountType}`);

  // Check if account already exists
  const existing = await getAccountByHandle(values.handle);
  if (existing) {
    console.log('\n⚠️  Account already exists:');
    console.log(`   ID: ${existing.id}`);
    console.log(`   Handle: ${existing.handle}`);
    console.log(`   Lens: ${existing.lens_handle || '(not set)'}`);
    console.log(`   PKP: ${existing.pkp_address || '(not set)'}`);
    process.exit(0);
  }

  // Create account
  const account = await createAccount({
    handle: values.handle,
    display_name: values.name,
    account_type: accountType,
    bio: values.bio,
    avatar_grove_url: values.avatar,
    pkp_address: values['pkp-address'],
    pkp_token_id: values['pkp-token-id'],
    pkp_public_key: values['pkp-public-key'],
    pkp_network: values['pkp-network'],
    lens_handle: values['lens-handle'],
    lens_account_address: values['lens-account-address'],
    lens_account_id: values['lens-account-id'],
    lens_metadata_uri: values['lens-metadata-uri'],
    lens_transaction_hash: values['lens-transaction-hash'],
  });

  console.log('\n✅ Account created');
  console.log(`   ID: ${account.id}`);
  console.log(`   Handle: ${account.handle}`);
  console.log(`   Display Name: ${account.display_name}`);
  console.log(`   Type: ${account.account_type}`);

  if (account.pkp_address) {
    console.log(`   PKP Address: ${account.pkp_address}`);
  }

  if (account.lens_handle) {
    console.log(`   Lens Handle: ${account.lens_handle}`);
  }

  console.log('\n💡 Next steps:');
  if (!account.pkp_address) {
    console.log('   • Add PKP: bun src/scripts/mint-pkp.ts --handle=' + account.handle);
  }
  if (!account.lens_handle) {
    console.log('   • Add Lens: bun src/scripts/create-lens-account.ts --handle=' + account.handle);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
