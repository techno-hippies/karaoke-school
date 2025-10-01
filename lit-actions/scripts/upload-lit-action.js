#!/usr/bin/env node

/**
 * Upload a Lit Action to IPFS via Pinata
 *
 * Usage:
 *   node scripts/upload-lit-action.js <path-to-lit-action.js> <name>
 *
 * Example:
 *   node scripts/upload-lit-action.js src/test/simple-eoa-test.js "Simple EOA Test"
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function uploadLitAction() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/upload-lit-action.js <path-to-lit-action.js> <name>');
    console.error('Example: node scripts/upload-lit-action.js src/test/simple-eoa-test.js "Simple EOA Test"');
    process.exit(1);
  }

  const filePath = args[0];
  const customName = args[1];

  const PINATA_JWT = process.env.PINATA_JWT || process.env.VITE_PINATA_JWT;

  if (!PINATA_JWT) {
    throw new Error('PINATA_JWT not found in environment variables');
  }

  try {
    // Read the Lit Action file
    const jsCode = fs.readFileSync(path.resolve(__dirname, '..', filePath), 'utf8');
    console.log(`📖 Read Lit Action from: ${filePath}`);
    console.log(`📏 File size: ${jsCode.length} bytes`);

    // Upload to Pinata
    console.log('📤 Uploading to IPFS via Pinata...');

    const FormData = (await import('formdata-node')).FormData;
    const { File } = await import('formdata-node');

    const formData = new FormData();
    const file = new File([jsCode], `${customName.replace(/\s+/g, '-')}.js`, {
      type: 'text/javascript'
    });
    formData.append('file', file);

    // Add metadata
    formData.append('pinataMetadata', JSON.stringify({
      name: customName,
      keyvalues: {
        type: 'lit-action',
        network: 'naga-dev',
        uploadDate: new Date().toISOString()
      }
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
    console.log('✅ Upload successful!');
    console.log('📦 CID:', result.IpfsHash);
    console.log('🏷️  Name:', customName);
    console.log('🔗 Gateway URL:', `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);

    return result.IpfsHash;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

uploadLitAction().catch(console.error);