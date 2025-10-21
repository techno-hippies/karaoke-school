#!/usr/bin/env bun
/**
 * Register Segment on Blockchain
 *
 * Registers a karaoke segment with the SegmentRegistryV1 contract
 * Two-step process:
 *   1. registerSegment: Basic metadata
 *   2. processSegment: Audio assets (Grove URIs)
 *
 * Usage:
 *   bun segments/01-register-segment.ts \
 *     --genius-id 3002580 \
 *     --tiktok-id 7334542274145454891 \
 *     --start-time 0 \
 *     --end-time 60.56 \
 *     --vocals-uri lens://... \
 *     --instrumental-uri lens://... \
 *     [--alignment-uri lens://...] \
 *     [--cover-uri lens://...]
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { parseArgs } from 'util';

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    'genius-id': { type: 'string' },
    'tiktok-id': { type: 'string' },
    'start-time': { type: 'string' },
    'end-time': { type: 'string' },
    'vocals-uri': { type: 'string' },
    'instrumental-uri': { type: 'string' },
    'alignment-uri': { type: 'string' },
    'cover-uri': { type: 'string' },
  },
});

// Validate required args
if (!values['genius-id'] || !values['tiktok-id'] || !values['start-time'] ||
    !values['end-time'] || !values['vocals-uri'] || !values['instrumental-uri']) {
  console.error('❌ Missing required arguments');
  console.error('Usage: bun segments/01-register-segment.ts \\');
  console.error('  --genius-id 3002580 \\');
  console.error('  --tiktok-id 7334542274145454891 \\');
  console.error('  --start-time 0 \\');
  console.error('  --end-time 60.56 \\');
  console.error('  --vocals-uri lens://... \\');
  console.error('  --instrumental-uri lens://...');
  process.exit(1);
}

const geniusId = parseInt(values['genius-id']!);
const tiktokId = values['tiktok-id']!;
const startTime = Math.floor(parseFloat(values['start-time']!));
const endTime = Math.floor(parseFloat(values['end-time']!)); // Floor to stay within 60s max
const vocalsUri = values['vocals-uri']!;
const instrumentalUri = values['instrumental-uri']!;
const alignmentUri = values['alignment-uri'] || '';
const coverUri = values['cover-uri'] || '';

console.log('🎵 Segment Registration\n');
console.log('════════════════════════════════════════════════════════════\n');
console.log(`Genius ID: ${geniusId}`);
console.log(`TikTok ID: ${tiktokId}`);
console.log(`Time Range: ${startTime}s - ${endTime}s (${endTime - startTime}s)`);
console.log(`Vocals: ${vocalsUri}`);
console.log(`Instrumental: ${instrumentalUri}`);
if (alignmentUri) console.log(`Alignment: ${alignmentUri}`);
if (coverUri) console.log(`Cover: ${coverUri}`);
console.log();

// Load contract addresses
const SEGMENT_REGISTRY = process.env.SEGMENT_REGISTRY_ADDRESS;
if (!SEGMENT_REGISTRY) {
  throw new Error('SEGMENT_REGISTRY_ADDRESS not set in .env');
}

// Setup wallet
const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  throw new Error('PRIVATE_KEY not set in .env');
}

// Ensure private key has 0x prefix
const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
const account = privateKeyToAccount(formattedKey as `0x${string}`);

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

// Contract ABI (minimal for registration)
const segmentRegistryAbi = [
  {
    name: 'registerSegment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'tiktokSegmentId', type: 'string' },
      { name: 'startTime', type: 'uint32' },
      { name: 'endTime', type: 'uint32' },
      { name: 'coverUri', type: 'string' },
    ],
    outputs: [{ name: 'segmentHash', type: 'bytes32' }],
  },
  {
    name: 'processSegment',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'segmentHash', type: 'bytes32' },
      { name: 'vocalsUri', type: 'string' },
      { name: 'instrumentalUri', type: 'string' },
      { name: 'alignmentUri', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'getSegmentHash',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'tiktokSegmentId', type: 'string' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'segmentExists',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'segmentHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'getSegment',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'segmentHash', type: 'bytes32' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'geniusId', type: 'uint32' },
          { name: 'tiktokSegmentId', type: 'string' },
          { name: 'startTime', type: 'uint32' },
          { name: 'endTime', type: 'uint32' },
          { name: 'duration', type: 'uint32' },
          { name: 'vocalsUri', type: 'string' },
          { name: 'instrumentalUri', type: 'string' },
          { name: 'alignmentUri', type: 'string' },
          { name: 'coverUri', type: 'string' },
          { name: 'processed', type: 'bool' },
          { name: 'enabled', type: 'bool' },
          { name: 'createdAt', type: 'uint64' },
          { name: 'processedAt', type: 'uint64' },
        ],
      },
    ],
  },
] as const;

async function main() {
  try {
    // Step 1: Check if segment already exists
    console.log('Step 1: Checking if segment exists...');
    const computedHash = await publicClient.readContract({
      address: SEGMENT_REGISTRY as `0x${string}`,
      abi: segmentRegistryAbi,
      functionName: 'getSegmentHash',
      args: [geniusId, tiktokId],
    });

    console.log(`  Segment hash: ${computedHash}`);

    const exists = await publicClient.readContract({
      address: SEGMENT_REGISTRY as `0x${string}`,
      abi: segmentRegistryAbi,
      functionName: 'segmentExists',
      args: [computedHash],
    });

    let segmentHash: `0x${string}`;

    if (exists) {
      console.log('⚠️  Segment already registered, skipping registerSegment()');
      segmentHash = computedHash;
    } else {
      // Step 2: Register segment
      console.log('\nStep 2: Registering segment...');
      console.log(`  Calling registerSegment(${geniusId}, "${tiktokId}", ${startTime}, ${endTime}, "${coverUri}")`);

      const hash = await walletClient.writeContract({
        address: SEGMENT_REGISTRY as `0x${string}`,
        abi: segmentRegistryAbi,
        functionName: 'registerSegment',
        args: [geniusId, tiktokId, startTime, endTime, coverUri],
      });

      console.log(`  Transaction: ${hash}`);
      console.log('  Waiting for confirmation...');

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`  ✓ Confirmed in block ${receipt.blockNumber}`);

      // Get the segment hash
      segmentHash = await publicClient.readContract({
        address: SEGMENT_REGISTRY as `0x${string}`,
        abi: segmentRegistryAbi,
        functionName: 'getSegmentHash',
        args: [geniusId, tiktokId],
      });

      console.log(`  Segment hash: ${segmentHash}`);
    }

    // Step 3: Process segment with audio URIs
    console.log('\nStep 3: Adding audio assets...');
    console.log(`  Calling processSegment("${segmentHash}", ...)`);

    const processHash = await walletClient.writeContract({
      address: SEGMENT_REGISTRY as `0x${string}`,
      abi: segmentRegistryAbi,
      functionName: 'processSegment',
      args: [segmentHash, vocalsUri, instrumentalUri, alignmentUri],
    });

    console.log(`  Transaction: ${processHash}`);
    console.log('  Waiting for confirmation...');

    const processReceipt = await publicClient.waitForTransactionReceipt({
      hash: processHash,
    });
    console.log(`  ✓ Confirmed in block ${processReceipt.blockNumber}`);

    // Step 4: Verify registration
    console.log('\nStep 4: Verifying registration...');
    const segment = await publicClient.readContract({
      address: SEGMENT_REGISTRY as `0x${string}`,
      abi: segmentRegistryAbi,
      functionName: 'getSegment',
      args: [segmentHash],
    });

    console.log('\n✅ Segment registered successfully!\n');
    console.log('Segment details:');
    console.log(`  Hash: ${segmentHash}`);
    console.log(`  Genius ID: ${segment[0]}`);
    console.log(`  TikTok ID: ${segment[1]}`);
    console.log(`  Time: ${segment[2]}s - ${segment[3]}s (${segment[4]}s)`);
    console.log(`  Vocals: ${segment[5]}`);
    console.log(`  Instrumental: ${segment[6]}`);
    console.log(`  Alignment: ${segment[7]}`);
    console.log(`  Cover: ${segment[8]}`);
    console.log(`  Processed: ${segment[9]}`);
    console.log(`  Enabled: ${segment[10]}`);
    console.log();
    console.log(`🔗 Base Sepolia: https://sepolia.basescan.org/address/${SEGMENT_REGISTRY}`);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
