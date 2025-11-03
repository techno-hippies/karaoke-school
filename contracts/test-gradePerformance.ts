import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Load ABI
const artifactPath = path.join(__dirname, 'out', 'PerformanceGrader.sol', 'PerformanceGrader.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

async function main() {
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = '0xbc831cfc35C543892B14cDe6E40ED9026eF32678';

    if (!privateKey) {
        throw new Error('PRIVATE_KEY must be set');
    }

    console.log('Connecting to Lens testnet...');
    const provider = new ethers.JsonRpcProvider('https://rpc.testnet.lens.xyz');
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, artifact.abi, wallet);

    console.log('Wallet address:', wallet.address);
    console.log('Contract address:', contractAddress);

    // Test parameters
    const performanceId = BigInt(Date.now()); // Use timestamp as unique ID
    const segmentHash = ethers.keccak256(ethers.toUtf8Bytes('test-segment-' + Date.now()));
    const performer = wallet.address;
    const score = 7543; // 75.43%
    const metadataUri = 'grove://test-metadata-' + Date.now();

    console.log('\nCalling gradePerformance with:');
    console.log('  performanceId:', performanceId.toString());
    console.log('  segmentHash:', segmentHash);
    console.log('  performer:', performer);
    console.log('  score:', score, '(75.43%)');
    console.log('  metadataUri:', metadataUri);

    console.log('\nSubmitting transaction...');
    const tx = await contract.gradePerformance(
        performanceId,
        segmentHash,
        performer,
        score,
        metadataUri
    );

    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('\n✅ Transaction confirmed!');
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Status:', receipt.status === 1 ? 'SUCCESS' : 'FAILED');

    // Parse event
    if (receipt.logs && receipt.logs.length > 0) {
        console.log('\nEvent emitted:');
        const iface = new ethers.Interface(artifact.abi);
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'PerformanceGraded') {
                    console.log('  Event: PerformanceGraded');
                    console.log('  performanceId:', parsed.args.performanceId.toString());
                    console.log('  segmentHash:', parsed.args.segmentHash);
                    console.log('  performer:', parsed.args.performer);
                    console.log('  score:', parsed.args.score.toString());
                    console.log('  metadataUri:', parsed.args.metadataUri);
                    console.log('  timestamp:', parsed.args.timestamp.toString());
                }
            } catch (e) {
                // Skip non-matching logs
            }
        }
    }

    console.log('\n🎉 gradePerformance called successfully!');
    console.log('Transaction:', `https://block-explorer.testnet.lens.dev/tx/${tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
