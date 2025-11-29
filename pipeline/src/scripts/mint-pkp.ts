#!/usr/bin/env bun
/**
 * Mint PKP Script
 *
 * Mints a PKP (Programmable Key Pair) via Lit Protocol and updates the account.
 *
 * Usage:
 *   bun src/scripts/mint-pkp.ts --handle=scarlett
 *   bun src/scripts/mint-pkp.ts --handle=scarlett --network=naga-test
 */

import { parseArgs } from 'util';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev, nagaTest } from '@lit-protocol/networks';
import { createWalletClient, http, type Account } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { getAccountByHandle, updateAccountPkp } from '../db/queries';
import { validateEnv, PRIVATE_KEY, LIT_NETWORK } from '../config';

// Chronicle Yellowstone chain (for PKP minting gas)
const chronicleYellowstone = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
};

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    handle: { type: 'string' },
    network: { type: 'string', default: LIT_NETWORK || 'naga-dev' },
  },
  strict: true,
});

async function main() {
  // Validate required env
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  if (!values.handle) {
    console.error('❌ Missing required argument: --handle');
    console.log('\nUsage:');
    console.log('  bun src/scripts/mint-pkp.ts --handle=scarlett');
    process.exit(1);
  }

  const handle = values.handle;
  const networkName = values.network || 'naga-dev';

  console.log('\n🔐 Mint PKP Script');
  console.log('==================');
  console.log(`   Handle: ${handle}`);
  console.log(`   Network: ${networkName}`);

  // Check if account exists
  const account = await getAccountByHandle(handle);
  if (!account) {
    console.error(`\n❌ Account not found: ${handle}`);
    console.log('   Create it first: bun src/scripts/create-account.ts --handle=' + handle + ' --name="..."');
    process.exit(1);
  }

  if (account.pkp_address) {
    console.log('\n⚠️  Account already has a PKP:');
    console.log(`   PKP Address: ${account.pkp_address}`);
    console.log(`   PKP Network: ${account.pkp_network}`);
    process.exit(0);
  }

  // Get network config
  const networkMap: Record<string, any> = {
    'naga-dev': nagaDev,
    'naga-test': nagaTest,
  };

  const network = networkMap[networkName];
  if (!network) {
    console.error(`\n❌ Invalid network: ${networkName}`);
    console.log('   Valid options: naga-dev, naga-test');
    process.exit(1);
  }

  // Create wallet from private key
  let privateKey = PRIVATE_KEY;
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  const walletAccount = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`\n📝 Using wallet: ${walletAccount.address}`);

  const walletClient = createWalletClient({
    account: walletAccount,
    chain: chronicleYellowstone as any,
    transport: http(),
  });

  // Connect to Lit Protocol
  console.log('\n🔌 Connecting to Lit Protocol...');
  const litClient = await createLitClient({ network });
  console.log('   ✓ Connected');

  // Mint PKP
  console.log('\n🪙 Minting PKP...');
  console.log('   This may take a minute...');

  const mintedPkp = await litClient.mintWithEoa({
    account: walletClient.account as Account,
  });

  if (!mintedPkp.data) {
    console.error('❌ Failed to mint PKP');
    process.exit(1);
  }

  console.log('   ✓ PKP Minted!');
  console.log(`   Token ID: ${mintedPkp.data.tokenId}`);
  console.log(`   Public Key: ${mintedPkp.data.pubkey}`);
  console.log(`   ETH Address: ${mintedPkp.data.ethAddress}`);

  // Update database
  console.log('\n💾 Updating database...');
  const updated = await updateAccountPkp(handle, {
    pkp_address: mintedPkp.data.ethAddress,
    pkp_token_id: mintedPkp.data.tokenId.toString(),
    pkp_public_key: mintedPkp.data.pubkey,
    pkp_network: networkName,
  });

  if (!updated) {
    console.error('❌ Failed to update database');
    process.exit(1);
  }

  console.log('   ✓ Database updated');

  // Disconnect
  await litClient.disconnect();

  console.log('\n✅ PKP minted successfully!');
  console.log(`   PKP Address: ${mintedPkp.data.ethAddress}`);

  console.log('\n💡 Next steps:');
  console.log(`   1. Fund PKP with GRASS on Lens testnet:`);
  console.log(`      cast send ${mintedPkp.data.ethAddress} --value 0.01ether \\`);
  console.log('        --rpc-url https://rpc.testnet.lens.xyz \\');
  console.log('        --private-key $PRIVATE_KEY');
  console.log(`   2. Create Lens account:`);
  console.log(`      bun src/scripts/create-lens-account.ts --handle=${handle}`);
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
