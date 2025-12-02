#!/usr/bin/env bun
/**
 * Emit Exercises Script
 *
 * Emits exercise events (translation, trivia) to ExerciseEvents contract.
 *
 * Usage:
 *   bun src/scripts/emit-exercises.ts --iswc=T0112199333
 *   bun src/scripts/emit-exercises.ts --iswc=T0112199333 --type=trivia
 *   bun src/scripts/emit-exercises.ts --iswc=T0112199333 --limit=5
 *   bun src/scripts/emit-exercises.ts --iswc=T0112199333 --dry-run
 */

import { parseArgs } from 'util';
import { ethers } from 'ethers';
import { query, queryOne } from '../db/connection';
import { normalizeISWC } from '../lib/lyrics-parser';
import { validateEnv } from '../config';
import { uploadMetadataToGrove } from '../services/grove';

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    iswc: { type: 'string' },
    type: { type: 'string' }, // 'translation', 'trivia', or 'all' (default)
    limit: { type: 'string', default: '100' },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

// Contract config
const EXERCISE_EVENTS_ADDRESS = '0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832';
const RPC_URL = 'https://rpc.testnet.lens.xyz';

const EXERCISE_EVENTS_ABI = [
  'function emitTranslationQuestionRegistered(bytes32 questionId, bytes32 lineId, bytes32 segmentHash, string spotifyTrackId, uint16 lineIndex, string languageCode, string metadataUri, uint16 distractorPoolSize) external',
  'function emitTriviaQuestionRegistered(bytes32 questionId, string spotifyTrackId, string languageCode, string metadataUri, uint16 distractorPoolSize) external',
];

interface ExerciseData {
  id: string;
  song_id: string;
  spotify_track_id: string;
  exercise_type: string;
  language_code: string;
  question_data: {
    prompt: string;
    correct_answer: string;
    distractors: string[];
    explanation: string;
  };
  lyric_id: string | null;
  line_index: number;
  clip_id: string | null;
  clip_start_ms: number | null;
  emitted_at: string | null;
}

function uuidToBytes32(uuid: string): string {
  // Remove dashes and convert to bytes32
  const hex = uuid.replace(/-/g, '');
  return '0x' + hex.padStart(64, '0');
}

