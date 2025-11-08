#!/usr/bin/env bun
/**
 * Emit Line Events to Lens Testnet
 *
 * Emits LineRegistered events for all karaoke lines within segment boundaries.
 * Enables line-level FSRS spaced repetition and study cards.
 *
 * Flow:
 * 1. Query karaoke_lines WHERE segment_hash IS NOT NULL (lines inside segments)
 * 2. For each line, emit LineRegistered event with:
 *    - line_id (UUID from DB)
 *    - timing (absolute ms from track start)
 *    - originalText (for display)
 *    - word timing metadata (from DB)
 *
 * Gas Estimate:
 * - LineRegistered: ~40k gas per line
 * - For 20 lines/segment × 37 segments = 740 lines
 * - Total: ~30M gas (~$5-10 on Lens Testnet)
 *
 * Usage:
 *   # Dry run (no contract calls)
 *   bun scripts/contracts/emit-line-events.ts --dry-run
 *
 *   # Test with 1 segment (20 lines)
 *   bun scripts/contracts/emit-line-events.ts --limit=1
 *
 *   # Full batch (all segments)
 *   bun scripts/contracts/emit-line-events.ts
 */

import { ethers } from 'ethers';
import { query } from '../../src/db/neon';

// Contract ABI (generated from Foundry)
import LineEventsABI from '../../../contracts/out/LineEvents.sol/LineEvents.json';

// ============ Configuration ============

const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';
const LENS_TESTNET_CHAIN_ID = 37111;

// Deployed contract address (from deployment output)
const LINE_EVENTS_ADDRESS = '0x8B5DF9CD83b1ED47cc423df7444d0988D3204305';

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.find((arg) => arg.startsWith('--limit='));
const segmentLimit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined;

// ============ Contract Setup ============

let provider: ethers.providers.JsonRpcProvider;
let wallet: ethers.Wallet;
let lineEvents: ethers.Contract;

if (!dryRun) {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  lineEvents = new ethers.Contract(
    LINE_EVENTS_ADDRESS,
    LineEventsABI.abi,
    wallet
  );

  console.log('🔗 Connected to Lens Testnet');
  console.log('📜 LineEvents:', LINE_EVENTS_ADDRESS);
  console.log('👛 Wallet:', wallet.address);
  console.log('');
}

// ============ Database Queries ============

interface KaraokeLine {
  line_id: string;
  spotify_track_id: string;
  line_index: number;
  start_ms: number;
  end_ms: number;
  original_text: string;
  word_count: number;
  words: any[];
  segment_hash: Buffer;
}

interface SegmentWithLines {
  segment_hash: string;
  spotify_track_id: string;
  lines: KaraokeLine[];
}

/**
 * Query all lines within segment boundaries, grouped by segment
 */
async function getSegmentsWithLines(): Promise<SegmentWithLines[]> {
  console.log('📊 Querying karaoke_lines from Neon DB...');

  // Get all lines with segment associations
  // Filter: segment_hash IS NOT NULL (within segment boundaries)
  // Filter: original_text is not empty (valid study cards)
  // Filter: word_count > 0 (has actual words)
  const lines = await query<KaraokeLine>(`
    SELECT
      line_id::text as line_id,
      spotify_track_id,
      line_index,
      start_ms,
      end_ms,
      original_text,
      word_count,
      words,
      segment_hash
    FROM karaoke_lines
    WHERE segment_hash IS NOT NULL
      AND original_text IS NOT NULL
      AND LENGTH(TRIM(original_text)) > 0
      AND word_count > 0
    ORDER BY spotify_track_id, line_index
  `);

  console.log(`   ✓ Found ${lines.length} lines with segment associations`);

  // Group by segment_hash
  const segmentMap = new Map<string, KaraokeLine[]>();

  for (const line of lines) {
    const segmentHashHex = '0x' + line.segment_hash.toString('hex');

    if (!segmentMap.has(segmentHashHex)) {
      segmentMap.set(segmentHashHex, []);
    }

    segmentMap.get(segmentHashHex)!.push(line);
  }

  const segments: SegmentWithLines[] = Array.from(segmentMap.entries()).map(
    ([segmentHash, lines]) => ({
      segment_hash: segmentHash,
      spotify_track_id: lines[0].spotify_track_id,
      lines,
    })
  );

  console.log(`   ✓ Grouped into ${segments.length} segments`);
  console.log('');

  return segmentLimit ? segments.slice(0, segmentLimit) : segments;
}

