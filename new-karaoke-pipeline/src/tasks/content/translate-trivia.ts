#!/usr/bin/env bun

import { OpenRouterService } from '../../services/openrouter';
import {
  SUPPORTED_TRIVIA_LOCALES,
  getQuestionsWithoutLocalization,
  insertTriviaLocalizations,
} from '../../db/trivia';
import { WORD_LIMIT_PER_CHOICE } from './trivia-utils';

const LANGUAGE_NAMES: Record<(typeof SUPPORTED_TRIVIA_LOCALES)[number], string> = {
  zh: 'Simplified Chinese',
  vi: 'Vietnamese',
  id: 'Indonesian',
};

function buildTranslationPrompt(
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  question: { prompt: string; correctAnswer: string; distractors: string[]; explanation: string }
): string {
  const distractorLines = question.distractors.map((text, idx) => `Distractor ${idx + 1}: ${text}`).join('\n');

  return `Translate the following trivia question into ${LANGUAGE_NAMES[languageCode]}.

Rules:
- Keep every lyric or phrase enclosed in double quotes exactly as written in English.
- Preserve the meaning and tone suitable for language learners.
- Keep the translated correct_answer and each distractor under ${WORD_LIMIT_PER_CHOICE} words.
- Maintain the original intent; do not add new information.
- Keep the explanation concise (<= 120 characters).

Original prompt:
"""${question.prompt}"""

Correct answer:
${question.correctAnswer}

Distractor pool:
${distractorLines || 'None provided'}

Explanation:
${question.explanation || 'None provided'}`;
}

function buildResponseFormat(expectedDistractors: number) {
  return {
    type: 'json_schema',
    json_schema: {
      name: 'trivia_localization',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['prompt', 'correct_answer', 'distractors', 'explanation'],
        properties: {
          prompt: { type: 'string' },
          explanation: { type: 'string' },
          correct_answer: { type: 'string' },
          distractors: {
            type: 'array',
            minItems: expectedDistractors,
            maxItems: expectedDistractors,
            items: { type: 'string' },
          },
        },
      },
    },
  };
}

function sanitizeTranslatedOption(value: any, context: string): string {
  let text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    throw new Error(`${context} is empty`);
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > WORD_LIMIT_PER_CHOICE) {
    throw new Error(`${context} exceeds ${WORD_LIMIT_PER_CHOICE}-word limit: "${text}"`);
  }

  return text;
}

