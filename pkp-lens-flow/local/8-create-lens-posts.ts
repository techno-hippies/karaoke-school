#!/usr/bin/env bun
/**
 * Step 8: Create Lens Posts from Videos
 *
 * Creates Lens video posts for all videos in the manifest
 * Posts to custom feed with proper metadata
 *
 * Prerequisites:
 * - Manifest with Grove URIs (data/videos/{handle}/manifest.json)
 * - Lens account authenticated
 *
 * Usage:
 *   bun run create-lens-posts --creator @brookemonk_
 *
 * Output:
 *   Lens posts created for each video
 */

import { PublicClient, SessionClient, evmAddress } from '@lens-protocol/client';
import { post as createPost, fetchAccount } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { signMessageWith } from '@lens-protocol/client/viem';
import { video, MediaVideoMimeType } from '@lens-protocol/metadata';
import { StorageClient, lensAccountOnly } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import path from 'path';

// Parse CLI args
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    creator: { type: 'string', short: 'c' },
  },
});

interface VideoData {
  postId: string;
  postUrl: string;
  description: string;
  copyrightType: string;
  stats: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  music: {
    title: string;
    spotifyUrl: string | null;
    spotifyTrackId: string | null;
    spotify?: {
      isrc: string;
      metadata: any;
      fetchedAt: string;
    };
    mlc?: {
      songCode: string;
      title: string;
      writers: any[];
      originalPublishers: any[];
      fetchedAt: string;
    };
  };
  localFiles: {
    video: string | null;
    thumbnail: string | null;
  };
  groveUris: {
    video: string | null;
    thumbnail: string | null;
    metadata: string | null;
  };
  transcription?: {
    languages: {
      en: any;
      vi: any;
      zh: any;
    };
    generatedAt: string;
    voxtralModel: string;
    translationModel: string;
  };
  encryption?: {
    encryptedSymmetricKey: string;
    dataToEncryptHash: string;
    iv: string;
    authTag: string;
    unifiedAccessControlConditions: any[];
    encryptedAt: string;
  };
  lensPostId?: string;
  lensPostHash?: string;
}

interface Manifest {
  tiktokHandle: string;
  lensHandle: string;
  lensAccountAddress: string;
  scrapedAt: string;
  profile: {
    nickname: string;
    bio: string;
    stats: any;
    groveUris: {
      metadata: string | null;
      avatar: string | null;
    };
  };
  videos: VideoData[];
}

interface LensAccountData {
  tiktokHandle: string;
  pkpEthAddress: string;
  lensHandle: string;
  lensAccountAddress: string;
  network: string;
  subscriptionLock: {
    address: string;
    chain: string;
  };
}

// App and Feed addresses
const APP_ADDRESS = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';
const FEED_ADDRESS = '0x5941b291E69069769B8e309746b301928C816fFa';

