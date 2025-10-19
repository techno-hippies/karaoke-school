#!/usr/bin/env bun
/**
 * Step 2: Create Lens Account for TikTok Creator
 *
 * Creates a Lens account on testnet using the PKP owner's wallet.
 * Later, the PKP will be added as an account manager.
 *
 * Prerequisites:
 * - PKP data in data/pkps/{handle}.json (from step 1)
 * - PRIVATE_KEY in blockchain/.env (will own the Lens account initially)
 *
 * Usage:
 *   bun run local/2-create-lens-account.ts --creator @charlidamelio
 *
 * Output:
 *   data/lens/charlidamelio.json
 */

import { PublicClient, evmAddress } from '@lens-protocol/client';
import { createAccountWithUsername, fetchAccount } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { StorageClient, immutable } from '@lens-chain/storage-client';
import { account } from '@lens-protocol/metadata';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { existsSync } from 'fs';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

interface PKPData {
  tiktokHandle: string;
  pkpPublicKey: string;
  pkpEthAddress: string;
  pkpTokenId: string;
  ownerEOA: string;
  network: string;
  mintedAt: string;
  transactionHash?: string;
}

interface LensAccountData {
  tiktokHandle: string;
  pkpEthAddress: string;
  lensHandle: string;
  lensAccountAddress: string;
  lensAccountId: string;
  network: string;
  createdAt: string;
  transactionHash?: string;
}

