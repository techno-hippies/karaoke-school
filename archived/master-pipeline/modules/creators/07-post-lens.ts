#!/usr/bin/env bun
/**
 * Creator Module 07: Post to Lens
 *
 * Creates Lens post for a processed video
 * Includes video, song metadata, and Story Protocol link
 *
 * Usage:
 *   bun run creators/07-post-lens.ts --tiktok-handle @brookemonk_ --video-hash abc123def456
 */

import { parseArgs } from 'util';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { post as createPost, fetchAccount } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { video, MediaVideoMimeType } from '@lens-protocol/metadata';
import { StorageClient, lensAccountOnly } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { requireEnv, paths } from '../../lib/config.js';
import { readJson, writeJson } from '../../lib/fs.js';
import { logger } from '../../lib/logger.js';

interface VideoManifest {
  videoHash: string;
  creatorHandle: string;
  tiktokVideoId: string;
  tiktokUrl: string;
  description: string;
  descriptionTranslations?: Record<string, string>;
  transcription?: {
    languages: {
      en: any;
      vi?: any;
      zh?: any;
    };
  };
  song: {
    title: string;
    artist: string;
    copyrightType: 'copyrighted' | 'copyright-free';
    spotifyId?: string;
    geniusId?: number;
    coverUri?: string; // Album art URI from song metadata
  };
  match?: {
    startTime: number;
    endTime: number;
    confidence: number;
  };
  grove: {
    video: string;
    thumbnail?: string;
    vocals?: string;
    instrumental?: string;
  };
  storyProtocol?: {
    ipId: string;
    txHash: string;
    metadataUri: string;
  };
  lensPost?: {
    hash: string;
    metadataUri: string;
    postedAt: string;
  };
  createdAt: string;
}

interface CreatorManifest {
  handle: string;
  displayName: string;
  identifiers: {
    tiktokHandle: string;
    lensHandle: string;
    lensAccountAddress: string;
  };
}

