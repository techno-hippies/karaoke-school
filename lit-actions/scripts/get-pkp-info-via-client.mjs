#!/usr/bin/env node

/**
 * Get PKP Info via Lit Client
 */

import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🔐 Fetching PKP Info via Lit Client\n');

  // Load PKP credentials
  const pkpCredsPath = join(dirname(__dirname), 'output/pkp-credentials.json');
  const pkpCreds = JSON.parse(await readFile(pkpCredsPath, 'utf-8'));

  console.log('📋 PKP Info from credentials:');
  console.log('   Token ID:', pkpCreds.tokenId);
  console.log('   ETH Address:', pkpCreds.ethAddress);
  console.log('   Network:', pkpCreds.network);

  // Connect to Lit
  console.log('\n🔌 Connecting to Lit Protocol (nagaDev)...');
  const litClient = await createLitClient({ network: nagaDev });
  console.log('✅ Connected');

  // Try to get PKP permissions
  console.log('\n🔍 Fetching PKP permissions...');
  try {
    const permissions = await litClient.viewPKPPermissions({
      tokenId: pkpCreds.tokenId,
    });

    console.log('\n✅ PKP Permissions:');
    console.log(JSON.stringify(permissions, null, 2));

  } catch (error) {
    console.error('❌ Failed to get permissions:', error.message);
  }

  await litClient.disconnect();
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
