#!/usr/bin/env node

/**
 * Load Network TX Test - For when wallet is funded
 * 
 * Run this after getting tLOAD tokens to verify successful transaction
 */

import { LoadNetworkUploader } from './load-network-uploader.js';

async function testSuccessfulTx() {
  console.log('🚀 Testing Load Network TX (With Funded Wallet)\n');
  
  const uploader = new LoadNetworkUploader();
  
  try {
    // Use the same wallet from the demo
    const evmWallet = await uploader.initEvmWallet('./demo-evm-wallet.json');
    
    // Check balance first
    const balance = await uploader.provider.getBalance(evmWallet.address);
    const balanceTLOAD = Number(balance) / 1e18;
    console.log(`💰 Balance: ${balanceTLOAD} tLOAD`);
    
    if (balanceTLOAD === 0) {
      console.log('❌ Wallet still unfunded. Get tLOAD from: https://load.network/faucet');
      return;
    }
    
    console.log('✅ Wallet funded! Testing TX...\n');
    
    // Create test data
    const testData = {
      type: "load-network-tx-test",
      timestamp: new Date().toISOString(),
      wallet: evmWallet.address,
      message: "This transaction will be recorded on Load Network blockchain!",
      testNumber: Math.floor(Math.random() * 1000000)
    };
    
    // Upload to Load Network
    const result = await uploader.uploadToLoadNetwork(testData, {
      walletPath: './demo-evm-wallet.json'
    });
    
    console.log('🎉 SUCCESS! Transaction completed!');
    console.log(`📝 TX Hash: ${result.hash}`);
    console.log(`🔍 Explorer: ${result.explorer}`);
    console.log(`⛽ Gas Used: ${result.gasUsed}`);
    console.log('');
    console.log('✅ Load Network integration is working perfectly!');
    console.log('📊 Your data is now permanently stored on the blockchain.');
    console.log('');
    console.log('🔗 View your transaction:');
    console.log(`   ${result.explorer}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ TX test failed:', error.message);
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testSuccessfulTx()
    .then((result) => {
      console.log('\n✅ TX test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ TX test failed:', error.message);
      process.exit(1);
    });
}

export { testSuccessfulTx };
