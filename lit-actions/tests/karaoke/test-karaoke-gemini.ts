#!/usr/bin/env bun

/**
 * Isolate Gemini/OpenRouter grading latency for karaoke grader.
 *
 * Usage:
 *   LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-gemini.ts
 *   LIT_NETWORK=naga-test bun tests/karaoke/test-karaoke-gemini.ts
 */

import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLitClient } from '@lit-protocol/lit-client';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from '../shared/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function loadOpenRouterKey() {
  return Env.loadKey('karaoke', 'openrouter_api_key');
}

async function createAuthContext(litClient: any) {
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'karaoke-gemini-test',
      networkName: Env.name,
      storagePath: Env.getAuthStoragePath('karaoke-gemini'),
    }),
  });

  const testPrivateKey = (
    process.env.PAYER_PRIVATE_KEY ||
    process.env.LIT_TEST_PRIVATE_KEY ||
    '0x' + '1'.padStart(64, '0')
  ) as `0x${string}`;
  const viemAccount = privateKeyToAccount(testPrivateKey);
  console.log('💳 Payer address:', viemAccount.address, Env.isTest ? '(needs tstLPX)' : '(free)');

  return authManager.createEoaAuthContext({
    authConfig: {
      chain: 'ethereum',
      expiration: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      resources: [
        {
          resource: new LitActionResource('*'),
          ability: 'lit-action-execution',
        },
      ],
    },
    config: { account: viemAccount },
    litClient,
  });
}

async function main() {
  console.log('🤖 Gemini/OpenRouter smoke test');
  console.log('Network:', Env.name, Env.isTest ? '(payments enforced)' : '(free)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const openRouterEncryptedKey = await loadOpenRouterKey();
    console.log('✅ Loaded OpenRouter key (CID:', openRouterEncryptedKey.cid, ')');

    const litClient = await createLitClient({ network: Env.litNetwork });
    const authContext = await createAuthContext(litClient);

    const code = `
      const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
      const OPENROUTER_REFERER = "https://karaoke.school";
      const OPENROUTER_APP_TITLE = "Karaoke School Grader";
      const GEMINI_TIMEOUT_MS = 25_000;

      async function decryptGenericKey(encrypted) {
        return await Lit.Actions.decryptAndCombine({
          accessControlConditions: encrypted.accessControlConditions,
          ciphertext: encrypted.ciphertext,
          dataToEncryptHash: encrypted.dataToEncryptHash,
          authSig: null,
          chain: "ethereum",
        });
      }

      function buildStructuredSchema() {
        return {
          type: "json_schema",
          json_schema: {
            name: "karaoke_grade",
            schema: {
              type: "object",
              properties: {
                aggregateScoreBp: { type: "integer", minimum: 0, maximum: 10000 },
                lines: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      lineIndex: { type: "integer" },
                      expectedText: { type: "string" },
                      transcriptExcerpt: { type: "string" },
                      scoreBp: { type: "integer", minimum: 0, maximum: 10000 },
                      feedback: { type: "string" },
                    },
                    required: ["lineIndex", "expectedText", "transcriptExcerpt", "scoreBp", "feedback"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["aggregateScoreBp", "lines"],
              additionalProperties: false,
            },
          },
        };
      }

      function buildGeminiMessages({ transcript, lyricsLines }) {
        const expected = lyricsLines
          .map((line, idx) => \`\${idx + 1}. \${line.text}\`)
          .join("\\n");
        return [
          {
            role: "system",
            content: [{ type: "text", text: "You are a karaoke pronunciation grader. Score each lyric line from 0-10000 based on pronunciation accuracy, timing, and clarity. Return structured JSON using the provided schema." }],
          },
          {
            role: "user",
            content: [{ type: "text", text: \`Transcript:\\n\${transcript}\\n\\nExpected Lines:\\n\${expected}\` }],
          },
        ];
      }

      function extractGeminiText(responseJson) {
        if (!responseJson) return null;
        const choice = responseJson.choices?.[0];
        if (!choice) return null;
        const probe = (value) => {
          if (!value) return null;
          if (typeof value === "string" && value.trim()) return value.trim();
          if (Array.isArray(value)) {
            for (const part of value) {
              const found = probe(part?.text) || probe(part?.output_text) || probe(part?.content) || (typeof part === "string" ? part : null);
              if (found) return found;
            }
          }
          if (typeof value === "object") {
            return probe(value.content) || probe(value.parts) || (typeof value.text === "string" ? value.text : null);
          }
          return null;
        };
        return probe(choice.message?.content) || probe(choice.message?.parts) || probe(choice.message) || probe(choice.content) || probe(choice.parts) || null;
      }

      function parseStructuredGeminiJson(rawText) {
        if (!rawText) return null;
        let sanitized = rawText.trim();
        try { return JSON.parse(sanitized); } catch {}
        const firstBrace = sanitized.indexOf("{");
        const lastBrace = sanitized.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try { return JSON.parse(sanitized.slice(firstBrace, lastBrace + 1)); } catch {}
        }
        return null;
      }

      async function gradeWithGemini({ transcript, lyricsLines, openRouterEncryptedKey }) {
        const apiKey = await decryptGenericKey(openRouterEncryptedKey);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
        try {
          const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: \`Bearer \${apiKey}\`,
              "HTTP-Referer": OPENROUTER_REFERER,
              "X-Title": OPENROUTER_APP_TITLE,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite-preview-09-2025",
              response_format: buildStructuredSchema(),
              messages: buildGeminiMessages({ transcript, lyricsLines }),
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!response.ok) {
            const text = await response.text();
            throw new Error(\`Gemini scoring failed: \${response.status} \${text.slice(0,120)}\`);
          }
          const json = await response.json();
          const structuredText = extractGeminiText(json);
          const parsed = parseStructuredGeminiJson(structuredText);
          if (!parsed) throw new Error("Gemini response is not valid JSON");
          return parsed;
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      }

      (async () => {
        const start = Date.now();
        try {
          const result = await gradeWithGemini({
            transcript: jsParams.transcript,
            lyricsLines: jsParams.lyricsLines,
            openRouterEncryptedKey: jsParams.openRouterEncryptedKey,
          });
          Lit.Actions.setResponse({
            response: JSON.stringify({ success: true, result, ms: Date.now() - start }),
          });
        } catch (error) {
          Lit.Actions.setResponse({
            response: JSON.stringify({ success: false, error: error.message, ms: Date.now() - start }),
          });
        }
      })();
    `;

    const result = await litClient.executeJs({
      code,
      authContext,
      jsParams: {
        transcript: process.env.KARAOKE_TRANSCRIPT || 'Test transcript for grading hello world',
        lyricsLines: [
          { index: 0, text: 'Test line one' },
          { index: 1, text: 'Test line two' },
        ],
        openRouterEncryptedKey,
      },
    });

    console.log('Response:', result.response);
    await litClient.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Gemini test failed:', error.message);
    process.exit(1);
  }
}

main();