async function main() {
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  if (!values.iswc) {
    console.error('Usage: bun src/scripts/emit-exercises.ts --iswc=T0112199333');
    console.error('       bun src/scripts/emit-exercises.ts --iswc=T0112199333 --type=trivia');
    process.exit(1);
  }

  const iswc = normalizeISWC(values.iswc);
  const exerciseType = values.type || 'all'; // 'translation', 'trivia', or 'all'
  const limit = parseInt(values.limit!);
  const dryRun = values['dry-run'];

  console.log('\n📤 Emitting Exercises');
  console.log(`   ISWC: ${iswc}`);
  console.log(`   Type: ${exerciseType}`);
  console.log(`   Limit: ${limit}`);
  if (dryRun) console.log('   Mode: DRY RUN');

  // Build type filter
  const supportedTypes = ['translation', 'trivia'];
  let typeFilter: string;
  if (exerciseType === 'all') {
    typeFilter = `e.exercise_type IN ('translation', 'trivia')`;
  } else if (supportedTypes.includes(exerciseType)) {
    typeFilter = `e.exercise_type = '${exerciseType}'`;
  } else {
    console.error(`❌ Unsupported exercise type: ${exerciseType}`);
    console.error(`   Supported types: ${supportedTypes.join(', ')}, all`);
    process.exit(1);
  }

  // Get exercises that haven't been emitted yet
  const exercises = await query<ExerciseData>(`
    SELECT
      e.id, e.song_id, s.spotify_track_id, e.exercise_type, e.language_code,
      e.question_data, e.lyric_id, l.line_index, e.clip_id, c.start_ms as clip_start_ms,
      e.emitted_at
    FROM exercises e
    JOIN songs s ON e.song_id = s.id
    LEFT JOIN lyrics l ON e.lyric_id = l.id
    LEFT JOIN clips c ON e.clip_id = c.id
    WHERE s.iswc = $1
      AND ${typeFilter}
      AND e.emitted_at IS NULL
    ORDER BY e.created_at
    LIMIT $2
  `, [iswc, limit]);

  if (exercises.length === 0) {
    console.log('\n✅ No exercises to emit');
    return;
  }

  // Count by type
  const byType = exercises.reduce((acc, e) => {
    acc[e.exercise_type] = (acc[e.exercise_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n📋 Found ${exercises.length} exercises to emit`);
  for (const [type, count] of Object.entries(byType)) {
    console.log(`   ${type}: ${count}`);
  }

  // Connect to Lens testnet
  console.log('\n🔗 Connecting to Lens testnet...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  const contract = new ethers.Contract(EXERCISE_EVENTS_ADDRESS, EXERCISE_EVENTS_ABI, wallet);

  console.log(`   Wallet: ${wallet.address}`);
  console.log(`   Contract: ${EXERCISE_EVENTS_ADDRESS}`);

  let emitted = 0;
  let failed = 0;

  for (const exercise of exercises) {
    try {
      console.log(`\n📝 Exercise ${emitted + 1}/${exercises.length}`);
      console.log(`   ID: ${exercise.id}`);
      console.log(`   Type: ${exercise.exercise_type}`);
      console.log(`   Prompt: ${exercise.question_data.prompt.substring(0, 50)}...`);

      // Prepare metadata for Grove (use distractorPool for app compatibility)
      const metadata = {
        questionId: exercise.id,
        exerciseType: exercise.exercise_type,
        languageCode: exercise.language_code,
        prompt: exercise.question_data.prompt,
        correctAnswer: exercise.question_data.correct_answer,
        distractorPool: exercise.question_data.distractors, // App expects distractorPool
        explanation: exercise.question_data.explanation,
        spotifyTrackId: exercise.spotify_track_id,
        lineIndex: exercise.line_index,
        createdAt: new Date().toISOString(),
      };

      if (dryRun) {
        console.log('   [DRY RUN] Would upload metadata and emit event');
        emitted++;
        continue;
      }

      // Upload metadata to Grove (use HTTPS URL, not grove:// protocol)
      console.log('   Uploading metadata to Grove...');
      const result = await uploadMetadataToGrove(metadata, `exercise-${exercise.id}.json`);
      const metadataUri = result.url; // Use .url not .uri - browsers can't fetch grove://
      console.log(`   Metadata URI: ${metadataUri}`);

      // Update DB with metadata URI
      await query(
        `UPDATE exercises SET metadata_uri = $1 WHERE id = $2`,
        [metadataUri, exercise.id]
      );

      // Prepare contract params
      const questionId = uuidToBytes32(exercise.id);
      const distractorPoolSize = exercise.question_data.distractors.length + 1; // +1 for correct answer

      let tx;
      if (exercise.exercise_type === 'trivia') {
        // Trivia questions are song-level (no line/segment reference)
        console.log('   Emitting TriviaQuestionRegistered...');
        tx = await contract.emitTriviaQuestionRegistered(
          questionId,
          exercise.spotify_track_id,
          exercise.language_code,
          metadataUri,
          distractorPoolSize
        );
      } else {
        // Translation questions are linked to specific lines
        const lineId = exercise.lyric_id ? uuidToBytes32(exercise.lyric_id) : ethers.ZeroHash;

        // Calculate segment hash (use clip start if available, otherwise 0)
        const clipStartMs = exercise.clip_start_ms || 0;
        const segmentHash = ethers.keccak256(
          ethers.AbiCoder.defaultAbiCoder().encode(
            ['string', 'uint32'],
            [exercise.spotify_track_id, clipStartMs]
          )
        );

        const lineIndex = exercise.line_index || 0;

        console.log('   Emitting TranslationQuestionRegistered...');
        tx = await contract.emitTranslationQuestionRegistered(
          questionId,
          lineId,
          segmentHash,
          exercise.spotify_track_id,
          lineIndex,
          exercise.language_code,
          metadataUri,
          distractorPoolSize
        );
      }

      console.log(`   Transaction: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`   Confirmed in block ${receipt.blockNumber}`);

      // Update database
      await query(
        `UPDATE exercises SET emitted_at = NOW(), transaction_hash = $1 WHERE id = $2`,
        [tx.hash, exercise.id]
      );

      emitted++;
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log('\n📊 Summary');
  console.log(`   Emitted: ${emitted}`);
  console.log(`   Failed: ${failed}`);

  if (emitted > 0 && !dryRun) {
    console.log(`\n✅ Exercises emitted successfully`);
  }
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
