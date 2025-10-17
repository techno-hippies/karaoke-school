#!/usr/bin/env bun
/**
 * Step 8.5: Mint Story Protocol IP Assets for Songs
 *
 * Creates Story Protocol IP Assets for songs with matched Spotify/Genius tracks.
 * Includes MLC data, ISRC, ISWC, and other metadata in the IP Asset.
 *
 * Prerequisites:
 * - Manifest with Spotify metadata and ISRCs
 * - Manifest with MLC data (optional but recommended)
 * - Manifest with Genius data (optional but recommended)
 *
 * Usage:
 *   bun run mint-story-ip-assets --creator @billieeilish
 *
 * Output:
 *   Updated manifest with Story Protocol IP Asset IDs
 */

import { StoryClient, StoryConfig, PILFlavor } from '@story-protocol/core-sdk';
import { http, zeroAddress } from 'viem';
import { privateKeyToAccount, Address } from 'viem/accounts';
import { readFile, writeFile } from 'fs/promises';
import { parseArgs } from 'util';
import path from 'path';
import { StorageClient, lensAccountOnly } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { createHash } from 'crypto';

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
  music: {
    title: string;
    spotifyUrl: string | null;
    spotifyTrackId: string | null;
    spotify?: {
      isrc?: string;
      metadata?: {
        name: string;
        artists: string[];
        album: string;
        releaseDate: string;
        durationMs: number;
        explicit: boolean;
        popularity: number;
        isrc?: string;
        upc?: string;
        ean?: string;
      };
      fetchedAt?: string;
    };
    mlc?: {
      songCode?: string;
      title?: string;
      iswc?: string | null;
      writers?: Array<{
        ipId: number;
        firstName: string;
        lastName: string;
        ipiNumber: string | null;
        roleCode: number;
        writerShare: number;
        [key: string]: any;
      }>;
      originalPublishers?: Array<{
        ipId: number;
        publisherName: string;
        ipiNumber: string | null;
        publisherShare: number;
        administratorPublishers: Array<{
          ipId: number;
          publisherName: string;
          ipiNumber: string;
          publisherShare: number;
          [key: string]: any;
        }>;
        writers: any[];
        [key: string]: any;
      }>;
      matchedRecording?: any;
      fetchedAt?: string;
      storyMintable?: boolean;
      storyMintableReason?: string;
      totalPublisherShare?: number;
      publisherShareBreakdown?: {
        direct: number;
        admin: number;
      };
    };
    genius?: {
      id: number;
      url: string;
      slug: string;
      title: string;
      artist: string;
      matchConfidence: number;
      matchType: string;
      matchDetails: any;
      fetchedAt: string;
    };
  };
  storyProtocol?: {
    ipAssetId: string;
    metadataUri: string;
    txHash: string;
    mintedAt: string;
    pilTermsId?: string;
    royaltyVault?: string;
  };
  [key: string]: any;
}

interface Manifest {
  tiktokHandle: string;
  lensHandle: string;
  lensAccountAddress: string;
  videos: VideoData[];
  [key: string]: any;
}

/**
 * Calculate each publisher's effective share (direct + administrator shares)
 */
function calculatePublisherEffectiveShare(publisher: any): number {
  let share = publisher.publisherShare || 0;

  // Add administrator shares
  if (publisher.administratorPublishers && publisher.administratorPublishers.length > 0) {
    for (const admin of publisher.administratorPublishers) {
      share += admin.publisherShare || 0;
    }
  }

  return share;
}

/**
 * Build Story Protocol metadata for a song
 * Following the IPA Metadata Standard: https://docs.story.foundation/blockchain-reference/metadata
 */
