#!/usr/bin/env bun
/**
 * Emit Segment Events to Lens Testnet
 *
 * Uploads karaoke segment data to Grove/IPFS and emits contract events
 * for The Graph subgraph indexing.
 *
 * Flow:
 * 1. Query 37 segments with cropped instrumentals + GRC-20 work IDs
 * 2. Upload 111 translations to Grove (37 segments × 3 languages)
 * 3. Upload 37 alignment JSONs to Grove
 * 4. Upload 37 metadata JSONs to Grove
 * 5. Emit 37 SegmentRegistered events
 * 6. Emit 37 SegmentProcessed events
 * 7. Emit 111 TranslationAdded events
 *
 * Gas Estimate:
 * - SegmentRegistered: 35k × 37 = 1.3M gas
 * - SegmentProcessed: 42k × 37 = 1.6M gas
 * - TranslationAdded: 25k × 111 = 2.8M gas
 * Total: ~5.7M gas (~$1-2 on Lens Testnet)
 *
 * Usage:
 *   # Dry run (no contract calls)
 *   bun scripts/contracts/emit-segment-events.ts --dry-run
 *
 *   # Test with 2 segments
 *   bun scripts/contracts/emit-segment-events.ts --limit=2
 *
 *   # Full batch (37 segments)
 *   bun scripts/contracts/emit-segment-events.ts
 */

import { ethers } from 'ethers';
import { query } from '../../src/db/neon';
import { GroveService } from '../../src/services/grove';
import {
  GET_SEGMENTS_FOR_EMISSION_QUERY,
  validateSegmentData,
  validateSegmentMetadata,
  validateSegmentRegisteredEvent,
  validateSegmentProcessedEvent,
  validateTranslationAddedEvent,
  type SegmentEmissionData,
  type TranslationMetadata,
  type AlignmentMetadata,
} from '../../src/schemas/segment-event-emission';

// Contract ABIs (generated from Foundry)
import SegmentEventsABI from '../../../contracts/out/SegmentEvents.sol/SegmentEvents.json';
import TranslationEventsABI from '../../../contracts/out/TranslationEvents.sol/TranslationEvents.json';

// ============ Configuration ============

const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';
const LENS_TESTNET_CHAIN_ID = 37111;

// Deployed contract addresses (from contracts/README.md)
const SEGMENT_EVENTS_ADDRESS = '0x9Dd47ca83d43cFcec36EFf439A2161498A1ED670';
const TRANSLATION_EVENTS_ADDRESS = '0x4aE979A4f115d734670403e644d83d4C695f9c58'; // Deployed 2025-11-03 (fixed indexed strings)

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// ============ Contract Setup ============

let provider: ethers.providers.JsonRpcProvider;
let wallet: ethers.Wallet;
let segmentEvents: ethers.Contract;
let translationEvents: ethers.Contract;

if (!dryRun) {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required (use dotenvx)');
    process.exit(1);
  }

  provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  segmentEvents = new ethers.Contract(
    SEGMENT_EVENTS_ADDRESS,
    SegmentEventsABI.abi,
    wallet
  );

  // Only initialize if deployed
  if (TRANSLATION_EVENTS_ADDRESS !== '0x0000000000000000000000000000000000000000') {
    translationEvents = new ethers.Contract(
      TRANSLATION_EVENTS_ADDRESS,
      TranslationEventsABI.abi,
      wallet
    );
  }
}

// ============ Grove Service ============

const groveService = new GroveService(LENS_TESTNET_CHAIN_ID);

// ============ Helper Functions ============

/**
 * Generate segment hash (keccak256 of spotify_track_id + start_ms)
 */
function generateSegmentHash(spotifyTrackId: string, startMs: number): string {
  return ethers.utils.solidityKeccak256(
    ['string', 'uint32'],
    [spotifyTrackId, startMs]
  );
}

/**
 * Upload translation to Grove and update DB
 */
async function uploadTranslation(
  spotifyTrackId: string,
  languageCode: string,
  translationData: TranslationMetadata
): Promise<string> {
  console.log(`    📤 Uploading ${languageCode} translation to Grove...`);

  const jsonBuffer = Buffer.from(JSON.stringify(translationData, null, 2));
  const base64 = jsonBuffer.toString('base64');

  const result = await groveService.uploadAudio(
    base64,
    `${spotifyTrackId}-${languageCode}.json`,
    'instrumental'
  );

  console.log(`       ✅ Uploaded: ${result.cid}`);

  // Update DB with grove_url
  await query(
    `UPDATE lyrics_translations
     SET grove_url = $1, updated_at = NOW()
     WHERE spotify_track_id = $2 AND language_code = $3`,
    [result.url, spotifyTrackId, languageCode]
  );

  console.log(`       ✅ DB updated with Grove URL`);

  return result.url;
}

