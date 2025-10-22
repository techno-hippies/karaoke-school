#!/usr/bin/env bun
/**
 * Unified Account Module: Create Complete Account
 *
 * Creates a unified account (artist or regular user) with:
 * - PKP (Programmable Key Pair) on Lit Protocol
 * - Lens Protocol account with custom handle
 * - Grove metadata using AccountMetadataSchema (Zod validated)
 * - Optional AccountCreated event emission
 *
 * Architecture:
 * - Eliminates artist/user hierarchy (everyone gets same account type)
 * - Optional geniusArtistId field for verified artists
 * - PKP controls Lens account (self-custodial)
 * - Grove stores mutable account metadata with ACL
 * - The Graph indexes AccountCreated events (optional)
 *
 * Permissions:
 * - Account metadata uses walletOnly ACL (admin wallet can update)
 * - Admin can add ISNI, verify accounts, update stats
 * - Account owners request changes via dApp (admin approves)
 *
 * Usage:
 *   # Regular user
 *   bun run accounts/01-create-account.ts --username brookemonk
 *
 *   # Verified artist (with Genius ID, ISNI, and blue check)
 *   bun run accounts/01-create-account.ts --username taylorswift --genius-artist-id 498 --isni 0000000078519858 --verify
 *
 *   # With custom display name and avatar
 *   bun run accounts/01-create-account.ts --username charlidamelio --display-name "Charli D'Amelio" --avatar lens://...
 *
 *   # Emit event to contract (optional)
 *   bun run accounts/01-create-account.ts --username brookemonk --emit-event
 */

