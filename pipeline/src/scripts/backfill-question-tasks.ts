#!/usr/bin/env bun
/**
 * Backfill Question Tasks
 *
 * Seeds translation_quiz and trivia tasks for tracks that bypassed question generation.
 * This script repairs tracks that reached 'ready' stage without questions due to the
 * parallel branch architecture bug.
 *
 * What it does:
 * 1. Finds tracks at separated/segmented/enhanced/ready stages
 * 2. Filters for tracks with translations but no questions
 * 3. Seeds translation_quiz and trivia tasks
 * 4. Optionally downgrades stage to 'translated' to unblock progression
 *
 * Usage:
 *   bun src/scripts/backfill-question-tasks.ts [--downgrade-stage]
 *
 * Options:
 *   --downgrade-stage   Downgrade tracks to 'translated' stage (recommended)
 *                       Without this, tracks stay at current stage but tasks are seeded
 *
 * Example workflow:
 *   # 1. Backfill and downgrade
 *   bun src/scripts/backfill-question-tasks.ts --downgrade-stage
 *
 *   # 2. Generate questions
 *   bun src/tasks/content/generate-translation-quiz.ts --limit=20
 *   bun src/tasks/content/generate-trivia.ts --limit=20
 *
 *   # 3. Verify all tracks have questions
 *   psql $NEON_DATABASE_URL -c "SELECT COUNT(*) FROM tracks t WHERE t.stage = 'ready' AND NOT EXISTS (SELECT 1 FROM song_translation_questions WHERE spotify_track_id = t.spotify_track_id);"
 */

import '../env';
import { query } from '../db/connection';
import { ensureAudioTask } from '../db/audio-tasks';
import { AudioTaskType, TrackStage } from '../db/task-stages';

interface TrackRow {
  spotify_track_id: string;
  title: string;
  stage: string;
  updated_at: Date;
}

async function backfillQuestionTasks(downgradeStage: boolean = false) {
  console.log('\n🔄 Backfilling Question Tasks for Existing Tracks\n');
  console.log(`Mode: ${downgradeStage ? 'Backfill + Downgrade Stage' : 'Backfill Only'}\n`);

  // Find tracks that bypassed question generation
  const tracks = await query<TrackRow>(
    `SELECT t.spotify_track_id, t.title, t.stage, t.updated_at
     FROM tracks t
     WHERE t.stage IN ('separated', 'segmented', 'enhanced', 'ready')
       AND EXISTS (
         SELECT 1 FROM lyrics_translations lt
         WHERE lt.spotify_track_id = t.spotify_track_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM song_translation_questions q
         WHERE q.spotify_track_id = t.spotify_track_id
       )
     ORDER BY t.updated_at ASC`
  );

  if (tracks.length === 0) {
    console.log('✓ No tracks need backfilling. All tracks with translations have questions.\n');
    return;
  }

  console.log(`Found ${tracks.length} track(s) needing question tasks:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const track of tracks) {
    const trackLabel = `${track.title} (${track.spotify_track_id})`;

    try {
      console.log(`Processing: ${trackLabel}`);
      console.log(`   Current stage: ${track.stage}`);

      // Seed question tasks
      await ensureAudioTask(track.spotify_track_id, AudioTaskType.TranslationQuiz);
      await ensureAudioTask(track.spotify_track_id, AudioTaskType.Trivia);
      console.log(`   ✓ Seeded tasks: translation_quiz, trivia`);

      // Optionally downgrade stage to allow proper progression
      if (downgradeStage) {
        await query(
          `UPDATE tracks
           SET stage = $2, updated_at = NOW()
           WHERE spotify_track_id = $1`,
          [track.spotify_track_id, TrackStage.Translated]
        );
        console.log(`   ✓ Downgraded stage: ${track.stage} → translated`);
      }

      successCount++;
      console.log('');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`   ✗ Failed: ${message}\n`);
      errorCount++;
    }
  }

  console.log('─'.repeat(60));
  console.log(`\n✅ Backfill Complete`);
  console.log(`   Success: ${successCount} track(s)`);
  if (errorCount > 0) {
    console.log(`   Errors:  ${errorCount} track(s)`);
  }

  if (downgradeStage) {
    console.log(`\n📋 Next Steps:`);
    console.log(`   1. Run question generators to process pending tasks:`);
    console.log(`      bun src/tasks/content/generate-translation-quiz.ts --limit=20`);
    console.log(`      bun src/tasks/content/generate-trivia.ts --limit=20`);
    console.log(`   2. Verify questions were generated:`);
    console.log(`      Check audio_tasks table for completed translation_quiz/trivia tasks`);
    console.log(`   3. Tracks will auto-progress through stages as tasks complete\n`);
  } else {
    console.log(`\n⚠️  Warning: Tracks were not downgraded.`);
    console.log(`   Tasks are seeded but tracks remain at current stage.`);
    console.log(`   Run with --downgrade-stage to reset progression.\n`);
  }
}

if (import.meta.main) {
  const downgradeStage = process.argv.includes('--downgrade-stage');

  backfillQuestionTasks(downgradeStage).catch((error) => {
    console.error('\n❌ Fatal error during backfill:', error);
    process.exit(1);
  });
}

export { backfillQuestionTasks };
