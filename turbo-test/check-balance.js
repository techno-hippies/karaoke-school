#!/usr/bin/env node

/**
 * Quick balance checker for your Load Network wallet
 * Run this after funding to check balance and test transactions
 */

import { LoadNetworkUploader } from './load-network-uploader.js';

async function checkWalletBalance() {
  console.log('🔍 Checking Load Network Wallet Balance\n');
  
  const uploader = new LoadNetworkUploader();
  
  try {
    // Initialize the same wallet
    const evmWallet = await uploader.initEvmWallet('./demo-evm-wallet.json');
    console.log(`📍 Wallet: ${evmWallet.address}\n`);
    
    // Check balance
    const balance = await uploader.provider.getBalance(evmWallet.address);
    const balanceTLOAD = Number(balance) / 1e18;
    
    console.log(`💰 Current Balance: ${balanceTLOAD} tLOAD`);
    
    if (balanceTLOAD === 0) {
      console.log('❌ Still unfunded. Check:');
      console.log('   1. Did the faucet transaction complete?');
      console.log('   2. Is the wallet address correct?');
      console.log('   3. Wait 2-5 minutes for processing');
      return false;
    }
    
    console.log('✅ Wallet funded! Ready for transactions.');
    
    // Quick test data
    const testData = {
      type: "balance-check-test",
      timestamp: new Date().toISOString(),
      message: "Testing transaction with funded wallet",
      balanceAtTest: balanceTLOAD
    };
    
    console.log('\n🚀 Testing transaction...');
    const result = await uploader.uploadToLoadNetwork(testData, {
      walletPath: './demo-evm-wallet.json'
    });
    
    console.log('🎉 SUCCESS! Transaction completed!');
    console.log(`📝 TX Hash: ${result.hash}`);
    console.log(`🔍 Explorer: ${result.explorer}`);
    console.log(`⛽ Gas Used: ${result.gasUsed}`);
    
    // Check final balance
    const finalBalance = await uploader.provider.getBalance(evmWallet.address);
    const finalBalanceTLOAD = Number(finalBalance) / 1e18;
    const gasUsedTLOAD = (Number(result.gasUsed) * 2) / 1e18; // Rough estimate
    
    console.log(`\n💰 Final Balance: ${finalBalanceTLOAD} tLOAD`);
    console.log(`💸 Approx Gas Used: ${gasUsedTLOAD.toFixed(6)} tLOAD`);
    
    return {
      initialBalance: balanceTLOAD,
      finalBalance: finalBalanceTLOAD,
      txHash: result.hash,
      explorerUrl: result.explorer
    };
    
  } catch (error) {
    console.error('❌ Balance check failed:', error.message);
    throw error;
  }
}

// Run the check
if (import.meta.url === `file://${process.argv[1]}`) {
  checkWalletBalance()
    .then((result) => {
      if (result) {
        console.log('\n✅ Load Network integration working perfectly!');
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Check failed:', error.message);
      process.exit(1);
    });
}

export { checkWalletBalance };
