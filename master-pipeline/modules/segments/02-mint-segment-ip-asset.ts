#!/usr/bin/env bun
/**
 * Mint Story Protocol IP Asset for Processed Segment
 *
 * Creates derivative IP Asset for karaoke-ready audio clip
 * This is a DERIVATIVE work with mechanical license (MLC) provenance
 *
 * Prerequisites:
 * - Segment processed with vocals + instrumental stems
 * - Song metadata with MLC data
 * - PRIVATE_KEY in .env
 * - FAL_KEY in .env (for Seedream cover art)
 * - SPG_NFT_CONTRACT
 *
 * Usage:
 *   bun segments/02-mint-segment-ip-asset.ts \
 *     --genius-id 10047250 \
 *     --segment-id "7334542274145454891-0-60"
 */

import { parseArgs } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import path from 'path';

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'segment-id': { type: 'string' }, // Format: tiktokId-startTime-endTime
    'create-collection': { type: 'boolean' },
  },
  strict: false,
  allowPositionals: true,
});

if (!values['genius-id'] || !values['segment-id']) {
  console.error('❌ Missing required arguments');
  console.error('Usage: bun segments/02-mint-segment-ip-asset.ts --genius-id 10047250 --segment-id "7334542274145454891-0-60"');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const segmentId = values['segment-id']!;

console.log('🎨 Story Protocol Derivative IP Asset Minter (Karaoke Segment)\n');
console.log('════════════════════════════════════════════════════════════\n');

const privateKey = process.env.PRIVATE_KEY;
const spgNftContract = process.env.SPG_NFT_CONTRACT as Address | undefined;
const safeWallet = process.env.SAFE_MULTISIG_ADDRESS as Address | undefined;
const falKey = process.env.FAL_KEY;

if (!privateKey) {
  console.error('❌ PRIVATE_KEY not set in .env');
  process.exit(1);
}

if (!falKey) {
  console.error('❌ FAL_KEY not set in .env (required for Seedream cover art generation)');
  process.exit(1);
}

// Derive wallet address
const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
const account = privateKeyToAccount(formattedKey as `0x${string}`);
const walletAddress = account.address;

async function main() {
  try {
    // Step 1: Load song metadata
    console.log('Step 1: Loading song metadata...');
    const metadataPath = path.join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);
    const metadataRaw = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataRaw);

    console.log(`  Title: ${metadata.title}`);
    console.log(`  Artist: ${metadata.artist}`);

    // Step 2: Validate MLC data (required for derivative works)
    console.log('\nStep 2: Validating MLC data...');

    if (!metadata.licensing) {
      console.error('❌ FAILED: No MLC licensing data found');
      console.error('');
      console.error('MLC data is REQUIRED to mint derivative IP Assets with mechanical license provenance.');
      console.error('');
      console.error('Fix: Run the MLC data fetching step:');
      console.error(`  bun songs/02-fetch-mlc-data.ts --genius-id ${geniusId}`);
      console.error('');
      process.exit(1);
    }

    console.log(`  ✅ MLC Song Code: ${metadata.licensing.mlcSongCode}`);
    console.log(`  ISWC: ${metadata.licensing.iswc}`);
    console.log(`  Writers: ${metadata.licensing.writers.length}`);
    console.log(`  Publishers: ${metadata.licensing.publishers.length}`);

    // Step 3: Find segment in metadata
    console.log(`\nStep 3: Loading segment data (${segmentId})...`);
    const segment = metadata.segments?.find((s: any) => {
      const id = `${s.tiktokId}-${s.startTime}-${s.endTime}`;
      return id === segmentId;
    });

    if (!segment) {
      console.error(`❌ FAILED: Segment not found: ${segmentId}`);
      console.error('');
      console.error(`Available segments: ${metadata.segments?.length || 0}`);
      if (metadata.segments && metadata.segments.length > 0) {
        metadata.segments.forEach((s: any) => {
          console.error(`  - ${s.tiktokId}-${s.startTime}-${s.endTime}`);
        });
      }
      console.error('');
      process.exit(1);
    }

    console.log(`  Start: ${segment.startTime}s`);
    console.log(`  End: ${segment.endTime}s`);
    console.log(`  Duration: ${segment.duration}s`);
    console.log(`  Vocals: ${segment.vocalsUri.slice(0, 30)}...`);
    console.log(`  Instrumental: ${segment.instrumentalUri.slice(0, 30)}...`);

    // Step 4: Generate derivative cover art using Seedream
    console.log('\nStep 4: Generating derivative cover art with Seedream...');
    const { FalImageService } = await import('../../services/fal-image.js');
    const seedreamService = new FalImageService({ apiKey: falKey });

    const coverArtResult = await seedreamService.generateDerivativeCoverArt(
      metadata.coverUri,
      geniusId // Use geniusId as seed for consistency
    );

    console.log(`  ✅ Generated: ${coverArtResult.images[0].url}`);

    // Step 5: Upload derivative cover art to Grove
    console.log('\nStep 5: Uploading cover art to Grove...');
    const { GroveService } = await import('../../services/grove.js');
    const groveService = new GroveService();

    // Download Seedream image
    const imageResponse = await fetch(coverArtResult.images[0].url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download Seedream image: ${imageResponse.statusText}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();

    // Upload to Grove
    const coverUpload = await groveService.uploadBuffer(
      Buffer.from(imageBuffer),
      'image/png',
      { name: `segment-${segmentId}-cover.png` }
    );

    const derivativeCoverUri = coverUpload.uri;
    console.log(`  ✅ Cover URI: ${derivativeCoverUri}`);

    // Step 6: Create Story Protocol service
    console.log('\nStep 6: Connecting to Story Protocol...');
    const { StoryProtocolService } = await import('../../services/story-protocol.js');

    let currentSpgContract = spgNftContract;

    if (!currentSpgContract || values['create-collection']) {
      console.log('\nStep 6.1: Creating NFT collection...');
      const service = new StoryProtocolService({
        privateKey,
        safeWallet,
      });

      currentSpgContract = await service.createNFTCollection(
        'KaraokeSchool Karaoke Clips',
        'KSKARAOKE',
        100000
      );

      console.log(`\n⚠️  Add to your .env:`);
      console.log(`  SPG_NFT_CONTRACT="${currentSpgContract}"\n`);

      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log(`  Using existing NFT collection: ${currentSpgContract}`);
    }

    const storyService = new StoryProtocolService({
      privateKey,
      spgNftContract: currentSpgContract,
      safeWallet,
    });

    // Step 7: Build derivative IP Asset metadata
    console.log('\nStep 7: Building derivative IP Asset metadata...');

    // Hash media files
    console.log('  Hashing derivative cover art...');
    const imageHash = await storyService.hashUrl(derivativeCoverUri);

    console.log('  Hashing instrumental (primary media)...');
    const instrumentalHash = await storyService.hashUrl(segment.instrumentalUri);

    // Transform MLC data
    const mlcData = {
      songCode: metadata.licensing.mlcSongCode,
      title: metadata.title,
      iswc: metadata.licensing.iswc,
      totalPublisherShare: metadata.licensing.totalPublisherShare,
      writers: metadata.licensing.writers,
      publishers: metadata.licensing.publishers,
    };

    const ipaMetadata = StoryProtocolService.buildSongMetadata({
      title: `${metadata.title} (Karaoke Instrumental ${segment.startTime}-${segment.endTime}s)`,
      description: `AI-generated karaoke instrumental (fal.ai audio-to-audio derivative). Educational fair use karaoke - users sing over this instrumental. Mechanical license: MLC ${metadata.licensing.mlcSongCode}.`,
      artist: metadata.artist,
      creatorName: 'KaraokeSchool AI',
      creatorAddress: walletAddress,
      imageUrl: derivativeCoverUri,
      imageHash,
      mediaUrl: segment.instrumentalUri, // Primary media = instrumental (NOT vocals!)
      mediaHash: instrumentalHash,
      tiktokUrl: segment.tiktokUrl || '',
      spotifyUrl: metadata.spotify?.url || '',
      geniusUrl: `https://genius.com/songs/${geniusId}`,
      copyrightType: 'derivative_ai_instrumental',
      mlcData,
      spotifyData: {
        // Do NOT include ISRC - not relevant for instrumental derivatives
        track_id: metadata.spotify?.id,
      },
    });

    // Override mediaType to audio
    ipaMetadata.mediaType = 'audio/wav';

    // Override creators: 100% ownership by KaraokeSchool (NOT 18/82 split!)
    ipaMetadata.creators = [
      {
        name: 'KaraokeSchool AI',
        address: walletAddress,
        contributionPercent: 100,  // We own the derivative instrumental 100%
        role: 'ai_music_generator',
        description: 'AI-generated instrumental derivative using fal.ai audio-to-audio. Mechanical royalties paid separately per statutory rate.',
      },
    ];

    // Add derivative-specific fields
    (ipaMetadata as any).derivative_metadata = {
      type: 'ai_generated_instrumental',
      segment_id: segmentId,
      start_time: segment.startTime,
      end_time: segment.endTime,
      duration: segment.duration,
      primary_media_uri: segment.instrumentalUri,  // What users karaoke over
      vocals_uri: segment.vocalsUri,               // Backup/reference only (not used in app)
      alignment_uri: segment.alignmentUri,         // Word-level timestamps
      use_case: 'educational_karaoke',
      user_interaction: 'Users sing over this AI-generated instrumental (fair use)',
      processing: {
        source_separation: 'Demucs (htdemucs_ft model)',
        ai_enhancement: 'fal.ai audio-to-audio',
        forced_alignment: 'ElevenLabs word-level timestamps',
      },
      ownership: {
        derivative_owner: 'KaraokeSchool',
        ownership_percent: 100,
        mechanical_royalty_obligation: 'Paid separately per statutory rate to MLC publishers',
      },
    };

    console.log('  ✅ Derivative IPA metadata built');

    // Step 8: Upload IPA metadata to Grove
    console.log('\nStep 8: Uploading IPA metadata to Grove...');

    const tempFile = `/tmp/ipa-segment-${segmentId}.json`;
    await writeFile(tempFile, JSON.stringify(ipaMetadata, null, 2));

    const groveResult = await groveService.upload(tempFile, 'application/json');
    const metadataUri = groveResult.gatewayUrl;
    console.log(`  ✅ Metadata URI: ${metadataUri}`);

    // Step 9: Mint derivative IP Asset
    console.log('\nStep 9: Minting derivative IP Asset...');
    const mintResult = await storyService.mintIPAsset({
      metadata: ipaMetadata,
      metadataUri,
      recipient: walletAddress,
      commercialRevShare: 0, // 100% owned by us - mechanical royalties paid separately
      mintingFee: 0,
    });

    console.log('\n✅ Derivative IP Asset Minted!\n');
    console.log('IP Asset Details:');
    console.log(`  IP Asset ID: ${mintResult.ipId}`);
    console.log(`  Transaction: ${mintResult.txHash}`);
    console.log(`  Metadata URI: ${mintResult.metadataUri}`);
    if (mintResult.licenseTermsIds) {
      console.log(`  License Terms: ${mintResult.licenseTermsIds.join(', ')}`);
    }
    if (mintResult.royaltyVault) {
      console.log(`  Royalty Vault: ${mintResult.royaltyVault}`);
    }

    // Step 10: Update segment in metadata file
    console.log('\nStep 10: Updating segment metadata...');
    segment.storyProtocol = {
      ipAssetId: mintResult.ipId,
      txHash: mintResult.txHash,
      metadataUri: mintResult.metadataUri,
      licenseTermsIds: mintResult.licenseTermsIds,
      royaltyVault: mintResult.royaltyVault,
      derivativeCoverUri,
      mintedAt: new Date().toISOString(),
    };

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`  ✅ Updated: ${metadataPath}`);

    console.log('\n🔗 View on Story Protocol:');
    console.log(`  https://aeneid.explorer.story.foundation/ipa/${mintResult.ipId}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message?.includes('insufficient funds')) {
      console.error('💡 Get testnet IP from: https://aeneid.storyscan.io/faucet');
    }
    console.error(error);
    process.exit(1);
  }
}

main();
