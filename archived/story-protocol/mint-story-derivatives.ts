#!/usr/bin/env bun
/**
 * Pipeline Step 13: Mint Story Protocol Derivatives
 *
 * Mints copyrighted TikTok creator videos as Story Protocol IP Assets
 * Prerequisites:
 *   - Video transcribed + translated
 *   - Video uploaded to Grove
 *   - GRC-20 work + recording minted
 *   - Creator has PKP + Lens account
 *
 * Process:
 *   1. Query videos ready for Story minting
 *   2. Build minimal metadata (18% creator, reference GRC-20)
 *   3. Upload metadata to Grove
 *   4. Mint to Story Protocol with Commercial Remix license
 *   5. Update database with Story IP asset info
 *   6. (Optional) Post to Lens custom feed
 *
 * Usage:
 *   bun src/processors/mint-story-derivatives.ts --limit=3
 *   bun src/processors/mint-story-derivatives.ts --video-id=7558957526327332118
 */

import { parseArgs } from 'util';
import { type Address, http, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { StoryClient, StoryConfig, PILFlavor } from '@story-protocol/core-sdk';
import { query } from '../db/neon';
import { buildStoryMetadata, hashMetadata, hashUrl } from '../schemas/story-protocol-metadata';

interface VideoForMinting {
  video_id: string;
  creator_username: string;
  spotify_track_id: string;
  grove_video_cid: string;
  video_url: string | null;
  story_mint_attempts: number;
  track_title: string;
  artist_name: string;
  genius_song_id: number;
  work_grc20_id: string;
  recording_grc20_id: string;
  transcription_text: string;
  detected_language: string;
  creator_nickname: string | null;
  creator_lens_address: string | null;
  creator_pkp_address: string | null;
}

interface TranscriptionTranslation {
  language_code: string;
  translated_text: string;
  translation_source: string;
}

/**
 * Get transcription translations for a video
 */
async function getTranscriptions(videoId: string): Promise<{ [lang: string]: { text: string; source?: string } }> {
  const transcriptions: any = {};

  // Get original transcription
  const original = await query<{
    language_code: string | null;
    text: string;
  }>(`
    SELECT
      t.detected_language as language_code,
      t.transcription_text as text
    FROM tiktok_video_transcriptions t
    WHERE t.video_id = $1
  `, [videoId]);

  if (original.length > 0 && original[0].language_code) {
    transcriptions[original[0].language_code] = {
      text: original[0].text,
      source: 'original',
    };
  }

  // Get translations
  const translations = await query<{
    language_code: string;
    text: string;
    source: string;
  }>(`
    SELECT
      tt.language_code,
      tt.translated_text as text,
      tt.translation_source as source
    FROM tiktok_video_transcriptions t
    JOIN tiktok_video_transcription_translations tt ON tt.transcription_id = t.id
    WHERE t.video_id = $1
  `, [videoId]);

  for (const row of translations) {
    transcriptions[row.language_code] = {
      text: row.text,
      source: row.source,
    };
  }

  return transcriptions;
}

/**
 * Mint a single video to Story Protocol
 */
async function mintVideo(
  video: VideoForMinting,
  storyClient: StoryClient,
  spgNftContract: Address
): Promise<void> {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📹 Video: ${video.video_id}`);
  console.log(`🎵 Song: ${video.track_title} by ${video.artist_name}`);
  console.log(`👤 Creator: @${video.creator_username} (${video.creator_nickname || 'N/A'})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Check creator has Lens account
  if (!video.creator_lens_address) {
    console.log(`⚠️  Creator has no Lens account - skipping`);
    console.log(`   Run: bun src/processors/mint-creator-pkps.ts --username=${video.creator_username}`);
    console.log(`   Then: bun src/processors/create-creator-lens.ts --username=${video.creator_username}\n`);
    return;
  }

  // 1. Get multilingual transcriptions
  console.log('📝 Fetching transcriptions...');
  const transcriptions = await getTranscriptions(video.video_id);
  const languages = Object.keys(transcriptions);
  console.log(`   ✓ Found ${languages.length} languages: ${languages.join(', ')}`);

  // 2. Build metadata
  console.log('\n🏗️  Building Story Protocol metadata...');
  const groveVideoUrl = `https://api.grove.storage/${video.grove_video_cid}`;

  const metadata = buildStoryMetadata({
    videoId: video.video_id,
    videoUrl: video.video_url || undefined,
    groveVideoCid: video.grove_video_cid,
    groveVideoUrl,
    transcriptions,
    creatorName: video.creator_nickname || video.creator_username,
    creatorLensAddress: video.creator_lens_address,
    trackTitle: video.track_title,
    trackArtist: video.artist_name,
    spotifyTrackId: video.spotify_track_id,
    geniusSongId: video.genius_song_id,
    grc20WorkId: video.work_grc20_id,
    grc20RecordingId: video.recording_grc20_id,
  });

  console.log(`   ✓ Title: ${metadata.title}`);
  console.log(`   ✓ GRC-20 Work: ${metadata.grc20.work_id}`);
  console.log(`   ✓ GRC-20 Recording: ${metadata.grc20.recording_id}`);
  console.log(`   ✓ Creator: ${metadata.creators[0].name} (${metadata.creators[0].contributionPercent}%)`);

  // 3. Upload metadata to Grove
  console.log('\n☁️  Uploading metadata to Grove...');
  const { StorageClient, immutable } = await import('@lens-chain/storage-client');
  const storageClient = StorageClient.create();

  const metadataUpload = await storageClient.uploadAsJson({
    json: metadata,
    accessControl: immutable(),
  });

  const metadataUri = metadataUpload.uri; // lens:// URI
  const metadataHash = hashMetadata(metadata);

  console.log(`   ✓ Metadata URI: ${metadataUri.slice(0, 60)}...`);
  console.log(`   ✓ Metadata Hash: ${metadataHash.slice(0, 20)}...`);

  // 4. Hash media files
  console.log('\n🔐 Hashing media files...');
  const imageHash = await hashUrl(metadata.image);
  const mediaHash = await hashUrl(metadata.mediaUrl);
  console.log(`   ✓ Image hash: ${imageHash.slice(0, 20)}...`);
  console.log(`   ✓ Media hash: ${mediaHash.slice(0, 20)}...`);

  // 5. Mint to Story Protocol
  console.log('\n⛓️  Minting to Story Protocol...');
  console.log(`   Network: Aeneid Testnet (chainId: 1315)`);
  console.log(`   SPG NFT: ${spgNftContract}`);
  console.log(`   Recipient: ${video.creator_lens_address}`);
  console.log(`   License: Commercial Remix (18% revenue share)`);

  const response = await storyClient.ipAsset.registerIpAsset({
    nft: {
      type: 'mint',
      spgNftContract,
      recipient: video.creator_lens_address as Address,
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
          commercialRevShare: 18, // Creator gets 18%
          currency: '0x1514000000000000000000000000000000000000' as Address, // $WIP testnet
          override: {
            uri: 'https://raw.githubusercontent.com/piplabs/pil-document/ad67bb632a310d2557f8abcccd428e4c9c798db1/off-chain-terms/CommercialRemix.json',
          },
        }),
      },
    ],
    deadline: BigInt(Date.now() + 1000 * 60 * 5), // 5 min deadline
  });

  console.log('\n✅ IP Asset minted!');
  console.log(`   IP Asset ID: ${response.ipId}`);
  console.log(`   Transaction: ${response.txHash}`);

  const licenseTermsIds = 'licenseTermsIds' in response && response.licenseTermsIds
    ? response.licenseTermsIds.map(id => id.toString())
    : [];

  if (licenseTermsIds.length > 0) {
    console.log(`   License Terms: ${licenseTermsIds.join(', ')}`);
  }

  // Get royalty vault
  let royaltyVault: string | undefined;
  try {
    royaltyVault = await storyClient.royalty.getRoyaltyVaultAddress(response.ipId!);
    console.log(`   Royalty Vault: ${royaltyVault}`);
  } catch (error: any) {
    console.log(`   ⚠️  Could not get royalty vault: ${error.message}`);
  }

  // 6. Update database
  console.log('\n💾 Updating database...');

  // Format license terms as PostgreSQL array
  const licenseTermsArray = licenseTermsIds.length > 0
    ? `{${licenseTermsIds.join(',')}}`
    : '{}';

  await query(`
    UPDATE tiktok_videos
    SET story_ip_id = $1,
        story_metadata_uri = $2,
        story_tx_hash = $3,
        story_license_terms_ids = $4,
        story_royalty_vault = $5,
        story_minted_at = NOW(),
        story_mint_attempts = story_mint_attempts + 1,
        story_last_error = NULL
    WHERE video_id = $6
  `, [
    response.ipId,
    metadataUri,
    response.txHash,
    licenseTermsArray, // PostgreSQL array format
    royaltyVault || null,
    video.video_id,
  ]);

  console.log('   ✓ Database updated');

  // Explorer URL
  const explorerUrl = `https://aeneid.explorer.story.foundation/ipa/${response.ipId}`;
  console.log(`\n🔗 View on Story Explorer:`);
  console.log(`   ${explorerUrl}`);

  console.log(`\n✨ Video successfully minted!\n`);
}

