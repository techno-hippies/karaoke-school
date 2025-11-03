#!/usr/bin/env bun
import { ethers } from 'ethers';
import fs from 'fs';

const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(LENS_TESTNET_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log('🚀 Deploying TranslationEvents...');
  console.log(`📍 Wallet: ${wallet.address}`);
  console.log(`📍 Network: Lens Testnet`);
  console.log('');

  // Read compiled bytecode
  const abiPath = '/media/t42/th42/Code/karaoke-school-v1/contracts/out/TranslationEvents.sol/TranslationEvents.json';
  const abi = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
  const bytecode = abi.bytecode.object;

  // Deploy
  const tx = await wallet.sendTransaction({
    data: '0x' + bytecode,
  });

  console.log(`⏳ Deployment submitted: ${tx.hash}`);
  const receipt = await tx.wait();

  console.log(`✅ Deployed at: ${receipt.contractAddress}`);
  console.log(`📊 Gas used: ${receipt.gasUsed.toString()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
