#!/usr/bin/env node

/**
 * Complete Lit Action Deployment Pipeline
 *
 * This script automates the entire deployment workflow:
 * 1. Validates Lit Action code
 * 2. Uploads to IPFS via Pinata
 * 3. Re-encrypts API keys for the new CID
 * 4. Updates app/src/lib/contracts/addresses.ts
 * 5. Creates deployment summary
 *
 * Usage:
 *   node scripts/deploy-lit-action-full.mjs <lit-action-path> <name> [--dry-run]
 *
 * Example:
 *   node scripts/deploy-lit-action-full.mjs study/sat-it-back-v1.js "Karaoke Grader v9"
 *   node scripts/deploy-lit-action-full.mjs study/sat-it-back-v1.js "Test Deploy" --dry-run
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`STEP ${step}: ${message}`, 'bright');
  log('='.repeat(60), 'cyan');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    log('Usage: node scripts/deploy-lit-action-full.mjs <lit-action-path> <name> [--dry-run]', 'red');
    log('Example: node scripts/deploy-lit-action-full.mjs study/sat-it-back-v1.js "Karaoke Grader v9"', 'yellow');
    process.exit(1);
  }

  const litActionPath = args[0];
  const deploymentName = args[1];
  const isDryRun = args.includes('--dry-run');

  if (isDryRun) {
    log('\n🔍 DRY RUN MODE - No files will be modified', 'yellow');
  }

  const PINATA_JWT = process.env.PINATA_JWT;
  const VOXTRAL_API_KEY = process.env.VOXTRAL_API_KEY;

  if (!PINATA_JWT) {
    log('❌ Error: PINATA_JWT not found in environment', 'red');
    process.exit(1);
  }

  if (!VOXTRAL_API_KEY) {
    log('❌ Error: VOXTRAL_API_KEY not found in environment', 'red');
    process.exit(1);
  }

  let newCid;
  let encryptedKey;

  try {
    // ============================================================
    // STEP 1: Validate Lit Action Code
    // ============================================================
    logStep(1, 'Validate Lit Action Code');
    
    const litActionFullPath = resolve(__dirname, '..', litActionPath);
    const jsCode = readFileSync(litActionFullPath, 'utf8');
    
    log(`📖 Read Lit Action from: ${litActionPath}`, 'green');
    log(`📏 File size: ${jsCode.length} bytes`, 'green');

    // Check for common issues
    const checks = [
      { pattern: /voxtralEncryptedKey/g, name: 'voxtralEncryptedKey parameter', required: true },
      { pattern: /Lit\.Actions\.decryptAndCombine/g, name: 'decryptAndCombine call', required: true },
      { pattern: /gradeLinePerformance/g, name: 'gradeLinePerformance function', required: true },
      { pattern: /voxstralEncryptedKey/gi, name: 'OLD voxstral naming (with S)', required: false, shouldNotExist: true },
    ];

    let validationPassed = true;
    for (const check of checks) {
      const matches = jsCode.match(check.pattern);
      if (check.shouldNotExist && matches) {
        log(`❌ FAIL: Found ${check.name} (should not exist!)`, 'red');
        validationPassed = false;
      } else if (check.required && !matches) {
        log(`❌ FAIL: Missing ${check.name}`, 'red');
        validationPassed = false;
      } else if (matches) {
        log(`✅ PASS: Found ${check.name} (${matches.length} occurrences)`, 'green');
      }
    }

    if (!validationPassed) {
      log('\n❌ Validation failed - fix issues before deploying', 'red');
      process.exit(1);
    }

    log('\n✅ Validation passed!', 'green');

    // ============================================================
    // STEP 2: Upload to IPFS
    // ============================================================
    logStep(2, 'Upload to IPFS via Pinata');

    if (isDryRun) {
      log('⏭️  Skipping upload (dry run)', 'yellow');
      newCid = 'QmDRYRUN123456789'; // Fake CID for dry run
    } else {
      log('📤 Uploading to IPFS...', 'blue');

      const formData = new FormData();
      const blob = new Blob([jsCode], { type: 'text/javascript' });
      const fileName = `${deploymentName.replace(/\s+/g, '-')}.js`;
      formData.append('file', blob, fileName);

      formData.append('pinataMetadata', JSON.stringify({
        name: deploymentName,
        keyvalues: {
          type: 'lit-action',
          network: 'naga-dev',
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

      const result = await response.json();
      newCid = result.IpfsHash;

      log(`✅ Upload successful!`, 'green');
      log(`📦 CID: ${newCid}`, 'cyan');
      log(`🔗 Gateway URL: https://gateway.pinata.cloud/ipfs/${newCid}`, 'blue');
    }

    // ============================================================
    // STEP 3: Re-encrypt API Keys
    // ============================================================
    logStep(3, 'Re-encrypt API Keys for New CID');

    if (isDryRun) {
      log('⏭️  Skipping encryption (dry run)', 'yellow');
      encryptedKey = {
        ciphertext: 'DRYRUN_ENCRYPTED_DATA',
        dataToEncryptHash: 'DRYRUN_HASH',
        accessControlConditions: [],
      };
    } else {
      log(`🔐 Encrypting Voxtral API key for CID: ${newCid}`, 'blue');
      log(`🔑 API key length: ${VOXTRAL_API_KEY.length}`, 'blue');

      const litClient = await createLitClient({ network: nagaDev });
      log('✅ Connected to Lit network', 'green');

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
            value: newCid,
          },
        },
      ];

      log('🔒 Encrypting with access control...', 'blue');

      const encryptedData = await litClient.encrypt({
        dataToEncrypt: VOXTRAL_API_KEY,
        unifiedAccessControlConditions: accessControlConditions,
        chain: 'ethereum',
      });

      encryptedKey = {
        ciphertext: encryptedData.ciphertext,
        dataToEncryptHash: encryptedData.dataToEncryptHash,
        accessControlConditions,
        encryptedAt: new Date().toISOString(),
        cid: newCid,
      };

      await litClient.disconnect();

      log('✅ Encryption complete!', 'green');

      // Save to keys directory
      const keyFilePath = resolve(__dirname, '../keys/voxtral_api_key.json');
      writeFileSync(keyFilePath, JSON.stringify(encryptedKey, null, 2));
      log(`📁 Saved to: ${keyFilePath}`, 'green');
    }

    // ============================================================
    // STEP 4: Update App Code
    // ============================================================
    logStep(4, 'Update App Code (addresses.ts)');

    const addressesPath = resolve(__dirname, '../../app/src/lib/contracts/addresses.ts');
    
    if (isDryRun) {
      log('⏭️  Skipping app update (dry run)', 'yellow');
    } else {
      log(`📝 Reading: ${addressesPath}`, 'blue');
      let addressesContent = readFileSync(addressesPath, 'utf8');

      // Update LIT_ACTION_IPFS_CID
      const cidRegex = /export const LIT_ACTION_IPFS_CID = '[^']+'/;
      const newCidLine = `export const LIT_ACTION_IPFS_CID = '${newCid}'  // ${deploymentName}`;
      addressesContent = addressesContent.replace(cidRegex, newCidLine);
      log(`✅ Updated LIT_ACTION_IPFS_CID to: ${newCid}`, 'green');

      // Update encrypted key ciphertext
      const ciphertextRegex = /ciphertext: '[^']+'/;
      const newCiphertext = `ciphertext: '${encryptedKey.ciphertext}'`;
      addressesContent = addressesContent.replace(ciphertextRegex, newCiphertext);
      log(`✅ Updated encrypted key ciphertext`, 'green');

      // Update dataToEncryptHash
      const hashRegex = /dataToEncryptHash: '[^']+'/;
      const newHash = `dataToEncryptHash: '${encryptedKey.dataToEncryptHash}'`;
      addressesContent = addressesContent.replace(hashRegex, newHash);
      log(`✅ Updated dataToEncryptHash`, 'green');

      // Update CID in access control conditions
      const accCidRegex = /value: 'Qm[a-zA-Z0-9]+',\s*\/\/ v\d+/;
      const newAccCid = `value: '${newCid}',  // ${deploymentName}`;
      addressesContent = addressesContent.replace(accCidRegex, newAccCid);
      log(`✅ Updated access control CID`, 'green');

      // Write back
      writeFileSync(addressesPath, addressesContent, 'utf8');
      log(`📁 Saved to: ${addressesPath}`, 'green');
    }

    // ============================================================
    // STEP 5: Create Deployment Summary
    // ============================================================
    logStep(5, 'Create Deployment Summary');

    const summary = {
      deploymentName,
      timestamp: new Date().toISOString(),
      litAction: {
        path: litActionPath,
        size: jsCode.length,
        cid: newCid,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${newCid}`,
      },
      encryptedKey: {
        ciphertext: encryptedKey.ciphertext.substring(0, 40) + '...',
        dataToEncryptHash: encryptedKey.dataToEncryptHash,
        encryptedAt: encryptedKey.encryptedAt || new Date().toISOString(),
      },
      filesUpdated: isDryRun ? [] : [
        'lit-actions/keys/voxtral_api_key.json',
        'app/src/lib/contracts/addresses.ts',
      ],
      nextSteps: [
        'Test the app to verify grading works',
        'Check browser console for any errors',
        'Verify decryption succeeds',
        'Test line-level progression',
      ],
    };

    const summaryPath = resolve(__dirname, `../deployments/${deploymentName.replace(/\s+/g, '-')}-${Date.now()}.json`);
    
    if (!isDryRun) {
      writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
      log(`📁 Deployment summary saved to: ${summaryPath}`, 'green');
    }

    // ============================================================
    // SUCCESS SUMMARY
    // ============================================================
    log('\n' + '='.repeat(60), 'green');
    log('✅ DEPLOYMENT SUCCESSFUL!', 'green');
    log('='.repeat(60), 'green');

    log('\n📋 Summary:', 'cyan');
    log(`   Name: ${deploymentName}`, 'blue');
    log(`   CID: ${newCid}`, 'blue');
    log(`   Gateway: https://gateway.pinata.cloud/ipfs/${newCid}`, 'blue');
    
    if (!isDryRun) {
      log('\n📝 Files Updated:', 'cyan');
      log('   ✅ lit-actions/keys/voxtral_api_key.json', 'green');
      log('   ✅ app/src/lib/contracts/addresses.ts', 'green');
    }

    log('\n🚀 Next Steps:', 'cyan');
    log('   1. Restart the app dev server (if running)', 'yellow');
    log('   2. Test grading flow end-to-end', 'yellow');
    log('   3. Check for decryption errors', 'yellow');
    log('   4. Verify line-level progression works', 'yellow');

    if (isDryRun) {
      log('\n⚠️  This was a DRY RUN - no files were modified', 'yellow');
    }

  } catch (error) {
    log('\n' + '='.repeat(60), 'red');
    log('❌ DEPLOYMENT FAILED', 'red');
    log('='.repeat(60), 'red');
    log(`\nError: ${error.message}`, 'red');
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, 'red');
    }
    process.exit(1);
  }
}

main().catch(console.error);
