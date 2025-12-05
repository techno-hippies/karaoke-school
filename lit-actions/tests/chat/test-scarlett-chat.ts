#!/usr/bin/env bun

/**
 * Test Script for Multi-Personality Chat v1 - Venice AI Chat Action with STT
 *
 * Tests CHAT, TRANSLATE, and STT modes
 *
 * Usage:
 *   # Test mode (no API calls)
 *   CHAT_TEST_MODE=true bun tests/chat/test-scarlett-chat.ts
 *
 *   # Real mode with local code (requires VENICE_API_KEY)
 *   CHAT_USE_LOCAL_CODE=true bun tests/chat/test-scarlett-chat.ts
 *
 *   # Real mode with IPFS CID (after upload)
 *   LIT_NETWORK=naga-dev bun tests/chat/test-scarlett-chat.ts
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { createAuthManager, storagePlugins } from '@lit-protocol/auth';
import { LitActionResource } from '@lit-protocol/auth-helpers';
import { privateKeyToAccount } from 'viem/accounts';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Env } from '../shared/env';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const TEST_MODE = process.env.CHAT_TEST_MODE === 'true';
const USE_LOCAL_CODE = ['true', '1'].includes((process.env.CHAT_USE_LOCAL_CODE || 'true').toLowerCase());

async function loadVeniceEncryptedKey() {
  console.log('🔐 Loading encrypted Venice API key...');
  const keyPath = Env.getKeyPath('chat', 'venice_api_key');

  if (!existsSync(keyPath)) {
    console.log(`⚠️  Key file not found: ${keyPath}`);
    console.log('   Run: VENICE_API_KEY=xxx bun scripts/encrypt-key.ts --action=chat');
    return null;
  }

  const keyData = Env.loadKey('chat', 'venice_api_key');
  console.log(`✅ Encrypted key loaded (CID: ${keyData.cid})`);
  return keyData;
}

async function loadDeepinfraEncryptedKey() {
  console.log('🔐 Loading encrypted DeepInfra API key...');
  const keyPath = Env.getKeyPath('chat', 'deepinfra_api_key');

  if (!existsSync(keyPath)) {
    console.log(`⚠️  DeepInfra key file not found: ${keyPath}`);
    console.log('   Run: DEEPINFRA_API_KEY=xxx bun scripts/encrypt-key.ts --action=chat');
    return null;
  }

  const keyData = Env.loadKey('chat', 'deepinfra_api_key');
  console.log(`✅ DeepInfra key loaded (CID: ${keyData.cid})`);
  return keyData;
}

async function main() {
  console.log('🤖 Multi-Personality Chat v1 Test\n');
  console.log('Network:', Env.name);
  console.log('Test mode:', TEST_MODE ? 'ON (no API calls)' : 'OFF (real Venice API calls)');
  console.log('Local code:', USE_LOCAL_CODE ? 'ON' : 'OFF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Load encrypted keys (may be null in test mode)
    const veniceEncryptedKey = TEST_MODE ? null : await loadVeniceEncryptedKey();
    const deepinfraEncryptedKey = TEST_MODE ? null : await loadDeepinfraEncryptedKey();

    if (!TEST_MODE && !veniceEncryptedKey) {
      console.log('\n⚠️  No encrypted Venice key found. Running in test mode instead.');
      process.env.CHAT_TEST_MODE = 'true';
    }

    // Set up Auth Manager
    console.log('\n🔐 Setting up Auth Manager...');
    const authManager = createAuthManager({
      storage: storagePlugins.localStorageNode({
        appName: "scarlett-chat-test",
        networkName: Env.name,
        storagePath: Env.getAuthStoragePath('scarlett-chat')
      }),
    });

    // Connect to Lit
    console.log(`\n🔌 Connecting to Lit Protocol (${Env.name})...`);
    const litClient = await createLitClient({ network: Env.litNetwork });
    console.log('✅ Connected to Lit Network');

    // Create authentication context
    console.log('\n🔐 Creating authentication context...');
    const payerPrivateKey = (
      process.env.PAYER_PRIVATE_KEY ||
      process.env.PRIVATE_KEY ||
      ('0x' + '0'.repeat(63) + '1')
    ) as `0x${string}`;
    const viemAccount = privateKeyToAccount(payerPrivateKey);
    console.log('💳 Payer address:', viemAccount.address);

    const authContext = await authManager.createEoaAuthContext({
      authConfig: {
        chain: 'ethereum',
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
        resources: [
          {
            resource: new LitActionResource('*'),
            ability: 'lit-action-execution'
          }
        ]
      },
      config: {
        account: viemAccount
      },
      litClient: litClient
    });
    console.log('✅ Auth context created');

    // ========================================
    // TEST 1: CHAT MODE
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 TEST 1: CHAT MODE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const chatParams = {
      mode: 'CHAT',
      userMessage: '你好！我想学英语，应该从哪里开始？',
      conversationHistory: [],
      veniceEncryptedKey: veniceEncryptedKey,
      testMode: TEST_MODE || !veniceEncryptedKey
    };

    console.log('📤 Sending message:', chatParams.userMessage);
    console.log('');

    const chatExecParams: any = USE_LOCAL_CODE
      ? {
          code: await readFile(join(__dirname, '../../actions/chat/multi-personality-chat-v1.js'), 'utf-8'),
          authContext: authContext,
          jsParams: chatParams,
        }
      : {
          ipfsId: Env.cids.chat,
          authContext: authContext,
          jsParams: chatParams,
        };

    const chatStartTime = Date.now();
    const chatResult = await litClient.executeJs(chatExecParams);
    const chatExecTime = Date.now() - chatStartTime;

    const chatResponse = JSON.parse(chatResult.response as string);

    console.log('📥 Response:');
    console.log('   Success:', chatResponse.success);
    console.log('   Mode:', chatResponse.mode);
    console.log('   Reply:', chatResponse.reply);
    if (chatResponse.usage) {
      console.log('   Tokens:', chatResponse.usage.total_tokens);
    }
    console.log('   Execution time:', chatExecTime, 'ms');

    if (chatResponse.error) {
      console.log('   ❌ Error:', chatResponse.error);
    }

    // ========================================
    // TEST 2: TRANSLATE MODE
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 TEST 2: TRANSLATE MODE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const translateParams = {
      mode: 'TRANSLATE',
      textToTranslate: 'Hello! I am Scarlett, your English tutor. Let\'s learn together!',
      veniceEncryptedKey: veniceEncryptedKey,
      testMode: TEST_MODE || !veniceEncryptedKey
    };

    console.log('📤 Text to translate:', translateParams.textToTranslate);
    console.log('');

    const translateExecParams: any = USE_LOCAL_CODE
      ? {
          code: await readFile(join(__dirname, '../../actions/chat/multi-personality-chat-v1.js'), 'utf-8'),
          authContext: authContext,
          jsParams: translateParams,
        }
      : {
          ipfsId: Env.cids.chat,
          authContext: authContext,
          jsParams: translateParams,
        };

    const translateStartTime = Date.now();
    const translateResult = await litClient.executeJs(translateExecParams);
    const translateExecTime = Date.now() - translateStartTime;

    const translateResponse = JSON.parse(translateResult.response as string);

    console.log('📥 Response:');
    console.log('   Success:', translateResponse.success);
    console.log('   Mode:', translateResponse.mode);
    console.log('   Original:', translateResponse.original);
    console.log('   Translation:', translateResponse.translation);
    if (translateResponse.usage) {
      console.log('   Tokens:', translateResponse.usage.total_tokens);
    }
    console.log('   Execution time:', translateExecTime, 'ms');

    if (translateResponse.error) {
      console.log('   ❌ Error:', translateResponse.error);
    }

    // ========================================
    // TEST 3: CHAT WITH TTS (Audio Response)
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 TEST 3: CHAT WITH TTS (Audio Response)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const ttsParams = {
      mode: 'CHAT',
      userMessage: 'Say hello in a fun way!',
      conversationHistory: [],
      veniceEncryptedKey: veniceEncryptedKey,
      deepinfraEncryptedKey: deepinfraEncryptedKey,
      returnAudio: true,  // Request TTS
      testMode: TEST_MODE || !veniceEncryptedKey || !deepinfraEncryptedKey
    };

    console.log('📤 Sending message:', ttsParams.userMessage);
    console.log('🔊 Return audio:', ttsParams.returnAudio);
    console.log('');

    const ttsExecParams: any = USE_LOCAL_CODE
      ? {
          code: await readFile(join(__dirname, '../../actions/chat/multi-personality-chat-v1.js'), 'utf-8'),
          authContext: authContext,
          jsParams: ttsParams,
        }
      : {
          ipfsId: Env.cids.chat,
          authContext: authContext,
          jsParams: ttsParams,
        };

    const ttsStartTime = Date.now();
    const ttsResult = await litClient.executeJs(ttsExecParams);
    const ttsExecTime = Date.now() - ttsStartTime;

    const ttsResponse = JSON.parse(ttsResult.response as string);

    console.log('📥 Response:');
    console.log('   Success:', ttsResponse.success);
    console.log('   Mode:', ttsResponse.mode);
    console.log('   Reply:', ttsResponse.reply);
    console.log('   Has Audio:', ttsResponse.replyAudio ? `Yes (${ttsResponse.replyAudio.length} bytes base64)` : 'No');
    if (ttsResponse.ttsWarning) {
      console.log('   ⚠️  TTS Warning:', ttsResponse.ttsWarning);
    }
    if (ttsResponse.usage) {
      console.log('   Tokens:', ttsResponse.usage.total_tokens);
    }
    console.log('   Execution time:', ttsExecTime, 'ms');

    if (ttsResponse.error) {
      console.log('   ❌ Error:', ttsResponse.error);
    }

    // ========================================
    // TEST 4: CHAT WITH STT (Audio Input)
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 TEST 4: CHAT WITH STT (Audio Input)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Load audio file
    const audioPath = join(__dirname, '../fixtures/hey-im-scarlett-how-are-you-doing.wav');
    let sttResponse: any = { success: false, error: 'Skipped' };
    let sttExecTime = 0;

    if (!existsSync(audioPath)) {
      console.log('⚠️  Audio fixture not found:', audioPath);
      console.log('   STT test skipped');
    } else {
      const audioBuffer = await readFile(audioPath);
      const audioDataBase64 = audioBuffer.toString('base64');

      console.log('🎤 Audio file:', audioPath);
      console.log('📦 Audio size:', Math.round(audioBuffer.length / 1024), 'KB');
      console.log('');

      const sttParams = {
        mode: 'CHAT',
        audioDataBase64: audioDataBase64,  // Audio input instead of text
        conversationHistory: [],
        veniceEncryptedKey: veniceEncryptedKey,
        deepinfraEncryptedKey: deepinfraEncryptedKey,
        testMode: TEST_MODE || !veniceEncryptedKey || !deepinfraEncryptedKey
      };

      const sttExecParams: any = USE_LOCAL_CODE
        ? {
            code: await readFile(join(__dirname, '../../actions/chat/multi-personality-chat-v1.js'), 'utf-8'),
            authContext: authContext,
            jsParams: sttParams,
          }
        : {
            ipfsId: Env.cids.chat,
            authContext: authContext,
            jsParams: sttParams,
          };

      const sttStartTime = Date.now();
      const sttResult = await litClient.executeJs(sttExecParams);
      sttExecTime = Date.now() - sttStartTime;

      sttResponse = JSON.parse(sttResult.response as string);

      console.log('📥 Response:');
      console.log('   Success:', sttResponse.success);
      console.log('   Mode:', sttResponse.mode);
      console.log('   Transcript:', sttResponse.transcript);
      console.log('   Reply:', sttResponse.reply);
      if (sttResponse.usage) {
        console.log('   Tokens:', sttResponse.usage.total_tokens);
      }
      console.log('   Execution time:', sttExecTime, 'ms');

      if (sttResponse.error) {
        console.log('   ❌ Error:', sttResponse.error);
      }
    }

    // ========================================
    // RESULTS SUMMARY
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const assertions = [
      {
        name: 'Chat mode successful',
        pass: chatResponse.success === true,
        actual: chatResponse.success
      },
      {
        name: 'Chat reply returned',
        pass: chatResponse.reply && chatResponse.reply.length > 0,
        actual: chatResponse.reply ? `"${chatResponse.reply.substring(0, 50)}..."` : 'null'
      },
      {
        name: 'Translate mode successful',
        pass: translateResponse.success === true,
        actual: translateResponse.success
      },
      {
        name: 'Translation returned',
        pass: translateResponse.translation && translateResponse.translation.length > 0,
        actual: translateResponse.translation ? `"${translateResponse.translation.substring(0, 50)}..."` : 'null'
      },
      {
        name: 'Version correct (chat)',
        pass: chatResponse.version === 'multi-personality-chat-v1',
        actual: chatResponse.version
      },
      {
        name: 'TTS mode successful',
        pass: ttsResponse.success === true,
        actual: ttsResponse.success
      },
      {
        name: 'TTS reply returned',
        pass: ttsResponse.reply && ttsResponse.reply.length > 0,
        actual: ttsResponse.reply ? `"${ttsResponse.reply.substring(0, 50)}..."` : 'null'
      },
      {
        name: 'TTS audio or warning returned',
        pass: (ttsResponse.replyAudio && ttsResponse.replyAudio.length > 0) || ttsResponse.ttsWarning,
        actual: ttsResponse.replyAudio ? `${ttsResponse.replyAudio.length} bytes` : (ttsResponse.ttsWarning || 'null')
      },
      {
        name: 'STT mode successful',
        pass: sttResponse.success === true,
        actual: sttResponse.success
      },
      {
        name: 'STT transcript returned',
        pass: sttResponse.transcript && sttResponse.transcript.length > 0,
        actual: sttResponse.transcript ? `"${sttResponse.transcript.substring(0, 50)}..."` : 'null'
      },
      {
        name: 'STT reply returned',
        pass: sttResponse.reply && sttResponse.reply.length > 0,
        actual: sttResponse.reply ? `"${sttResponse.reply.substring(0, 50)}..."` : 'null'
      }
    ];

    assertions.forEach((assertion, i) => {
      const status = assertion.pass ? '✅' : '❌';
      console.log(`${i + 1}. ${status} ${assertion.name}`);
      if (!assertion.pass) {
        console.log(`   Expected: true, Got: ${assertion.actual}`);
      }
    });

    const allPassed = assertions.every(a => a.pass);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED! 🎉');
      if (TEST_MODE || !veniceEncryptedKey) {
        console.log('\n💡 Note: Running in test mode. To test with real Venice API:');
        console.log('   1. Set VENICE_API_KEY in .env');
        console.log('   2. Run: bun scripts/encrypt-key.ts --action=chat');
        console.log('   3. Run: CHAT_TEST_MODE=false bun tests/chat/test-scarlett-chat.ts');
      }
    } else {
      console.log('❌ SOME TESTS FAILED');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await litClient.disconnect();
    process.exit(allPassed ? 0 : 1);

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
