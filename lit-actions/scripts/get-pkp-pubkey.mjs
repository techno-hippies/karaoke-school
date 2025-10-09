#!/usr/bin/env node

/**
 * Get PKP Public Key directly from PKP NFT contract
 */

import { ethers } from 'ethers';
import { readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

// PKP NFT Contract ABI (just the getPubkey function)
const PKP_NFT_ABI = [
  "function getPubkey(uint256 tokenId) external view returns (bytes memory)"
];

// PKP NFT Contract addresses by network
const PKP_NFT_ADDRESSES = {
  yellowstone: '0x8F75a53F65e31DD0D2e40d0827becAaE2299D111',
  datilDev: '0x60C1dD1eE9cD5D74B02fC5e6399d4e35a0d6e0d1'
};

async function main() {
  console.log('🔐 Fetching PKP Public Key from PKP NFT Contract\n');

  // Load PKP credentials
  const pkpCredsPath = dirname(__dirname) + '/output/pkp-credentials.json';
  const pkpCreds = JSON.parse(await readFile(pkpCredsPath, 'utf-8'));
  
  console.log('📋 PKP Info:');
  console.log('   Token ID:', pkpCreds.tokenId);
  console.log('   ETH Address:', pkpCreds.ethAddress);
  console.log('   Network:', pkpCreds.network);

  // Try yellowstone first (Chronicle testnet for nagaDev)
  const provider = new ethers.providers.JsonRpcProvider('https://yellowstone-rpc.litprotocol.com');
  const contractAddress = PKP_NFT_ADDRESSES.yellowstone;

  console.log('\n🔌 Connecting to Chronicle Yellowstone...');
  console.log('   PKP NFT Contract:', contractAddress);

  const pkpNftContract = new ethers.Contract(contractAddress, PKP_NFT_ABI, provider);

  try {
    console.log('\n📞 Calling getPubkey...');
    const publicKeyBytes = await pkpNftContract.getPubkey(pkpCreds.tokenId);
    const publicKey = ethers.utils.hexlify(publicKeyBytes);
    
    console.log('\n✅ Public Key Retrieved:');
    console.log('   ', publicKey);
    
    // Remove 0x prefix for Lit Actions
    const publicKeyNoPrefix = publicKey.startsWith('0x') ? publicKey.substring(2) : publicKey;
    
    // Update credentials file
    pkpCreds.publicKey = publicKeyNoPrefix;
    await writeFile(pkpCredsPath, JSON.stringify(pkpCreds, null, 2));
    
    console.log('\n💾 Updated pkp-credentials.json with public key (no 0x prefix)');
    console.log('   ', publicKeyNoPrefix);
    
  } catch (error) {
    console.error('\n❌ Failed to get public key:', error.message);
    console.error('   This might mean the PKP was minted on a different network');
    console.error('   or the token ID is incorrect');
    process.exit(1);
  }
}

main().catch(console.error);
