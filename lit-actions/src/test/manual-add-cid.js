#!/usr/bin/env node

/**
 * Manually add CID to PKP permissions
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const PKP_CREDS_PATH = join(__dirname, '../../output/pkp-credentials.json');
  const NEW_CID = 'QmeSgWA2ZUAijd8GiU4yfNnhvRgNh2TUrKnJCE74Z8HEGj';
  
  try {
    console.log('🔧 Adding CID to PKP permissions...');
    console.log('📁 PKP Credentials:', PKP_CREDS_PATH);
    console.log('🆕 New CID:', NEW_CID);
    
    // Read current credentials
    const credentials = JSON.parse(await readFile(PKP_CREDS_PATH, 'utf-8'));
    console.log('✅ Loaded PKP credentials');
    console.log('   Address:', credentials.ethAddress);
    console.log('   Token ID:', credentials.tokenId);
    console.log('   Current permitted actions:', credentials.permittedActions.length);
    
    // Check if CID already exists
    const existingAction = credentials.permittedActions.find(action => action.ipfsId === NEW_CID);
    if (existingAction) {
      console.log('⚠️ CID already exists in permissions');
      return;
    }
    
    // Add new CID to permitted actions
    const newAction = {
      ipfsId: NEW_CID,
      scopes: ['sign-anything']
    };
    
    credentials.permittedActions.push(newAction);
    
    // Write back to file
    await writeFile(PKP_CREDS_PATH, JSON.stringify(credentials, null, 2));
    
    console.log('✅ Successfully added CID to PKP permissions!');
    console.log('   New permitted actions:', credentials.permittedActions.length);
    console.log('🎯 CID:', NEW_CID);
    console.log('📜 Scope: sign-anything');
    
    console.log('\n🔄 PKP permissions updated. The Lit Action should now work!');
    
  } catch (error) {
    console.error('❌ Failed to add CID to permissions:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);