import { parseArgs } from 'util';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { createAccountWithUsername, fetchAccount } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { StorageClient, immutable, walletOnly } from '@lens-chain/storage-client';
import { account as createLensAccountMetadata } from '@lens-protocol/metadata';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireEnv, paths } from '../../lib/config.js';
import { writeJson, ensureDir, readJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { AccountMetadataSchema, type AccountMetadata } from '../../lib/schemas/grove/account.js';

// Chronicle Yellowstone chain config
const chronicleChain = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'Chronicle Yellowstone', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com/'] },
    public: { http: ['https://yellowstone-rpc.litprotocol.com/'] },
  },
  blockExplorers: {
    default: {
      name: 'Yellowstone Explorer',
      url: 'https://yellowstone-explorer.litprotocol.com/',
    },
  },
};

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      username: { type: 'string' },
      'genius-artist-id': { type: 'string' }, // Optional: for verified artists
      isni: { type: 'string' }, // Optional: ISNI code for artists (authoritative identifier)
      'display-name': { type: 'string' }, // Optional: overrides username
      avatar: { type: 'string' }, // Optional: avatar URI
      bio: { type: 'string' }, // Optional: custom bio
      verify: { type: 'boolean', default: false }, // Optional: mark as verified (blue check)
      'emit-event': { type: 'boolean', default: false }, // Optional: emit to contract
    },
  });

  if (!values.username) {
    logger.error('Missing required parameter: --username');
    console.log('\nUsage:');
    console.log('  bun run accounts/01-create-account.ts --username brookemonk');
    console.log('  bun run accounts/01-create-account.ts --username taylorswift --genius-artist-id 498 --isni 0000000078519858 --verify');
    console.log('  bun run accounts/01-create-account.ts --username charlidamelio --display-name "Charli D\'Amelio"\n');
    console.log('Options:');
    console.log('  --username           Lens handle (lowercase, alphanumeric + hyphens/underscores)');
    console.log('  --genius-artist-id   Genius artist ID (for verified artists only)');
    console.log('  --isni               ISNI code for artists (16 digits, no spaces, e.g., "0000000078519858")');
    console.log('  --display-name       Custom display name (defaults to username)');
    console.log('  --avatar             Avatar URI on Grove storage (optional)');
    console.log('  --bio                Custom bio (optional)');
    console.log('  --verify             Mark account as verified (blue check badge)');
    console.log('  --emit-event         Emit AccountCreated event to contract (optional)\n');
    process.exit(1);
  }

  // Clean username (remove @ if present, lowercase, replace underscores)
  const username = values.username!.replace('@', '').toLowerCase().replace(/_/g, '');
  const displayName = values['display-name'] || username;
  const geniusArtistId = values['genius-artist-id'] ? parseInt(values['genius-artist-id']) : undefined;

  // Clean and validate ISNI (remove any spaces, validate 16 digits)
  const isni = values.isni ? values.isni.replace(/\s/g, '') : undefined;
  if (isni && !/^\d{16}$/.test(isni)) {
    logger.error('Invalid ISNI format. Must be 16 digits (e.g., "0000000078519858").');
    console.log(`   Received: "${values.isni}"`);
    console.log(`   Cleaned: "${isni}"`);
    process.exit(1);
  }

  const avatarUri = values.avatar;
  const customBio = values.bio;
  const shouldVerify = values.verify;
  const emitEvent = values['emit-event'];

  // Validate username format
  if (!/^[a-z0-9-_]+$/.test(username)) {
    logger.error('Invalid username format. Use lowercase letters, numbers, hyphens, and underscores only.');
    process.exit(1);
  }

  logger.header(`Create Unified Account: @${username}`);
  console.log(`   Username: @${username}`);
  console.log(`   Display Name: ${displayName}`);
  if (geniusArtistId) {
    console.log(`   ⭐ Artist (Genius ID: ${geniusArtistId})`);
  }
  if (isni) {
    console.log(`   🎵 ISNI: ${isni}`);
  }
  if (shouldVerify) {
    console.log(`   ✅ Verified Account (Blue Check)`);
  }
  console.log('');

  try {
    // Check if account already exists
    const accountPath = paths.account(username);
    try {
      const existingAccount = readJson<any>(accountPath);
      logger.warn('Account already exists');
      console.log(`   Lens: @${existingAccount.username}`);
      console.log(`   Address: ${existingAccount.lensAccountAddress}`);
      console.log(`   PKP: ${existingAccount.pkpAddress}`);
      console.log(`   Created: ${existingAccount.createdAt}\n`);
      console.log('✅ Skipping account creation (already exists)');
      console.log(`   Delete ${accountPath} to recreate\n`);
      return;
    } catch {
      // Account doesn't exist, continue
    }

    // ============ STEP 1: Mint PKP ============
    logger.step('1/4', 'Minting PKP on Lit Protocol');

    const litClient = await createLitClient({
      network: nagaDev,
    });
    console.log('✅ Lit client initialized');

    const privateKey = requireEnv('PRIVATE_KEY');
    const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const eoaAccount = privateKeyToAccount(formattedKey);

    const walletClient = createWalletClient({
      account: eoaAccount,
      chain: chronicleChain,
      transport: http('https://yellowstone-rpc.litprotocol.com/'),
    });

    console.log(`🔑 EOA Address: ${walletClient.account.address}`);
    console.log('💰 Note: Make sure you have Chronicle Yellowstone test tokens');
    console.log('   Get from: https://chronicle-yellowstone-faucet.getlit.dev/\n');

    console.log('⏳ Minting PKP...');
    const mintResult = await litClient.mintWithEoa({
      account: walletClient.account,
    });

    const pkpAddress = mintResult.data.ethAddress as Address;
    const pkpPublicKey = mintResult.data.pubkey;
    const pkpTokenId = mintResult.data.tokenId.toString();
    const pkpTxHash = mintResult.txHash as Hex;

    console.log(`✅ PKP minted`);
    console.log(`   Address: ${pkpAddress}`);
    console.log(`   Token ID: ${pkpTokenId}`);
    console.log(`   Tx: ${pkpTxHash}`);
    console.log(`   Explorer: https://yellowstone-explorer.litprotocol.com/tx/${pkpTxHash}\n`);

    // ============ STEP 2: Create Lens Account ============
    logger.step('2/4', 'Creating Lens account');

    const lensClient = PublicClient.create({
      environment: testnet,
      origin: 'http://localhost:3000',
    });

    const lensWalletClient = createWalletClient({
      account: eoaAccount,
      chain: chains.testnet,
      transport: http(),
    });

    const storage = StorageClient.create();

    // App address for Lens app
    const appAddress = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';

    console.log('🔐 Authenticating with Lens...');
    const authenticated = await lensClient.login({
      onboardingUser: {
        app: evmAddress(appAddress),
        wallet: evmAddress(lensWalletClient.account.address),
      },
      signMessage: signMessageWith(lensWalletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    console.log('✅ Authenticated with Lens');
    const sessionClient = authenticated.value;

    // Create Lens metadata using official metadata package
    const attributes = [
      { type: 'String', key: 'pkpAddress', value: pkpAddress },
      { type: 'String', key: 'username', value: username },
      { type: 'String', key: 'platform', value: 'karaoke-school' },
      ...(geniusArtistId ? [{ type: 'Number', key: 'geniusArtistId', value: geniusArtistId.toString() }] : []),
    ];

    const lensMetadata = createLensAccountMetadata({
      name: displayName,
      bio: customBio || `Karaoke School account for @${username} - Powered by Lit Protocol`,
      picture: avatarUri,
      attributes,
    });

    // Upload Lens metadata to Grove (immutable)
    console.log('☁️  Uploading Lens metadata to Grove...');
    const lensMetadataUpload = await storage.uploadAsJson(lensMetadata, {
      name: `${username}-lens-metadata.json`,
      acl: immutable(chains.testnet.id),
    });
    console.log(`✅ Lens metadata uploaded: ${lensMetadataUpload.uri}`);

    // Create account with username
    console.log('\n👤 Creating Lens account...');
    console.log(`   Handle: @${username}`);

    const createResult = await createAccountWithUsername(sessionClient, {
      username: {
        localName: username,
      },
      metadataUri: lensMetadataUpload.uri,
    })
      .andThen(handleOperationWith(lensWalletClient))
      .andThen(sessionClient.waitForTransaction);

    if (createResult.isErr()) {
      throw new Error(`Account creation failed: ${createResult.error.message}`);
    }

    const lensTxHash = createResult.value;
    console.log('✅ Lens account created!');
    console.log(`   Tx: ${lensTxHash}`);

    // Fetch account details
    const accountResult = await fetchAccount(sessionClient, {
      username: { localName: username },
    });

    if (accountResult.isErr() || !accountResult.value) {
      throw new Error('Failed to fetch created account');
    }

    const lensAccount = accountResult.value;
    const lensAccountAddress = lensAccount.address as Address;

    console.log(`   Address: ${lensAccountAddress}\n`);

    // ============ STEP 3: Create Unified Account Metadata (Grove) ============
    logger.step('3/4', 'Creating unified account metadata');

    // Get admin wallet address for ACL and verification
    const adminWallet = requireEnv('BACKEND_WALLET_ADDRESS');

    // Build AccountMetadata using Zod schema
    const accountMetadata: AccountMetadata = {
      version: '1.0.0',
      type: 'account',
      username,
      displayName,
      lensAccountAddress,
      pkpAddress,
      ...(geniusArtistId && { geniusArtistId }),
      ...(isni && { isni }),
      ...(avatarUri && { avatar: avatarUri }),
      ...(customBio && { bio: customBio }),
      ...(shouldVerify && {
        verification: {
          verified: true,
          verifiedBy: adminWallet as Address,
          verifiedAt: new Date().toISOString(),
          verificationMethod: 'manual' as const,
        },
      }),
      stats: {
        // Initialize empty stats
        totalPerformances: 0,
        totalGraded: 0,
        bestScore: 0,
        averageScore: 0,
        totalStudySessions: 0,
        totalMinutesStudied: 0,
        cardsLearned: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        experience: 0,
      },
      achievements: [],
      socialLinks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Validate with Zod
    const validated = AccountMetadataSchema.parse(accountMetadata);

    console.log('☁️  Uploading account metadata to Grove...');
    const metadataUpload = await storage.uploadAsJson(validated, {
      name: `${username}-account.json`,
      acl: walletOnly(adminWallet as Address, chains.testnet.id),
    });
    console.log(`✅ Account metadata uploaded: ${metadataUpload.uri}`);
    console.log(`   ACL: Admin wallet only (${adminWallet})\n`);

    // ============ STEP 4: Optionally Emit Event ============
    if (emitEvent) {
      logger.step('4/4', 'Emitting AccountCreated event');
      console.log('⚠️  Event emission not yet implemented');
      console.log('   Will be added when AccountEvents contract is deployed\n');
      // TODO: Call accountEvents.emitAccountCreated()
    } else {
      logger.step('4/4', 'Skipping event emission');
      console.log('   Use --emit-event to emit to contract\n');
    }

    // ============ Save Account Data ============
    const accountData = {
      username,
      displayName,
      lensAccountAddress,
      lensAccountId: lensAccountAddress,
      pkpAddress,
      pkpPublicKey,
      pkpTokenId,
      ...(geniusArtistId && { geniusArtistId }),
      network: 'lens-testnet',
      createdAt: new Date().toISOString(),
      metadataUri: metadataUpload.uri,
      lensMetadataUri: lensMetadataUpload.uri,
      transactionHashes: {
        pkpMint: pkpTxHash,
        lensCreate: lensTxHash,
      },
    };

    ensureDir(paths.accounts());
    writeJson(accountPath, accountData);

    logger.success('Account created successfully!');
    logger.detail('Username', `@${username}`);
    logger.detail('Lens Address', lensAccountAddress);
    logger.detail('PKP Address', pkpAddress);
    logger.detail('Metadata', metadataUpload.uri);
    if (geniusArtistId) {
      logger.detail('Genius Artist ID', geniusArtistId.toString());
    }

    console.log('\n✅ Account data saved to:', accountPath);
    console.log('\n🎉 Setup complete! Account is ready to use.\n');
    console.log('Next steps:');
    console.log('  • Upload segments for this user to perform');
    console.log('  • Submit performances and grade them');
    console.log('  • View leaderboards and stats on The Graph\n');

    process.exit(0);

  } catch (error: any) {
    logger.error(`Failed to create account: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
