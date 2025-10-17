#!/usr/bin/env bun
import { readFileSync } from "fs";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const ELEVENLABS_MODEL = "scribe_v1";

const apiKey = process.env.ELEVENLABS_API_KEY;
const audioPath = "/tmp/test_audio.mp3";

const formData = new FormData();
const audioBuffer = readFileSync(audioPath);
const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

formData.append("file", audioBlob, "test_audio.mp3");
formData.append("model_id", ELEVENLABS_MODEL);
formData.append("language_code", "en");

console.log("🔊 Transcribing with ElevenLabs...");

const response = await fetch(ELEVENLABS_API_URL, {
  method: "POST",
  headers: {
    "xi-api-key": apiKey,
  },
  body: formData,
});

if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
}

const data = await response.json();

// Filter out whitespace-only words
if (data.words) {
  data.words = data.words.filter((word: any) => {
    return word.text.trim().length > 0;
  });
}

console.log("\n✅ API Response:");
console.log(`   Words: ${data.words.length}`);
console.log(`   Text: ${data.text}`);
console.log(`   Language: ${data.language}`);
console.log(`   Duration: ${data.duration}s`);

console.log("\n📝 First 10 words with timestamps:");
data.words.slice(0, 10).forEach((w: any, idx: number) => {
  console.log(`   ${idx + 1}. "${w.text}" [${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s]`);
});

// Test line grouping
console.log("\n📊 Testing line grouping...");

interface Word {
  text: string;
  start: number;
  end: number;
}

function groupWordsIntoLines(words: Word[]) {
  if (words.length === 0) return [];

  const lines: Array<{ start: number; end: number; text: string; words: Word[] }> = [];
  let currentLine: Word[] = [];

  const MAX_LINE_DURATION = 5.0;
  const MAX_WORDS_PER_LINE = 10;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentLine.push(word);

    const lineStart = currentLine[0].start;
    const lineEnd = word.end;
    const lineDuration = lineEnd - lineStart;
    const isLastWord = i === words.length - 1;
    const nextWordHasPause = !isLastWord && (words[i + 1].start - word.end) > 0.3;

    const shouldEndLine =
      isLastWord ||
      currentLine.length >= MAX_WORDS_PER_LINE ||
      lineDuration >= MAX_LINE_DURATION ||
      nextWordHasPause ||
      word.text.endsWith('.') ||
      word.text.endsWith('!') ||
      word.text.endsWith('?');

    if (shouldEndLine && currentLine.length > 0) {
      const lineText = currentLine.map(w => w.text).join(' ');
      lines.push({
        start: currentLine[0].start,
        end: currentLine[currentLine.length - 1].end,
        text: lineText,
        words: [...currentLine],
      });
      currentLine = [];
    }
  }

  return lines;
}

const lines = groupWordsIntoLines(data.words);

console.log(`\n📋 Created ${lines.length} lines:`);
lines.forEach((line: any, idx: number) => {
  console.log(`\n   Line ${idx + 1} [${line.start.toFixed(2)}s - ${line.end.toFixed(2)}s]:`);
  console.log(`   "${line.text}"`);
  console.log(`   Words: ${line.words.length}`);
});
