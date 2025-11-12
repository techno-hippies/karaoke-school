/**
 * Task: Translate TikTok Transcript (Multi-Language)
 *
 * Translates TikTok video transcripts to ALL target languages (zh, vi, id) using Gemini.
 * Stores results in tiktok_translations table (one row per language).
 *
 * Pattern: Mirrors lyrics translation workflow for consistency
 *
 * Prerequisites:
 * - Transcript must exist in tiktok_transcripts table (transcribe task completed)
 *
 * Flow:
 * 1. Select transcripts without complete translations (missing any of zh/vi/id)
 * 2. For each video, translate to ALL missing target languages
 * 3. Insert each translation into tiktok_translations table
 *
 * Usage:
 *   bun src/tasks/tiktok/translate.ts --limit=10
 *   bun src/tasks/tiktok/translate.ts --videoId=7565931111373622550
 */

import { BaseTask, type BaseSubjectInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { AudioTaskType } from '../../db/task-stages';
import { query } from '../../db/connection';
import { TRANSLATION_CONFIG } from '../../config';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

if (!OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY environment variable is required');
}

interface TikTokVideoInput extends BaseSubjectInput {
  video_id: string;
  creator_username: string;
  transcript_text: string;
  transcript_language: string;
  existing_languages: string[];  // Languages already translated
  subject_type: 'tiktok_video';
  subject_id: string;
}

interface TranslationResult extends TaskResult {
  metadata: {
    translations: Array<{
      language_code: string;
      translated_text: string;
    }>;
    translation_model: string;
  };
}

export class TranslateTikTokTask extends BaseTask<TikTokVideoInput, TranslationResult> {
  readonly taskType = AudioTaskType.TranslateTikTok;
  readonly subjectType = 'tiktok_video' as const;
  private readonly targetLanguages = TRANSLATION_CONFIG.defaultLanguages; // ['zh', 'vi', 'id']

  async selectTracks(limit: number, videoId?: string): Promise<TikTokVideoInput[]> {
    const filter = buildAudioTasksFilter(this.taskType, this.subjectType, 'video_id');

    // Build query to find videos missing translations for any target language
    const targetLangsList = this.targetLanguages.map(l => `'${l}'`).join(',');

    if (videoId) {
      const results = await query<TikTokVideoInput>(
        `SELECT
          v.video_id,
          v.creator_username,
          t.transcript_text,
          t.transcript_language,
          COALESCE(
            ARRAY_AGG(DISTINCT tr.language_code) FILTER (WHERE tr.language_code IS NOT NULL),
            ARRAY[]::text[]
          ) as existing_languages,
          'tiktok_video' as subject_type,
          v.video_id as subject_id
         FROM tiktok_videos v
         INNER JOIN tiktok_transcripts t ON t.video_id = v.video_id
         LEFT JOIN tiktok_translations tr ON tr.video_id = v.video_id
         WHERE v.video_id = $1
           ${filter}
         GROUP BY v.video_id, v.creator_username, t.transcript_text, t.transcript_language
         HAVING COUNT(DISTINCT tr.language_code) FILTER (WHERE tr.language_code IN (${targetLangsList})) < ${this.targetLanguages.length}
         LIMIT 1`,
        [videoId]
      );
      return results;
    }

    const results = await query<TikTokVideoInput>(
      `SELECT
        v.video_id,
        v.creator_username,
        t.transcript_text,
        t.transcript_language,
        COALESCE(
          ARRAY_AGG(DISTINCT tr.language_code) FILTER (WHERE tr.language_code IS NOT NULL),
          ARRAY[]::text[]
        ) as existing_languages,
        'tiktok_video' as subject_type,
        v.video_id as subject_id
       FROM tiktok_videos v
       INNER JOIN tiktok_transcripts t ON t.video_id = v.video_id
       LEFT JOIN tiktok_translations tr ON tr.video_id = v.video_id
       WHERE ${filter.replace('AND ', '')}
       GROUP BY v.video_id, v.creator_username, t.transcript_text, t.transcript_language
       HAVING COUNT(DISTINCT tr.language_code) FILTER (WHERE tr.language_code IN (${targetLangsList})) < ${this.targetLanguages.length}
       ORDER BY v.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return results;
  }

  async processTrack(video: TikTokVideoInput): Promise<TranslationResult> {
    console.log(`  🌐 Translating ${video.video_id} (${video.transcript_language})...`);

    // Determine which languages still need translation
    const missingLanguages = this.targetLanguages.filter(
      lang => !video.existing_languages.includes(lang)
    );

    if (missingLanguages.length === 0) {
      console.log(`  ✓ All languages already translated`);
      return {
        metadata: {
          translations: [],
          translation_model: TRANSLATION_CONFIG.model,
        },
      };
    }

    console.log(`  📝 Translating to: ${missingLanguages.join(', ')}`);

    const translations: Array<{ language_code: string; translated_text: string }> = [];

    // Translate to each missing language
    for (const targetLang of missingLanguages) {
      // Skip if source language matches target (rare edge case)
      if (video.transcript_language === targetLang) {
        console.log(`  ⏭️  Skipping ${targetLang} (same as source)`);
        await query(
          `INSERT INTO tiktok_translations (video_id, language_code, translated_text, translation_model)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (video_id, language_code) DO NOTHING`,
          [video.video_id, targetLang, video.transcript_text, 'none (same language)']
        );
        continue;
      }

      // Translate via Gemini
      const translatedText = await this.translateText(
        video.transcript_text,
        video.transcript_language,
        targetLang
      );

      // Insert into tiktok_translations
      await query(
        `INSERT INTO tiktok_translations (video_id, language_code, translated_text, translation_model)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (video_id, language_code) DO UPDATE SET
           translated_text = EXCLUDED.translated_text,
           translation_model = EXCLUDED.translation_model,
           updated_at = NOW()`,
        [video.video_id, targetLang, translatedText, TRANSLATION_CONFIG.model]
      );

      translations.push({ language_code: targetLang, translated_text: translatedText });
      console.log(`  ✅ ${targetLang}: ${translatedText.substring(0, 50)}...`);

      // Rate limiting between translations
      if (missingLanguages.indexOf(targetLang) < missingLanguages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, TRANSLATION_CONFIG.rateLimitMs));
      }
    }

    return {
      metadata: {
        translations,
        translation_model: TRANSLATION_CONFIG.model,
      },
    };
  }

  /**
   * Translate text using Gemini Flash 2.5 Lite via OpenRouter
   */
  private async translateText(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://karaoke.school',
        'X-Title': 'Karaoke School TikTok Translation',
      },
      body: JSON.stringify({
        model: TRANSLATION_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}. Provide ONLY the translation, no explanations or additional text.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim() || '';

    if (!translatedText) {
      throw new Error('Empty translation response from Gemini');
    }

    return translatedText;
  }
}

// CLI wrapper
if (import.meta.main) {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const videoIdArg = args.find(arg => arg.startsWith('--videoId='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  const videoId = videoIdArg ? videoIdArg.split('=')[1] : undefined;

  const task = new TranslateTikTokTask();
  await task.run({ limit, trackId: videoId });
}
