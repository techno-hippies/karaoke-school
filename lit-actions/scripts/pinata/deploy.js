#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const execAsync = promisify(exec);

async function deployToIPFS(filePath) {
  try {
    // Check for Pinata credentials
    const pinataJWT = process.env.PINATA_JWT;
    
    if (!pinataJWT) {
      console.error('❌ Missing PINATA_JWT in environment');
      console.log('💡 Add this to your .env file');
      process.exit(1);
    }
    
    const fileName = path.basename(filePath);
    console.log(`📤 Uploading ${fileName} to IPFS via Pinata...`);
    
    // Use curl to upload with JWT
    const curlCommand = `curl -X POST https://api.pinata.cloud/pinning/pinFileToIPFS \
      -H "Authorization: Bearer ${pinataJWT}" \
      -F "file=@${filePath}"`;
    
    const { stdout, stderr } = await execAsync(curlCommand);
    
    // Ignore curl progress output
    if (stderr && !stderr.includes('%') && !stderr.includes('Warning')) {
      throw new Error(`Upload failed: ${stderr}`);
    }
    
    const result = JSON.parse(stdout);
    console.log(`✅ Uploaded to IPFS!`);
    console.log(`📍 CID: ${result.IpfsHash}`);
    console.log(`🔗 Gateway URL: https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`);
    
    return result.IpfsHash;
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get file path from command line
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node deploy-to-ipfs.js <file-path>');
  process.exit(1);
}

deployToIPFS(filePath);