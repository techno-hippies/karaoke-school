#!/usr/bin/env bun

/**
 * Verify keys and PKP permissions for Lit Actions
 *
 * Usage:
 *   bun scripts/verify.ts                    # Verify current env (LIT_NETWORK)
 *   bun scripts/verify.ts --all              # Verify all environments
 *   bun scripts/verify.ts --keys-only        # Skip PKP permission check
 *   bun scripts/verify.ts --permissions-only # Skip key verification
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev, nagaTest } from '@lit-protocol/networks';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../');

// Parse args
const args = process.argv.slice(2);
const checkAll = args.includes('--all');
const keysOnly = args.includes('--keys-only');
const permissionsOnly = args.includes('--permissions-only');

// Config
const NETWORK_MAP: Record<string, any> = { nagaDev, nagaTest };
const KEY_ENV_MAP: Record<string, string> = {
  'naga-dev': 'dev',
  'naga-test': 'test',
  'mainnet': 'prod'
};

const EXPECTED_KEYS: Record<string, string[]> = {
  karaoke: ['voxtral_api_key', 'openrouter_api_key'],
  exercise: ['voxtral_api_key']
};

interface EnvConfig {
  network: string;
  cidFile: string;
  pkpFile: string;
  permissionsContract: string;
}

async function loadEnvConfig(envName: string): Promise<EnvConfig> {
  const configs = JSON.parse(readFileSync(join(ROOT_DIR, 'config/lit-envs.json'), 'utf-8'));
  const config = configs[envName];
  if (!config) {
    throw new Error(`Unknown environment: ${envName}`);
  }
  return config;
}

async function verifyKeys(envName: string): Promise<boolean> {
  const keyEnv = KEY_ENV_MAP[envName];
  const cidPath = join(ROOT_DIR, `cids/${keyEnv}.json`);

  if (!existsSync(cidPath)) {
    console.error(`  ❌ CID file not found: cids/${keyEnv}.json`);
    return false;
  }

  const cids = JSON.parse(readFileSync(cidPath, 'utf-8'));
  let allValid = true;

  for (const [action, keys] of Object.entries(EXPECTED_KEYS)) {
    const cid = cids[action];
    if (!cid) {
      console.error(`  ❌ Missing CID for ${action}`);
      allValid = false;
      continue;
    }

    for (const keyName of keys) {
      const fileName = `${keyName}_${action}.json`;
      const keyPath = join(ROOT_DIR, 'keys', keyEnv, action, fileName);

      if (!existsSync(keyPath)) {
        console.error(`  ❌ Missing: keys/${keyEnv}/${action}/${fileName}`);
        allValid = false;
        continue;
      }

      try {
        const keyData = JSON.parse(readFileSync(keyPath, 'utf-8'));
        if (keyData.cid !== cid) {
          console.error(`  ❌ CID mismatch in ${fileName}`);
          console.error(`     Expected: ${cid}`);
          console.error(`     Found:    ${keyData.cid}`);
          allValid = false;
        } else {
          console.log(`  ✅ ${action}/${fileName}`);
        }
      } catch (e: any) {
        console.error(`  ❌ Invalid JSON in ${fileName}: ${e.message}`);
        allValid = false;
      }
    }
  }

  return allValid;
}

async function verifyPermissions(envName: string): Promise<boolean> {
  const envConfig = await loadEnvConfig(envName);
  const network = NETWORK_MAP[envConfig.network];

  if (!network) {
    console.error(`  ❌ Invalid network: ${envConfig.network}`);
    return false;
  }

  const pkpPath = join(ROOT_DIR, envConfig.pkpFile);
  if (!existsSync(pkpPath)) {
    console.error(`  ❌ PKP file not found: ${envConfig.pkpFile}`);
    return false;
  }

  const pkpCreds = JSON.parse(readFileSync(pkpPath, 'utf-8'));
  const keyEnv = KEY_ENV_MAP[envName];
  const cids = JSON.parse(readFileSync(join(ROOT_DIR, `cids/${keyEnv}.json`), 'utf-8'));

  console.log(`  PKP: ${pkpCreds.ethAddress}`);

  const litClient = await createLitClient({ network });
  const permissions = await litClient.viewPKPPermissions({ tokenId: pkpCreds.tokenId });
  await litClient.disconnect();

  const permitted = new Set((permissions?.actions ?? []).map((a: any) => a.ipfsId || a));
  let allValid = true;

  for (const [action, cid] of Object.entries(cids)) {
    if (permitted.has(cid)) {
      console.log(`  ✅ ${action}: ${cid}`);
    } else {
      console.error(`  ❌ ${action}: ${cid} (not permitted)`);
      allValid = false;
    }
  }

  return allValid;
}

async function verifyEnvironment(envName: string): Promise<boolean> {
  console.log(`\n🔍 ${envName}`);
  console.log('─'.repeat(40));

  let keysValid = true;
  let permissionsValid = true;

  if (!permissionsOnly) {
    console.log('\n📁 Keys:');
    keysValid = await verifyKeys(envName);
  }

  if (!keysOnly) {
    console.log('\n🔐 Permissions:');
    permissionsValid = await verifyPermissions(envName);
  }

  return keysValid && permissionsValid;
}

async function main() {
  console.log('🔍 Lit Actions Verification');

  const envsToCheck = checkAll
    ? ['naga-dev', 'naga-test']
    : [process.env.LIT_NETWORK?.toLowerCase() || 'naga-dev'];

  let allValid = true;

  for (const env of envsToCheck) {
    const valid = await verifyEnvironment(env);
    if (!valid) allValid = false;
  }

  console.log('\n' + '═'.repeat(40));
  if (allValid) {
    console.log('✨ All verifications passed!');
    process.exit(0);
  } else {
    console.error('❌ Some verifications failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
