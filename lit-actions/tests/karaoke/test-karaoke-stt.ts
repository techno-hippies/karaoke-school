#!/usr/bin/env bun

/**
 * Isolate Voxtral STT latency for karaoke grader.
 *
 * Usage:
 *   LIT_NETWORK=naga-dev bun tests/karaoke/test-karaoke-stt.ts
 *   LIT_NETWORK=naga-test bun tests/karaoke/test-karaoke-stt.ts
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

const AUDIO_PATH = process.env.KARAOKE_AUDIO_PATH || join(__dirname, '../fixtures/hey-im-scarlett-how-are-you-doing.wav');

function loadAudioToBase64(path: string): string {
  return fs.readFileSync(path).toString('base64');
}

async function loadVoxtralKey() {
  return Env.loadKey('karaoke', 'voxtral_api_key');
}

async function createAuthContext(litClient: any) {
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'karaoke-stt-test',
      networkName: Env.name,
      storagePath: Env.getAuthStoragePath('karaoke-stt'),
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
  console.log('🎙️ STT smoke test');
  console.log('Network:', Env.name, Env.isTest ? '(payments enforced)' : '(free)');
  console.log('Audio:', AUDIO_PATH);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const voxtralEncryptedKey = await loadVoxtralKey();
    console.log('✅ Loaded Voxtral key (CID:', voxtralEncryptedKey.cid, ')');

    const audioBase64 = loadAudioToBase64(AUDIO_PATH);
    const litClient = await createLitClient({ network: Env.litNetwork });
    const authContext = await createAuthContext(litClient);

    const code = `
      const VOXTRAL_TIMEOUT_MS = 20_000;
      async function decryptGenericKey(encrypted) {
        return await Lit.Actions.decryptAndCombine({
          accessControlConditions: encrypted.accessControlConditions,
          ciphertext: encrypted.ciphertext,
          dataToEncryptHash: encrypted.dataToEncryptHash,
          authSig: null,
          chain: "ethereum",
        });
      }

      async function transcribePerformance({ audioDataBase64, voxtralEncryptedKey }) {
        const voxtralKey = await decryptGenericKey(voxtralEncryptedKey);
        const audioBytes = Uint8Array.from(atob(audioDataBase64), (c) => c.charCodeAt(0));
        const boundary = "----LitBoundary" + Math.random().toString(36).substring(2, 10);
        const modelPart = \`--\${boundary}\\r\\nContent-Disposition: form-data; name="model"\\r\\n\\r\\nvoxtral-mini-latest\\r\\n\`;
        const filePart = \`--\${boundary}\\r\\nContent-Disposition: form-data; name="file"; filename="audio.webm"\\r\\nContent-Type: audio/webm\\r\\n\\r\\n\`;
        const footer = \`\\r\\n--\${boundary}--\\r\\n\`;
        const encoder = new TextEncoder();
        const body = concatUint8Arrays([
          encoder.encode(modelPart),
          encoder.encode(filePart),
          audioBytes,
          encoder.encode(footer),
        ]);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), VOXTRAL_TIMEOUT_MS);
        try {
          const response = await fetch("https://api.mistral.ai/v1/audio/transcriptions", {
            method: "POST",
            headers: {
              Authorization: \`Bearer \${voxtralKey}\`,
              "Content-Type": \`multipart/form-data; boundary=\${boundary}\`,
            },
            body,
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!response.ok) {
            const text = await response.text();
            throw new Error(\`Voxtral transcription failed: \${response.status} \${text.slice(0,120)}\`);
          }
          const json = await response.json();
          return json?.text || json?.transcript || "";
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      }

      function concatUint8Arrays(chunks) {
        const total = chunks.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        return result;
      }

      (async () => {
        const start = Date.now();
        try {
          const transcript = await transcribePerformance({
            audioDataBase64: jsParams.audioDataBase64,
            voxtralEncryptedKey: jsParams.voxtralEncryptedKey,
          });
          Lit.Actions.setResponse({
            response: JSON.stringify({ success: true, transcript, ms: Date.now() - start }),
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
      jsParams: { audioDataBase64: audioBase64, voxtralEncryptedKey },
    });

    console.log('Response:', result.response);
    await litClient.disconnect();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ STT test failed:', error.message);
    process.exit(1);
  }
}

main();
