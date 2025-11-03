#!/usr/bin/env node

/**
 * Direct PerformanceGrader Test (Without Lit Network)
 *
 * This bypasses Lit Protocol entirely and uses a regular private key
 * to prove the signature pattern works with the deployed contract.
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const PERFORMANCE_GRADER_ADDRESS = '0xbc831cfc35C543892B14cDe6E40ED9026eF32678';
const LENS_TESTNET_CHAIN_ID = 37111;
const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';
const PKP_ADDRESS = '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30';

// Test parameters
const TEST_USER_ADDRESS = `0x${Date.now().toString(16).padStart(40, '0')}`;
const TEST_SEGMENT_HASH = `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`;
const TEST_PERFORMANCE_ID = Date.now();
const TEST_SCORE = 8750; // 87.50%
const TEST_METADATA_URI = `grove://${Math.random().toString(36).substring(2, 15)}`;

console.log('🧪 Direct PerformanceGrader Test (No Lit Network)\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function main() {
  try {
    //Note: PKPs don't have exportable private keys - that's the point!
    // For testing, we'll use a regular wallet and update the contract's trustedPKP
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in .env');
    }

    console.log('📝 Test Parameters:');
    console.log('   Performance ID:', TEST_PERFORMANCE_ID);
    console.log('   Segment Hash:', TEST_SEGMENT_HASH);
    console.log('   Performer:', TEST_USER_ADDRESS);
    console.log('   Score:', TEST_SCORE, '(87.50%)');
    console.log('   Metadata URI:', TEST_METADATA_URI);
    console.log('   Contract:', PERFORMANCE_GRADER_ADDRESS);
    console.log('   Chain:', 'Lens Testnet (37111)');
    console.log('   PKP Address:', PKP_ADDRESS);
    console.log('');

    // Connect to Lens testnet
    console.log('🔌 Connecting to Lens testnet...');
    const provider = new ethers.JsonRpcProvider(LENS_TESTNET_RPC);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('✅ Connected as:', wallet.address);
    console.log('⚠️  Expected PKP:', PKP_ADDRESS);

    if (wallet.address.toLowerCase() !== PKP_ADDRESS.toLowerCase()) {
      console.log('');
      console.log('⚠️  Wallet mismatch! Updating contract trustedPKP to test wallet...');
      console.log('   This is OK for testing - proving the signature pattern works.');
      console.log('   In production, the Lit Action will use the real PKP.');
      console.log('');
    }

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

    if (balance === 0n) {
      console.log('❌ No balance! Get testnet ETH from:');
      console.log('   https://faucet.lens.xyz');
      process.exit(1);
    }

    // Create contract instance
    console.log('📜 Creating contract instance...');
    const performanceGraderABI = [
      'function gradePerformance(uint256 performanceId, bytes32 segmentHash, address performer, uint16 score, string metadataUri) external',
      'function trustedPKP() view returns (address)',
      'function paused() view returns (bool)',
      'function owner() view returns (address)',
      'function setTrustedPKP(address newPKP) external',
      'event PerformanceGraded(uint256 indexed performanceId, bytes32 indexed segmentHash, address indexed performer, uint16 score, string metadataUri, uint64 timestamp)'
    ];

    const contract = new ethers.Contract(
      PERFORMANCE_GRADER_ADDRESS,
      performanceGraderABI,
      wallet
    );

    // Verify contract configuration
    console.log('🔍 Verifying contract configuration...');
    const trustedPKP = await contract.trustedPKP();
    const isPaused = await contract.paused();
    const contractOwner = await contract.owner();

    console.log('   Trusted PKP:', trustedPKP);
    console.log('   Contract Owner:', contractOwner);
    console.log('   Paused:', isPaused);
    console.log('   Test Wallet:', wallet.address);
    console.log('');

    if (isPaused) {
      throw new Error('Contract is paused!');
    }

    // If wallet doesn't match trusted PKP, need to update
    if (trustedPKP.toLowerCase() !== wallet.address.toLowerCase()) {
      console.log('⚠️  Wallet is not trusted PKP!');

      if (wallet.address.toLowerCase() === contractOwner.toLowerCase()) {
        console.log('✅ But wallet IS the contract owner, so you can call setTrustedPKP first.');
        console.log('   Run this command to update:');
        console.log(`   cast send ${PERFORMANCE_GRADER_ADDRESS} "setTrustedPKP(address)" ${wallet.address} --rpc-url ${LENS_TESTNET_RPC} --private-key $PRIVATE_KEY`);
        console.log('');
        console.log('   Or get more testnet ETH from https://faucet.lens.xyz and re-run this test.');
        console.log('');
        process.exit(1);
      }

      throw new Error(`Wallet not authorized.\nTrusted PKP: ${trustedPKP}\nWallet: ${wallet.address}`);
    }

    // Submit grading transaction
    console.log('🚀 Submitting grading transaction...');
    const tx = await contract.gradePerformance(
      TEST_PERFORMANCE_ID,
      TEST_SEGMENT_HASH,
      TEST_USER_ADDRESS,
      TEST_SCORE,
      TEST_METADATA_URI
    );

    console.log('✅ Transaction submitted!');
    console.log('   TX Hash:', tx.hash);
    console.log('   Explorer:', `https://explorer.testnet.lens.xyz/tx/${tx.hash}`);
    console.log('');

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();

    console.log('✅ Transaction confirmed!');
    console.log('   Block Number:', receipt.blockNumber);
    console.log('   Gas Used:', receipt.gasUsed.toString());
    console.log('   Status:', receipt.status === 1 ? 'Success ✅' : 'Failed ❌');
    console.log('');

    // Parse events
    console.log('📊 Events emitted:');
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed.name === 'PerformanceGraded') {
          console.log('   ✅ PerformanceGraded event:');
          console.log('      - Performance ID:', parsed.args.performanceId.toString());
          console.log('      - Segment Hash:', parsed.args.segmentHash);
          console.log('      - Performer:', parsed.args.performer);
          console.log('      - Score:', parsed.args.score.toString(), `(${parsed.args.score / 100}%)`);
          console.log('      - Metadata URI:', parsed.args.metadataUri);
          console.log('      - Timestamp:', new Date(Number(parsed.args.timestamp) * 1000).toISOString());
        }
      } catch (e) {
        // Skip non-contract logs
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TEST PASSED! Transaction successful on Lens testnet!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎯 Next: The Lit Action can now use the same pattern');
    console.log('   to sign transactions with the PKP.');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
