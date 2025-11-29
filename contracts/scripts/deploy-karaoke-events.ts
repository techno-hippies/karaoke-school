import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load ABI and bytecode
const artifactPath = path.join(__dirname, 'out', 'KaraokeEvents.sol', 'KaraokeEvents.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    // Get private key and trusted PKP from environment
    const privateKey = process.env.PRIVATE_KEY;
    const trustedPKP = process.env.TRUSTED_PKP_ADDRESS;

    if (!privateKey) {
        throw new Error('PRIVATE_KEY must be set');
    }
    if (!trustedPKP) {
        throw new Error('TRUSTED_PKP_ADDRESS must be set');
    }

    console.log('Connecting to Lens testnet...');
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('Deployer address:', wallet.address);
    console.log('Trusted PKP:', trustedPKP);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'ETH');

    // Deploy contract with trustedPKP constructor arg
    console.log('\nDeploying KaraokeEvents...');
    const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode.object,
        wallet
    );

    const contract = await factory.deploy(trustedPKP);
    console.log('Transaction hash:', contract.deploymentTransaction()?.hash);

    console.log('Waiting for deployment...');
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log('\n✅ KaraokeEvents deployed at:', contractAddress);
    console.log('Deployer:', wallet.address);

    // Save ABI for subgraph
    const abiPath = path.join(__dirname, '../subgraph/abis/KaraokeEvents.json');
    fs.writeFileSync(abiPath, JSON.stringify({ abi: artifact.abi }, null, 2));
    console.log('✅ ABI saved to:', abiPath);

    // Test emit functions
    console.log('\nVerifying contract is callable...');
    console.log('  Has emitClipRegistered:', typeof contract.emitClipRegistered === 'function');
    console.log('  Has emitClipProcessed:', typeof contract.emitClipProcessed === 'function');
    console.log('  Has emitSongEncrypted:', typeof contract.emitSongEncrypted === 'function');
    console.log('  Has gradeKaraokePerformance:', typeof contract.gradeKaraokePerformance === 'function');
    console.log('  Has getClipHash:', typeof contract.getClipHash === 'function');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
