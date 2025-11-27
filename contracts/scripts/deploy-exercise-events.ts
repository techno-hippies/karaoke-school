#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import ExerciseEventsArtifact from '../out/ExerciseEvents.sol/ExerciseEvents.json' assert { type: 'json' };

const LENS_TESTNET_RPC = 'https://rpc.testnet.lens.xyz';
const TRUSTED_PKP_ADDRESS = '0x3345Cb3A0CfEcb47bC3D638e338D26c870FA2b23';

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  const provider = new ethers.JsonRpcProvider(LENS_TESTNET_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('Deployer address:', wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  console.log('\nDeploying ExerciseEvents...');
  console.log('Trusted PKP:', TRUSTED_PKP_ADDRESS);

  const factory = new ethers.ContractFactory(
    ExerciseEventsArtifact.abi,
    ExerciseEventsArtifact.bytecode.object,
    wallet
  );

  const contract = await factory.deploy(TRUSTED_PKP_ADDRESS, {
    gasLimit: 5000000,
  });

  console.log('Waiting for deployment...');
  console.log('Transaction hash:', contract.deploymentTransaction()?.hash);

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log('\n✅ ExerciseEvents deployed at:', address);
  console.log('\nUpdate contracts.config.js:');
  console.log(`export const EXERCISE_EVENTS_ADDRESS = '${address}';`);
}

main().catch((error) => {
  console.error('Deployment failed:', error);
  process.exit(1);
});