// ============ Event Emission ============

/**
 * Emit LineRegistered event for a single line
 */
async function emitLineRegistered(
  segmentHash: string,
  line: KaraokeLine,
  dryRun: boolean
): Promise<void> {
  const lineIdBytes32 = ethers.utils.hexZeroPad(
    ethers.utils.hexlify(Buffer.from(line.line_id.replace(/-/g, ''), 'hex')),
    32
  );

  const wordTimingMetadataUri = `ipfs://line-${line.line_id}`;

  if (dryRun) {
    console.log(`   [DRY RUN] LineRegistered:`);
    console.log(`     - lineId: ${lineIdBytes32}`);
    console.log(`     - lineIndex: ${line.line_index}`);
    console.log(`     - text: ${line.original_text.substring(0, 30)}...`);
    console.log(`     - timing: ${line.start_ms}-${line.end_ms}ms`);
    return;
  }

  try {
    const tx = await lineEvents.emitLineRegistered(
      segmentHash,
      lineIdBytes32,
      line.spotify_track_id,
      line.line_index,
      line.start_ms,
      line.end_ms,
      line.original_text,
      line.word_count,
      wordTimingMetadataUri,
      {
        gasLimit: 200000, // Conservative estimate
      }
    );

    console.log(`   ✓ Line ${line.line_index}: ${line.original_text.substring(0, 30)}... (tx: ${tx.hash})`);

    await tx.wait();
  } catch (error: any) {
    console.error(`   ❌ Failed to emit line ${line.line_index}:`, error.message);
    throw error;
  }
}

/**
 * Emit events for all lines in a segment
 */
async function emitSegmentLines(
  segment: SegmentWithLines,
  dryRun: boolean
): Promise<void> {
  console.log(`\n📝 Segment ${segment.segment_hash}`);
  console.log(`   Track: ${segment.spotify_track_id}`);
  console.log(`   Lines: ${segment.lines.length}`);

  for (const line of segment.lines) {
    await emitLineRegistered(segment.segment_hash, line, dryRun);
  }

  console.log(`   ✓ Emitted ${segment.lines.length} line events`);
}

// ============ Main ============

async function main() {
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('  Emit Line Events to Lens Testnet');
  console.log('════════════════════════════════════════════');
  console.log('');

  if (dryRun) {
    console.log('🏃 DRY RUN MODE (no contract calls)');
    console.log('');
  }

  // Step 1: Get segments with lines
  const segments = await getSegmentsWithLines();

  if (segments.length === 0) {
    console.log('⚠️  No segments with lines found');
    return;
  }

  const totalLines = segments.reduce((sum, s) => sum + s.lines.length, 0);

  console.log('📊 Summary:');
  console.log(`   Segments: ${segments.length}`);
  console.log(`   Total lines: ${totalLines}`);
  console.log(`   Avg lines/segment: ${Math.round(totalLines / segments.length)}`);
  console.log('');

  if (!dryRun) {
    const gasEstimate = totalLines * 40000; // 40k gas per line
    const ethEstimate = ethers.utils.formatEther(
      ethers.BigNumber.from(gasEstimate).mul(10) // 10 gwei gas price
    );

    console.log('💰 Gas Estimate:');
    console.log(`   Total gas: ${gasEstimate.toLocaleString()}`);
    console.log(`   Estimated cost: ${ethEstimate} GRASS (at 10 gwei)`);
    console.log('');

    console.log('⚠️  Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('');
  }

  // Step 2: Emit events for each segment
  let successCount = 0;
  let failCount = 0;

  for (const segment of segments) {
    try {
      await emitSegmentLines(segment, dryRun);
      successCount += segment.lines.length;
    } catch (error) {
      console.error(`❌ Failed to emit segment ${segment.segment_hash}`);
      failCount += segment.lines.length;
    }
  }

  // Summary
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('  Emission Complete');
  console.log('════════════════════════════════════════════');
  console.log(`✓ Success: ${successCount} lines`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} lines`);
  }
  console.log('');
  console.log('Next steps:');
  console.log('1. Update subgraph/subgraph.yaml with LineEvents address');
  console.log('2. Update subgraph/schema.graphql with Line entity');
  console.log('3. Update subgraph/src/mappings.ts to handle LineRegistered');
  console.log('4. Deploy subgraph to The Graph');
  console.log('');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
