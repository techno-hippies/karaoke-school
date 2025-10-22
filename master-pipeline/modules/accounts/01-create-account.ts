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
 *   # Regular user (kschool1/username)
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
 *
 * Note: All accounts are created in the kschool1/* custom namespace
 */

import { parseArgs } from 'util';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { GraphQLClient, gql } from 'graphql-request';
import { chains } from '@lens-chain/sdk/viem';
import { StorageClient, immutable, walletOnly } from '@lens-chain/storage-client';
import { account as createLensAccountMetadata } from '@lens-protocol/metadata';
import { createWalletClient, createPublicClient, http, type Address, type Hex } from 'viem';
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
    console.log('  --username           Username in kschool1/* namespace (lowercase, alphanumeric + hyphens/underscores)');
    console.log('  --genius-artist-id   Genius artist ID (for verified artists only)');
    console.log('  --isni               ISNI code for artists (16 digits, no spaces, e.g., "0000000078519858")');
    console.log('  --display-name       Custom display name (defaults to username)');
    console.log('  --avatar             Avatar URI on Grove storage (optional)');
    console.log('  --bio                Custom bio (optional)');
    console.log('  --verify             Mark account as verified (blue check badge)');
    console.log('  --emit-event         Emit AccountCreated event to contract (optional)');
    console.log('\nNote: All accounts are created in kschool1/* custom namespace\n');
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

    // ============ STEP 2: Create Lens Account (GraphQL) ============
    logger.step('2/4', 'Creating Lens account');

    const lensWalletClient = createWalletClient({
      account: eoaAccount,
      chain: chains.testnet,
      transport: http(),
    });

    const lensPublicClient = createPublicClient({
      chain: chains.testnet,
      transport: http(),
    });

    const storage = StorageClient.create();

    // Karaoke School app address and custom namespace
    const appAddress = requireEnv('LENS_APP_ADDRESS');
    const customNamespace = requireEnv('LENS_CUSTOM_NAMESPACE');
    const LENS_API = 'https://api.testnet.lens.xyz/graphql';

    // Initialize GraphQL client
    const gqlClient = new GraphQLClient(LENS_API, {
      headers: {
        'Origin': 'https://karaoke.school',
      },
    });

    console.log('🔐 Authenticating with Lens (GraphQL)...');

    // Step 2.1: Get authentication challenge
    const challengeQuery = gql`
      mutation Challenge($request: ChallengeRequest!) {
        challenge(request: $request) {
          id
          text
        }
      }
    `;

    const challengeResponse: any = await gqlClient.request(challengeQuery, {
      request: {
        onboardingUser: {
          app: appAddress,
          wallet: lensWalletClient.account.address,
        },
      },
    });

    const { id: challengeId, text: challengeText } = challengeResponse.challenge;

    // Step 2.2: Sign challenge
    const signature = await lensWalletClient.signMessage({
      message: challengeText,
    });

    // Step 2.3: Authenticate with signature
    const authMutation = gql`
      mutation Authenticate($request: SignedAuthChallenge!) {
        authenticate(request: $request) {
          ... on AuthenticationTokens {
            accessToken
            refreshToken
            idToken
          }
          ... on WrongSignerError {
            reason
          }
          ... on ExpiredChallengeError {
            reason
          }
          ... on ForbiddenError {
            reason
          }
        }
      }
    `;

    const authResponse: any = await gqlClient.request(authMutation, {
      request: {
        id: challengeId,
        signature,
      },
    });

    const authResult = authResponse.authenticate;
    if (!authResult || !authResult.accessToken) {
      console.error('Authentication response:', JSON.stringify(authResponse, null, 2));
      throw new Error(`Authentication failed: ${authResult?.reason || 'No access token'}`);
    }

    const { accessToken } = authResult;
    gqlClient.setHeader('Authorization', `Bearer ${accessToken}`);
    console.log('✅ Authenticated with Lens');

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

    // ============ STEP 2A: Create Account (No Username Yet) ============
    console.log('\n👤 Creating Lens account (step 1/2)...');

    const createAccountMutation = gql`
      mutation CreateAccount($request: CreateAccountRequest!) {
        createAccount(request: $request) {
          ... on CreateAccountResponse {
            hash
          }
          ... on SelfFundedTransactionRequest {
            reason
            raw {
              from
              to
              data
              value
              nonce
              gasLimit
              maxPriorityFeePerGas
              maxFeePerGas
            }
          }
          ... on TransactionWillFail {
            reason
          }
        }
      }
    `;

    const createAccountResponse: any = await gqlClient.request(createAccountMutation, {
      request: {
        metadataUri: lensMetadataUpload.uri,
      },
    });

    const createAccountResult = createAccountResponse.createAccount;

    if (createAccountResult.reason) {
      throw new Error(`Account creation will fail: ${createAccountResult.reason}`);
    }

    let accountTxHash: Hex;

    // Check if it's a self-funded transaction (has 'raw' field)
    if (createAccountResult.raw) {
      console.log('💰 Self-funded transaction required');
      console.log(`   Reason: ${createAccountResult.reason}`);
      const txHash = await lensWalletClient.sendTransaction({
        to: createAccountResult.raw.to,
        data: createAccountResult.raw.data,
        value: BigInt(createAccountResult.raw.value || '0'),
        gas: BigInt(createAccountResult.raw.gasLimit),
        maxPriorityFeePerGas: BigInt(createAccountResult.raw.maxPriorityFeePerGas || '0'),
        maxFeePerGas: BigInt(createAccountResult.raw.maxFeePerGas || '0'),
      });
      accountTxHash = txHash;
      console.log(`   Tx sent: ${txHash}`);
    } else if (createAccountResult.hash) {
      // Sponsored transaction - already has hash
      accountTxHash = createAccountResult.hash;
    } else {
      console.error('Unexpected create account response:', JSON.stringify(createAccountResult, null, 2));
      throw new Error('Unexpected response type for createAccount');
    }

    console.log('⏳ Waiting for transaction confirmation...');

    // Wait for transaction to be mined
    const receipt = await lensPublicClient.waitForTransactionReceipt({ hash: accountTxHash });
    if (receipt.status !== 'success') {
      throw new Error('Account creation transaction failed');
    }

    console.log('✅ Lens account created!');
    console.log(`   Tx: ${accountTxHash}`);

    // Extract account address from transaction receipt logs
    // The AccountCreated event should have the account address
    console.log('📝 Extracting account address from transaction logs...');
    const logs = receipt.logs;

    // Look for the account creation event (topic0 should match AccountCreated event)
    // For now, we'll use a simplified approach - the 'from' address in our transaction
    // or extract from logs. Since this is complex, let's use an alternative approach:
    // Try to fetch the account by transaction hash with a simpler query

    const accountQuery = gql`
      query Account($request: AccountRequest!) {
        account(request: $request) {
          address
        }
      }
    `;

    // Poll for account to be indexed
    console.log('⏳ Waiting for account to be indexed...');
    let lensAccountAddress: Address | null = null;
    for (let i = 0; i < 20; i++) {
      try {
        const accountResponse: any = await gqlClient.request(accountQuery, {
          request: { txHash: accountTxHash },
        });

        if (accountResponse.account && accountResponse.account.address) {
          lensAccountAddress = accountResponse.account.address;
          console.log(`   ✅ Found after ${i + 1} attempts`);
          break;
        }
      } catch (error: any) {
        // Account not yet indexed, continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!lensAccountAddress) {
      throw new Error(`Failed to fetch created account address after 20 retries. Transaction: ${accountTxHash}`);
    }

    console.log(`   Address: ${lensAccountAddress}`);

    // ============ STEP 2B: Switch to Account Owner ============
    console.log('\n🔄 Switching to account owner...');

    // Re-authenticate as the account owner
    const ownerChallengeResponse: any = await gqlClient.request(challengeQuery, {
      request: {
        accountOwner: {
          app: appAddress,
          account: lensAccountAddress,
          owner: lensWalletClient.account.address,
        },
      },
    });

    const { id: ownerChallengeId, text: ownerChallengeText } = ownerChallengeResponse.challenge;

    const ownerSignature = await lensWalletClient.signMessage({
      message: ownerChallengeText,
    });

    const ownerAuthResponse: any = await gqlClient.request(authMutation, {
      request: {
        id: ownerChallengeId,
        signature: ownerSignature,
      },
    });

    const ownerAuthResult = ownerAuthResponse.authenticate;
    if (!ownerAuthResult || !ownerAuthResult.accessToken) {
      console.error('Owner authentication response:', JSON.stringify(ownerAuthResponse, null, 2));
      throw new Error(`Owner authentication failed: ${ownerAuthResult?.reason || 'No access token'}`);
    }

    // Update authorization header with owner's token
    gqlClient.setHeader('Authorization', `Bearer ${ownerAuthResult.accessToken}`);
    console.log('✅ Switched to account owner');

    // ============ STEP 2C: Create Username in Custom Namespace ============
    console.log(`\n📝 Creating username kschool1/${username} (step 2/2)...`);

    const createUsernameMutation = gql`
      mutation CreateUsername($request: CreateUsernameRequest!) {
        createUsername(request: $request) {
          ... on CreateUsernameResponse {
            hash
          }
          ... on SponsoredTransactionRequest {
            reason
            sponsoredReason
            raw {
              from
              to
              data
              value
              nonce
              gasLimit
              maxPriorityFeePerGas
              maxFeePerGas
            }
          }
          ... on SelfFundedTransactionRequest {
            reason
            raw {
              from
              to
              data
              value
              nonce
              gasLimit
              maxPriorityFeePerGas
              maxFeePerGas
            }
          }
          ... on TransactionWillFail {
            reason
          }
        }
      }
    `;

    let createUsernameResponse: any;
    try {
      createUsernameResponse = await gqlClient.request(createUsernameMutation, {
        request: {
          username: {
            localName: username,
            namespace: customNamespace,
          },
        },
      });

      console.log('Full createUsername response:', JSON.stringify(createUsernameResponse, null, 2));
    } catch (error: any) {
      console.error('❌ GraphQL createUsername error:');
      console.error('   Message:', error.message);
      if (error.response) {
        console.error('   Response:', JSON.stringify(error.response, null, 2));
      }
      if (error.request) {
        console.error('   Request:', JSON.stringify(error.request, null, 2));
      }
      throw new Error(`Username creation GraphQL error: ${error.message}`);
    }

    const createUsernameResult = createUsernameResponse.createUsername;

    // Check if the response is actually empty or just doesn't have expected fields
    if (!createUsernameResult) {
      console.error('❌ No createUsername field in response');
      console.error('   Full response keys:', Object.keys(createUsernameResponse));
      throw new Error('Username creation returned no result - check GraphQL query');
    }

    // Check if it's an empty object (might indicate silent failure or schema mismatch)
    const resultKeys = Object.keys(createUsernameResult);
    if (resultKeys.length === 0) {
      console.error('❌ Empty createUsername result (no fields returned)');
      throw new Error('Username creation returned empty response - check GraphQL schema');
    }

    // Note: For SponsoredTransactionRequest and SelfFundedTransactionRequest,
    // the 'reason' field is informational, not an error

    let usernameTxHash: Hex;

    // Check if it's sponsored (gas paid by protocol, but may still need signature)
    if (createUsernameResult.sponsoredReason !== undefined) {
      console.log('✅ Sponsored transaction (gas paid by protocol)');
      console.log(`   Reason: ${createUsernameResult.reason || 'Username creation sponsored'}`);
      console.log(`   Sponsored Reason: ${createUsernameResult.sponsoredReason}`);

      // Check if sponsored transaction has raw data (REQUIRES_SIGNATURE case)
      if (createUsernameResult.raw) {
        console.log('   Requires signature - signing and sending transaction...');

        const txHash = await lensWalletClient.sendTransaction({
          to: createUsernameResult.raw.to,
          data: createUsernameResult.raw.data,
          value: BigInt(createUsernameResult.raw.value || '0'),
          gas: BigInt(createUsernameResult.raw.gasLimit),
          maxPriorityFeePerGas: BigInt(createUsernameResult.raw.maxPriorityFeePerGas || '0'),
          maxFeePerGas: BigInt(createUsernameResult.raw.maxFeePerGas || '0'),
        });
        usernameTxHash = txHash;
        console.log(`   Tx sent: ${txHash}`);

        console.log('⏳ Waiting for username creation confirmation...');
        const usernameReceipt = await lensPublicClient.waitForTransactionReceipt({ hash: usernameTxHash });
        if (usernameReceipt.status !== 'success') {
          throw new Error('Username creation transaction failed');
        }
      } else {
        // Protocol handles everything - just poll for username to appear
        console.log('⏳ Waiting for sponsored transaction to complete...');

        const usernameQuery = gql`
          query Account($request: AccountRequest!) {
            account(request: $request) {
              username {
                value
                namespace {
                  address
                }
              }
            }
          }
        `;

        let usernameAssigned = false;
        for (let i = 0; i < 30; i++) {
          try {
            const accountResponse: any = await gqlClient.request(usernameQuery, {
              request: { address: lensAccountAddress },
            });

            if (accountResponse.account?.username?.value === username) {
              usernameAssigned = true;
              console.log(`   ✅ Username assigned after ${i + 1} attempts`);
              break;
            }
          } catch (error) {
            // Continue polling
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!usernameAssigned) {
          throw new Error('Username creation timed out - check account manually');
        }

        usernameTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
      }
    }
    // Check if it's a self-funded transaction (has 'raw' field)
    else if (createUsernameResult.raw) {
      // Payment required - check the value
      const paymentValue = BigInt(createUsernameResult.raw.value || '0');

      if (paymentValue > 0n) {
        console.log(`💰 Payment required: ${paymentValue.toString()} wei`);
      } else {
        console.log('✅ Free username (6+ characters)');
      }
      console.log(`   Reason: ${createUsernameResult.reason}`);

      const txHash = await lensWalletClient.sendTransaction({
        to: createUsernameResult.raw.to,
        data: createUsernameResult.raw.data,
        value: paymentValue,
        gas: BigInt(createUsernameResult.raw.gasLimit),
        maxPriorityFeePerGas: BigInt(createUsernameResult.raw.maxPriorityFeePerGas || '0'),
        maxFeePerGas: BigInt(createUsernameResult.raw.maxFeePerGas || '0'),
      });
      usernameTxHash = txHash;
      console.log(`   Tx sent: ${txHash}`);

      console.log('⏳ Waiting for username creation confirmation...');
      const usernameReceipt = await lensPublicClient.waitForTransactionReceipt({ hash: usernameTxHash });
      if (usernameReceipt.status !== 'success') {
        throw new Error('Username creation transaction failed');
      }
    } else if (createUsernameResult.hash) {
      // Direct response with hash
      usernameTxHash = createUsernameResult.hash;
      console.log(`   Tx hash: ${usernameTxHash}`);

      console.log('⏳ Waiting for username creation confirmation...');
      const usernameReceipt = await lensPublicClient.waitForTransactionReceipt({ hash: usernameTxHash });
      if (usernameReceipt.status !== 'success') {
        throw new Error('Username creation transaction failed');
      }
    } else {
      console.error('Unexpected create username response:', JSON.stringify(createUsernameResult, null, 2));
      throw new Error('Unexpected response type for createUsername');
    }

    console.log('✅ Username created!');
    console.log(`   Handle: kschool1/${username}`);
    if (usernameTxHash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      console.log(`   Tx: ${usernameTxHash}`);
    }
    console.log('');

    // ============ STEP 3: Create Unified Account Metadata (Grove) ============
    logger.step('3/4', 'Creating unified account metadata');

    // Get admin wallet address for ACL and verification
    const adminWallet = requireEnv('BACKEND_WALLET_ADDRESS');

    // Build AccountMetadata using Zod schema
    const accountMetadata: AccountMetadata = {
      version: '1.0.0',
      type: 'account',
      username,
      lensAccountAddress,
      pkpAddress,
      ...(geniusArtistId && { geniusArtistId }),
      ...(isni && { isni }),
      ...(shouldVerify && {
        verification: {
          verified: true,
          verifiedAt: new Date().toISOString(),
        },
      }),
      displayName,
      ...(customBio && { bio: customBio }),
      ...(avatarUri && { avatarUri }),
      createdContent: [],
      achievements: [],
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
        lensAccountCreate: accountTxHash,
        lensUsernameCreate: usernameTxHash,
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