/**
 * Main processor function
 */
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '10' },
      'video-id': { type: 'string' },
      'test-mode': { type: 'boolean', default: false },
    },
  });

  const limit = parseInt(values.limit || '10');
  const videoId = values['video-id'];
  const testMode = values['test-mode'];

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Step 13: Mint Story Protocol Derivatives');
  console.log('═══════════════════════════════════════════════════════\n');

  // Initialize Story Protocol client
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const storyConfig: StoryConfig = {
    account,
    transport: http(process.env.STORY_RPC_URL || 'https://aeneid.storyrpc.io'),
    chainId: 1315, // Aeneid testnet
  };

  const storyClient = StoryClient.newClient(storyConfig);

  console.log('✅ Connected to Story Protocol Aeneid Testnet');
  console.log(`   Chain ID: ${storyConfig.chainId}`);
  console.log(`   RPC: ${process.env.STORY_RPC_URL || 'https://aeneid.storyrpc.io'}`);
  console.log(`   Wallet: ${account.address}\n`);

  // Get or create SPG NFT contract
  let spgNftContract = process.env.STORY_SPG_NFT_CONTRACT as Address | undefined;

  if (!spgNftContract) {
    console.log('📦 No SPG NFT contract configured. Creating new collection...');
    const result = await storyClient.nftClient.createNFTCollection({
      name: 'Karaoke School Creator Videos',
      symbol: 'KSCV',
      isPublicMinting: false,
      mintFeeRecipient: zeroAddress,
      mintOpen: true,
      maxSupply: 100000,
      contractURI: '',
    });

    spgNftContract = (result.spgNftContract || result.nftContract) as Address;
    if (!spgNftContract) {
      throw new Error('Failed to create NFT collection');
    }

    console.log(`   ✅ NFT Collection created: ${spgNftContract}`);
    console.log(`   📜 Transaction: ${result.txHash}`);
    console.log(`   ⚠️  Save this to .env: STORY_SPG_NFT_CONTRACT=${spgNftContract}\n`);
  } else {
    console.log(`   SPG NFT: ${spgNftContract}\n`);
  }

  // Query videos ready for minting
  let videos: VideoForMinting[];

  if (videoId) {
    // Mint specific video
    console.log(`🎯 Processing specific video: ${videoId}\n`);
    videos = await query<VideoForMinting>(`
      SELECT * FROM videos_ready_for_story_minting
      WHERE video_id = $1
    `, [videoId]);

    if (videos.length === 0) {
      console.log(`❌ Video ${videoId} not found or not ready for minting`);
      console.log(`   Requirements:`);
      console.log(`     - Copyrighted video`);
      console.log(`     - Transcribed + translated`);
      console.log(`     - Uploaded to Grove`);
      console.log(`     - GRC-20 work + recording minted`);
      console.log(`     - Not already minted to Story Protocol\n`);
      process.exit(1);
    }
  } else {
    // Batch mint
    videos = await query<VideoForMinting>(`
      SELECT * FROM videos_ready_for_story_minting
      LIMIT $1
    `, [limit]);
  }

  if (videos.length === 0) {
    console.log('✅ No videos ready for Story Protocol minting\n');
    console.log('All ready videos have been minted!\n');
    process.exit(0);
  }

  console.log(`Found ${videos.length} video(s) ready for minting\n`);

  if (testMode) {
    console.log('🧪 TEST MODE: Will not actually mint\n');
  }

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const video of videos) {
    try {
      if (testMode) {
        console.log(`\n[TEST] Would mint video: ${video.video_id}`);
        console.log(`  Song: ${video.track_title}`);
        console.log(`  Creator: @${video.creator_username}`);
        console.log(`  GRC-20 Work: ${video.work_grc20_id}`);
        skippedCount++;
        continue;
      }

      await mintVideo(video, storyClient, spgNftContract);
      successCount++;
    } catch (error: any) {
      console.error(`\n❌ Failed to mint video ${video.video_id}:`);
      console.error(`   ${error.message}\n`);

      // Update error in database
      await query(`
        UPDATE tiktok_videos
        SET story_mint_attempts = story_mint_attempts + 1,
            story_last_error = $1
        WHERE video_id = $2
      `, [error.message, video.video_id]);

      errorCount++;
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`✅ Successfully minted: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  if (testMode) {
    console.log(`🧪 Tested: ${skippedCount}`);
  }
  console.log('');

  if (successCount > 0) {
    console.log('🎉 Videos successfully minted to Story Protocol!');
    console.log('   View on https://aeneid.explorer.story.foundation\n');
  }

  if (errorCount > 0) {
    console.log('⚠️  Some videos failed to mint. Check logs above for details.\n');
    process.exit(1);
  }
}

// CLI execution
if (import.meta.main) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Step 13 failed:', error);
      process.exit(1);
    });
}

export { main as processStoryDerivatives };
