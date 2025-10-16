#!/usr/bin/env bun
/**
 * Step 3.5: Transcribe Audio with Voxtral API
 *
 * Transcribes video audio to English using Mistral's Voxtral API
 * Generates word-level timestamps for karaoke-style captions
 *
 * Usage: bun run transcribe-audio --creator @handle
 */

import { parseArgs } from "util";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import type { TranscriptionData, VideoTranscription } from "./types/transcription";

const VOXTRAL_API_URL = "https://api.mistral.ai/v1/audio/transcriptions";
const VOXTRAL_MODEL = "voxtral-mini-latest";

/**
 * Extract audio from video file to MP3 using ffmpeg
 */
async function extractAudioToMp3(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", videoPath,
      "-vn", // No video
      "-acodec", "libmp3lame", // MP3 codec
      "-q:a", "2", // High quality
      "-y", // Overwrite output file
      outputPath,
    ]);

    let errorOutput = "";

    ffmpeg.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg failed with code ${code}: ${errorOutput}`));
      }
    });

    ffmpeg.on("error", (error) => {
      reject(error);
    });
  });
}

interface VoxtralSegment {
  start: number;
  end: number;
  text: string;
}

interface VoxtralResponse {
  model: string;
  text: string;
  language: string;
  segments: VoxtralSegment[];
  usage: {
    prompt_audio_seconds: number;
    prompt_tokens: number;
    total_tokens: number;
    completion_tokens: number;
  };
}

async function transcribeAudio(
  audioPath: string,
  apiKey: string
): Promise<VoxtralResponse> {
  const formData = new FormData();

  // Read audio file as blob
  const audioBuffer = readFileSync(audioPath);
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

  formData.append("file", audioBlob, audioPath.split("/").pop());
  formData.append("model", VOXTRAL_MODEL);
  formData.append("timestamp_granularities", "segment");
  // Note: Can't specify language when requesting timestamps - will auto-detect

  const response = await fetch(VOXTRAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Voxtral API error (${response.status}): ${errorText}`
    );
  }

  return await response.json();
}

/**
 * Distribute segment timing proportionally across words
 * Since Voxtral gives segment-level timestamps, we estimate word-level timing
 */
function distributeWordTimings(segment: VoxtralSegment) {
  const words = segment.text.trim().split(/\s+/);
  const segmentDuration = segment.end - segment.start;
  const timePerWord = segmentDuration / words.length;

  return words.map((word, index) => ({
    word,
    start: segment.start + index * timePerWord,
    end: segment.start + (index + 1) * timePerWord,
  }));
}

function convertToTranscriptionData(
  response: VoxtralResponse
): TranscriptionData {
  return {
    language: "en",
    text: response.text,
    segments: response.segments.map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
      words: distributeWordTimings(segment),
    })),
  };
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      creator: {
        type: "string",
        short: "c",
      },
    },
  });

  const creator = values.creator;
  if (!creator) {
    console.error("❌ Missing required flag: --creator");
    process.exit(1);
  }

  const handle = creator.replace("@", "");
  console.log(`🎤 Transcribing audio for @${handle}...`);

  // Load API key (check both VOXTRAL_API_KEY and MISTRAL_API_KEY)
  const apiKey = process.env.VOXTRAL_API_KEY || process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing VOXTRAL_API_KEY or MISTRAL_API_KEY environment variable");
    console.error("   Get your API key at: https://console.mistral.ai/");
    process.exit(1);
  }

  // Load manifest
  const manifestPath = join(
    process.cwd(),
    "data",
    "videos",
    handle,
    "manifest.json"
  );
  if (!existsSync(manifestPath)) {
    console.error(`❌ Manifest not found: ${manifestPath}`);
    console.error("   Run 'bun run crawl-tiktok' first");
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  console.log(`📄 Loaded manifest with ${manifest.videos.length} videos`);

  // Transcribe each video
  let transcribed = 0;
  let skipped = 0;
  let failed = 0;

  for (const video of manifest.videos) {
    console.log(`\n🎬 Video: ${video.postId}`);
    console.log(`   URL: ${video.postUrl}`);

    // Skip if already transcribed
    if (video.transcription?.languages?.en) {
      console.log("   ⏭️  Already transcribed, skipping");
      skipped++;
      continue;
    }

    // Check if video file exists
    // Extract filename from localFiles path (remove relative prefix like ../../data/videos/handle/)
    const videoFilename = video.localFiles?.video
      ? video.localFiles.video.split("/").pop()
      : `video_${video.postId}.mp4`;

    const videoPath = join(
      process.cwd(),
      "data",
      "videos",
      handle,
      videoFilename
    );

    if (!existsSync(videoPath)) {
      console.error(`   ❌ Video file not found: ${videoPath}`);
      failed++;
      continue;
    }

    // Extract audio to temporary MP3 file
    const audioPath = videoPath.replace(/\.mp4$/, "_temp.mp3");

    try {
      console.log(`   🎵 Extracting audio...`);
      await extractAudioToMp3(videoPath, audioPath);
      console.log(`   ✅ Audio extracted to ${audioPath.split("/").pop()}`);

      console.log(`   🔊 Transcribing audio...`);
      const response = await transcribeAudio(audioPath, apiKey);

      console.log(`   ✅ Transcribed: ${response.segments.length} segments`);
      console.log(`   📝 Text preview: ${response.text.slice(0, 100)}...`);
      console.log(`   ⏱️  Audio duration: ${response.usage.prompt_audio_seconds}s`);

      // Convert to our format
      const transcriptionData = convertToTranscriptionData(response);

      // Add to video object
      const transcription: VideoTranscription = {
        languages: {
          en: transcriptionData,
        },
        generatedAt: new Date().toISOString(),
        voxtralModel: response.model,
      };

      video.transcription = transcription;
      transcribed++;

      // Save manifest after each transcription (in case of failures)
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`   💾 Saved to manifest`);

    } catch (error) {
      console.error(`   ❌ Transcription failed:`, error);
      failed++;
    } finally {
      // Clean up temporary audio file
      if (existsSync(audioPath)) {
        unlinkSync(audioPath);
      }
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Transcription Summary:");
  console.log(`   ✅ Transcribed: ${transcribed}`);
  console.log(`   ⏭️  Skipped (already done): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📄 Total: ${manifest.videos.length}`);
  console.log("=".repeat(60));

  if (transcribed > 0) {
    console.log(`\n✅ Manifest updated: ${manifestPath}`);
    console.log("\n📝 Next step: Run translation");
    console.log(`   bun run translate-transcriptions --creator @${handle}`);
  }
}

main().catch(console.error);