async function createLensPosts(tiktokHandle: string): Promise<void> {
  console.log('\n📱 Step 8: Creating Lens Posts');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  console.log(`   Lens Account: ${manifest.lensHandle}`);
  console.log(`   Videos: ${manifest.videos.length}\n`);

  // 2. Load Lens account data
  const lensDataPath = path.join(process.cwd(), 'data', 'lens', `${cleanHandle}.json`);
  const lensDataRaw = await readFile(lensDataPath, 'utf-8');
  const lensData: LensAccountData = JSON.parse(lensDataRaw);

  console.log(`🔑 Lens Account:`);
  console.log(`   Handle: ${lensData.lensHandle}`);
  console.log(`   Address: ${lensData.lensAccountAddress}`);
  console.log(`   Lock: ${lensData.subscriptionLock.address}\n`);

  // 3. Setup clients
  console.log('🔗 Setting up Lens client...');

  // Get private key from environment
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }

  // Create account and wallet client
  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);
  const walletClient = createWalletClient({
    account,
    chain: chains.testnet,
    transport: http(),
  });

  // Create public client
  const publicClient = PublicClient.create({
    environment: testnet,
    origin: 'https://pkp-lens-flow.local',
  });

  // First, fetch the account details by username to get the account address
  console.log(`   Fetching Lens account details for: ${lensData.lensHandle}`);

  const accountResult = await fetchAccount(publicClient, {
    username: {
      localName: lensData.lensHandle.replace('@', ''),
    },
  });

  if (accountResult.isErr()) {
    throw new Error(`Could not find Lens account: ${lensData.lensHandle}`);
  }

  const lensAccountAddress = accountResult.value.address;
  console.log(`   Found account address: ${lensAccountAddress}`);

  console.log(`   Authenticating as account owner: ${account.address}`);

  // Use accountOwner login now that we have the account address
  const authenticated = await publicClient.login({
    accountOwner: {
      account: evmAddress(lensAccountAddress),
      owner: evmAddress(account.address),
      app: evmAddress(APP_ADDRESS),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (!authenticated.isOk()) {
    throw new Error(`Authentication failed: ${authenticated.error.message}`);
  }

  const sessionClient = authenticated.value;
  console.log('✅ Authenticated with Lens\n');

  // 4. Setup Grove storage client
  const storageClient = StorageClient.create();
  // Use PKP address since lensAccountAddress is "unknown"
  const lensAccount = lensData.pkpEthAddress as `0x${string}`;
  const chainId = chains.testnet.id;
  const acl = lensAccountOnly(lensAccount, chainId);

  // 5. Create posts for each video
  console.log(`🎬 Creating ${manifest.videos.length} Lens posts...\n`);

  for (let i = 0; i < manifest.videos.length; i++) {
    const videoData = manifest.videos[i];
    console.log(`   Video ${i + 1}/${manifest.videos.length}: ${videoData.music.title}`);
    console.log(`   Type: ${videoData.copyrightType}`);
    console.log(`   TikTok: ${videoData.postUrl}`);

    // Skip if already posted
    if (videoData.lensPostId) {
      console.log(`   ⏭️  Already posted (Lens ID: ${videoData.lensPostId})\n`);
      continue;
    }

    // Ensure we have Grove URIs
    if (!videoData.groveUris.video || !videoData.groveUris.thumbnail) {
      console.log(`   ⚠️  Missing Grove URIs, skipping\n`);
      continue;
    }

    try {
      // Build content text with transcription
      let contentText = videoData.description || '';

      if (videoData.transcription) {
        contentText += '\n\n📝 Transcription (EN):\n' + videoData.transcription.languages.en.text;
      }

      // Add music and licensing info
      if (videoData.copyrightType === 'copyrighted') {
        contentText += `\n\n🎵 Music: ${videoData.music.title}`;

        if (videoData.music.spotify?.isrc) {
          contentText += `\nISRC: ${videoData.music.spotify.isrc}`;
        }

        if (videoData.music.mlc?.songCode) {
          contentText += `\nMLC Song Code: ${videoData.music.mlc.songCode}`;
          if (videoData.music.mlc.writers.length > 0) {
            const writerNames = videoData.music.mlc.writers
              .map(w => `${w.firstName} ${w.lastName}`)
              .join(', ');
            contentText += `\nWriters: ${writerNames}`;
          }
        }
      }

      // Add stats
      contentText += `\n\n📊 Original Stats:`;
      contentText += `\n👁️ ${(videoData.stats.views / 1000000).toFixed(1)}M views`;
      contentText += `\n❤️ ${(videoData.stats.likes / 1000000).toFixed(1)}M likes`;

      // Add encryption notice (only for copyrighted content)
      if (videoData.copyrightType === 'copyrighted' && videoData.encryption) {
        contentText += `\n\n🔐 This content is encrypted and requires an Unlock subscription key to decrypt.`;
        contentText += `\nLock: ${lensData.subscriptionLock.address}`;
      }

      // Create video metadata
      console.log(`      • Creating Lens video metadata...`);

      const metadata = video({
        title: `${manifest.profile.nickname} - ${videoData.music.title}`,
        content: contentText,
        video: {
          item: videoData.groveUris.video,
          type: MediaVideoMimeType.MP4,
          cover: videoData.groveUris.thumbnail,
          altTag: videoData.description || videoData.music.title,
        },
        tags: [
          'tiktok',
          'encrypted',
          videoData.copyrightType,
          ...(videoData.music.spotify?.isrc ? ['licensed'] : []),
        ],
        attributes: [
          {
            type: 'String',
            key: 'tiktok_post_id',
            value: videoData.postId,
          },
          {
            type: 'String',
            key: 'tiktok_url',
            value: videoData.postUrl,
          },
          {
            type: 'String',
            key: 'copyright_type',
            value: videoData.copyrightType,
          },
          // Only include encryption attributes if video is encrypted
          ...(videoData.encryption ? [
            {
              type: 'String' as const,
              key: 'unlock_lock',
              value: lensData.subscriptionLock.address,
            },
            {
              type: 'String' as const,
              key: 'encryption_hash',
              value: videoData.encryption.dataToEncryptHash,
            },
          ] : []),
          {
            type: 'String',
            key: 'metadata_uri',
            value: videoData.groveUris.metadata || '',
          },
          // Include full transcription data as JSON
          ...(videoData.transcription ? [{
            type: 'JSON' as const,
            key: 'transcriptions',
            value: JSON.stringify({
              languages: videoData.transcription.languages,
              generatedAt: videoData.transcription.generatedAt,
              voxtralModel: videoData.transcription.voxtralModel,
              translationModel: videoData.transcription.translationModel,
            }),
          }] : []),
          // Include encryption metadata as JSON
          ...(videoData.encryption ? [{
            type: 'JSON' as const,
            key: 'encryption',
            value: JSON.stringify({
              encryptedSymmetricKey: videoData.encryption.encryptedSymmetricKey,
              dataToEncryptHash: videoData.encryption.dataToEncryptHash,
              iv: videoData.encryption.iv,
              authTag: videoData.encryption.authTag,
              unifiedAccessControlConditions: videoData.encryption.unifiedAccessControlConditions,
            }),
          }] : []),
          // Include licensing data as JSON for copyrighted content
          ...(videoData.music.spotify?.isrc ? [{
            type: 'JSON' as const,
            key: 'licensing',
            value: JSON.stringify({
              isrc: videoData.music.spotify.isrc,
              spotify: videoData.music.spotify.metadata,
              mlc: videoData.music.mlc ? {
                songCode: videoData.music.mlc.songCode,
                title: videoData.music.mlc.title,
                writers: videoData.music.mlc.writers,
                originalPublishers: videoData.music.mlc.originalPublishers,
              } : null,
            }),
          }] : []),
        ],
      });

      // Upload metadata to Grove
      console.log(`      • Uploading Lens metadata to Grove...`);
      const metadataResult = await storageClient.uploadAsJson(metadata, {
        name: `lens-post-${videoData.postId}.json`,
        acl,
      });
      console.log(`      ✅ Metadata URI: ${metadataResult.uri}`);

      // Create Lens post
      console.log(`      • Creating Lens post...`);
      const postResult = await createPost(sessionClient, {
        contentUri: metadataResult.uri as any,
      });

      if (postResult.isErr()) {
        throw new Error(`Post creation failed: ${postResult.error}`);
      }

      const postResponse = postResult.value;

      // Store post info
      if ('hash' in postResponse) {
        videoData.lensPostHash = postResponse.hash;
        console.log(`      ✅ Post created! Hash: ${postResponse.hash}`);
      } else {
        console.log(`      ℹ️  Post response:`, JSON.stringify(postResponse, null, 2));
      }

      console.log('');

      // Small delay between posts to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.log(`      ❌ Error creating post: ${error.message}\n`);
    }
  }

  // 6. Save updated manifest
  console.log('💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // 7. Summary
  console.log('═══════════════════════════════════════════');
  console.log('✨ Lens Posts Created!\n');

  const posted = manifest.videos.filter(v => v.lensPostHash || v.lensPostId).length;
  console.log(`📊 Summary:`);
  console.log(`   Posts created: ${posted}/${manifest.videos.length}`);
  console.log(`   Feed: ${FEED_ADDRESS}`);
  console.log(`   App: ${APP_ADDRESS}\n`);
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run create-lens-posts --creator @brookemonk_\n');
      process.exit(1);
    }

    await createLensPosts(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
