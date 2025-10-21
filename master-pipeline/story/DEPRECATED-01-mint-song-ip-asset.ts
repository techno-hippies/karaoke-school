#!/usr/bin/env bun
/**
 * Mint Story Protocol IP Asset
 *
 * Creates IP Asset with Commercial Remix licensing terms
 * Requires complete metadata with MLC data
 *
 * Prerequisites:
 * - Song registered with metadata
 * - MLC data with ≥98% publisher shares
 * - PRIVATE_KEY in .env
 * - STORY_SPG_NFT_CONTRACT (or will create one)
 *
 * Usage:
 *   bun story/01-mint-ip-asset.ts --genius-id 10047250
 */

import { parseArgs } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { Address, zeroAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import path from 'path';

const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'create-collection': { type: 'boolean' },
  },
});

if (!values['genius-id']) {
  console.error('❌ Missing required argument: --genius-id');
  console.error('Usage: bun story/01-mint-ip-asset.ts --genius-id 10047250');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);

console.log('🎨 Story Protocol IP Asset Minter\n');
console.log('════════════════════════════════════════════════════════════\n');

const privateKey = process.env.PRIVATE_KEY;
const spgNftContract = process.env.STORY_SPG_NFT_CONTRACT as Address | undefined;
const safeWallet = process.env.SAFE_MULTISIG_ADDRESS as Address | undefined;

if (!privateKey) {
  console.error('❌ PRIVATE_KEY not set in .env');
  process.exit(1);
}

// Derive wallet address from private key
const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
const account = privateKeyToAccount(formattedKey as `0x${string}`);
const walletAddress = account.address;

