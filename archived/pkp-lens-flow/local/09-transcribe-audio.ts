#!/usr/bin/env bun
/**
 * Step 3.5: Transcribe Audio with ElevenLabs API
 *
 * Transcribes video audio to English using ElevenLabs Speech-to-Text
 * Generates word-level timestamps for karaoke-style captions
 *
 * Usage: bun run transcribe-audio --creator @handle
 */

import { parseArgs } from "util";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";
import type { TranscriptionData, VideoTranscription } from "./types/transcription";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const ELEVENLABS_MODEL = "scribe_v1";

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

interface ElevenLabsWord {
  text: string;
  start: number;
  end: number;
}

interface ElevenLabsResponse {
  text: string;
  language: string;
  words: ElevenLabsWord[];
  duration: number;
}

async function transcribeAudio(
  audioPath: string,
  apiKey: string
): Promise<ElevenLabsResponse> {
  const formData = new FormData();

  // Read audio file as blob
  const audioBuffer = readFileSync(audioPath);
  const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

  formData.append("file", audioBlob, audioPath.split("/").pop());
  formData.append("model_id", ELEVENLABS_MODEL);
  formData.append("language_code", "en");

  const response = await fetch(ELEVENLABS_API_URL, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `ElevenLabs API error (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  // Filter out whitespace-only words
  if (data.words) {
    data.words = data.words.filter((word: ElevenLabsWord) => {
      return word.text.trim().length > 0;
    });
  }

  return data;
}

/**
 * Group words into lines based on natural sentence boundaries
 * Creates segments similar to karaoke lines for better readability
 */
function groupWordsIntoLines(
  words: ElevenLabsWord[]
): Array<{ start: number; end: number; text: string; words: Array<{ word: string; start: number; end: number }> }> {
  if (words.length === 0) return [];

  const lines: Array<{ start: number; end: number; text: string; words: Array<{ word: string; start: number; end: number }> }> = [];
  let currentLine: Array<{ word: string; start: number; end: number }> = [];

  const MAX_LINE_DURATION = 5.0; // Max 5 seconds per line
  const MAX_WORDS_PER_LINE = 10; // Max 10 words per line

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordData = {
      word: word.text,
      start: word.start,
      end: word.end,
    };

    currentLine.push(wordData);

    // Check if we should end this line
    const lineStart = currentLine[0].start;
    const lineEnd = word.end;
    const lineDuration = lineEnd - lineStart;
    const isLastWord = i === words.length - 1;
    const nextWordHasPause = !isLastWord && (words[i + 1].start - word.end) > 0.3; // 300ms pause

    const shouldEndLine =
      isLastWord ||
      currentLine.length >= MAX_WORDS_PER_LINE ||
      lineDuration >= MAX_LINE_DURATION ||
      nextWordHasPause ||
      word.text.endsWith('.') ||
      word.text.endsWith('!') ||
      word.text.endsWith('?');

    if (shouldEndLine && currentLine.length > 0) {
      const lineText = currentLine.map(w => w.word).join(' ');
      lines.push({
        start: currentLine[0].start,
        end: currentLine[currentLine.length - 1].end,
        text: lineText,
        words: currentLine,
      });
      currentLine = [];
    }
  }

  return lines;
}

function convertToTranscriptionData(
  response: ElevenLabsResponse
): TranscriptionData {
  // Group words into natural line segments
  const segments = groupWordsIntoLines(response.words);

  return {
    language: response.language || "en",
    text: response.text,
    segments,
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

  // Load ElevenLabs API key
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing ELEVENLABS_API_KEY environment variable");
    console.error("   Get your API key at: https://elevenlabs.io/app/settings/api-keys");
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

      console.log(`   🔊 Transcribing audio with ElevenLabs...`);
      const response = await transcribeAudio(audioPath, apiKey);

      console.log(`   ✅ Transcribed: ${response.words.length} words`);
      console.log(`   📝 Text preview: ${response.text.slice(0, 100)}...`);
      if (response.duration) {
        console.log(`   ⏱️  Audio duration: ${response.duration.toFixed(1)}s`);
      }

      // Convert to our format with natural line grouping
      const transcriptionData = convertToTranscriptionData(response);

      console.log(`   📊 Created ${transcriptionData.segments.length} lines from ${response.words.length} words`);

      // Add to video object
      const transcription: VideoTranscription = {
        languages: {
          en: transcriptionData,
        },
        generatedAt: new Date().toISOString(),
        elevenLabsModel: ELEVENLABS_MODEL,
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
