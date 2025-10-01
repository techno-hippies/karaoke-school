#!/usr/bin/env bun

/**
 * Get PKP Public Key from Token ID
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🔍 Fetching PKP Public Key\n');

  // Load PKP credentials
  const pkpCredsPath = dirname(__dirname) + '/output/pkp-credentials.json';
  const pkpCreds = JSON.parse(await readFile(pkpCredsPath, 'utf-8'));
  console.log('PKP Address:', pkpCreds.ethAddress);
  console.log('Token ID:', pkpCreds.tokenId);

  // Connect to Lit
  console.log('\n🔌 Connecting to Lit Protocol...');
  const litClient = await createLitClient({ network: nagaDev });
  console.log('✅ Connected');

  // Get PKP public key from contract
  console.log('\n📦 Reading PKP public key from contract...');

  const pubKey = await litClient.getPubKeyFromTokenId({ tokenId: pkpCreds.tokenId });
  console.log('✅ Public Key:', pubKey);

  // Update credentials file
  if (pubKey) {
    pkpCreds.publicKey = pubKey;
    await writeFile(pkpCredsPath, JSON.stringify(pkpCreds, null, 2));
    console.log('\n✅ Updated pkp-credentials.json with public key');
  } else {
    console.log('\n⚠️  Could not fetch public key');
  }

  await litClient.disconnect();
}

main().catch(console.error);