async function main() {
  try {
    // Step 1: Load metadata
    console.log('Step 1: Loading metadata...');
    const metadataPath = path.join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);
    const metadataRaw = await readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataRaw);

    console.log(`  Title: ${metadata.title}`);
    console.log(`  Artist: ${metadata.artist}`);

    // Step 2: Validate MLC data (strict requirement)
    console.log('\nStep 2: Validating licensing data...');

    // Check if licensing data exists
    if (!metadata.licensing) {
      console.error('❌ FAILED: No licensing data found');
      console.error('');
      console.error('MLC licensing data is REQUIRED to mint Story Protocol IP Assets.');
      console.error('');
      console.error('Fix: Run the MLC data fetching step:');
      console.error(`  bun songs/02-fetch-mlc-data.ts --genius-id ${geniusId}`);
      console.error('');
      process.exit(1);
    }

    // Check required MLC fields
    const requiredFields = ['isrc', 'mlcSongCode', 'iswc', 'writers', 'publishers', 'totalPublisherShare'];
    const missingFields = requiredFields.filter(field => !metadata.licensing[field]);

    if (missingFields.length > 0) {
      console.error('❌ FAILED: Incomplete MLC data');
      console.error('');
      console.error(`Missing required fields: ${missingFields.join(', ')}`);
      console.error('');
      console.error('MLC data must include ISRC, MLC Song Code, ISWC, writers, publishers, and total publisher share.');
      console.error('');
      console.error('Fix: Re-run the MLC data fetching step:');
      console.error(`  bun songs/02-fetch-mlc-data.ts --genius-id ${geniusId}`);
      console.error('');
      process.exit(1);
    }

    // Check Story Protocol eligibility (≥98% publisher shares)
    if (!metadata.licensing.storyMintable) {
      console.error('❌ FAILED: Not Story Protocol eligible');
      console.error('');
      console.error(`Publisher shares: ${metadata.licensing.totalPublisherShare}% (need ≥98%)`);
      console.error('');
      console.error('This song does not meet Story Protocol\'s licensing requirements.');
      console.error('Songs must have ≥98% publisher share coverage in the MLC database.');
      console.error('');
      process.exit(1);
    }

    console.log(`  ✅ Story-mintable`);
    console.log(`  ISRC: ${metadata.licensing.isrc}`);
    console.log(`  MLC Song Code: ${metadata.licensing.mlcSongCode}`);
    console.log(`  Writers: ${metadata.licensing.writers.length}`);
    console.log(`  Publishers: ${metadata.licensing.publishers.length}`);
    console.log(`  Total Publisher Share: ${metadata.licensing.totalPublisherShare}%`);

    // Step 3: Create Story Protocol service
    console.log('\nStep 3: Connecting to Story Protocol...');
    const { StoryProtocolService } = await import('../services/StoryProtocolService.js');

    let currentSpgContract = spgNftContract;

    // Create NFT collection if needed
    if (!currentSpgContract || values['create-collection']) {
      console.log('\nStep 3.1: Creating NFT collection...');
      const service = new StoryProtocolService({
        privateKey,
        safeWallet,
      });

      currentSpgContract = await service.createNFTCollection(
        'KaraokeSchool Covers',
        'KSCOVER',
        100000
      );

      console.log(`\n⚠️  Add to your .env:`);
      console.log(`  STORY_SPG_NFT_CONTRACT="${currentSpgContract}"\n`);

      // Wait for transaction
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log(`  Using existing NFT collection: ${currentSpgContract}`);
    }

    // Recreate service with SPG contract
    const storyService = new StoryProtocolService({
      privateKey,
      spgNftContract: currentSpgContract,
      safeWallet,
    });

    // Step 4: Build IPA metadata
    console.log('\nStep 4: Building IPA metadata...');

    // Hash media files
    console.log('  Hashing cover image...');
    const imageHash = await storyService.hashUrl(metadata.coverUri);

    // For mediaUrl, use first segment's vocals if available, else cover
    const mediaUrl = metadata.segments?.[0]?.vocalsUri || metadata.coverUri;
    console.log('  Hashing media...');
    const mediaHash = await storyService.hashUrl(mediaUrl);

    // Transform metadata.licensing to match expected format
    const mlcData = {
      songCode: metadata.licensing.mlcSongCode, // Map mlcSongCode -> songCode
      title: metadata.title,
      iswc: metadata.licensing.iswc,
      totalPublisherShare: metadata.licensing.totalPublisherShare,
      writers: metadata.licensing.writers,
      publishers: metadata.licensing.publishers,
    };

    const ipaMetadata = StoryProtocolService.buildSongMetadata({
      title: `${metadata.title} - ${metadata.artist}`,
      description: `Licensed karaoke track from ${metadata.artist}.`,
      artist: metadata.artist,
      creatorName: 'KaraokeSchool',
      creatorAddress: walletAddress, // Wallet owns the IP asset
      imageUrl: metadata.coverUri,
      imageHash,
      mediaUrl,
      mediaHash,
      tiktokUrl: '', // Not applicable for songs
      spotifyUrl: metadata.spotify?.url || '',
      geniusUrl: `https://genius.com/songs/${geniusId}`,
      copyrightType: 'licensed',
      mlcData,
      spotifyData: {
        isrc: metadata.licensing.isrc,
        track_id: metadata.spotify?.id,
      },
    });

    console.log('  ✅ IPA metadata built');

    // Step 5: Upload IPA metadata to Grove
    console.log('\nStep 5: Uploading IPA metadata to Grove...');
    const { GroveService } = await import('../services/grove.js');
    const groveService = new GroveService();

    const tempFile = `/tmp/ipa-${geniusId}.json`;
    await writeFile(tempFile, JSON.stringify(ipaMetadata, null, 2));

    const groveResult = await groveService.upload(tempFile, 'application/json');
    const metadataUri = groveResult.gatewayUrl; // Story Protocol needs HTTP URL
    console.log(`  ✅ Metadata URI: ${metadataUri}`);

    // Step 6: Mint IP Asset
    console.log('\nStep 6: Minting IP Asset...');
    const mintResult = await storyService.mintIPAsset({
      metadata: ipaMetadata,
      metadataUri,
      recipient: walletAddress, // Mint to wallet (can transfer later)
      commercialRevShare: 18,
      mintingFee: 0,
    });

    console.log('\n✅ IP Asset Minted!\n');
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

    // Step 7: Save to metadata file
    console.log('\nStep 7: Updating metadata file...');
    metadata.storyProtocol = {
      ipAssetId: mintResult.ipId,
      txHash: mintResult.txHash,
      metadataUri: mintResult.metadataUri,
      licenseTermsIds: mintResult.licenseTermsIds,
      royaltyVault: mintResult.royaltyVault,
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
