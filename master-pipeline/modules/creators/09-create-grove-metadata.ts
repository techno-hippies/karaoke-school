/**
 * Create Grove Account Metadata for Existing Creators
 *
 * This script creates proper Grove metadata (AccountMetadataSchema) for creators
 * who were onboarded before the Grove metadata system was implemented.
 *
 * Usage:
 *   bun modules/creators/09-create-grove-metadata.ts --tiktok-handle @brookemonk_
 */

import { parseArgs } from 'util';
import { StorageClient, immutable } from '@lens-protocol/client';
import { chains } from '@lens-protocol/client';
import { createInitialAccountMetadata } from '../../lib/schemas/grove/account.js';
import { paths } from '../../lib/paths.js';
import { readJson, writeJson } from '../../lib/files.js';
import { logger } from '../../lib/logger.js';
import { PublicClient, testnet } from '@lens-protocol/client';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { requireEnv } from '../../lib/env.js';

interface CreatorManifest {
  handle: string;
  displayName: string;
  identifiers: {
    tiktokHandle: string;
    lensHandle: string;
    pkpAddress: string;
    lensAccountAddress: string;
  };
  profile?: {
    avatar?: string;
    bio?: string;
  };
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
    },
  });

  const tiktokHandle = values['tiktok-handle']?.replace('@', '');
  if (!tiktokHandle) {
    console.error('Error: --tiktok-handle is required');
    process.exit(1);
  }

  logger.header(`Create Grove Metadata: @${tiktokHandle}`);

  try {
    // Load creator manifest
    const manifestPath = paths.creatorManifest(tiktokHandle);
    const manifest = readJson<CreatorManifest>(manifestPath);

    const { lensHandle, lensAccountAddress, pkpAddress } = manifest.identifiers;
    const displayName = manifest.displayName || `@${tiktokHandle}`;
    const bio = manifest.profile?.bio || '';
    const avatarUrl = manifest.profile?.avatar;

    logger.info(`Display Name: ${displayName}`);
    logger.info(`Lens Handle: ${lensHandle}`);
    logger.info(`Lens Account: ${lensAccountAddress}`);
    logger.info(`PKP Address: ${pkpAddress}`);

    // Create Grove metadata
    const groveMetadata = createInitialAccountMetadata({
      username: lensHandle,
      lensAccountAddress,
      pkpAddress,
      displayName,
      bio,
    });

    // Add avatar if available
    if (avatarUrl) {
      groveMetadata.avatarUri = avatarUrl;
    }

    // Add social links
    groveMetadata.links = {
      tiktok: `https://www.tiktok.com/@${tiktokHandle}`,
    };

    logger.info(`Grove Metadata Created:`);
    console.log(JSON.stringify(groveMetadata, null, 2));

    // Upload to Grove Storage
    console.log('\n☁️  Uploading to Grove Storage...');
    const storage = StorageClient.create();

    const uploadResult = await storage.uploadAsJson(groveMetadata, {
      name: `${lensHandle}-grove-metadata.json`,
      acl: immutable(chains.testnet.id),
    });

    console.log(`✅ Grove metadata uploaded: ${uploadResult.uri}`);

    // Now we need to update the Lens account metadata to include the groveMetadataUri attribute
    console.log('\n📝 Updating Lens account metadata...');

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

    // Authenticate
    const { signMessage } = await import('@lens-protocol/client/viem');
    const authenticated = await lensClient.login({
      onboardingUser: {
        app: '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0' as `0x${string}`,
        wallet: walletClient.account.address,
      },
      signMessage: signMessage(walletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    const sessionClient = authenticated.value;

    // Get current account metadata
    const accountQuery = await sessionClient.account({ address: lensAccountAddress as `0x${string}` });
    if (!accountQuery.isOk()) {
      throw new Error(`Failed to fetch account: ${accountQuery.error.message}`);
    }

    const currentAccount = accountQuery.value;
    const currentMetadata = currentAccount.metadata as any;

    // Create updated metadata with groveMetadataUri attribute
    const { accountMetadata } = await import('@lens-protocol/metadata');
    const updatedMetadata = accountMetadata({
      name: displayName, // Fix the name while we're at it
      bio: currentMetadata.bio || bio,
      picture: currentMetadata.picture,
      attributes: [
        ...(currentMetadata.attributes || []),
        { type: 'String' as const, key: 'groveMetadataUri', value: uploadResult.uri },
      ],
    });

    // Upload updated metadata
    console.log('☁️  Uploading updated Lens metadata...');
    const metadataUpload = await storage.uploadAsJson(updatedMetadata, {
      name: `${lensHandle}-account-metadata-updated.json`,
      acl: immutable(chains.testnet.id),
    });

    console.log(`✅ Updated metadata uploaded: ${metadataUpload.uri}`);

    // Update account on-chain
    console.log('\n🔄 Updating account on-chain...');
    const updateResult = await sessionClient.setAccountMetadata({
      metadataUri: metadataUpload.uri,
    });

    if (updateResult.isErr()) {
      throw new Error(`Failed to update account: ${updateResult.error.message}`);
    }

    console.log('⏳ Waiting for transaction...');
    const txResult = await updateResult.value.waitForCompletion();

    if (txResult.isErr()) {
      throw new Error(`Transaction failed: ${txResult.error.message}`);
    }

    console.log('✅ Account updated successfully!');
    console.log(`   Transaction: ${txResult.value.txHash}`);

    // Update local manifest
    const lensPath = paths.creatorLens(tiktokHandle);
    const lensData = readJson<any>(lensPath);
    lensData.groveMetadataUri = uploadResult.uri;
    lensData.lensMetadataUri = metadataUpload.uri;
    writeJson(lensPath, lensData);

    console.log('\n✅ Grove metadata created and linked successfully!');
    console.log(`   Grove URI: ${uploadResult.uri}`);
    console.log(`   Lens Metadata URI: ${metadataUpload.uri}`);

  } catch (error) {
    logger.error('Failed to create Grove metadata:', error);
    process.exit(1);
  }
}

main();
