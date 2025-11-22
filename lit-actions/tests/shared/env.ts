import { nagaDev, nagaTest } from '@lit-protocol/networks';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import * as contracts from '../../config/contracts.config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '../../');

// Load root .env if present (for API keys mostly)
dotenv.config({ path: join(ROOT_DIR, '.env') });

// Detect Environment
const RAW_ENV = (process.env.LIT_NETWORK || 'naga-dev').toLowerCase();
const IS_TEST = RAW_ENV === 'naga-test';
const IS_DEV = RAW_ENV === 'naga-dev';
const IS_MAINNET = RAW_ENV === 'mainnet';

if (!IS_TEST && !IS_DEV && !IS_MAINNET) {
  console.warn(`Unknown LIT_NETWORK: ${RAW_ENV}. Defaulting to naga-dev.`);
}

const ENV_NAME = IS_TEST ? 'naga-test' : (IS_MAINNET ? 'mainnet' : 'naga-dev');
const KEY_ENV = IS_TEST ? 'test' : (IS_MAINNET ? 'prod' : 'dev');

// Types
interface LitEnvConfig {
  network: string;
  cidFile: string;
  pkpFile: string;
  permissionsContract: string;
  notes?: string;
}

interface CIDs {
  karaoke: string;
  exercise: string;
}

interface EncryptedKey {
  cid: string;
  ciphertext: string;
  dataToEncryptHash: string;
}

// Load Configs
const litEnvsPath = join(ROOT_DIR, 'config/lit-envs.json');
const litEnvs: Record<string, LitEnvConfig> = JSON.parse(readFileSync(litEnvsPath, 'utf-8'));
const envConfig = litEnvs[ENV_NAME];

if (!envConfig) {
  throw new Error(`No config found for environment: ${ENV_NAME} in lit-envs.json`);
}

// Load CIDs
const cidPath = join(ROOT_DIR, envConfig.cidFile);
if (!existsSync(cidPath)) {
  throw new Error(`CID file not found: ${cidPath}`);
}
const cids: CIDs = JSON.parse(readFileSync(cidPath, 'utf-8'));

// Lit Network Object
const litNetwork = IS_TEST ? nagaTest : nagaDev;

export const Env = {
  name: ENV_NAME,
  keyEnv: KEY_ENV,
  isTest: IS_TEST,
  isDev: IS_DEV,
  isMainnet: IS_MAINNET,
  litNetwork,

  // Configs
  cids,
  contracts,
  config: envConfig,

  // Helpers
  paths: {
    root: ROOT_DIR,
    keys: join(ROOT_DIR, 'keys', KEY_ENV),
    output: join(ROOT_DIR, 'output', 'lit-auth', ENV_NAME),
  },

  getKeyPath(action: 'karaoke' | 'exercise', keyName: string): string {
    const fileName = `${keyName}_${action}.json`;
    return join(this.paths.keys, action, fileName);
  },

  loadKey(action: 'karaoke' | 'exercise', keyName: string): EncryptedKey {
    const path = this.getKeyPath(action, keyName);
    if (!existsSync(path)) {
      throw new Error(`Key file not found: ${path} (Env: ${ENV_NAME})`);
    }
    return JSON.parse(readFileSync(path, 'utf-8'));
  },

  getAuthStoragePath(appName: string): string {
    return join(this.paths.output, appName);
  }
};