// App and Feed addresses
const APP_ADDRESS = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';
const FEED_ADDRESS = '0x5941b291E69069769B8e309746b301928C816fFa';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'tiktok-handle': { type: 'string' },
      'video-hash': { type: 'string' },
    },
  });

  if (!values['tiktok-handle'] || !values['video-hash']) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun run creators/07-post-lens.ts --tiktok-handle @brookemonk_ --video-hash abc123def456\n');
    console.log('Options:');
    console.log('  --tiktok-handle  TikTok username (with or without @)');
    console.log('  --video-hash     Video hash from processing step\n');
    process.exit(1);
  }

  const tiktokHandle = values['tiktok-handle']!.replace('@', '');
  const videoHash = values['video-hash']!;

  logger.header(`Post to Lens: ${videoHash}`);

  try {
    // Load video manifest
    const videoManifestPath = paths.creatorVideoManifest(tiktokHandle, videoHash);
    const manifest = readJson<VideoManifest>(videoManifestPath);

    logger.info(`Video: ${manifest.song.title}`);
    logger.info(`TikTok: ${manifest.tiktokUrl}`);

    if (manifest.lensPost) {
      logger.warn('Video already posted to Lens');
      console.log(`   Post hash: ${manifest.lensPost.hash}`);
      console.log(`   Posted at: ${manifest.lensPost.postedAt}\n`);
      return;
    }

    // Load creator manifest
    const creatorManifestPath = paths.creatorManifest(tiktokHandle);
    const creatorManifest = readJson<CreatorManifest>(creatorManifestPath);

    // Setup Lens clients
    console.log('\n🔗 Setting up Lens client...');

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

    const publicClient = PublicClient.create({
      environment: testnet,
      origin: 'https://karaoke-school.ai',
    });

    const lensAccountAddress = creatorManifest.identifiers.lensAccountAddress;
    console.log(`   Lens Handle: @${creatorManifest.identifiers.lensHandle}`);
    console.log(`   Lens Account: ${lensAccountAddress}`);
    console.log(`   Owner: ${account.address}`);

    // Authenticate with Lens
    console.log('\n🔐 Authenticating with Lens...');
    const authenticated = await publicClient.login({
      accountOwner: {
        account: evmAddress(lensAccountAddress),
        owner: evmAddress(account.address),
        app: evmAddress(APP_ADDRESS),
      },
      signMessage: signMessageWith(walletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Authentication failed: ${authenticated.error.message}`);
    }

    const sessionClient = authenticated.value;
    console.log('✅ Authenticated with Lens');

    // Setup Grove storage
    const storageClient = StorageClient.create();
    const chainId = chains.testnet.id;
    const acl = lensAccountOnly(lensAccountAddress as `0x${string}`, chainId);

    // Build post content
    console.log('\n📝 Building post metadata...');

    let contentText = manifest.description || '';

    // Add song info
    contentText += `\n\n🎵 ${manifest.song.title} by ${manifest.song.artist}`;

    // Add Story Protocol link if minted
    if (manifest.storyProtocol) {
      contentText += `\n\n⛓️ Story Protocol: https://explorer.story.foundation/ipa/${manifest.storyProtocol.ipId}`;
      contentText += `\nIP Asset ID: ${manifest.storyProtocol.ipId}`;
    }

    // Add match info for copyrighted content
    if (manifest.match) {
      contentText += `\n\n⏱️ Matched Segment: ${manifest.match.startTime.toFixed(2)}s - ${manifest.match.endTime.toFixed(2)}s`;
      contentText += `\nConfidence: ${manifest.match.confidence}%`;
    }

    // Add copyright type
    contentText += `\n\n📄 Copyright: ${manifest.song.copyrightType}`;

    // Create video metadata
    const postMetadata = video({
      title: `${creatorManifest.displayName} - ${manifest.song.title}`,
      content: contentText,
      video: {
        item: manifest.grove.video,
        type: MediaVideoMimeType.MP4,
        cover: manifest.grove.thumbnail || manifest.grove.video, // Use thumbnail image if available
        altTag: manifest.description || manifest.song.title,
      },
      tags: [
        'karaoke',
        'tiktok',
        manifest.song.copyrightType,
        ...(manifest.song.copyrightType === 'copyrighted' ? ['cover', 'licensed'] : ['original']),
        ...(manifest.storyProtocol ? ['story-protocol'] : []),
        ...(manifest.song.geniusId ? [`genius-${manifest.song.geniusId}`] : []),
      ],
      attributes: [
        {
          type: 'String',
          key: 'tiktok_video_id',
          value: manifest.tiktokVideoId,
        },
        {
          type: 'String',
          key: 'tiktok_url',
          value: manifest.tiktokUrl,
        },
        {
          type: 'String',
          key: 'video_hash',
          value: videoHash,
        },
        {
          type: 'String',
          key: 'copyright_type',
          value: manifest.song.copyrightType,
        },
        {
          type: 'String',
          key: 'song_name',
          value: manifest.song.title,
        },
        {
          type: 'String',
          key: 'artist_name',
          value: manifest.song.artist,
        },
        ...(manifest.song.coverUri
          ? [
              {
                type: 'String' as const,
                key: 'album_art',
                value: manifest.song.coverUri,
              },
            ]
          : []),
        ...(manifest.song.spotifyId
          ? [
              {
                type: 'String' as const,
                key: 'spotify_id',
                value: manifest.song.spotifyId,
              },
            ]
          : []),
        ...(manifest.song.geniusId
          ? [
              {
                type: 'String' as const,
                key: 'genius_id',
                value: manifest.song.geniusId.toString(),
              },
            ]
          : []),
        ...(manifest.storyProtocol
          ? [
              {
                type: 'String' as const,
                key: 'story_ip_id',
                value: manifest.storyProtocol.ipId,
              },
              {
                type: 'String' as const,
                key: 'story_metadata_uri',
                value: manifest.storyProtocol.metadataUri,
              },
            ]
          : []),
        ...(manifest.descriptionTranslations
          ? [
              {
                type: 'JSON' as const,
                key: 'description_translations',
                value: JSON.stringify(manifest.descriptionTranslations),
              },
            ]
          : []),
        ...(manifest.grove.vocals
          ? [
              {
                type: 'String' as const,
                key: 'vocals_uri',
                value: manifest.grove.vocals,
              },
            ]
          : []),
        ...(manifest.grove.instrumental
          ? [
              {
                type: 'String' as const,
                key: 'instrumental_uri',
                value: manifest.grove.instrumental,
              },
            ]
          : []),
        ...(manifest.transcription
          ? [
              {
                type: 'JSON' as const,
                key: 'transcriptions',
                value: JSON.stringify(manifest.transcription),
              },
            ]
          : []),
      ],
    });

    // Upload metadata to Grove
    console.log('\n☁️  Uploading post metadata to Grove...');
    const metadataResult = await storageClient.uploadAsJson(postMetadata, {
      name: `lens-post-${videoHash}.json`,
      acl,
    });
    console.log(`   ✓ Metadata URI: ${metadataResult.uri}`);

    // Create Lens post
    console.log('\n📱 Creating Lens post...');
    const postResult = await createPost(sessionClient, {
      contentUri: metadataResult.uri as any,
    })
      .andThen(handleOperationWith(walletClient))
      .andThen(sessionClient.waitForTransaction);

    if (postResult.isErr()) {
      throw new Error(`Post creation failed: ${postResult.error.message}`);
    }

    const postHash = postResult.value;
    console.log(`✅ Post created! Hash: ${postHash}`);

    // Update manifest
    manifest.lensPost = {
      hash: postHash,
      metadataUri: metadataResult.uri,
      postedAt: new Date().toISOString(),
    };

    writeJson(videoManifestPath, manifest);
    logger.success(`Manifest updated: ${videoManifestPath}`);

    console.log('\n📊 Summary:');
    console.log(`   Creator: @${creatorManifest.identifiers.lensHandle}`);
    console.log(`   Song: ${manifest.song.title} by ${manifest.song.artist}`);
    console.log(`   Copyright: ${manifest.song.copyrightType}`);
    console.log(`   TikTok: ${manifest.tiktokUrl}`);
    if (manifest.storyProtocol) {
      console.log(`   Story IP: ${manifest.storyProtocol.ipId}`);
    }
    console.log(`   Lens Post: ${postHash}`);
    console.log(`   Feed: ${FEED_ADDRESS}`);
    console.log(`   App: ${APP_ADDRESS}`);

    console.log('\n✅ Video successfully posted to Lens!\n');
  } catch (error: any) {
    logger.error(`Failed to post to Lens: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