/**
 * Upload alignment to Grove
 */
async function uploadAlignment(
  spotifyTrackId: string,
  alignmentData: AlignmentMetadata
): Promise<string> {
  console.log(`    📤 Uploading alignment to Grove...`);

  const jsonBuffer = Buffer.from(JSON.stringify(alignmentData, null, 2));
  const base64 = jsonBuffer.toString('base64');

  const result = await groveService.uploadAudio(
    base64,
    `${spotifyTrackId}-alignment.json`,
    'instrumental'
  );

  console.log(`       ✅ Uploaded: ${result.cid}`);

  return result.url;
}

/**
 * Upload segment metadata to Grove
 */
async function uploadMetadata(
  spotifyTrackId: string,
  metadataData: any
): Promise<string> {
  console.log(`    📤 Uploading segment metadata to Grove...`);

  const jsonBuffer = Buffer.from(JSON.stringify(metadataData, null, 2));
  const base64 = jsonBuffer.toString('base64');

  const result = await groveService.uploadAudio(
    base64,
    `${spotifyTrackId}-metadata.json`,
    'instrumental'
  );

  console.log(`       ✅ Uploaded: ${result.cid}`);

  return result.url;
}

/**
 * Process a single segment
 */
async function processSegment(
  segment: SegmentEmissionData,
  index: number,
  total: number
): Promise<{ success: boolean; error?: string }> {
  console.log('');
  console.log(`${'='.repeat(80)}`);
  console.log(`[${index + 1}/${total}] ${segment.spotify_track_id}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // 1. Generate segment hash
    const segmentHash = generateSegmentHash(
      segment.spotify_track_id,
      segment.optimal_segment_start_ms
    );
    console.log(`  🔑 Segment Hash: ${segmentHash}`);
    console.log(`  🎵 GRC-20 Work: ${segment.grc20_work_id}`);
    console.log(`  ⏱️  Timing: ${segment.optimal_segment_start_ms}ms - ${segment.optimal_segment_end_ms}ms`);
    console.log(`  🌍 Translations: ${segment.translations.length} languages`);

    // 2. Upload translations to Grove (update DB)
    console.log('');
    console.log(`  📦 Step 1: Upload Translations to Grove`);

    const uploadedTranslations: Array<{
      language_code: string;
      grove_url: string;
      confidence_score: number;
      translation_source: string;
    }> = [];

    for (const translation of segment.translations) {
      // Skip if already uploaded
      if (translation.grove_url) {
        console.log(`    ✅ ${translation.language_code} already on Grove: ${translation.grove_url}`);
        uploadedTranslations.push({
          language_code: translation.language_code,
          grove_url: translation.grove_url,
          confidence_score: translation.confidence_score || 1.0,
          translation_source: translation.translation_source,
        });
        continue;
      }

      const translationMetadata: TranslationMetadata = {
        spotify_track_id: segment.spotify_track_id,
        language_code: translation.language_code,
        translation_source: translation.translation_source,
        confidence_score: translation.confidence_score || 1.0,
        lines: translation.lines,
      };

      if (dryRun) {
        console.log(`    [DRY RUN] Would upload ${translation.language_code} translation`);
        uploadedTranslations.push({
          language_code: translation.language_code,
          grove_url: 'https://api.grove.storage/dry-run-translation',
          confidence_score: translation.confidence_score || 1.0,
          translation_source: translation.translation_source,
        });
      } else {
        const groveUrl = await uploadTranslation(
          segment.spotify_track_id,
          translation.language_code,
          translationMetadata
        );

        uploadedTranslations.push({
          language_code: translation.language_code,
          grove_url: groveUrl,
          confidence_score: translation.confidence_score || 1.0,
          translation_source: translation.translation_source,
        });
      }
    }

    // 3. Upload alignment to Grove
    console.log('');
    console.log(`  📦 Step 2: Upload Alignment to Grove`);

    const alignmentMetadata: AlignmentMetadata = {
      spotify_track_id: segment.spotify_track_id,
      total_words: segment.alignment_words.length,
      words: segment.alignment_words,
    };

    const alignmentUri = dryRun
      ? 'https://api.grove.storage/dry-run-alignment'
      : await uploadAlignment(segment.spotify_track_id, alignmentMetadata);

    // 4. Build and upload segment metadata
    console.log('');
    console.log(`  📦 Step 3: Upload Segment Metadata to Grove`);

    // Calculate cropped duration from clip boundaries
    const clipDurationMs = segment.clip_end_ms - segment.clip_start_ms;

    const metadata = {
      // Segment identification
      segment_hash: segmentHash,
      grc20_work_id: segment.grc20_work_id,
      spotify_track_id: segment.spotify_track_id,

      // Song metadata (from GRC-20 work)
      title: segment.title,
      artist: segment.artist_name,

      // Timing information (robust with all references)
      timing: {
        // Original segment timing (for reference)
        original_segment_start_ms: segment.optimal_segment_start_ms,
        original_segment_end_ms: segment.optimal_segment_end_ms,
        original_duration_ms: segment.optimal_segment_end_ms - segment.optimal_segment_start_ms,

        // TikTok clip timing (within original segment)
        tiktok_clip_start_ms: segment.clip_start_ms,
        tiktok_clip_end_ms: segment.clip_end_ms,

        // Actual playback duration (for UI/player)
        cropped_duration_ms: clipDurationMs,
      },

      // Assets (all point to Grove/IPFS)
      assets: {
        instrumental: segment.cropped_instrumental_grove_url,
        alignment: alignmentUri,
      },

      // Translations (multi-language support)
      translations: uploadedTranslations,
    };

    // Validate metadata
    const metadataValidation = validateSegmentMetadata(metadata);
    if (!metadataValidation.success) {
      console.error('❌ Metadata validation failed:');
      console.error(metadataValidation.error?.flatten());
      return { success: false, error: 'Metadata validation failed' };
    }

    const metadataUri = dryRun
      ? 'https://api.grove.storage/dry-run-metadata'
      : await uploadMetadata(segment.spotify_track_id, metadataValidation.metadata);

    // 5. Emit SegmentRegistered event
    console.log('');
    console.log(`  ⛓️  Step 4: Emit SegmentRegistered Event`);

    const registeredEventData = {
      segment_hash: segmentHash,
      grc20_work_id: segment.grc20_work_id,
      spotify_track_id: segment.spotify_track_id,
      segment_start_ms: segment.optimal_segment_start_ms,
      segment_end_ms: segment.optimal_segment_end_ms,
      metadata_uri: metadataUri,
    };

    const eventValidation1 = validateSegmentRegisteredEvent(registeredEventData);
    if (!eventValidation1.success) {
      console.error('❌ SegmentRegistered event validation failed:');
      console.error(eventValidation1.error?.flatten());
      return { success: false, error: 'Event validation failed' };
    }

    if (dryRun) {
      console.log('    [DRY RUN] Would emit SegmentRegistered event');
      console.log(`       Hash: ${segmentHash}`);
      console.log(`       Work: ${segment.grc20_work_id}`);
    } else {
      const tx1 = await segmentEvents.emitSegmentRegistered(
        segmentHash,
        segment.grc20_work_id,
        segment.spotify_track_id,
        segment.optimal_segment_start_ms,
        segment.optimal_segment_end_ms,
        metadataUri
      );
      console.log(`    ⏳ Transaction submitted: ${tx1.hash}`);
      const receipt1 = await tx1.wait();
      console.log(`    ✅ Confirmed in block ${receipt1.blockNumber} (gas: ${receipt1.gasUsed.toString()})`);
    }

    // 6. Emit SegmentProcessed event
    console.log('');
    console.log(`  ⛓️  Step 5: Emit SegmentProcessed Event`);

    const processedEventData = {
      segment_hash: segmentHash,
      instrumental_uri: segment.cropped_instrumental_grove_url,
      alignment_uri: alignmentUri,
      translation_count: uploadedTranslations.length,
      metadata_uri: metadataUri,
    };

    const eventValidation2 = validateSegmentProcessedEvent(processedEventData);
    if (!eventValidation2.success) {
      console.error('❌ SegmentProcessed event validation failed:');
      console.error(eventValidation2.error?.flatten());
      return { success: false, error: 'Event validation failed' };
    }

    if (dryRun) {
      console.log('    [DRY RUN] Would emit SegmentProcessed event');
      console.log(`       Instrumental: ${segment.cropped_instrumental_grove_url}`);
      console.log(`       Alignment: ${alignmentUri}`);
      console.log(`       Translation Count: ${uploadedTranslations.length}`);
    } else {
      const tx2 = await segmentEvents.emitSegmentProcessed(
        segmentHash,
        segment.cropped_instrumental_grove_url,
        alignmentUri,
        uploadedTranslations.length,
        metadataUri
      );
      console.log(`    ⏳ Transaction submitted: ${tx2.hash}`);
      const receipt2 = await tx2.wait();
      console.log(`    ✅ Confirmed in block ${receipt2.blockNumber} (gas: ${receipt2.gasUsed.toString()})`);
    }

    // 7. Emit TranslationAdded events
    console.log('');
    console.log(`  ⛓️  Step 6: Emit TranslationAdded Events (${uploadedTranslations.length})`);

    if (!translationEvents && !dryRun) {
      console.warn('    ⚠️  TranslationEvents contract not deployed, skipping...');
    } else {
      for (const translation of uploadedTranslations) {
        const translationEventData = {
          segment_hash: segmentHash,
          language_code: translation.language_code,
          translation_uri: translation.grove_url,
          translation_source: translation.translation_source,
          confidence_score: Math.floor(translation.confidence_score * 10000), // Convert to basis points
          validated: false,
        };

        const eventValidation3 = validateTranslationAddedEvent(translationEventData);
        if (!eventValidation3.success) {
          console.error(`❌ TranslationAdded (${translation.language_code}) validation failed:`);
          console.error(eventValidation3.error?.flatten());
          continue;
        }

        if (dryRun) {
          console.log(`    [DRY RUN] Would emit TranslationAdded (${translation.language_code})`);
        } else {
          const tx3 = await translationEvents.emitTranslationAdded(
            segmentHash,
            translation.language_code,
            translation.grove_url,
            translation.translation_source,
            Math.floor(translation.confidence_score * 10000),
            false // not validated
          );
          console.log(`    ⏳ ${translation.language_code}: ${tx3.hash}`);
          const receipt3 = await tx3.wait();
          console.log(`    ✅ ${translation.language_code}: Block ${receipt3.blockNumber} (gas: ${receipt3.gasUsed.toString()})`);
        }
      }
    }

    console.log('');
    console.log(`  ✅ Segment ${segment.spotify_track_id} completed successfully!`);
    return { success: true };
  } catch (error: any) {
    console.error('');
    console.error(`  ❌ Error processing segment: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ============ Main Function ============

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Emit Segment Events to Lens Testnet                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log('');

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No contract calls will be made');
    console.log('');
  }

  // Check wallet balance
  if (!dryRun) {
    const balance = await wallet.getBalance();
    const balanceEth = ethers.utils.formatEther(balance);
    console.log(`💰 Wallet: ${wallet.address}`);
    console.log(`💰 Balance: ${balanceEth} ETH`);
    console.log('');

    if (balance.lt(ethers.utils.parseEther('0.01'))) {
      console.warn('⚠️  Low balance! May not have enough gas for all transactions.');
      console.log('');
    }
  }

  // 1. Query segments from database
  console.log('⏳ Querying segments from database...');

  let segments = await query<SegmentEmissionData>(GET_SEGMENTS_FOR_EMISSION_QUERY);

  if (limit) {
    segments = segments.slice(0, limit);
    console.log(`   Limiting to ${limit} segments for testing`);
  }

  console.log(`✅ Found ${segments.length} segments ready for emission`);
  console.log('');

  if (segments.length === 0) {
    console.log('🎉 No segments need event emission!');
    return;
  }

  // 2. Validate all segments first
  console.log('🔍 Validating all segments...');

  const validSegments: SegmentEmissionData[] = [];
  const invalidSegments: Array<{ id: string; errors: string[] }> = [];

  for (const segmentData of segments) {
    const validation = validateSegmentData(segmentData);

    if (validation.success && validation.segment) {
      validSegments.push(validation.segment);
    } else {
      invalidSegments.push({
        id: segmentData.spotify_track_id,
        errors: validation.missingFields || ['Unknown validation error'],
      });
    }
  }

  console.log(`✅ Valid: ${validSegments.length}`);
  if (invalidSegments.length > 0) {
    console.log(`❌ Invalid: ${invalidSegments.length}`);
    console.log('');
    console.log('Invalid segments:');
    for (const invalid of invalidSegments) {
      console.log(`  - ${invalid.id}: ${invalid.errors.join(', ')}`);
    }
    console.log('');
  }

  if (validSegments.length === 0) {
    console.error('❌ No valid segments to process!');
    process.exit(1);
  }

  // 3. Process segments
  console.log('🚀 Processing segments...');
  console.log('');

  let successCount = 0;
  let failCount = 0;
  const errors: Array<{ id: string; error: string }> = [];

  for (let i = 0; i < validSegments.length; i++) {
    const segment = validSegments[i];
    const result = await processSegment(segment, i, validSegments.length);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      errors.push({ id: segment.spotify_track_id, error: result.error || 'Unknown error' });
    }

    // Rate limit: 2 seconds between segments
    if (i < validSegments.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // 4. Summary
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Summary                                                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');
  console.log(`   Total segments: ${validSegments.length}`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('');

  if (failCount > 0) {
    console.log('Failed segments:');
    for (const error of errors) {
      console.log(`  - ${error.id}: ${error.error}`);
    }
    console.log('');
  }

  if (successCount === validSegments.length) {
    console.log('🎉 All segments processed successfully!');
  } else if (successCount > 0) {
    console.log('⚠️  Some segments failed. Review errors above.');
  } else {
    console.log('❌ All segments failed. Check errors above.');
  }

  console.log('');
}

main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
