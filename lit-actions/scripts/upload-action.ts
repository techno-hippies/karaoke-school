#!/usr/bin/env bun

/**
 * Upload a Lit Action to IPFS via Pinata
 *
 * Usage:
 *   bun scripts/upload-action.ts <action-name>
 *   bun scripts/upload-action.ts karaoke
 *   bun scripts/upload-action.ts exercise
 *
 * Or with explicit path:
 *   bun scripts/upload-action.ts --path=actions/karaoke-grader-v1.js --name="Karaoke Grader v1"
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Env } from '../tests/shared/env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../');

// Parse CLI args
const args = process.argv.slice(2);
const pathArg = args.find(a => a.startsWith('--path='))?.split('=')[1];
const nameArg = args.find(a => a.startsWith('--name='))?.split('=')[1];
const actionArg = args.find(a => !a.startsWith('--'));

// Action definitions
const ACTIONS: Record<string, { path: string; name: string }> = {
  karaoke: {
    path: 'actions/karaoke-grader-v1.js',
    name: 'Karaoke Grader v1'
  },
  exercise: {
    path: 'actions/exercise-grader-v1.js',
    name: 'Exercise Grader v1'
  }
};

async function main() {
  const PINATA_JWT = process.env.PINATA_JWT;

  if (!PINATA_JWT) {
    console.error('❌ PINATA_JWT not found');
    console.error('   Set it in .env or export before running');
    process.exit(1);
  }

  let filePath: string;
  let actionName: string;

  if (pathArg) {
    // Explicit path mode
    filePath = pathArg;
    actionName = nameArg || pathArg.split('/').pop()!.replace('.js', '');
  } else if (actionArg && ACTIONS[actionArg]) {
    // Named action mode
    filePath = ACTIONS[actionArg].path;
    actionName = ACTIONS[actionArg].name;
  } else {
    console.error('❌ Usage:');
    console.error('   bun scripts/upload-action.ts <action-name>');
    console.error('   bun scripts/upload-action.ts --path=<file> --name=<name>');
    console.error('');
    console.error('Available actions:', Object.keys(ACTIONS).join(', '));
    process.exit(1);
  }

  const fullPath = join(ROOT_DIR, filePath);

  if (!existsSync(fullPath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`📤 Upload Lit Action`);
  console.log(`   Env: ${Env.name}`);
  console.log(`   File: ${filePath}`);
  console.log(`   Name: ${actionName}`);

  try {
    const jsCode = readFileSync(fullPath, 'utf-8');
    console.log(`   Size: ${jsCode.length} bytes`);

    // Upload to Pinata
    console.log('\n🚀 Uploading to IPFS via Pinata...');

    const formData = new FormData();
    const blob = new Blob([jsCode], { type: 'text/javascript' });
    const fileName = `${actionName.replace(/\s+/g, '-')}.js`;
    formData.append('file', blob, fileName);

    formData.append('pinataMetadata', JSON.stringify({
      name: actionName,
      keyvalues: {
        type: 'lit-action',
        network: Env.name,
        uploadDate: new Date().toISOString()
      }
    }));

    formData.append('pinataOptions', JSON.stringify({
      wrapWithDirectory: false
    }));

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinata upload failed: ${error}`);
    }

    const result = await response.json() as { IpfsHash: string };
    const cid = result.IpfsHash;

    console.log('\n✅ Upload successful!');
    console.log(`   CID: ${cid}`);
    console.log(`   Gateway: https://gateway.pinata.cloud/ipfs/${cid}`);

    // Update CID file if this is a known action
    if (actionArg && ACTIONS[actionArg]) {
      const cidPath = join(ROOT_DIR, `cids/${Env.keyEnv}.json`);
      if (existsSync(cidPath)) {
        const cids = JSON.parse(readFileSync(cidPath, 'utf-8'));
        const oldCid = cids[actionArg];
        cids[actionArg] = cid;
        writeFileSync(cidPath, JSON.stringify(cids, null, 2) + '\n');
        console.log(`\n📝 Updated cids/${Env.keyEnv}.json`);
        if (oldCid) {
          console.log(`   ${actionArg}: ${oldCid} → ${cid}`);
        } else {
          console.log(`   ${actionArg}: ${cid}`);
        }
      }
    }

    console.log('\n⚠️  Next steps:');
    console.log(`   1. Add PKP permission: bun scripts/add-permission.ts ${cid}`);
    console.log(`   2. Re-encrypt keys: bun scripts/encrypt-key.ts --action=${actionArg || 'karaoke'}`);

  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
