#!/usr/bin/env bun
/**
 * Creator Module 06: Mint Story Protocol Derivative
 *
 * Mints creator video as derivative IP Asset on Story Protocol.
 * Implements 18% creator / 82% rights holders revenue split.
 *
 * Network: Story Protocol Aeneid Testnet (chainId: 1315)
 * Explorer: https://aeneid.explorer.story.foundation
 *
 * Handles BOTH copyrighted and copyright-free content:
 * - Copyrighted: Derivative work with 18/82 split
 * - Copyright-free: Original work (100% creator)
 *
 * Usage:
 *   bun run creators/06-mint-derivative.ts --tiktok-handle @brookemonk_ --video-hash abc123def456
 */

import { parseArgs } from 'util';
import { type Address, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { StoryClient, StoryConfig, PILFlavor } from '@story-protocol/core-sdk';
import { requireEnv, paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { GroveService } from '../../services/grove.js';
import { buildSongMetadata, hashMetadata } from '../../services/story-metadata.js';
import { CreatorVideoManifestSchema } from '../../lib/schemas/creator.js';

interface VideoManifest {
  videoHash: string;
  creatorHandle: string;
  tiktokVideoId: string;
  tiktokUrl: string;
  description: string;
  song: {
    title: string;
    artist: string;
    copyrightType: 'copyrighted' | 'copyright-free';
    spotifyId?: string;
    geniusId?: number;
  };
  match?: {
    startTime: number;
    endTime: number;
    confidence: number;
  };
  grove: {
    video: string; // lens:// URI
    videoGateway: string; // https://api.grove.storage/... URL
    thumbnail?: string; // lens:// URI
    thumbnailGateway?: string; // https://api.grove.storage/... URL
    vocals?: string;
    vocalsGateway?: string;
    instrumental?: string;
    instrumentalGateway?: string;
  };
  storyMintable: boolean;
  storyProtocol?: {
    ipId: string;
    txHash: string;
    metadataUri: string;
    licenseTermsIds?: string[];
    royaltyVault?: string;
    mintedAt: string;
  };
  createdAt: string;
}

interface CreatorManifest {
  handle: string;
  displayName: string;
  identifiers: {
    tiktokHandle: string;
    lensHandle: string;
    pkpAddress: string;
    lensAccountAddress: string;
  };
  pkp: {
    pkpEthAddress: string;
  };
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'video-hash': { type: 'string' },
      'parent-ip-id': { type: 'string' }, // Optional: parent IP for copyrighted content
    },
  });

  if (!values['tiktok-handle'] || !values['video-hash']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun run creators/06-mint-derivative.ts --tiktok-handle @brookemonk_ --video-hash abc123def456');
    console.log('  bun run creators/06-mint-derivative.ts --tiktok-handle @brookemonk_ --video-hash abc123def456 --parent-ip-id 0x123...\n');
    console.log('Options:');
    console.log('  --tiktok-handle  TikTok username (with or without @)');
    console.log('  --video-hash     Video hash from processing step');
    console.log('  --parent-ip-id   Parent IP Asset ID (for copyrighted content)\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const videoHash = values['video-hash']!;
  const parentIpId = values['parent-ip-id'];

  logger.header(`Mint Story Protocol Derivative: ${videoHash}`);

  try {
    // Load and validate video manifest
    const manifestPath = paths.creatorVideoManifest(tiktokHandle, videoHash);
    const manifestData = readJson<VideoManifest>(manifestPath);

    const validationResult = CreatorVideoManifestSchema.safeParse(manifestData);
    if (!validationResult.success) {
      throw new Error(
        `Invalid video manifest: ${validationResult.error.message}`
      );
    }
    const manifest = validationResult.data;

    logger.info(`Video: ${manifest.song.title}`);
    logger.info(`Copyright: ${manifest.song.copyrightType}`);
    logger.info(`Story mintable: ${manifest.storyMintable}`);

    // Check if already minted
    if (manifest.storyProtocol) {
      logger.warn('Story Protocol IP Asset already minted');
      console.log(`   IP ID: ${manifest.storyProtocol.ipId}`);
      console.log(`   Minted: ${manifest.storyProtocol.mintedAt}\n`);
      console.log('✅ Skipping minting (already complete)');
      console.log(`   Story Explorer: https://explorer.story.foundation/ipa/${manifest.storyProtocol.ipId}\n`);
      return;
    }

    if (!manifest.storyMintable) {
      throw new Error('Video is not Story Protocol mintable');
    }

    // Load creator manifest
    const creatorManifestPath = paths.creatorManifest(tiktokHandle);
    const creatorManifest = readJson<CreatorManifest>(creatorManifestPath);

    // Use Lens account address as recipient
    const recipientAddress = creatorManifest.identifiers.lensAccountAddress as Address;

    // Initialize Story Protocol client
    const privateKey = requireEnv('PRIVATE_KEY');
    const spgNftContract = (process.env.STORY_SPG_NFT_CONTRACT || process.env.SPG_NFT_CONTRACT) as Address | undefined;

    if (!spgNftContract) {
      throw new Error('STORY_SPG_NFT_CONTRACT or SPG_NFT_CONTRACT environment variable not set');
    }

    const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(formattedKey);
    const walletAddress = account.address;

    const config: StoryConfig = {
      account: account,
      transport: http(process.env.STORY_RPC_URL || 'https://aeneid.storyrpc.io'),
      chainId: 1315, // Aeneid testnet
    };

    const client = StoryClient.newClient(config);
    const networkName = config.chainId === 1315 ? 'AENEID TESTNET' : 'MAINNET';
    console.log(`✅ Connected to Story Protocol ${networkName}`);
    console.log(`   Chain ID: ${config.chainId}`);
    console.log(`   RPC: ${process.env.STORY_RPC_URL || 'https://aeneid.storyrpc.io'}`);
    console.log(`   Wallet: ${account.address}\n`);

    const currency = (process.env.STORY_CURRENCY as Address | undefined) || '0x1514000000000000000000000000000000000000';
    const groveService = new GroveService();

    // Build metadata
    console.log('\n📝 Building IP Asset metadata (hashing media files)...');
    const metadata = await buildSongMetadata(
      manifest,
      tiktokHandle,
      walletAddress
    );

    console.log(`   ✓ Image hash: ${metadata.imageHash.slice(0, 20)}...`);
    console.log(`   ✓ Media hash: ${metadata.mediaHash.slice(0, 20)}...`);

    // Upload metadata to Grove Storage
    console.log('\n☁️  Uploading metadata to Grove...');
    const groveResult = await groveService.uploadJson({
      json: metadata,
      accessControl: 'immutable',
    });

    const metadataUri = groveResult.gatewayUrl; // Use HTTP gateway URL for Story Protocol
    const metadataHash = hashMetadata(metadata);

    console.log(`   ✓ Metadata URI: ${metadataUri.slice(0, 60)}...`);
    console.log(`   ✓ Metadata Hash: ${metadataHash.slice(0, 20)}...`);

    // Mint IP Asset on Story Protocol
    const isCopyrighted = manifest.song.copyrightType === 'copyrighted';
    console.log('\n⛓️  Minting IP Asset on Story Protocol...');
    console.log(`   Type: ${isCopyrighted ? 'Derivative (18/82 split)' : 'Original (100% creator)'}`);
    console.log(`   Recipient: ${recipientAddress} (Lens account)`);

    const response = await client.ipAsset.registerIpAsset({
      nft: {
        type: "mint",
        spgNftContract: spgNftContract!,
        recipient: recipientAddress,
      },
      ipMetadata: {
        ipMetadataURI: metadataUri,
        ipMetadataHash: metadataHash,
        nftMetadataURI: metadataUri,
        nftMetadataHash: metadataHash,
      },
      licenseTermsData: [
        {
          terms: PILFlavor.commercialRemix({
            defaultMintingFee: 0,
            commercialRevShare: isCopyrighted ? 18 : 0,
            currency: currency,
            override: {
              uri: 'https://raw.githubusercontent.com/piplabs/pil-document/ad67bb632a310d2557f8abcccd428e4c9c798db1/off-chain-terms/CommercialRemix.json',
            },
          }),
        },
      ],
      deadline: BigInt(Date.now() + 1000 * 60 * 5), // 5 min deadline for signature
    });

    console.log('\n✅ IP Asset minted!');
    console.log(`   IP ID: ${response.ipId}`);
    console.log(`   Transaction: ${response.txHash}`);
    if ('licenseTermsIds' in response && response.licenseTermsIds && response.licenseTermsIds.length > 0) {
      console.log(`   License Terms IDs: ${response.licenseTermsIds.join(', ')}`);
    }

    // Get royalty vault
    let royaltyVault: string | undefined;
    try {
      royaltyVault = await client.royalty.getRoyaltyVaultAddress(response.ipId!);
      console.log(`   Royalty Vault: ${royaltyVault}`);
    } catch (error: any) {
      console.log(`   ⚠️  Could not get royalty vault: ${error.message}`);
    }

    // Update manifest
    manifest.storyProtocol = {
      ipId: response.ipId!,
      txHash: response.txHash!,
      metadataUri: groveResult.uri, // Store lens:// URI
      metadataGatewayUrl: groveResult.gatewayUrl, // Store HTTP gateway URL
      licenseTermsIds: ('licenseTermsIds' in response && response.licenseTermsIds)
        ? response.licenseTermsIds.map(id => id.toString())
        : undefined,
      royaltyVault,
      mintedAt: new Date().toISOString(),
    };

    writeJson(manifestPath, manifest);
    logger.success(`Manifest updated: ${manifestPath}`);

    // Determine explorer URL based on network
    const explorerUrl = config.chainId === 1315
      ? `https://aeneid.explorer.story.foundation/ipa/${response.ipId}`
      : `https://explorer.story.foundation/ipa/${response.ipId}`;

    console.log('\n📊 Summary:');
    console.log(`   Video Hash: ${videoHash}`);
    console.log(`   Creator: ${tiktokHandle}`);
    console.log(`   Song: ${manifest.song.title} by ${manifest.song.artist}`);
    console.log(`   Copyright Type: ${manifest.song.copyrightType}`);
    console.log(`   Revenue Split: ${isCopyrighted ? '18% creator / 82% rights holders' : '100% creator'}`);
    console.log(`   Story Mintable: ${manifest.storyMintable}`);
    console.log(`   IP Asset ID: ${response.ipId}`);
    console.log(`   Network: ${networkName} (chainId: ${config.chainId})`);
    console.log(`\n🔗 View on Story Explorer (${networkName}):`);
    console.log(`   ${explorerUrl}`);

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/07-post-lens.ts --tiktok-handle @${tiktokHandle} --video-hash ${videoHash}\n`);
  } catch (error: any) {
    logger.error(`Failed to mint derivative: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
