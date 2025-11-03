import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load ABI
const artifactPath = path.join(__dirname, 'out', 'PerformanceGrader.sol', 'PerformanceGrader.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = '0xbc831cfc35C543892B14cDe6E40ED9026eF32678';
    const newTrustedPKP = process.argv[2] || '0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7'; // PKP address from args or default

    if (!privateKey) {
        throw new Error('PRIVATE_KEY must be set');
    }

    console.log('Connecting to Lens testnet...');
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, artifact.abi, wallet);

    console.log('Contract address:', contractAddress);
    console.log('Owner (caller):', wallet.address);
    console.log('New Trusted PKP:', newTrustedPKP);

    // Check current state
    const currentTrustedPKP = await contract.trustedPKP();
    console.log('\nCurrent Trusted PKP:', currentTrustedPKP);

    if (currentTrustedPKP.toLowerCase() === newTrustedPKP.toLowerCase()) {
        console.log('✅ Trusted PKP is already set correctly!');
        return;
    }

    console.log('\nUpdating Trusted PKP...');
    const tx = await contract.setTrustedPKP(newTrustedPKP);
    console.log('Transaction hash:', tx.hash);

    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();

    console.log('\n✅ Trusted PKP updated!');
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());

    // Verify the update
    const updatedTrustedPKP = await contract.trustedPKP();
    console.log('\nVerified Trusted PKP:', updatedTrustedPKP);
    console.log('Transaction:', `https://block-explorer.testnet.lens.dev/tx/${tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
