#!/usr/bin/env node

// Script to add test videos to the blockchain via contract interaction
// This will trigger events that the subgraph indexes to create feedItems

import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { localhost } from 'viem/chains';

// Contract ABI - minimal interface for adding videos
const KARAOKE_SCHOOL_ABI = [
  {
    inputs: [
      { name: "uploadTxId", type: "string" },
      { name: "irysUrl", type: "string" }
    ],
    name: "addVideo",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [
      { name: "handle", type: "string" },
      { name: "pkpPublicKey", type: "bytes" }
    ],
    name: "registerCreator",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "videoId", type: "uint256" },
      { indexed: false, name: "uploadTxId", type: "string" },
      { indexed: false, name: "irysUrl", type: "string" }
    ],
    name: "VideoAdded",
    type: "event"
  }
];

// Contract address - update this with your deployed contract
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // Common Anvil address

async function main() {
  console.log('🚀 Adding test videos to blockchain...');
  
  // Setup wallet (using Anvil's default account)
  const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
  
  const walletClient = createWalletClient({
    account,
    chain: localhost,
    transport: http('http://localhost:8545')
  });
  
  const publicClient = createPublicClient({
    chain: localhost,
    transport: http('http://localhost:8545')
  });
  
  // Test videos to add
  const testVideos = [
    {
      uploadTxId: 'tx_abc123_dance',
      irysUrl: 'https://arweave.net/abc123',
      handle: '@dance_master',
      description: 'Amazing dance moves! 🕺 #dance #viral'
    },
    {
      uploadTxId: 'tx_def456_cooking',
      irysUrl: 'https://arweave.net/def456',
      handle: '@chef_life',
      description: 'Perfect pasta recipe 🍝 #cooking #foodie'
    },
    {
      uploadTxId: 'tx_ghi789_tech',
      irysUrl: 'https://arweave.net/ghi789',
      handle: '@tech_wizard',
      description: 'Mind-blowing tech tips! 💻 #tech #tutorial'
    },
    {
      uploadTxId: 'tx_jkl012_comedy',
      irysUrl: 'https://arweave.net/jkl012',
      handle: '@funny_moments',
      description: 'Wait for it... 😂 #comedy #funny'
    },
    {
      uploadTxId: 'tx_mno345_travel',
      irysUrl: 'https://arweave.net/mno345',
      handle: '@world_explorer',
      description: 'Hidden paradise found! 🌴 #travel #wanderlust'
    }
  ];
  
  try {
    // First, register creators if needed
    console.log('📝 Registering creators...');
    for (const video of testVideos) {
      try {
        const hash = await walletClient.writeContract({
          address: CONTRACT_ADDRESS,
          abi: KARAOKE_SCHOOL_ABI,
          functionName: 'registerCreator',
          args: [
            video.handle,
            '0x' + '00'.repeat(64) // Dummy PKP public key
          ]
        });
        console.log(`  ✅ Registered ${video.handle}: ${hash}`);
        
        // Wait for confirmation
        await publicClient.waitForTransactionReceipt({ hash });
      } catch (error) {
        console.log(`  ⚠️ Creator ${video.handle} might already exist`);
      }
    }
    
    // Add videos
    console.log('\n🎬 Adding videos...');
    for (const video of testVideos) {
      const hash = await walletClient.writeContract({
        address: CONTRACT_ADDRESS,
        abi: KARAOKE_SCHOOL_ABI,
        functionName: 'addVideo',
        args: [video.uploadTxId, video.irysUrl]
      });
      
      console.log(`  ✅ Added video from ${video.handle}: ${hash}`);
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`     Block: ${receipt.blockNumber}`);
    }
    
    console.log('\n✨ Done! Videos should appear in the feed after subgraph indexes them.');
    console.log('   Wait ~5-10 seconds for indexing, then refresh the app.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Make sure:');
    console.log('   1. Anvil is running (npm run chain)');
    console.log('   2. Contract is deployed at', CONTRACT_ADDRESS);
    console.log('   3. Graph Node is running and syncing');
  }
}

main().catch(console.error);