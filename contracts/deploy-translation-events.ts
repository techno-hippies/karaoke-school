import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load ABI and bytecode
const artifactPath = path.join(__dirname, 'out', 'TranslationEvents.sol', 'TranslationEvents.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        throw new Error('PRIVATE_KEY must be set');
    }

    console.log('Connecting to Lens testnet...');
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('Deployer address:', wallet.address);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'ETH');

    // Deploy contract (no constructor args)
    console.log('\nDeploying TranslationEvents...');
    const factory = new ethers.ContractFactory(
        artifact.abi,
        artifact.bytecode.object,
        wallet
    );

    const contract = await factory.deploy();
    console.log('Transaction hash:', contract.deploymentTransaction()?.hash);

    console.log('Waiting for deployment...');
    await contract.waitForDeployment();

    const contractAddress = await contract.getAddress();
    console.log('\n✅ TranslationEvents deployed at:', contractAddress);
    console.log('Deployer:', wallet.address);

    // Test emit function
    console.log('\nVerifying contract is callable...');
    // Check if contract has the expected function
    const hasEmitFunction = typeof contract.emitTranslationAdded === 'function';
    console.log('  Has emitTranslationAdded:', hasEmitFunction);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
