#!/usr/bin/env bun

/**
 * Complete Lit Action Setup Pipeline
 *
 * Orchestrates the full deployment workflow:
 * 1. Upload Lit Action to IPFS
 * 2. Add PKP permission for the new CID
 * 3. Re-encrypt API keys with the new CID
 * 4. Verify everything is configured correctly
 *
 * Usage:
 *   bun scripts/setup.ts karaoke           # Full setup for karaoke action
 *   bun scripts/setup.ts exercise          # Full setup for exercise action
 *   bun scripts/setup.ts --all             # Setup both actions
 *   bun scripts/setup.ts karaoke --dry-run # Preview without changes
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLitClient } from '@lit-protocol/lit-client';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Env } from '../tests/shared/env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../');

// Chronicle Yellowstone chain
const chronicleYellowstone = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'tstLPX', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com'] },
  },
};

// Action definitions
interface ActionDef {
  name: string;
  path: string;
  displayName: string;
  keys: { name: string; envVar: string }[];
}

const ACTIONS: Record<string, ActionDef> = {
  karaoke: {
    name: 'karaoke',
    path: 'actions/karaoke-grader-v1.js',
    displayName: 'Karaoke Grader v1',
    keys: [
      { name: 'voxtral_api_key', envVar: 'VOXTRAL_API_KEY' },
      { name: 'openrouter_api_key', envVar: 'OPENROUTER_API_KEY' }
    ]
  },
  exercise: {
    name: 'exercise',
    path: 'actions/exercise-grader-v1.js',
    displayName: 'Exercise Grader v1',
    keys: [
      { name: 'voxtral_api_key', envVar: 'VOXTRAL_API_KEY' }
    ]
  }
};

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const setupAll = args.includes('--all');
const actionArg = args.find(a => !a.startsWith('--'));

function log(msg: string, type: 'info' | 'success' | 'error' | 'warn' | 'step' = 'info') {
  const prefixes: Record<string, string> = {
    info: '   ',
    success: '✅ ',
    error: '❌ ',
    warn: '⚠️  ',
    step: '\n🔧 '
  };
  console.log(`${prefixes[type]}${msg}`);
}

async function uploadAction(action: ActionDef, pinataJwt: string): Promise<string> {
  const fullPath = join(ROOT_DIR, action.path);
  const jsCode = readFileSync(fullPath, 'utf-8');

  log(`Uploading ${action.path} (${jsCode.length} bytes)...`, 'info');

  const formData = new FormData();
  const blob = new Blob([jsCode], { type: 'text/javascript' });
  formData.append('file', blob, `${action.displayName.replace(/\s+/g, '-')}.js`);

  formData.append('pinataMetadata', JSON.stringify({
    name: action.displayName,
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
    headers: { 'Authorization': `Bearer ${pinataJwt}` },
    body: formData
  });

  if (!response.ok) {
    throw new Error(`Pinata upload failed: ${await response.text()}`);
  }

  const result = await response.json() as { IpfsHash: string };
  return result.IpfsHash;
}

async function addPermission(
  cid: string,
  pkpCreds: any,
  litClient: any,
  walletClient: any
): Promise<void> {
  const pkpPermissionsManager = await litClient.getPKPPermissionsManager({
    pkpIdentifier: { tokenId: pkpCreds.tokenId },
    account: walletClient.account,
  });

  await pkpPermissionsManager.addPermittedAction({
    ipfsId: cid,
    scopes: ['sign-anything'],
  });
}

async function encryptKeys(
  action: ActionDef,
  cid: string,
  litClient: any
): Promise<void> {
  const outputDir = join(ROOT_DIR, 'keys', Env.keyEnv, action.name);
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
        value: cid,
      },
    },
  ];

  for (const keyDef of action.keys) {
    const value = process.env[keyDef.envVar];
    if (!value) {
      log(`Skipping ${keyDef.name} (${keyDef.envVar} not set)`, 'warn');
      continue;
    }

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
      cid,
    };

    const filePath = join(outputDir, `${keyDef.name}_${action.name}.json`);
    writeFileSync(filePath, JSON.stringify(outputData, null, 2));
    log(`Encrypted ${keyDef.name}`, 'info');
  }
}

async function setupAction(action: ActionDef, ctx: {
  pinataJwt: string;
  pkpCreds: any;
  litClient: any;
  walletClient: any;
}): Promise<string> {
  log(`Setup ${action.displayName}`, 'step');

  // Step 1: Upload
  log('Uploading to IPFS...', 'info');
  const cid = dryRun ? 'QmDRYRUN' : await uploadAction(action, ctx.pinataJwt);
  log(`CID: ${cid}`, 'success');

  // Step 2: Update CID file
  const cidPath = join(ROOT_DIR, `cids/${Env.keyEnv}.json`);
  const cids = existsSync(cidPath) ? JSON.parse(readFileSync(cidPath, 'utf-8')) : {};
  const oldCid = cids[action.name];
  cids[action.name] = cid;
  if (!dryRun) {
    writeFileSync(cidPath, JSON.stringify(cids, null, 2) + '\n');
  }
  if (oldCid && oldCid !== cid) {
    log(`Updated cids/${Env.keyEnv}.json: ${oldCid.slice(0, 12)}... → ${cid.slice(0, 12)}...`, 'info');
  }

  // Step 3: Add PKP permission
  log('Adding PKP permission...', 'info');
  if (!dryRun) {
    await addPermission(cid, ctx.pkpCreds, ctx.litClient, ctx.walletClient);
  }
  log('Permission added', 'success');

  // Step 4: Encrypt keys
  log('Encrypting keys...', 'info');
  if (!dryRun) {
    await encryptKeys(action, cid, ctx.litClient);
  }
  log('Keys encrypted', 'success');

  return cid;
}

async function main() {
  // Determine which actions to setup
  let actionsToSetup: ActionDef[];

  if (setupAll) {
    actionsToSetup = Object.values(ACTIONS);
  } else if (actionArg && ACTIONS[actionArg]) {
    actionsToSetup = [ACTIONS[actionArg]];
  } else {
    console.error('❌ Usage: bun scripts/setup.ts <action|--all> [--dry-run]');
    console.error('   Available actions:', Object.keys(ACTIONS).join(', '));
    process.exit(1);
  }

  console.log('🚀 Lit Action Setup');
  console.log('═'.repeat(50));
  console.log(`   Env: ${Env.name}`);
  console.log(`   Actions: ${actionsToSetup.map(a => a.name).join(', ')}`);
  if (dryRun) {
    console.log('   Mode: DRY RUN (no changes)');
  }

  // Check required env vars
  const PINATA_JWT = process.env.PINATA_JWT;
  if (!PINATA_JWT) {
    console.error('\n❌ PINATA_JWT not found');
    process.exit(1);
  }

  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('\n❌ PRIVATE_KEY not found');
    process.exit(1);
  }
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }

  // Load PKP credentials
  const pkpPath = join(ROOT_DIR, `output/pkp-${Env.name}.json`);
  if (!existsSync(pkpPath)) {
    console.error(`\n❌ PKP file not found: output/pkp-${Env.name}.json`);
    process.exit(1);
  }
  const pkpCreds = JSON.parse(readFileSync(pkpPath, 'utf-8'));
  console.log(`   PKP: ${pkpCreds.ethAddress}`);

  // Connect to Lit
  console.log('\n🔌 Connecting to Lit Protocol...');
  const litClient = await createLitClient({ network: Env.litNetwork });
  console.log('✅ Connected');

  // Create wallet client
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: chronicleYellowstone,
    transport: http(),
  });

  const ctx = { pinataJwt: PINATA_JWT, pkpCreds, litClient, walletClient };
  const results: Record<string, string> = {};

  try {
    for (const action of actionsToSetup) {
      results[action.name] = await setupAction(action, ctx);
    }

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('✅ Setup Complete');
    console.log('═'.repeat(50));

    for (const [name, cid] of Object.entries(results)) {
      console.log(`   ${name}: ${cid}`);
    }

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - no changes were made');
    } else {
      console.log('\n📋 Next steps:');
      console.log('   1. Run tests: bun tests/karaoke/test-karaoke-grader.ts');
      console.log('   2. Verify: bun scripts/verify.ts');
    }

  } finally {
    await litClient.disconnect();
  }
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
