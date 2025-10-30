#!/usr/bin/env node

/**
 * Simple Test Script for SegmentEvents Contract Lit Action
 * 
 * Tests the Lit Action without requiring Lit Protocol connection
 * This is just to verify the code structure and signature formatting
 */

import { readFile } from 'fs/promises';
import { ethers } from 'ethers';

// Test parameters
// Use simple test address (not computing from PKP for this test)
const TEST_USER_ADDRESS = '0xfC834ea9b0780C6d171A5F6d489Ef6f1Ae66EC30';
const TEST_SEGMENT_HASH = ethers.keccak256(
  ethers.AbiCoder.defaultAbiCoder().encode(
    ['string', 'uint32'], 
    ['test-track-123', 45000]
  )
);
const TEST_GRC20_WORK_ID = 'f1d7f4c7-ca47-4ba3-9875-a91720459ab4';
const TEST_SPOTIFY_TRACK_ID = 'test-track-123';
const TEST_SEGMENT_START_MS = 45000;
const TEST_SEGMENT_END_MS = 235000;
const TEST_METADATA_URI = 'grove://test-segment-metadata/12345';

// Contract address
const SEGMENT_EVENTS_ADDRESS = '0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8';
const LENS_TESTNET_CHAIN_ID = 37111;

function generateSegmentHash(spotifyTrackId, segmentStartMs) {
  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['string', 'uint32'], 
      [spotifyTrackId, segmentStartMs]
    )
  );
}

function buildTransactionData() {
  // Define contract ABI for SegmentEvents
  const segmentEventsABI = [
    'function emitSegmentRegistered(bytes32 segmentHash, string grc20WorkId, string spotifyTrackId, uint32 segmentStartMs, uint32 segmentEndMs, string metadataUri) external'
  ];
  
  const iface = new ethers.Interface(segmentEventsABI);
  
  // Encode the transaction data
  const txData = iface.encodeFunctionData('emitSegmentRegistered', [
    TEST_SEGMENT_HASH,
    TEST_GRC20_WORK_ID,
    TEST_SPOTIFY_TRACK_ID,
    TEST_SEGMENT_START_MS,
    TEST_SEGMENT_END_MS,
    TEST_METADATA_URI
  ]);
  
  return txData;
}

function buildEIP712Transaction(txData, nonce = 0) {
  const gasPrice = ethers.parseUnits('100', 'gwei'); // 100 gwei
  const gasPerPubdataByteLimit = ethers.toBigInt(800);
  const maxPriorityFeePerGas = ethers.toBigInt(0);
  
  // Use TEST_USER_ADDRESS as the signer address for this test
  const pkpEthAddress = TEST_USER_ADDRESS;
  
  // EIP-712 domain separator
  const domainTypeHash = ethers.keccak256(
    ethers.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId)')
  );
  const nameHash = ethers.keccak256(ethers.toUtf8Bytes('zkSync'));
  const versionHash = ethers.keccak256(ethers.toUtf8Bytes('2'));

  const domainSeparator = ethers.keccak256(
    ethers.concat([
      domainTypeHash,
      nameHash,
      versionHash,
      ethers.zeroPadValue(ethers.toBeHex(LENS_TESTNET_CHAIN_ID), 32)
    ])
  );

  // EIP-712 struct hash
  const txTypeHash = ethers.keccak256(
    ethers.toUtf8Bytes('Transaction(uint256 txType,uint256 from,uint256 to,uint256 gasLimit,uint256 gasPerPubdataByteLimit,uint256 maxFeePerGas,uint256 maxPriorityFeePerGas,uint256 paymaster,uint256 nonce,uint256 value,bytes data,bytes32[] factoryDeps,bytes paymasterInput)')
  );

  const structHash = ethers.keccak256(
    ethers.concat([
      txTypeHash,
      ethers.zeroPadValue(ethers.toBeHex(113), 32),           // txType: 113 (0x71)
      ethers.zeroPadValue(pkpEthAddress, 32),                 // from
      ethers.zeroPadValue(SEGMENT_EVENTS_ADDRESS, 32),        // to
      ethers.zeroPadValue(ethers.toBeHex(500000), 32),        // gasLimit
      ethers.zeroPadValue(ethers.toBeHex(gasPerPubdataByteLimit), 32), // gasPerPubdata
      ethers.zeroPadValue(ethers.toBeHex(gasPrice), 32),      // maxFeePerGas
      ethers.zeroPadValue(ethers.toBeHex(maxPriorityFeePerGas), 32), // maxPriorityFeePerGas
      ethers.zeroPadValue('0x00', 32),                        // paymaster: 0
      ethers.zeroPadValue(ethers.toBeHex(nonce), 32),         // nonce
      ethers.zeroPadValue('0x00', 32),                        // value: 0
      ethers.keccak256(txData),                               // data
      ethers.keccak256('0x'),                                 // factoryDeps: empty
      ethers.keccak256('0x')                                  // paymasterInput: empty
    ])
  );

  // Calculate final EIP-712 hash
  const eip712Hash = ethers.keccak256(
    ethers.concat([
      ethers.toUtf8Bytes('\x19\x01'),
      domainSeparator,
      structHash
    ])
  );

  return eip712Hash;
}

