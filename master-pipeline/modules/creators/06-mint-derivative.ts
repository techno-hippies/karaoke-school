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
import { privateKeyToAccount } from 'viem/accounts';
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

    // Use Lens account address as recipient (matches working implementation)
    const recipientAddress = creatorManifest.identifiers.lensAccountAddress as Address;

    // Initialize services
    const privateKey = requireEnv('PRIVATE_KEY');
    const spgNftContract = (process.env.STORY_SPG_NFT_CONTRACT || process.env.SPG_NFT_CONTRACT) as Address | undefined;
    const safeWallet = process.env.SAFE_WALLET as Address | undefined;

    if (!spgNftContract) {
      throw new Error('STORY_SPG_NFT_CONTRACT or SPG_NFT_CONTRACT environment variable not set');
    }

    // Get wallet address from private key (for metadata creators array)
    const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    const walletAddress = account.address;

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
      // === REQUIRED FOR STORY EXPLORER ===
      title: isCopyrighted
        ? `${manifest.song.title} - ${manifest.song.artist}`
        : manifest.song.title,
      description: manifest.description || `User-generated performance video by ${creatorName} featuring '${manifest.song.title}' by ${manifest.song.artist}. Original composition and recording rights held by respective owners.`,
      createdAt: manifest.createdAt,
      image: manifest.grove.video, // Thumbnail for display (lens:// URI)
      imageHash: '', // Will be set by hashUrl
      creators: isCopyrighted
        ? [
            {
              name: creatorName,
              address: walletAddress,
              contributionPercent: 18,
              role: 'derivative_performer',
              description: `User-generated performance video creator`,
              socialMedia: [
                { platform: 'TikTok', url: manifest.tiktokUrl },
              ],
            },
            {
              name: manifest.song.artist,
              address: '0x0000000000000000000000000000000000000000' as Address,
              contributionPercent: 82,
              role: 'original_rights_holder',
              description: 'Original artist(s) and rights holder(s); detailed credits in rights_metadata.mlc_data',
              ...(manifest.song.spotifyId || manifest.song.geniusId ? {
                socialMedia: [
                  ...(manifest.song.spotifyId ? [{ platform: 'Spotify', url: `https://open.spotify.com/track/${manifest.song.spotifyId}` }] : []),
                  ...(manifest.song.geniusId ? [{ platform: 'Genius', url: `https://genius.com/songs/${manifest.song.geniusId}` }] : []),
                ]
              } : {}),
            },
          ]
        : [
            {
              name: creatorName,
              address: walletAddress,
              contributionPercent: 100,
              role: 'original_creator',
              description: 'Original content creator',
              socialMedia: [
                { platform: 'TikTok', url: manifest.tiktokUrl },
              ],
            },
          ],

      // === REQUIRED FOR COMMERCIAL INFRINGEMENT CHECK ===
      mediaUrl: manifest.grove.video, // Actual video file (lens:// URI)
      mediaHash: '', // Will be set by hashUrl
      mediaType: 'video/mp4', // MIME type

      // === OPTIONAL STANDARD FIELDS ===
      ipType: 'Music', // Type of IP Asset
      tags: ['karaoke', 'cover', 'music', 'lipsync', manifest.song.copyrightType],

      // === CUSTOM EXTENSIONS (allowed by standard) ===
      original_work: {
        title: manifest.song.title,
        primary_artists: [manifest.song.artist],
        recording_label: 'Unknown',
        isrc: null,
        iswc: null,
        mlc_work_id: null,
        source_url: manifest.song.spotifyId
          ? `https://open.spotify.com/track/${manifest.song.spotifyId}`
          : null,
        genius_url: manifest.song.geniusId
          ? `https://genius.com/songs/${manifest.song.geniusId}`
          : null,
        genius_id: manifest.song.geniusId || null,
        ownership_claim_status: 'unverified', // or 'verified' if you have licenses
      },
      derivative_details: {
        video_url: manifest.tiktokUrl,
        duration_seconds: null, // Could be extracted from video metadata
        start_offset_seconds: 0,
        audio_used: 'varies',
        notes: `User-generated performance video incorporating the song. Specific type (e.g., lip-sync, dance, or vocal cover) and audio elements vary.`,
      },
      royalty_allocation_proposal: [
        { party: 'creator', pct: 18 },
        { party: 'rights_holders', pct: 82 },
      ],
      license_hint: {
        default: 'social_non_commercial',
        human_readable: 'Non-commercial social sharing only; underlying composition and recording remain third-party-owned.',
        terms_url: 'https://karaoke.school/terms/lipsync',
      },
      provenance: {
        created_at: manifest.createdAt,
        uploader: walletAddress,
        tiktok_url: manifest.tiktokUrl,
        tiktok_video_id: manifest.tiktokVideoId,
        copyright_type: manifest.song.copyrightType,
      },
    };

    // Hash image and media URLs
    console.log('🔐 Hashing media URLs...');
    metadata.imageHash = await storyService.hashUrl(metadata.image);
    metadata.mediaHash = await storyService.hashUrl(metadata.mediaUrl);

    console.log(`   ✓ Image hash: ${metadata.imageHash.slice(0, 20)}...`);
    console.log(`   ✓ Media hash: ${metadata.mediaHash.slice(0, 20)}...`);

    // Upload metadata to Grove
    console.log('\n☁️  Uploading metadata to Grove...');
    const groveResult = await groveService.uploadJson({
      json: metadata,
      accessControl: 'immutable',
    });
    const metadataUri = groveResult.gatewayUrl; // Use HTTP gateway URL for Story Protocol
    console.log(`   ✓ Metadata URI: ${metadataUri}`);

    // Mint IP Asset
    console.log('\n⛓️  Minting IP Asset on Story Protocol...');
    console.log(`   Type: ${isCopyrighted ? 'Derivative (18/82 split)' : 'Original (100% creator)'}`);
    console.log(`   Recipient: ${recipientAddress} (Lens account)`);

    const mintResult = await storyService.mintIPAsset({
      metadata,
      metadataUri,
      recipient: recipientAddress, // Mint to creator's Lens account (matches working implementation)
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
      metadataUri: groveResult.uri, // Store lens:// URI
      metadataGatewayUrl: groveResult.gatewayUrl, // Store HTTP gateway URL
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
