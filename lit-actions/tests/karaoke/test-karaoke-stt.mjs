#!/usr/bin/env node

/**
 * Isolate Voxtral STT latency for karaoke grader.
 *
 * Usage:
 *   KARAOKE_AUDIO_PATH=./tests/fixtures/hey-im-scarlett-how-are-you-doing.wav bun tests/karaoke/test-karaoke-stt.mjs
 */

const fs = require('fs');
const { join, dirname } = require('path');
const { fileURLToPath } = require('url');
const dotenv = require('dotenv');
const { createLitClient } = require('@lit-protocol/lit-client');
const { nagaTest } = require('@lit-protocol/networks');
const { createAuthManager, storagePlugins } = require('@lit-protocol/auth');
const { LitActionResource } = require('@lit-protocol/auth-helpers');
const { privateKeyToAccount } = require('viem/accounts');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const AUDIO_PATH =
  process.env.KARAOKE_AUDIO_PATH ||
  join(__dirname, '../fixtures/hey-im-scarlett-how-are-you-doing.wav');

function loadAudioToBase64(path) {
  return fs.readFileSync(path).toString('base64');
}

async function loadVoxtralKey() {
  const keyPath = join(__dirname, '../keys/karaoke/voxtral_api_key_karaoke.json');
  return JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
}

async function createAuthContext(litClient) {
  const authManager = createAuthManager({
    storage: storagePlugins.localStorageNode({
      appName: 'karaoke-stt-test',
      networkName: 'naga-test',
      storagePath: './lit-auth-storage',
    }),
  });

  const testPrivateKey = process.env.LIT_TEST_PRIVATE_KEY || '0x' + '1'.padStart(64, '0');
  const viemAccount = privateKeyToAccount(testPrivateKey);

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
  console.log('Audio:', AUDIO_PATH);
  try {
    const voxtralEncryptedKey = await loadVoxtralKey();
    const audioBase64 = loadAudioToBase64(AUDIO_PATH);
    const litClient = await createLitClient({ network: nagaTest });
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
            response: JSON.stringify({
              success: true,
              transcript,
              ms: Date.now() - start,
            }),
          });
        } catch (error) {
          Lit.Actions.setResponse({
            response: JSON.stringify({
              success: false,
              error: error.message,
              ms: Date.now() - start,
            }),
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
  } catch (error) {
    console.error('❌ STT test failed:', error);
    process.exit(1);
  }
}

main();
