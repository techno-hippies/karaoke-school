#!/usr/bin/env bun
/**
 * Creator Module 06: Mint Story Protocol Derivative
 *
 * Mints creator video as derivative IP Asset on Story Protocol
 * Implements 18% creator / 82% rights holders revenue split
 *
 * Handles BOTH copyrighted and copyright-free content:
 * - Copyrighted: Derivative work with 18/82 split
 * - Copyright-free: Original work (100% creator)
 *
 * Usage:
 *   bun run creators/06-mint-derivative.ts --tiktok-handle @brookemonk_ --video-hash abc123def456
 */

import { parseArgs } from 'util';
import { type Address } from 'viem';
import { requireEnv, paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';
import { StoryProtocolService, type IPAssetMetadata } from '../../services/story-protocol.js';
import { GroveService } from '../../services/grove.js';

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
    video: string;
    vocals?: string;
    instrumental?: string;
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
    // Load video manifest
    const manifestPath = paths.creatorVideoManifest(tiktokHandle, videoHash);
    const manifest = readJson<VideoManifest>(manifestPath);

    logger.info(`Video: ${manifest.song.title}`);
    logger.info(`Copyright: ${manifest.song.copyrightType}`);
    logger.info(`Story mintable: ${manifest.storyMintable}`);

    if (!manifest.storyMintable) {
      throw new Error('Video is not Story Protocol mintable');
    }

    // Load creator manifest
    const creatorManifestPath = paths.creatorManifest(tiktokHandle);
    const creatorManifest = readJson<CreatorManifest>(creatorManifestPath);

    // Initialize services
    const privateKey = requireEnv('PRIVATE_KEY');
    const spgNftContract = process.env.SPG_NFT_CONTRACT as Address | undefined;
    const safeWallet = process.env.SAFE_WALLET as Address | undefined;

    if (!spgNftContract) {
      throw new Error('SPG_NFT_CONTRACT environment variable not set');
    }

    const storyService = new StoryProtocolService({
      privateKey,
      spgNftContract,
      safeWallet,
    });

    const groveService = new GroveService();

    // Build metadata
    console.log('\n📝 Building IP Asset metadata...');

    const isCopyrighted = manifest.song.copyrightType === 'copyrighted';
    const creatorName = creatorManifest.displayName || manifest.creatorHandle;

    const metadata: IPAssetMetadata = {
      title: isCopyrighted
        ? `${creatorName} performs ${manifest.song.title}`
        : manifest.song.title,
      description: manifest.description || `Karaoke performance by ${creatorName}`,
      createdAt: manifest.createdAt,
      image: manifest.grove.video, // Use video thumbnail
      imageHash: '', // Will be set by hashUrl
      creators: isCopyrighted
        ? [
            {
              name: creatorName,
              address: creatorManifest.pkp.pkpEthAddress as Address,
              contributionPercent: 18,
              role: 'derivative_performer',
              description: `TikTok creator performing ${manifest.song.title}`,
            },
            {
              name: manifest.song.artist,
              address: '0x0000000000000000000000000000000000000000' as Address,
              contributionPercent: 82,
              role: 'original_rights_holder',
              description: 'Original song rights holders',
            },
          ]
        : [
            {
              name: creatorName,
              address: creatorManifest.pkp.pkpEthAddress as Address,
              contributionPercent: 100,
              role: 'original_creator',
              description: 'Original content creator',
            },
          ],
      mediaUrl: manifest.grove.video,
      mediaHash: '', // Will be set by hashUrl
      mediaType: 'video/mp4',
      ipType: isCopyrighted ? 'derivative' : 'original',
      tags: [
        'karaoke',
        'tiktok',
        manifest.song.copyrightType,
        ...(isCopyrighted ? ['cover', 'performance'] : ['original-sound']),
      ],
      // Additional metadata
      tiktokHandle: manifest.creatorHandle,
      tiktokVideoId: manifest.tiktokVideoId,
      tiktokUrl: manifest.tiktokUrl,
      song: manifest.song,
      match: manifest.match,
      vocals: manifest.grove.vocals,
      instrumental: manifest.grove.instrumental,
    };

    // Hash image and media URLs
    console.log('🔐 Hashing media URLs...');
    metadata.imageHash = await storyService.hashUrl(metadata.image);
    metadata.mediaHash = await storyService.hashUrl(metadata.mediaUrl);

    console.log(`   ✓ Image hash: ${metadata.imageHash.slice(0, 20)}...`);
    console.log(`   ✓ Media hash: ${metadata.mediaHash.slice(0, 20)}...`);

    // Upload metadata to Grove
    console.log('\n☁️  Uploading metadata to Grove...');
    const metadataUri = await groveService.uploadJson({
      json: metadata,
      accessControl: 'immutable',
    });
    console.log(`   ✓ Metadata URI: ${metadataUri}`);

    // Mint IP Asset
    console.log('\n⛓️  Minting IP Asset on Story Protocol...');
    console.log(`   Type: ${isCopyrighted ? 'Derivative (18/82 split)' : 'Original (100% creator)'}`);
    console.log(`   Recipient: ${creatorManifest.pkp.pkpEthAddress}`);

    const mintResult = await storyService.mintIPAsset({
      metadata,
      metadataUri,
      recipient: creatorManifest.pkp.pkpEthAddress as Address,
      commercialRevShare: isCopyrighted ? 18 : 0, // 18% for derivatives, 0% for originals
      mintingFee: 0,
    });

    console.log('\n✅ IP Asset minted!');
    console.log(`   IP ID: ${mintResult.ipId}`);
    console.log(`   Transaction: ${mintResult.txHash}`);
    if (mintResult.royaltyVault) {
      console.log(`   Royalty Vault: ${mintResult.royaltyVault}`);
    }
    if (mintResult.licenseTermsIds) {
      console.log(`   License Terms: ${mintResult.licenseTermsIds.join(', ')}`);
    }

    // Update manifest
    manifest.storyProtocol = {
      ipId: mintResult.ipId,
      txHash: mintResult.txHash,
      metadataUri: mintResult.metadataUri,
      licenseTermsIds: mintResult.licenseTermsIds,
      royaltyVault: mintResult.royaltyVault,
      mintedAt: new Date().toISOString(),
    };

    writeJson(manifestPath, manifest);
    logger.success(`Manifest updated: ${manifestPath}`);

    console.log('\n📊 Summary:');
    console.log(`   Video Hash: ${videoHash}`);
    console.log(`   Creator: ${creatorName}`);
    console.log(`   Song: ${manifest.song.title} by ${manifest.song.artist}`);
    console.log(`   Copyright: ${manifest.song.copyrightType}`);
    console.log(`   Revenue Split: ${isCopyrighted ? '18% creator / 82% rights holders' : '100% creator'}`);
    console.log(`   IP Asset ID: ${mintResult.ipId}`);
    console.log(`   Story Explorer: https://explorer.story.foundation/ipa/${mintResult.ipId}`);

    console.log('\n✅ Next step:');
    console.log(`   bun run creators/07-post-lens.ts --tiktok-handle @${tiktokHandle} --video-hash ${videoHash}\n`);
  } catch (error: any) {
    logger.error(`Failed to mint derivative: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
