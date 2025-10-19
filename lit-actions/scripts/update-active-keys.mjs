#!/usr/bin/env node

/**
 * Update app/src/lib/lit/keys/active.ts with newly encrypted keys
 *
 * Usage:
 *   node scripts/update-active-keys.mjs --key elevenlabs --file src/karaoke/keys/elevenlabs_api_key_v11.json --cid QmXXX
 */

import { readFile, writeFile } from 'fs/promises';

const args = process.argv.slice(2);
const keyIndex = args.indexOf('--key');
const fileIndex = args.indexOf('--file');
const cidIndex = args.indexOf('--cid');

if (keyIndex === -1 || fileIndex === -1 || cidIndex === -1) {
  console.error('Usage: node update-active-keys.mjs --key <elevenlabs|genius|openrouter> --file <path> --cid <CID>');
  process.exit(1);
}

const keyType = args[keyIndex + 1];  // e.g., "elevenlabs", "genius", "openrouter"
const keyFile = args[fileIndex + 1];
const cid = args[cidIndex + 1];

// Read the encrypted key JSON
const encryptedKey = JSON.parse(await readFile(keyFile, 'utf-8'));

// Map key type to constant name and description
const keyMap = {
  elevenlabs: {
    constName: 'ELEVENLABS_API_KEY',
    description: 'ElevenLabs API Key',
    actionName: 'Base Alignment Lit Action'
  },
  genius: {
    constName: 'GENIUS_API_KEY',
    description: 'Genius API Key',
    actionName: 'Match and Segment Lit Action'
  },
  openrouter: {
    constName: 'OPENROUTER_API_KEY',
    description: 'OpenRouter API Key',
    actionName: 'Match and Segment Lit Action'
  }
};

const keyInfo = keyMap[keyType];
if (!keyInfo) {
  console.error(`Unknown key type: ${keyType}`);
  process.exit(1);
}

// Read active.ts file
const activeFile = '../app/src/lib/lit/keys/active.ts';
let activeContent = await readFile(activeFile, 'utf-8');

// Build the replacement text
const newKeyBlock = `/**
 * ${keyInfo.description} (v${encryptedKey.cid.slice(-4)})
 * Bound to ${keyInfo.actionName}: ${cid}
 */
export const ${keyInfo.constName}: EncryptedKey = {
  ciphertext: "${encryptedKey.ciphertext}",
  dataToEncryptHash: "${encryptedKey.dataToEncryptHash}",
  accessControlConditions: [
    {
      conditionType: "evmBasic",
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "",
      parameters: [":currentActionIpfsId"],
      returnValueTest: {
        comparator: "=",
        value: "${cid}"
      }
    }
  ],
  encryptedAt: "${encryptedKey.encryptedAt}",
  cid: "${cid}"
}`;

// Replace the old key block with the new one
// Match from the comment to the closing brace
const regex = new RegExp(
  `/\\*\\*[\\s\\S]*?${keyInfo.constName}[\\s\\S]*?export const ${keyInfo.constName}: EncryptedKey = \\{[\\s\\S]*?\\n\\}`,
  'm'
);

if (!regex.test(activeContent)) {
  console.error(`Could not find ${keyInfo.constName} in ${activeFile}`);
  process.exit(1);
}

activeContent = activeContent.replace(regex, newKeyBlock);

// Write back to file
await writeFile(activeFile, activeContent);
console.log(`✅ Updated ${keyInfo.constName} in ${activeFile}`);
console.log(`   CID: ${cid}`);