async function buildSongMetadata(video: VideoData, tiktokHandle: string, walletAddress: Address) {
  const spotify = video.music.spotify;
  const mlc = video.music.mlc;
  const genius = video.music.genius;

  // Determine primary artists
  const primaryArtists = spotify?.metadata?.artists || [tiktokHandle];

  // Get media URLs
  const videoUrl = video.groveUris?.video || video.groveUris?.playlist || video.postUrl;
  const thumbnailUrl = video.groveUris?.thumbnail || videoUrl;

  // Build creators array - simple and unopinionated
  // Detailed writer/publisher breakdown available in rights_metadata
  const creators: any[] = [
    {
      name: tiktokHandle,
      address: walletAddress,
      contributionPercent: 18,
      role: 'derivative_performer',
      description: `User-generated performance video creator`,
      socialMedia: [
        { platform: 'TikTok', url: video.postUrl },
      ],
    },
    {
      name: primaryArtists.join(' & '),
      address: zeroAddress,
      contributionPercent: 82,
      role: 'original_rights_holder',
      description: `Original artist(s) and rights holder(s); detailed credits in rights_metadata.mlc_data`,
      ...(video.music.spotifyUrl || genius?.url ? {
        socialMedia: [
          ...(video.music.spotifyUrl ? [{ platform: 'Spotify', url: video.music.spotifyUrl }] : []),
          ...(genius?.url ? [{ platform: 'Genius', url: genius.url }] : []),
        ]
      } : {}),
    },
  ];

  // Hash media files (fetches and hashes actual content)
  const imageHash = await hashUrl(thumbnailUrl);
  const mediaHash = await hashUrl(videoUrl);

  // Build metadata following IPA Metadata Standard
  const metadata = {
    // === REQUIRED FOR STORY EXPLORER ===
    title: `${video.music.title} - ${primaryArtists[0]}`,
    description: video.description || `User-generated performance video by ${tiktokHandle} featuring '${video.music.title}' by ${primaryArtists.join(', ')}. Original composition and recording rights held by respective owners.`,
    createdAt: new Date().toISOString(), // ISO8601 format
    image: thumbnailUrl, // Thumbnail for display (1:1 for audio, 16:9 for video)
    imageHash, // SHA-256 hash of actual file content
    creators,

    // === REQUIRED FOR COMMERCIAL INFRINGEMENT CHECK ===
    mediaUrl: videoUrl, // Actual video file
    mediaHash, // SHA-256 hash of actual file content
    mediaType: 'video/mp4', // MIME type

    // === OPTIONAL STANDARD FIELDS ===
    ipType: 'Music', // Type of IP Asset
    tags: ['karaoke', 'cover', 'music', 'lipsync', video.copyrightType],

    // === CUSTOM EXTENSIONS (allowed by standard) ===
    original_work: {
      title: video.music.title,
      primary_artists: primaryArtists,
      recording_label: spotify?.metadata?.album || 'Unknown',
      isrc: spotify?.isrc || spotify?.metadata?.isrc || null,
      iswc: mlc?.iswc || null,
      mlc_work_id: mlc?.songCode || null,
      source_url: video.music.spotifyUrl || null,
      genius_url: genius?.url || null,
      genius_id: genius?.id || null,
      ownership_claim_status: 'unverified', // or 'verified' if you have licenses
    },
    derivative_details: {
      video_url: video.groveUris?.video || video.postUrl,
      duration_seconds: spotify?.metadata?.durationMs
        ? Math.round(spotify.metadata.durationMs / 1000)
        : null,
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
    rights_metadata: mlc ? {
      mlc_data: {
        song_code: mlc.songCode,
        title: mlc.title,
        iswc: mlc.iswc,
        total_publisher_share: mlc.totalPublisherShare,
        publisher_share_breakdown: mlc.publisherShareBreakdown,
        writers: mlc.writers
          ?.map(w => ({
            name: `${w.firstName || ''} ${w.lastName || ''}`.trim(),
            ipi: w.ipiNumber || null,
            role: w.roleCode === 10 ? 'Composer' : w.roleCode === 11 ? 'Composer/Author' : 'Writer',
          }))
          .filter(w => w.name) || [], // Remove empty writer objects
        publishers: mlc.originalPublishers
          ?.map(p => ({
            name: p.publisherName,
            ipi: p.ipiNumber,
            publisher_share: p.publisherShare || 0,
            administrator_publishers: p.administratorPublishers
              ?.map(admin => ({
                name: admin.publisherName,
                ipi: admin.ipiNumber,
                share: admin.publisherShare,
              }))
              .filter(admin => admin.name) || [], // Remove empty admin publishers
          }))
          .filter(p => p.name) || [], // Remove empty publisher objects
      },
      spotify_data: spotify?.metadata ? {
        isrc: spotify.metadata.isrc,
        upc: spotify.metadata.upc,
        ean: spotify.metadata.ean,
        track_name: spotify.metadata.name,
        artists: spotify.metadata.artists,
        album: spotify.metadata.album,
        release_date: spotify.metadata.releaseDate,
        explicit: spotify.metadata.explicit,
        popularity: spotify.metadata.popularity,
      } : null,
      genius_data: genius ? {
        genius_id: genius.id,
        genius_url: genius.url,
        genius_slug: genius.slug,
        match_confidence: genius.matchConfidence,
        match_type: genius.matchType,
      } : null,
    } : null,
    provenance: {
      created_at: new Date().toISOString(),
      uploader: walletAddress,
      tiktok_post_id: video.postId,
      tiktok_url: video.postUrl,
      copyright_type: video.copyrightType,
    },
  };

  return metadata;
}

/**
 * Upload metadata to Grove Storage
 * Returns HTTP gateway URL for Story Protocol compatibility
 */
async function uploadMetadataToGrove(
  metadata: any,
  storageClient: StorageClient,
  acl: any,
  videoId: string
): Promise<string> {
  const result = await storageClient.uploadAsJson(metadata, {
    name: `story-ip-metadata-${videoId}.json`,
    acl,
  });

  // Convert lens:// URI to HTTP gateway URL for Story Protocol explorer
  // lens://CID → https://api.grove.storage/CID
  const lensUri = result.uri;
  if (lensUri.startsWith('lens://')) {
    const cid = lensUri.replace('lens://', '');
    return `https://api.grove.storage/${cid}`;
  }

  return result.uri;
}

/**
 * Hash metadata for Story Protocol using SHA-256 (IPA Metadata Standard)
 */
function hashMetadata(metadata: any): `0x${string}` {
  const metadataJson = JSON.stringify(metadata);
  const hash = createHash('sha256').update(metadataJson).digest('hex');
  return `0x${hash}`;
}

/**
 * Fetches a file from a URL and returns its SHA-256 hash
 * Used for image/media hashes in Story Protocol metadata
 */
async function hashUrl(url: string): Promise<`0x${string}`> {
  try {
    // Convert lens:// URIs to https://api.grove.storage/
    let fetchUrl = url;
    if (url.startsWith('lens://')) {
      const hash = url.replace('lens://', '');
      fetchUrl = `https://api.grove.storage/${hash}`;
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    const hash = createHash('sha256').update(Buffer.from(buffer)).digest('hex');
    return `0x${hash}`;
  } catch (error: any) {
    console.warn(`      ⚠️  Failed to hash URL (using URL hash fallback): ${error.message}`);
    // Fallback: hash the URL string itself
    const hash = createHash('sha256').update(url).digest('hex');
    return `0x${hash}`;
  }
}

async function mintStoryIPAssets(tiktokHandle: string): Promise<void> {
  console.log('\n🎨 Step 8.5: Mint Story Protocol IP Assets');
  console.log('═══════════════════════════════════════════\n');

  const cleanHandle = tiktokHandle.replace('@', '');

  // 1. Check for private key
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    console.error('❌ Error: PRIVATE_KEY environment variable not set\n');
    process.exit(1);
  }

  // 2. Load manifest
  const manifestPath = path.join(process.cwd(), 'data', 'videos', cleanHandle, 'manifest.json');
  console.log(`📂 Loading manifest: ${manifestPath}`);

  const manifestRaw = await readFile(manifestPath, 'utf-8');
  const manifest: Manifest = JSON.parse(manifestRaw);

  const videos = manifest.videos;
  console.log(`   Found ${videos.length} videos\n`);

  // 3. Filter videos with complete metadata
  const eligibleVideos = videos.filter(v => {
    const hasISRC = !!v.music.spotify?.isrc;
    const hasGenius = !!v.music.genius?.id;
    const storyMintable = v.music.mlc?.storyMintable === true;
    const notMintedYet = !v.storyProtocol?.ipAssetId;
    return hasISRC && hasGenius && storyMintable && notMintedYet;
  });

  console.log(`📊 Eligibility:`);
  console.log(`   Total videos: ${videos.length}`);
  console.log(`   With ISRC: ${videos.filter(v => v.music.spotify?.isrc).length}`);
  console.log(`   With Genius: ${videos.filter(v => v.music.genius?.id).length}`);
  console.log(`   With MLC data: ${videos.filter(v => v.music.mlc?.songCode).length}`);
  console.log(`   Story-mintable (≥98% shares): ${videos.filter(v => v.music.mlc?.storyMintable).length}`);
  console.log(`   Already minted: ${videos.filter(v => v.storyProtocol?.ipAssetId).length}`);
  console.log(`   Eligible for minting: ${eligibleVideos.length}\n`);

  // Show which videos are NOT mintable and why
  const unmintable = videos.filter(v =>
    v.music.spotify?.isrc && v.music.genius?.id && !v.storyProtocol?.ipAssetId && v.music.mlc && !v.music.mlc.storyMintable
  );
  if (unmintable.length > 0) {
    console.log(`⚠️  ${unmintable.length} video(s) not Story-mintable:`);
    unmintable.forEach(v => {
      const reason = v.music.mlc?.storyMintableReason || 'Unknown';
      const share = v.music.mlc?.totalPublisherShare;
      console.log(`   • "${v.music.title}": ${reason}${share !== undefined ? ` (${share.toFixed(2)}%)` : ''}`);
    });
    console.log('');
  }

  if (eligibleVideos.length === 0) {
    console.log('⚠️  No eligible videos to mint. Videos need: ISRC, Genius data, and MLC with ≥98% shares.\n');
    return;
  }

  // 4. Setup Story Protocol client
  console.log('🔗 Setting up Story Protocol client...');

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const config: StoryConfig = {
    account: account,
    transport: http(process.env.STORY_RPC_URL || 'https://aeneid.storyrpc.io'),
    chainId: 1315, // Aeneid testnet
  };

  const client = StoryClient.newClient(config);
  console.log(`   ✅ Connected to Story Protocol Aeneid Testnet (chainId: ${config.chainId})`);
  console.log(`   Wallet: ${account.address}\n`);

  // 5. Setup Grove Storage
  console.log('🔗 Setting up Grove storage client...');
  const storageClient = StorageClient.create();
  const lensAccount = manifest.lensAccountAddress as `0x${string}`;
  const chainId = chains.testnet.id;
  const acl = lensAccountOnly(lensAccount, chainId);
  console.log(`   ✅ Grove ACL configured for ${lensAccount}\n`);

  // 6. Check for blanket SPG NFT Collection
  let spgNftContract = process.env.STORY_SPG_NFT_CONTRACT as Address | undefined;

  if (!spgNftContract) {
    console.log('📝 Creating blanket SPG NFT Collection for the app...\n');

    try {
      const collectionResult = await client.nftClient.createNFTCollection({
        name: 'KaraokeSchool Covers',
        symbol: 'KSCOVER',
        isPublicMinting: true, // Enable public minting
        mintFeeRecipient: zeroAddress, // No mint fees
        mintOpen: true,
        maxSupply: 100000, // High limit for growth
        contractURI: '', // Optional: add IPFS URI for app description
      });

      spgNftContract = collectionResult.spgNftContract || collectionResult.nftContract;
      console.log(`   ✅ Blanket Collection: ${spgNftContract}`);
      console.log(`   Transaction: ${collectionResult.txHash}\n`);
      console.log(`   ⚠️  Add to your .env file:`);
      console.log(`   STORY_SPG_NFT_CONTRACT="${spgNftContract}"\n`);

      if (!spgNftContract) {
        console.error('   ❌ Failed to get NFT contract address from response\n');
        console.error('   Response:', JSON.stringify(collectionResult, null, 2));
        process.exit(1);
      }

      // Wait for transaction confirmation
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error: any) {
      console.error(`   ❌ Failed to create NFT collection: ${error.message}\n`);
      process.exit(1);
    }
  } else {
    console.log(`📝 Using blanket SPG NFT Collection: ${spgNftContract}\n`);
  }

  // 7. Get PIL terms configuration
  // Using Commercial Remix flavor with 18% rev-share for derivatives
  const currency = process.env.STORY_CURRENCY as Address | undefined || '0x1514000000000000000000000000000000000000'; // $WIP testnet token
  const safeWallet = process.env.SAFE_MULTISIG_ADDRESS as Address | undefined;

  console.log('📜 PIL Terms: Commercial Remix with 18% creator rev-share\n');

  // 8. Mint IP Assets
  console.log(`🎨 Minting ${eligibleVideos.length} IP Assets...\n`);

  let mintedCount = 0;

  for (let i = 0; i < eligibleVideos.length; i++) {
    const video = eligibleVideos[i];
    console.log(`   Video ${i + 1}/${eligibleVideos.length}: ${video.music.title}`);
    console.log(`   • ISRC: ${video.music.spotify?.isrc}`);
    if (video.music.mlc?.songCode) {
      console.log(`   • MLC Song Code: ${video.music.mlc.songCode}`);
    }
    if (video.music.genius?.url) {
      console.log(`   • Genius: ${video.music.genius.url}`);
    }

    try {
      // Build metadata
      console.log(`      • Building metadata (hashing media files)...`);
      const metadata = await buildSongMetadata(video, cleanHandle, account.address);

      // Upload metadata to Grove
      console.log(`      • Uploading metadata to Grove...`);
      const metadataUri = await uploadMetadataToGrove(
        metadata,
        storageClient,
        acl,
        video.postId
      );
      const metadataHash = hashMetadata(metadata);

      console.log(`      ✅ Metadata URI: ${metadataUri.slice(0, 60)}...`);
      console.log(`      ✅ Metadata Hash: ${metadataHash.slice(0, 20)}...`);

      // Mint IP Asset
      console.log(`      • Minting IP Asset on Story Protocol...`);

      const response = await client.ipAsset.registerIpAsset({
        nft: {
          type: "mint",
          spgNftContract: spgNftContract!,
          recipient: manifest.lensAccountAddress as Address, // Mint to creator's PKP wallet
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
              commercialRevShare: 18, // 18% paid back by derivatives
              currency: currency,
              override: {
                uri: 'https://raw.githubusercontent.com/piplabs/pil-document/ad67bb632a310d2557f8abcccd428e4c9c798db1/off-chain-terms/CommercialRemix.json',
              },
            }),
          },
        ],
        deadline: BigInt(Date.now() + 1000 * 60 * 5), // 5 min deadline for signature
      });

      console.log(`      ✅ IP Asset minted!`);
      console.log(`         IP Asset ID: ${response.ipId}`);
      console.log(`         Transaction: ${response.txHash}`);

      // Log license terms IDs if attached
      if ('licenseTermsIds' in response && response.licenseTermsIds && response.licenseTermsIds.length > 0) {
        console.log(`         License Terms IDs: ${response.licenseTermsIds.join(', ')}`);
      }

      // Distribute royalty tokens 18/82 split if Safe wallet is configured
      if (safeWallet && response.ipId) {
        try {
          console.log(`      • Setting up 18/82 royalty split...`);

          // Get royalty vault address
          const vaultAddress = await client.royalty.getRoyaltyVaultAddress(response.ipId);
          console.log(`         Vault: ${vaultAddress}`);

          // Transfer 82 royalty tokens to Safe multisig
          // Creator keeps 18 tokens (they're the initial holder)
          await client.ipAccount.transferErc20({
            ipId: response.ipId,
            tokens: [{
              address: vaultAddress, // Royalty token is ERC20 from the vault
              amount: 82,
              target: safeWallet,
            }],
          });

          console.log(`         ✅ Royalty Split: 18% creator, 82% to Safe`);
        } catch (error: any) {
          console.log(`         ⚠️  Royalty split skipped: ${error.message}`);
        }
      }

      // Store in manifest
      video.storyProtocol = {
        ipAssetId: response.ipId!,
        metadataUri: metadataUri,
        txHash: response.txHash!,
        mintedAt: new Date().toISOString(),
        licenseTermsIds: ('licenseTermsIds' in response && response.licenseTermsIds)
          ? response.licenseTermsIds.map(id => id.toString())
          : undefined,
        royaltyVault: await client.royalty.getRoyaltyVaultAddress(response.ipId!).catch(() => undefined),
      };

      mintedCount++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
      if (error.message?.includes('insufficient funds')) {
        console.log(`         💡 Get testnet IP from: https://aeneid.storyscan.io/faucet`);
      }
      console.log('');
    }
  }

  // 6. Save updated manifest
  console.log('💾 Saving updated manifest...');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`   ✅ Manifest updated: ${manifestPath}\n`);

  // 7. Summary
  console.log('═══════════════════════════════════════════');
  console.log('✨ Story Protocol IP Assets Created!');
  console.log(`\n📊 Summary:`);
  console.log(`   IP Assets minted: ${mintedCount}/${eligibleVideos.length}`);
  console.log(`   Total in manifest: ${videos.filter(v => v.storyProtocol?.ipAssetId).length}\n`);

  console.log('📋 NEXT STEPS:');
  console.log('   1. Add the SPG NFT Contract to your .env if created');
  console.log('   2. View IP Assets at: https://aeneid.explorer.story.foundation');
  console.log('   3. Run: bun run create-lens-posts to reference IP Assets in Lens\n');
}

async function main() {
  try {
    const creator = values.creator;

    if (!creator) {
      console.error('\n❌ Error: --creator argument required\n');
      console.log('Usage: bun run mint-story-ip-assets --creator @billieeilish\n');
      process.exit(1);
    }

    await mintStoryIPAssets(creator);
    console.log('✨ Done!\n');
    process.exit(0);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();