async function rewriteOptionToLimit(
  openRouter: OpenRouterService,
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  text: string,
  context: string
): Promise<string> {
  const languageName = LANGUAGE_NAMES[languageCode];
  const systemPrompt = `You rewrite ${languageName} phrases to be concise while preserving meaning. Respond with only the rewritten text, ${WORD_LIMIT_PER_CHOICE} words or fewer.`;
  const userPrompt = `${context}:
"""${text}"""

Provide a concise rewrite in ${languageName} that stays within ${WORD_LIMIT_PER_CHOICE} words while keeping the original intent.`;

  const rewritten = await openRouter.complete([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return sanitizeTranslatedOption(rewritten, context);
}

interface LocalizationAttemptResult {
  prompt: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
}

async function requestTranslation(
  openRouter: OpenRouterService,
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  question: { id: string; prompt: string; correctAnswer: string; distractors: string[]; explanation: string },
  additionalGuidance?: string
): Promise<LocalizationAttemptResult> {
  const basePrompt = buildTranslationPrompt(languageCode, question);
  const finalPrompt = additionalGuidance
    ? `${basePrompt}

Additional instructions:
${additionalGuidance.trim()}`
    : basePrompt;

  const response = await openRouter.chat(
    [
      {
        role: 'system',
        content:
          'You translate educational trivia while preserving quoted English phrases exactly. ' +
          'Return only JSON that matches the provided schema.',
      },
      { role: 'user', content: finalPrompt },
    ],
    buildResponseFormat(question.distractors.length)
  );

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty translation response');
  }

  const parsed = JSON.parse(content);
  const prompt = String(parsed.prompt || '').trim();
  if (!prompt) {
    throw new Error('Translated prompt is empty');
  }
  let translatedCorrect: string;
  try {
    translatedCorrect = sanitizeTranslatedOption(parsed.correct_answer, 'Correct answer');
  } catch (error) {
    if (error instanceof Error && error.message.includes('word limit')) {
      translatedCorrect = await rewriteOptionToLimit(
        openRouter,
        languageCode,
        String(parsed.correct_answer ?? ''),
        'Correct answer'
      );
    } else {
      throw error;
    }
  }

  if (!Array.isArray(parsed.distractors) || parsed.distractors.length !== question.distractors.length) {
    throw new Error(`Expected ${question.distractors.length} translated distractors`);
  }

  const distractors: string[] = [];
  const seen = new Set<string>([translatedCorrect.toLowerCase()]);

  for (let index = 0; index < parsed.distractors.length; index += 1) {
    const entry = parsed.distractors[index];
    const context = `Distractor ${index + 1}`;
    let sanitized: string;

    try {
      sanitized = sanitizeTranslatedOption(entry, context);
    } catch (error) {
      if (error instanceof Error && error.message.includes('word limit')) {
        sanitized = await rewriteOptionToLimit(
          openRouter,
          languageCode,
          String(entry ?? ''),
          context
        );
      } else {
        throw error;
      }
    }

    const normalized = sanitized.toLowerCase();
    if (seen.has(normalized)) {
      throw new Error(`Duplicate translated distractor detected (${context})`);
    }

    seen.add(normalized);
    distractors.push(sanitized);
  }

  return {
    prompt,
    correctAnswer: translatedCorrect,
    distractors,
    explanation: String(parsed.explanation || '').trim(),
  };
}

async function translateWithRetries(
  openRouter: OpenRouterService,
  languageCode: (typeof SUPPORTED_TRIVIA_LOCALES)[number],
  question: { id: string; prompt: string; correctAnswer: string; distractors: string[]; explanation: string },
  maxRetries: number
): Promise<LocalizationAttemptResult> {
  let attempt = 0;
  let extraGuidance = '';
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    try {
      return await requestTranslation(openRouter, languageCode, question, extraGuidance);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt += 1;

      if (attempt > maxRetries) {
        throw lastError;
      }

      const message = lastError.message.toLowerCase();
      if (message.includes('word limit')) {
        const distractorMatch = /distractor\s+(\d+)/i.exec(lastError.message);
        const textMatch = /"([^"]+)"/.exec(lastError.message);
        if (distractorMatch) {
          const original = textMatch ? ` Current attempt: "${textMatch[1]}".` : '';
          extraGuidance = `Rewrite distractor ${distractorMatch[1]} so it stays within ${WORD_LIMIT_PER_CHOICE} words while preserving its misleading intent.${original}`.trim();
        } else if (message.includes('correct answer')) {
          const original = textMatch ? ` Current attempt: "${textMatch[1]}".` : '';
          extraGuidance = `Rewrite the correct answer so it stays within ${WORD_LIMIT_PER_CHOICE} words without losing meaning.${original}`.trim();
        } else {
          extraGuidance = `Ensure the correct answer and every distractor stay within ${WORD_LIMIT_PER_CHOICE} words by using concise phrasing.`;
        }
      } else if (message.includes('duplicate')) {
        extraGuidance = 'Provide unique distractors with clearly different wording and meanings.';
      } else if (message.includes('expected') || message.includes('missing')) {
        extraGuidance = `Return exactly ${question.distractors.length} distractors along with the translated correct_answer.`;
      } else if (message.includes('matches the correct answer')) {
        extraGuidance = 'Make sure every distractor changes the meaning so it is not identical to the correct answer.';
      } else {
        extraGuidance = 'Double-check the JSON schema, field names, and length constraints before responding again.';
      }
    }
  }

  throw lastError ?? new Error('Translation failed without specific error');
}

async function translateTrivia(limitPerLanguage = 25) {
  console.log(`\n🌐 Trivia Localization (limit per language: ${limitPerLanguage})`);

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY is not set.');
    process.exit(1);
  }

  const openRouter = new OpenRouterService(apiKey);

  for (const languageCode of SUPPORTED_TRIVIA_LOCALES) {
    const pending = await getQuestionsWithoutLocalization(languageCode, limitPerLanguage);

    if (pending.length === 0) {
      console.log(`✓ All trivia localized for ${languageCode}`);
      continue;
    }

    console.log(`Translating ${pending.length} question(s) to ${languageCode}`);

    for (const question of pending) {
      try {
        const result = await translateWithRetries(
          openRouter,
          languageCode,
          question,
          3
        );

        await insertTriviaLocalizations([
          {
            questionId: question.id,
            languageCode,
            prompt: result.prompt,
            correctAnswer: result.correctAnswer,
            distractors: result.distractors,
            explanation: result.explanation,
          },
        ]);

        console.log(`   ✓ ${question.id} translated to ${languageCode}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`   ✗ Failed to translate question ${question.id} (${languageCode}): ${message}`);
      }
    }
  }
}

if (import.meta.main) {
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 25;

  translateTrivia(Number.isNaN(limit) ? 25 : limit).catch((error) => {
    console.error('Fatal error during trivia localization:', error);
    process.exit(1);
  });
}

export { translateTrivia };
