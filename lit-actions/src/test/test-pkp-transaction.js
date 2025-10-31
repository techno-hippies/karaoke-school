#!/usr/bin/env node

/**
 * Test PerformanceGrader contract with real PKP signature
 */

import * as ethers from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

async function main() {
  console.log('🚀 Testing PerformanceGrader with PKP Signature');
  console.log('===============================================\n');

  // Configuration
  const CONTRACT_ADDRESS = '0xaB92C2708D44fab58C3c12aAA574700E80033B7D';
  const RPC_URL = 'https://rpc.testnet.lens.xyz';
  const PKP_PUBLIC_KEY = '0x043a5f87717daafe9972ee37154786845a74368d269645685ef51d7ac32c59a20df5340b8adb154b1ac137a8f2c0a6aedbcdbc46448cc545ea7f5233918d324939';
  const PKP_ADDRESS = '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30';
  
  // Contract ABI
  const CONTRACT_ABI = [
    'function gradePerformance(uint256 performanceId, bytes32 segmentHash, address performer, uint16 score, string metadataUri) external',
    'function trustedPKP() view returns (address)',
    'event PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)'
  ];

  try {
    // Create provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const pkpWallet = new ethers.Wallet(PKP_PUBLIC_KEY, provider);
    
    console.log('✅ PKP Wallet created');
    console.log('   Address:', pkpWallet.address);
    console.log('   Expected:', PKP_ADDRESS);
    console.log('   Match:', pkpWallet.address.toLowerCase() === PKP_ADDRESS.toLowerCase());

    // Create contract instance with signer
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, pkpWallet);
    
    // Test parameters
    const performanceId = Date.now();
    const segmentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test-song-verse-1'));
    const performer = '0x742d35Cc6634C0532925a3b8D40715c3F0532926';
    const score = 8500; // 85.00%
    const metadataUri = `grove://test-${performanceId}`;
    
    console.log('\n📝 Transaction Parameters:');
    console.log('   Performance ID:', performanceId);
    console.log('   Segment Hash:', segmentHash);
    console.log('   Performer:', performer);
    console.log('   Score:', score, '(', score/100, '%)');
    console.log('   Metadata URI:', metadataUri);
    
    // Check if we're the trusted PKP
    console.log('\n🔍 Checking PKP authorization...');
    const trustedPKP = await contract.trustedPKP();
    console.log('   Trusted PKP:', trustedPKP);
    console.log('   Our PKP:', pkpWallet.address);
    console.log('   Authorized:', trustedPKP.toLowerCase() === pkpWallet.address.toLowerCase());
    
    if (trustedPKP.toLowerCase() !== pkpWallet.address.toLowerCase()) {
      console.log('\n❌ PKP not authorized - transaction will fail');
      console.log('   Expected:', trustedPKP);
      console.log('   Got:', pkpWallet.address);
      return;
    }

    // Send transaction
    console.log('\n🚀 Sending gradePerformance transaction...');
    const tx = await contract.gradePerformance(
      performanceId,
      segmentHash,
      performer,
      score,
      metadataUri
    );
    
    console.log('📤 Transaction sent!');
    console.log('   Hash:', tx.hash);
    console.log('   Waiting for confirmation...\n');
    
    // Wait for confirmation
    const receipt = await tx.wait();
    
    console.log('✅ Transaction confirmed!');
    console.log('   Block Number:', receipt.blockNumber);
    console.log('   Gas Used:', receipt.gasUsed.toString());
    console.log('   Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');
    
    // Check events
    if (receipt.events && receipt.events.length > 0) {
      console.log('\n🎉 PerformanceGraded Event Emitted!');
      const event = receipt.events.find(e => e.event === 'PerformanceGraded');
      if (event) {
        console.log('   Performance ID:', event.args.performanceId.toString());
        console.log('   Segment Hash:', event.args.segmentHash);
        console.log('   Performer:', event.args.performer);
        console.log('   Score:', event.args.score.toString(), '(', event.args.score/100, '%)');
        console.log('   Metadata URI:', event.args.metadataUri);
        console.log('   Timestamp:', new Date(event.args.timestamp * 1000).toISOString());
      }
    }
    
    console.log('\n🌐 View on Explorer:');
    console.log('   https://block-explorer.testnet.lens.xyz/tx/' + tx.hash);
    
    console.log('\n🎯 SUCCESS! Data is now in the contract via transaction!');

  } catch (error) {
    console.error('\n❌ Transaction failed:', error.message);
    
    if (error.message.includes('NotTrustedPKP')) {
      console.log('\n💡 Fix: Update TRUSTED_PKP_ADDRESS in contract .env and redeploy');
    } else if (error.message.includes('invalid sender')) {
      console.log('\n💡 Fix: Use correct PKP private key');
    } else if (error.message.includes('execution reverted')) {
      console.log('\n💡 Fix: Check contract function parameters');
    }
  }
}

main().catch(console.error);
