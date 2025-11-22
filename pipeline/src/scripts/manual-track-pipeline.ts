#!/usr/bin/env bun
/**
 * Manual Track Full Pipeline Orchestrator
 *
 * Sequences through all audio processing tasks for a manual Spotify track.
 * Runs tasks in dependency order: download → align → translate → separate → segment → enhance
 *
 * This prevents manual execution of each CLI and ensures proper sequencing.
 * It skips tasks that are already completed and retries failed tasks.
 *
 * Usage:
 *   # Process single track through all stages
 *   bun src/scripts/manual-track-pipeline.ts --spotifyId=59WN2psjkt1tyaxjspN8fp
 *
 *   # Process with specific phase (default: all)
 *   bun src/scripts/manual-track-pipeline.ts --spotifyId=59WN2psjkt1tyaxjspN8fp --phase=audio
 *   bun src/scripts/manual-track-pipeline.ts --spotifyId=59WN2psjkt1tyaxjspN8fp --phase=separation
 *
 * Phases:
 *   audio       → download, align (core audio layer)
 *   lyrics      → translate (requires normalized_lyrics)
 *   separation  → separate, segment, enhance (audio enhancement)
 *   clip        → clip (final clip generation)
 *   all         → complete pipeline (default)
 */

import "../../env";
import { parseArgs } from "util";
import { query } from "../../db/connection";
import { execSync } from "child_process";

const TASKS_IN_ORDER = [
  { name: "download", phase: "audio", command: "src/tasks/audio/download-audio.ts" },
  { name: "align", phase: "audio", command: "src/tasks/audio/align-lyrics.ts" },
  { name: "translate", phase: "lyrics", command: "src/tasks/audio/translate-lyrics.ts" },
  { name: "separate", phase: "separation", command: "src/tasks/audio/separate-audio.ts" },
  { name: "segment", phase: "separation", command: "src/tasks/audio/select-segments.ts" },
  { name: "enhance", phase: "separation", command: "src/tasks/audio/enhance-audio.ts" },
  { name: "clip", phase: "clip", command: "src/tasks/audio/clip-segments.ts" },
];

interface TrackStatus {
  spotify_track_id: string;
  stage: string;
  title: string;
}

interface TaskStatus {
  id: number;
  task_type: string;
  status: "pending" | "running" | "completed" | "failed";
  error_message: string | null;
}

async function getTrackStatus(spotifyId: string): Promise<TrackStatus | null> {
  const result = await query<TrackStatus>(
    "SELECT spotify_track_id, stage, title FROM tracks WHERE spotify_track_id = $1",
    [spotifyId]
  );
  return result[0] || null;
}

async function getTaskStatus(spotifyId: string, taskType: string): Promise<TaskStatus | null> {
  const result = await query<TaskStatus>(
    "SELECT id, task_type, status, error_message FROM audio_tasks WHERE subject_id = $1 AND task_type = $2 ORDER BY created_at DESC LIMIT 1",
    [spotifyId, taskType]
  );
  return result[0] || null;
}

async function runTask(taskCommand: string, spotifyId: string): Promise<boolean> {
  try {
    console.log(`   Running: bun ${taskCommand} --limit=1`);
    execSync(`bun ${taskCommand} --limit=1`, {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    return true;
  } catch (error) {
    console.error(`   ❌ Task failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      spotifyId: { type: "string" },
      phase: { type: "string", default: "all" },
      force: { type: "boolean", default: false },
    },
  });

  const spotifyId = values.spotifyId || process.env.SPOTIFY_ID;
  const phase = (values.phase || "all") as string;
  const force = values.force || false;

  if (!spotifyId) {
    console.error("❌ --spotifyId required (or set SPOTIFY_ID env var)");
    process.exit(1);
  }

  console.log(`\n🎵 Manual Track Pipeline Orchestrator`);
  console.log(`   Track: ${spotifyId}`);
  console.log(`   Phase: ${phase}`);
  console.log(`   Force: ${force ? "yes (re-run completed tasks)" : "no (skip completed)"}\n`);

  // Get initial track status
  const track = await getTrackStatus(spotifyId);
  if (!track) {
    console.error(`❌ Track not found: ${spotifyId}`);
    process.exit(1);
  }

  console.log(`📍 Track: "${track.title}" (stage: ${track.stage})`);
  console.log("");

  // Filter tasks by phase
  const tasksToRun = TASKS_IN_ORDER.filter((task) => {
    if (phase === "all") return true;
    return task.phase === phase;
  });

  console.log(`📋 Tasks to run (${phase} phase):`);
  tasksToRun.forEach((task, i) => {
    console.log(`   ${i + 1}. ${task.name}`);
  });
  console.log("");

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const task of tasksToRun) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`▶ ${task.name.toUpperCase()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const taskStatus = await getTaskStatus(spotifyId, task.name);

    if (taskStatus?.status === "completed" && !force) {
      console.log(`✅ Already completed (${taskStatus.id}) - skipping`);
      skippedCount++;
      continue;
    }

    if (taskStatus?.status === "failed" && taskStatus.error_message) {
      console.log(`⚠️  Previous failure: ${taskStatus.error_message.substring(0, 100)}`);
      if (!force) {
        console.log(`   Use --force to retry`);
        failedCount++;
        continue;
      }
    }

    const success = await runTask(task.command, spotifyId);

    if (success) {
      successCount++;
    } else {
      failedCount++;
      console.log(`\n⚠️  ${task.name} failed. Check logs above.`);
      if (phase !== "all") {
        console.log(`   Run with same --spotifyId and --phase to retry`);
      }
      break; // Stop on first failure in sequential flow
    }
  }

  // Final summary
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Pipeline Summary`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   ✅ Completed: ${successCount}`);
  console.log(`   ⏭️  Skipped:   ${skippedCount}`);
  console.log(`   ❌ Failed:    ${failedCount}`);

  const finalTrack = await getTrackStatus(spotifyId);
  if (finalTrack) {
    console.log(`\n   Final stage: ${finalTrack.stage}`);
  }

  if (failedCount > 0) {
    console.log(`\n⚠️  Pipeline incomplete. Re-run with --force to retry failed tasks.`);
    process.exit(1);
  }

  if (successCount > 0) {
    console.log(`\n✅ Pipeline progressed successfully!`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
