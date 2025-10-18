#!/usr/bin/env bun
/**
 * Step 3.6: Translate Transcriptions with Gemini Flash 2.5
 *
 * Translates English transcriptions to Vietnamese and Mandarin
 * Distributes word-level timestamps proportionally for karaoke rendering
 *
 * Usage: bun run translate-transcriptions --creator @handle
 */

import { parseArgs } from "util";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { TranscriptionData, TranscriptionSegment } from "./types/transcription";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-2.5-flash-lite-preview-09-2025";

interface OpenRouterMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface OpenRouterRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function translateWithOpenRouter(
  text: string,
  targetLanguage: string,
  apiKey: string
): Promise<string> {
  const languageNames: Record<string, string> = {
    vi: "Vietnamese",
    zh: "Mandarin Chinese (Simplified)",
  };

  const prompt = `Translate the following English text to ${languageNames[targetLanguage]}.
Preserve the meaning and tone as accurately as possible.
Only return the translated text, nothing else.

English text:
${text}`;

  const request: OpenRouterRequest = {
    model: OPENROUTER_MODEL,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent translations
    max_tokens: 2048,
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorText}`
    );
  }

  const data: OpenRouterResponse = await response.json();
  const translatedText = data.choices[0]?.message?.content?.trim();

  if (!translatedText) {
    throw new Error("Empty translation response from OpenRouter");
  }

  return translatedText;
}

/**
 * Distribute timing proportionally for translated words
 * Since different languages have different word counts, we scale timing
 */
function distributeTranslatedTimings(
  originalSegment: TranscriptionSegment,
  translatedText: string
): TranscriptionSegment {
  const translatedWords = translatedText.trim().split(/\s+/);
  const segmentDuration = originalSegment.end - originalSegment.start;
  const timePerWord = segmentDuration / translatedWords.length;

  return {
    start: originalSegment.start,
    end: originalSegment.end,
    text: translatedText,
    words: translatedWords.map((word, index) => ({
      word,
      start: originalSegment.start + index * timePerWord,
      end: originalSegment.start + (index + 1) * timePerWord,
    })),
  };
}

async function translateTranscriptionData(
  englishData: TranscriptionData,
  targetLanguage: string,
  apiKey: string
): Promise<TranscriptionData> {
  console.log(`      🌐 Translating to ${targetLanguage}...`);

  // Translate segment by segment to preserve context
  const translatedSegments: TranscriptionSegment[] = [];

  for (let i = 0; i < englishData.segments.length; i++) {
    const segment = englishData.segments[i];
    console.log(`         Segment ${i + 1}/${englishData.segments.length}: "${segment.text.slice(0, 50)}..."`);

    try {
      const translatedText = await translateWithOpenRouter(
        segment.text,
        targetLanguage,
        apiKey
      );

      const translatedSegment = distributeTranslatedTimings(
        segment,
        translatedText
      );

      translatedSegments.push(translatedSegment);
      console.log(`         ✅ Translated: "${translatedText.slice(0, 50)}..."`);

      // Rate limiting: wait 1 second between requests
      if (i < englishData.segments.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`         ❌ Translation failed:`, error);
      // Fall back to original timing with placeholder text
      translatedSegments.push({
        ...segment,
        text: `[Translation failed: ${segment.text}]`,
      });
    }
  }

  // Combine all segment texts
  const fullTranslatedText = translatedSegments.map((s) => s.text).join(" ");

  return {
    language: targetLanguage,
    text: fullTranslatedText,
    segments: translatedSegments,
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
      languages: {
        type: "string",
        short: "l",
        default: "vi,zh",
      },
    },
  });

  const creator = values.creator;
  if (!creator) {
    console.error("❌ Missing required flag: --creator");
    process.exit(1);
  }

  const handle = creator.replace("@", "");
  const targetLanguages = values.languages?.split(",") || ["vi", "zh"];

  console.log(`🌍 Translating transcriptions for @${handle}...`);
  console.log(`   Target languages: ${targetLanguages.join(", ")}`);

  // Load API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ Missing OPENROUTER_API_KEY environment variable");
    console.error("   Get your API key at: https://openrouter.ai/keys");
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

  // Translate profile bio if it exists and hasn't been translated yet
  if (manifest.profile?.bio && manifest.profile.bio.trim()) {
    console.log(`\n👤 Translating profile bio...`);
    console.log(`   Original: "${manifest.profile.bio.slice(0, 100)}..."`);

    if (!manifest.profile.bioTranslations) {
      manifest.profile.bioTranslations = {};
    }

    for (const targetLang of targetLanguages) {
      if (manifest.profile.bioTranslations[targetLang]) {
        console.log(`   ⏭️  Bio already translated to ${targetLang}, skipping`);
        continue;
      }

      try {
        const translatedBio = await translateWithOpenRouter(
          manifest.profile.bio,
          targetLang,
          apiKey
        );
        manifest.profile.bioTranslations[targetLang] = translatedBio;
        console.log(`   ✅ ${targetLang}: "${translatedBio.slice(0, 100)}..."`);

        // Rate limit between translations
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`   ❌ Bio translation to ${targetLang} failed:`, error);
      }
    }

    // Save manifest after bio translation
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`   💾 Bio translations saved to manifest`);
  }

  // Translate each video
  let translated = 0;
  let skipped = 0;
  let failed = 0;

  for (const video of manifest.videos) {
    console.log(`\n🎬 Video: ${video.postId}`);
    console.log(`   URL: ${video.postUrl}`);

    // Check if transcription exists
    if (!video.transcription?.languages?.en) {
      console.log("   ⚠️  No English transcription found, skipping");
      skipped++;
      continue;
    }

    const englishData = video.transcription.languages.en;

    // Check if transcription needs translation
    const needsTranscriptionTranslation = targetLanguages.some(
      (lang) => !video.transcription.languages[lang]
    );

    // Check if description needs translation
    const needsDescriptionTranslation = video.description && targetLanguages.some(
      (lang) => !video.descriptionTranslations?.[lang]
    );

    if (!needsTranscriptionTranslation && !needsDescriptionTranslation) {
      console.log("   ⏭️  Already translated to all target languages, skipping");
      skipped++;
      continue;
    }

    try {
      // Translate description if needed
      if (video.description && needsDescriptionTranslation) {
        console.log(`   📝 Translating description: "${video.description.slice(0, 50)}..."`);

        if (!video.descriptionTranslations) {
          video.descriptionTranslations = {};
        }

        for (const targetLang of targetLanguages) {
          if (video.descriptionTranslations[targetLang]) {
            console.log(`      ⏭️  Description already translated to ${targetLang}`);
            continue;
          }

          const translatedDesc = await translateWithOpenRouter(
            video.description,
            targetLang,
            apiKey
          );
          video.descriptionTranslations[targetLang] = translatedDesc;
          console.log(`      ✅ ${targetLang}: "${translatedDesc.slice(0, 50)}..."`);

          // Rate limit
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      // Translate transcription to each target language
      for (const targetLang of targetLanguages) {
        if (video.transcription.languages[targetLang]) {
          console.log(`   ⏭️  Transcription already translated to ${targetLang}, skipping`);
          continue;
        }

        const translatedData = await translateTranscriptionData(
          englishData,
          targetLang,
          apiKey
        );

        video.transcription.languages[targetLang] = translatedData;
        console.log(`   ✅ Transcription translated to ${targetLang}`);
      }

      // Update metadata
      video.transcription.translationModel = OPENROUTER_MODEL;

      translated++;

      // Save manifest after each video (in case of failures)
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`   💾 Saved to manifest`);

    } catch (error) {
      console.error(`   ❌ Translation failed:`, error);
      failed++;
    }
  }

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Translation Summary:");
  console.log(`   ✅ Translated: ${translated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📄 Total: ${manifest.videos.length}`);
  console.log("=".repeat(60));

  if (translated > 0) {
    console.log(`\n✅ Manifest updated: ${manifestPath}`);
    console.log("\n🔐 Next step: Encrypt videos");
    console.log(`   bun run encrypt-videos --creator @${handle}`);
  }
}

main().catch(console.error);