async function createLensAccount(tiktokHandle: string): Promise<LensAccountData> {
  console.log('\n👤 Step 2: Creating Lens Account for TikTok Creator');
  console.log('═══════════════════════════════════════════════════\n');

  // Check if Lens account already exists
  const cleanHandle = tiktokHandle.replace('@', '');
  const lensDataPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);

  if (existsSync(lensDataPath)) {
    const existingData = await readFile(lensDataPath, 'utf-8');
    const lensData: LensAccountData = JSON.parse(existingData);

    // If address is valid (not 'unknown'), skip creation
    if (lensData.lensAccountAddress && lensData.lensAccountAddress !== 'unknown') {
      console.log('✅ Lens account already exists - loading from file');
      console.log(`   Handle: ${lensData.lensHandle}`);
      console.log(`   Account Address: ${lensData.lensAccountAddress}`);
      console.log('   Skipping account creation\n');
      console.log('✨ Done!\n');
      return lensData;
    } else {
      console.log('⚠️  Existing file found but address is unknown - will re-create account\n');
    }
  }

  // 1. Load PKP data
  const pkpPath = path.join(process.cwd(), 'data', 'pkps', `${cleanHandle}.json`);

  console.log(`📂 Loading PKP data from: ${pkpPath}`);
  const pkpDataRaw = await readFile(pkpPath, 'utf-8');
  const pkpData: PKPData = JSON.parse(pkpDataRaw);

  console.log(`✅ Loaded PKP for ${pkpData.tiktokHandle}`);
  console.log(`   PKP Address: ${pkpData.pkpEthAddress}\n`);

  // 1.5. Load TikTok profile data from manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading TikTok profile from manifest: ${manifestPath}`);

  let profileData = null;
  let desiredLensHandle = null;
  try {
    const manifestRaw = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestRaw);
    profileData = manifest.profile;
    desiredLensHandle = manifest.lensHandle?.replace('@', '');
    console.log(`✅ Profile: ${profileData.nickname}`);
    console.log(`   Avatar URI: ${profileData.groveUris?.avatar || 'none'}`);
    console.log(`   Bio: ${profileData.bio?.slice(0, 50) || 'none'}...`);
    console.log(`   Desired Lens Handle: @${desiredLensHandle}\n`);
  } catch (e) {
    console.log(`⚠️  Could not load manifest, will use placeholder data\n`);
  }

  // 2. Setup owner account (for PKP authorization)
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY not found in blockchain/.env');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const ownerAccount = privateKeyToAccount(formattedKey);

  console.log(`🔑 PKP Owner: ${ownerAccount.address}\n`);

  // 3. Create Lens client
  console.log('🔗 Creating Lens Protocol client (testnet)...');
  const lensClient = PublicClient.create({
    environment: testnet,
    origin: 'http://localhost:3000', // Required for non-browser environments
  });
  console.log('✅ Connected to Lens Protocol\n');

  // 5. Setup for onboarding user login
  // App address for the Lens app
  const appAddress = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

  console.log('⚠️  Note: Creating account with owner wallet');
  console.log('   Owner Address: ' + ownerAccount.address);
  console.log('   App Address: ' + appAddress);
  console.log('   PKP Address: ' + pkpData.pkpEthAddress);
  console.log('   Future: Will add PKP as account manager\n');

  // Create wallet client for signing
  const walletClient = createWalletClient({
    account: ownerAccount,
    chain: chains.testnet,
    transport: http(),
  });

  // 6. Login to Lens as onboarding user (using owner account)
  console.log('🔐 Authenticating with Lens Protocol (onboarding user)...');
  const authenticated = await lensClient.login({
    onboardingUser: {
      app: evmAddress(appAddress),
      wallet: evmAddress(ownerAccount.address),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    throw new Error(`Lens login failed: ${authenticated.error.message}`);
  }

  console.log('✅ Authenticated with Lens\n');
  const sessionClient = authenticated.value;

  // 7. Create account metadata
  const lensHandle = (desiredLensHandle || cleanHandle).toLowerCase().replace(/[^a-z0-9]/g, '');

  console.log('📝 Creating account metadata...');

  // Build attributes array
  const attributes: any[] = [
    {
      type: 'String',
      key: 'tiktok_handle',
      value: tiktokHandle,
    },
    {
      type: 'String',
      key: 'pkp_address',
      value: pkpData.pkpEthAddress,
    },
  ];

  // Add Genius artist ID if available (for artists who make music)
  if (profileData?.geniusArtistId) {
    attributes.push({
      type: 'Number',
      key: 'genius_artist_id',
      value: String(profileData.geniusArtistId),
    });
    console.log(`🎵 Artist detected - Genius ID: ${profileData.geniusArtistId}`);
  }

  // Add bio translations if available
  if (profileData?.bioTranslations) {
    for (const [lang, translation] of Object.entries(profileData.bioTranslations)) {
      attributes.push({
        type: 'String',
        key: `bio_${lang}`,
        value: translation,
      });
    }
  }

  const metadata = account({
    name: profileData?.nickname || `${cleanHandle} (TikTok)`,
    bio: profileData?.bio || `TikTok creator ${tiktokHandle} on Lens. PKP-controlled account.`,
    picture: profileData?.groveUris?.avatar || undefined,
    attributes,
  });

  // 8. Upload metadata to Grove storage
  console.log('☁️  Uploading metadata to Grove storage...');
  const storageClient = StorageClient.create();

  const uploadResult = await storageClient.uploadAsJson(metadata, {
    name: `${cleanHandle}-account-metadata.json`,
    acl: immutable(chains.testnet.id),
  });

  console.log(`✅ Metadata uploaded: ${uploadResult.uri}\n`);

  // 9. Create account with username and metadata
  console.log('👤 Creating Lens account...');
  console.log(`   Lens Handle: @${lensHandle}`);
  console.log(`   Linked to TikTok: ${tiktokHandle}\n`);

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
  console.log(`   Tx Hash: ${txHash}`);
  console.log(`   Waiting for indexer to pick up the account...\n`);

  // 10. Fetch account after creation (with retries for indexing)
  let accountResult;
  let retries = 0;
  const maxRetries = 30;  // 5 minutes max
  const retryDelay = 10000;  // 10 seconds

  console.log(`   ⚠️  Lens testnet indexer can be slow - this may take a few minutes...`);

  while (retries < maxRetries) {
    accountResult = await fetchAccount(lensClient, {
      username: {
        localName: lensHandle,
      },
    });

    if (accountResult.isOk() && accountResult.value) {
      break;
    }

    retries++;
    if (retries < maxRetries) {
      const remainingTime = Math.ceil(((maxRetries - retries) * retryDelay) / 1000);
      console.log(`   ⏳ Account not indexed yet, retrying in ${retryDelay / 1000}s (attempt ${retries}/${maxRetries}, ~${remainingTime}s remaining)...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  if (accountResult.isErr() || !accountResult.value) {
    console.error(`\n   ❌ Could not find account after ${maxRetries * retryDelay / 1000} seconds`);
    console.error(`   📋 Tried to fetch: ${lensHandle}`);
    console.error(`   💡 Possible causes:`);
    console.error(`      - Lens testnet indexer is slow/down`);
    console.error(`      - Account creation failed (check tx: ${txHash})`);
    console.error(`      - Username already taken or invalid`);
    throw new Error(`Could not find Lens account after ${maxRetries} attempts: @${lensHandle}. Account may need more time to index or testnet may be down.`);
  }

  const lensAccountAddress = accountResult.value.address;
  // Note: Account ID is not directly available, use username ID as fallback
  const lensAccountId = (accountResult.value as any).username?.id || 'N/A';
  console.log(`   ✅ Found account: ${lensAccountAddress}\n`);

  // 11. Save Lens account data with real address/ID
  const lensAccountData: LensAccountData = {
    tiktokHandle,
    pkpEthAddress: pkpData.pkpEthAddress,
    lensHandle: `@${lensHandle}`,
    lensAccountAddress,  // Now populated with real address
    lensAccountId,  // Now populated with real ID
    network: 'lens-testnet',
    createdAt: new Date().toISOString(),
    transactionHash: txHash,
  };

  const outputPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(lensAccountData, null, 2));

  console.log('💾 Saved to:', outputPath);
  console.log('');
  console.log('⚠️  Next Steps:');
  console.log('   1. Transfer account control to PKP (add PKP as account manager)');
  console.log('   2. Upload creator metadata to Grove storage');
  console.log('   3. Register PKP → TikTok mapping on-chain');
  console.log('');

  return lensAccountData;
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run local/2-create-lens-account.ts --creator @charlidamelio\n');
      process.exit(1);
    }

    await createLensAccount(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
