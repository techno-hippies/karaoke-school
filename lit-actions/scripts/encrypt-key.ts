#!/usr/bin/env bun

/**
 * Encrypt API keys for Lit Actions
 *
 * Usage:
 *   # Encrypt all keys for current environment
 *   bun scripts/encrypt-key.ts
 *
 *   # Encrypt specific key
 *   bun scripts/encrypt-key.ts --type=voxtral --action=karaoke
 *   bun scripts/encrypt-key.ts --type=openrouter --action=karaoke
 *
 *   # Override environment
 *   LIT_NETWORK=naga-test bun scripts/encrypt-key.ts
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Env } from '../tests/shared/env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../');

// Parse CLI args
const args = process.argv.slice(2);
const typeArg = args.find(a => a.startsWith('--type='))?.split('=')[1];
const actionArg = args.find(a => a.startsWith('--action='))?.split('=')[1];

// Key definitions
interface KeyDef {
  name: string;
  envVar: string;
}

interface Task {
  action: 'karaoke' | 'exercise' | 'karaoke-line' | 'chat' | 'tts';
  cid: string;
  keys: KeyDef[];
}

const ALL_TASKS: Task[] = [
  {
    action: 'karaoke',
    cid: Env.cids.karaoke,
    keys: [
      { name: 'voxtral_api_key', envVar: 'VOXTRAL_API_KEY' },
      { name: 'openrouter_api_key', envVar: 'OPENROUTER_API_KEY' }
    ]
  },
  {
    action: 'karaoke-line',
    cid: Env.cids['karaoke-line'] || Env.cids.karaoke,
    keys: [
      { name: 'voxtral_api_key', envVar: 'VOXTRAL_API_KEY' }
    ]
  },
  {
    action: 'exercise',
    cid: Env.cids.exercise,
    keys: [
      { name: 'voxtral_api_key', envVar: 'VOXTRAL_API_KEY' }
    ]
  },
  {
    action: 'chat',
    cid: Env.cids.chat || 'placeholder-chat-cid',
    keys: [
      { name: 'openrouter_api_key', envVar: 'OPENROUTER_API_KEY' },
      { name: 'deepinfra_api_key', envVar: 'DEEPINFRA_API_KEY' }
    ]
  },
  {
    action: 'tts',
    cid: Env.cids.tts || 'placeholder-tts-cid',
    keys: [
      { name: 'deepinfra_api_key', envVar: 'DEEPINFRA_API_KEY' }
    ]
  }
];

// Filter tasks based on CLI args
function getTasks(): Task[] {
  if (!typeArg && !actionArg) {
    return ALL_TASKS;
  }

  return ALL_TASKS
    .filter(task => !actionArg || task.action === actionArg)
    .map(task => ({
      ...task,
      keys: task.keys.filter(k => !typeArg || k.name.includes(typeArg))
    }))
    .filter(task => task.keys.length > 0);
}

async function main() {
  const tasks = getTasks();

  if (tasks.length === 0) {
    console.error('❌ No matching keys found for:', { type: typeArg, action: actionArg });
    console.error('   Available types: voxtral, openrouter');
    console.error('   Available actions: karaoke, exercise');
    process.exit(1);
  }

  console.log(`🔐 Encrypt Keys for ${Env.name}`);
  console.log(`   Key env: ${Env.keyEnv}`);
  console.log(`   Network: ${Env.isTest ? 'naga-test (paid)' : 'naga-dev (free)'}`);

  // Check required env vars
  const requiredVars = new Set<string>();
  tasks.forEach(task => task.keys.forEach(k => requiredVars.add(k.envVar)));

  const missingVars = [...requiredVars].filter(v => !process.env[v]);
  if (missingVars.length > 0) {
    console.error(`\n❌ Missing environment variables: ${missingVars.join(', ')}`);
    console.error('   Set them in .env or export before running');
    process.exit(1);
  }

  const litClient = await createLitClient({ network: Env.litNetwork });
  console.log('🔌 Connected to Lit\n');

  for (const task of tasks) {
    console.log(`📂 Action: ${task.action}`);
    console.log(`   CID: ${task.cid}`);

    const outputDir = join(ROOT_DIR, 'keys', Env.keyEnv, task.action);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const accessControlConditions = [
      {
        conditionType: 'evmBasic',
        contractAddress: '',
        standardContractType: '',
        chain: 'ethereum',
        method: '',
        parameters: [':currentActionIpfsId'],
        returnValueTest: {
          comparator: '=',
          value: task.cid,
        },
      },
    ];

    for (const keyDef of task.keys) {
      const value = process.env[keyDef.envVar]!;
      console.log(`   🔑 Encrypting ${keyDef.name}...`);

      try {
        const encrypted = await litClient.encrypt({
          dataToEncrypt: value,
          unifiedAccessControlConditions: accessControlConditions,
          chain: 'ethereum',
        });

        const outputData = {
          ciphertext: encrypted.ciphertext,
          dataToEncryptHash: encrypted.dataToEncryptHash,
          accessControlConditions,
          encryptedAt: new Date().toISOString(),
          cid: task.cid,
        };

        const fileName = `${keyDef.name}_${task.action}.json`;
        const filePath = join(outputDir, fileName);
        writeFileSync(filePath, JSON.stringify(outputData, null, 2));
        console.log(`      ✅ keys/${Env.keyEnv}/${task.action}/${fileName}`);
      } catch (err: any) {
        console.error(`      ❌ Failed: ${err.message}`);
        process.exit(1);
      }
    }
    console.log('');
  }

  await litClient.disconnect();
  console.log('✨ Encryption complete!');
  console.log('');
  console.log('💡 Frontend imports keys directly from lit-actions/keys/');
  console.log('   Restart app dev server to pick up changes (HMR)');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
