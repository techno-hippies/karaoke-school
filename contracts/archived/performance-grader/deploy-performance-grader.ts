import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load ABI and bytecode
const artifactPath = path.join(__dirname, 'out', 'PerformanceGrader.sol', 'PerformanceGrader.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    // Get private key from environment
    const privateKey = process.env.PRIVATE_KEY;
    const trustedPKP = process.env.TRUSTED_PKP_ADDRESS;

    if (!privateKey || !trustedPKP) {
        throw new Error('PRIVATE_KEY and TRUSTED_PKP_ADDRESS must be set');
    }

    console.log('Connecting to Lens testnet...');
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('Deployer address:', wallet.address);
    console.log('Trusted PKP:', trustedPKP);

    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log('Balance:', ethers.formatEther(balance), 'ETH');

    // Deploy contract
    console.log('\nDeploying PerformanceGrader...');
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
    console.log('\n✅ PerformanceGrader deployed at:', contractAddress);
    console.log('Owner:', wallet.address);
    console.log('Trusted PKP:', trustedPKP);

    // Verify state
    const ownerFromContract = await contract.owner();
    const trustedPKPFromContract = await contract.trustedPKP();
    const paused = await contract.paused();

    console.log('\nContract state:');
    console.log('  Owner:', ownerFromContract);
    console.log('  Trusted PKP:', trustedPKPFromContract);
    console.log('  Paused:', paused);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
