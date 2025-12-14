#!/usr/bin/env bun
/**
 * Disable Exercises Script
 *
 * Disables exercises on-chain by calling toggleQuestion(questionId, false)
 * Used to remove bad/legacy exercises that have incorrect data.
 *
 * Usage:
 *   bun src/scripts/disable-exercises.ts --spotify-id=5Z01UMMf7V1o0MzF86s6WJ
 *   bun src/scripts/disable-exercises.ts --question-ids=0x123,0x456
 *   bun src/scripts/disable-exercises.ts --spotify-id=5Z01UMMf7V1o0MzF86s6WJ --dry-run
 */

import { parseArgs } from 'util';
import { ethers } from 'ethers';
import { validateEnv } from '../config';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'spotify-id': { type: 'string' },
    'question-ids': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

// Contract config
const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
const RPC_URL = 'https://rpc.testnet.lens.xyz';
const SUBGRAPH_URL = 'https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v6-json-localizations';

const EXERCISE_EVENTS_ABI = [
  'function toggleQuestion(bytes32 questionId, bool enabled) external',
  'function owner() view returns (address)',
];

async function fetchExercisesBySpotifyId(spotifyTrackId: string): Promise<string[]> {
  const query = `{
    exerciseCards(where: {spotifyTrackId: "${spotifyTrackId}", enabled: true}) {
      questionId
      metadataUri
    }
  }`;

  const response = await fetch(SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  return data.data.exerciseCards.map((e: { questionId: string }) => e.questionId);
}

async function main() {
  validateEnv(['PRIVATE_KEY']);

  const dryRun = values['dry-run'];
  let questionIds: string[] = [];

  if (values['spotify-id']) {
    console.log(`\n🔍 Fetching exercises for Spotify ID: ${values['spotify-id']}`);
    questionIds = await fetchExercisesBySpotifyId(values['spotify-id']);
  } else if (values['question-ids']) {
    questionIds = values['question-ids'].split(',').map(id => id.trim());
  } else {
    console.error('Usage: bun src/scripts/disable-exercises.ts --spotify-id=XXX');
    console.error('       bun src/scripts/disable-exercises.ts --question-ids=0x123,0x456');
    process.exit(1);
  }

  if (questionIds.length === 0) {
    console.log('No exercises found to disable');
    return;
  }

  console.log(`\n📋 Found ${questionIds.length} exercises to disable:`);
  questionIds.forEach((id, i) => console.log(`   ${i + 1}. ${id}`));

  if (dryRun) {
    console.log('\n[DRY RUN] Would disable these exercises');
    return;
  }

  // Connect to Lens testnet
  console.log('\n🔗 Connecting to Lens testnet...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(EXERCISE_EVENTS_ADDRESS, EXERCISE_EVENTS_ABI, wallet);

  console.log(`   Wallet: ${wallet.address}`);
  console.log(`   Contract: ${EXERCISE_EVENTS_ADDRESS}`);

  // Verify ownership
  const owner = await contract.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`\n❌ Wallet ${wallet.address} is not the contract owner (${owner})`);
    process.exit(1);
  }
  console.log('   ✅ Wallet is contract owner');

  // Disable each exercise
  let disabled = 0;
  let failed = 0;

  for (const questionId of questionIds) {
    try {
      console.log(`\n🚫 Disabling ${questionId.substring(0, 20)}...`);
      const tx = await contract.toggleQuestion(questionId, false);
      console.log(`   Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   ✅ Confirmed in block ${receipt.blockNumber}`);
      disabled++;
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 Summary');
  console.log(`   Disabled: ${disabled}`);
  console.log(`   Failed: ${failed}`);

  if (disabled > 0) {
    console.log('\n✅ Exercises disabled successfully');
    console.log('   The subgraph will update shortly');
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