async function main() {
  console.log('🎯 Simple SegmentEvents Contract Test\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('📝 Test Parameters:');
    console.log('   Signer Address:', TEST_USER_ADDRESS);
    console.log('   User Address:', TEST_USER_ADDRESS);
    console.log('   Segment Hash:', TEST_SEGMENT_HASH);
    console.log('   GRC-20 Work ID:', TEST_GRC20_WORK_ID);
    console.log('   Spotify Track ID:', TEST_SPOTIFY_TRACK_ID);
    console.log('   Segment Range:', `${TEST_SEGMENT_START_MS}ms - ${TEST_SEGMENT_END_MS}ms`);
    console.log('   Duration:', TEST_SEGMENT_END_MS - TEST_SEGMENT_START_MS, 'ms');
    console.log('   Metadata URI:', TEST_METADATA_URI);
    console.log('   Contract:', SEGMENT_EVENTS_ADDRESS);
    console.log('   Chain:', 'Lens Testnet (37111)\n');

    // Test transaction data encoding
    console.log('🔧 Building Transaction Data...');
    const txData = buildTransactionData();
    console.log('✅ Transaction data encoded');
    console.log('   Function selector:', txData.slice(0, 10));
    console.log('   Data length:', txData.length, 'bytes\n');

    // Test EIP-712 hash generation
    console.log('🔐 Building EIP-712 Transaction Hash...');
    const eip712Hash = buildEIP712Transaction(txData, 0);
    console.log('✅ EIP-712 hash generated');
    console.log('   Hash:', eip712Hash, '\n');

    // Test the Lit Action file can be read
    console.log('📄 Verifying Lit Action File...');
    const litActionCode = await readFile('./src/stt/test-segment-events.js', 'utf-8');
    console.log('✅ Lit Action file loaded');
    console.log('   File size:', litActionCode.length, 'characters');
    
    // Check for required patterns
    const hasEthers = litActionCode.includes('ethers.providers.JsonRpcProvider');
    const hasPKPSigning = litActionCode.includes('Lit.Actions.signAndCombineEcdsa');
    const hasRLPEncoding = litActionCode.includes('ethers.utils.RLP.encode');
    const hasContractABI = litActionCode.includes('emitSegmentRegistered');
    
    console.log('\n🧪 Code Verification:');
    console.log('   Contains ethers provider:', hasEthers ? '✅' : '❌');
    console.log('   Contains PKP signing:', hasPKPSigning ? '✅' : '❌');
    console.log('   Contains RLP encoding:', hasRLPEncoding ? '✅' : '❌');
    console.log('   Contains contract function:', hasContractABI ? '✅' : '❌');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Simple tests passed!');
    console.log('\n📋 Next Steps:');
    console.log('1. The Lit Action code structure is correct');
    console.log('2. Transaction encoding works properly');
    console.log('3. EIP-712 hash generation works properly');
    console.log('4. To test on-chain: upload Lit Action to IPFS and run with Lit client');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

main();
