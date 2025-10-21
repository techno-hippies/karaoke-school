#!/usr/bin/env bun
/**
 * Creator Module 02: Create Lens Account
 *
 * Creates a Lens Protocol account for a TikTok creator with metadata
 *
 * Usage:
 *   bun run creators/02-create-lens.ts --tiktok-handle @brookemonk_ --lens-handle brookemonk
 *   bun run creators/02-create-lens.ts --tiktok-handle @karaokeking99
 */

import { parseArgs } from 'util';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { createAccountWithUsername, fetchAccount } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { account as accountMetadata } from '@lens-protocol/metadata';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireEnv, paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import type { CreatorPKP, CreatorLens } from '../../lib/schemas/index.js';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'lens-handle': { type: 'string' }, // Optional: custom Lens handle
      avatar: { type: 'string' }, // Optional: avatar URI
    },
  });

  if (!values['tiktok-handle']) {
    logger.error('Missing required parameter: --tiktok-handle');
    console.log('\nUsage:');
    console.log('  bun run creators/02-create-lens.ts --tiktok-handle @brookemonk_ --lens-handle brookemonk');
    console.log('  bun run creators/02-create-lens.ts --tiktok-handle @karaokeking99 --avatar lens://...\n');
    console.log('Options:');
    console.log('  --tiktok-handle  TikTok username (with or without @)');
    console.log('  --lens-handle    Custom Lens handle (defaults to TikTok handle without @ and _)');
    console.log('  --avatar         Avatar URI on Grove storage (optional)\n');
    process.exit(1);
  }

  // Clean handles
  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const lensHandle = values['lens-handle'] || tiktokHandle.replace(/_/g, '');
  const avatarUri = values.avatar;

  logger.header(`Create Lens Account: @${tiktokHandle}`);
  console.log(`   TikTok Handle: @${tiktokHandle}`);
  console.log(`   Lens Handle: @${lensHandle}\n`);

  try {
    // Load PKP data
    const pkpPath = paths.creatorPkp(tiktokHandle);
    const pkpData = readJson<CreatorPKP>(pkpPath);

    logger.info(`Loaded PKP: ${pkpData.pkpEthAddress}`);

    // Initialize Lens clients
    const lensClient = PublicClient.create({
      environment: testnet,
      origin: 'http://localhost:3000',
    });

    const privateKey = requireEnv('PRIVATE_KEY');
    const formattedKey = (
      privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
    ) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);

    const walletClient = createWalletClient({
      account,
      chain: chains.testnet,
      transport: http(),
    });

    const storage = StorageClient.create();

    // App address for Lens app
    const appAddress = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

    console.log('🔐 Authenticating with Lens Protocol...');
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
      { type: 'String', key: 'pkpAddress', value: pkpData.pkpEthAddress },
      { type: 'String', key: 'tiktokHandle', value: `@${tiktokHandle}` },
      { type: 'String', key: 'accountType', value: 'tiktok-creator' },
      { type: 'String', key: 'platform', value: 'karaoke-school' },
    ];

    const metadata = accountMetadata({
      name: `@${tiktokHandle}`,
      bio: `Official Karaoke School account for @${tiktokHandle} - Powered by Lit Protocol PKP`,
      picture: avatarUri,
      attributes,
    });

    // Upload metadata to Grove
    console.log('☁️  Uploading metadata to Grove...');
    const uploadResult = await storage.uploadAsJson(metadata, {
      name: `${lensHandle}-account-metadata.json`,
      acl: immutable(chains.testnet.id),
    });
    console.log(`✅ Metadata uploaded: ${uploadResult.uri}`);

    // Create account with username
    console.log('\n👤 Creating Lens account...');
    console.log(`   Lens Handle: @${lensHandle}`);

    const createResult = await createAccountWithUsername(sessionClient, {
      username: {
        localName: lensHandle,
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
      username: { localName: lensHandle },
    });

    if (accountResult.isErr() || !accountResult.value) {
      throw new Error('Failed to fetch created account');
    }

    const createdAccount = accountResult.value;

    const lensData: CreatorLens = {
      lensHandle,
      lensAccountAddress: createdAccount.address as Address,
      lensAccountId: createdAccount.address as Hex,
      network: 'lens-testnet',
      createdAt: new Date().toISOString(),
      metadataUri: uploadResult.uri,
      transactionHash: txHash as Hex,
    };

    console.log(`   Address: ${lensData.lensAccountAddress}\n`);

    // Save to file
    const lensPath = paths.creatorLens(tiktokHandle);
    writeJson(lensPath, lensData);

    logger.success(`Lens data saved to: ${lensPath}`);
    logger.detail('Lens Handle', `@${lensData.lensHandle}`);
    logger.detail('Account Address', lensData.lensAccountAddress);

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/03-scrape-videos.ts --tiktok-handle @${tiktokHandle}\n`);
  } catch (error: any) {
    logger.error(`Failed to create Lens account: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
