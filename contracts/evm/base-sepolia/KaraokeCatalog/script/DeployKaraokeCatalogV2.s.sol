// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../KaraokeCatalogV2.sol";

/**
 * @title DeployKaraokeCatalogV2
 * @notice Deployment script for KaraokeCatalogV2 on Base Sepolia
 *
 * V2 Changes:
 * - Added processSegmentsBatch() for optimized Lit Action execution
 * - Single transaction for all segments (reduces time from 50s to 10s)
 * - Prevents Lit Network timeout (30s limit)
 *
 * Base Sepolia:
 * - Chain ID: 84532
 * - RPC: https://sepolia.base.org
 * - Explorer: https://sepolia.basescan.org
 *
 * Usage (with dotenvx):
 * DOTENV_PRIVATE_KEY=<key> dotenvx run -f /path/to/contracts/.env -- \
 *   forge script KaraokeCatalog/script/DeployKaraokeCatalogV2.s.sol:DeployKaraokeCatalogV2 \
 *   --rpc-url https://sepolia.base.org \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
 *
 * Environment Variables Required (in .env):
 * - PRIVATE_KEY: Deployer private key (encrypted)
 * - PKP_ADDRESS: Lit Protocol PKP address (trusted processor for automated operations)
 * - BASESCAN_API_KEY: BaseScan API key for verification
 */
contract DeployKaraokeCatalogV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address trustedProcessor = vm.envAddress("PKP_ADDRESS");

        console.log("=== KaraokeCatalogV2 Deployment ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Trusted Processor (PKP):", trustedProcessor);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        KaraokeCatalogV2 catalog = new KaraokeCatalogV2(trustedProcessor);

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("KaraokeCatalogV2 deployed to:", address(catalog));
        console.log("Owner:", catalog.owner());
        console.log("Trusted Processor:", catalog.trustedProcessor());
        console.log("Paused:", catalog.paused());
        console.log("Total Songs:", catalog.getTotalSongs());

        console.log("\n=== V2 New Features ===");
        console.log("- processSegmentsBatch(): Process multiple segments in single tx");
        console.log("- Reduces Lit Action time: 50s -> 10s (5 txs -> 1 tx)");
        console.log("- Prevents Lit Network timeout (30s limit)");
        console.log("- Lower gas cost (single transaction overhead)");
        console.log("- Atomic updates (all segments succeed or all fail)");

        console.log("\n=== Contract Capabilities ===");
        console.log("- Full songs with audio/metadata/covers");
        console.log("- Segment-only songs (copyrighted content)");
        console.log("- Genius API integration");
        console.log("- Batch segment creation AND processing (V2)");
        console.log("- Two-phase segment lifecycle (Create -> Process)");

        console.log("\n=== Next Steps ===");
        console.log("1. Upload updated Lit Action 2 to IPFS");
        console.log("2. Update webhook server:");
        console.log("   - CATALOG_CONTRACT_ADDRESS=", address(catalog));
        console.log("   - LIT_ACTION_2_CID=<new_cid>");
        console.log("3. Test E2E flow with Demucs API");
        console.log("4. Migrate data from V1 if needed");
        console.log("5. Update frontend with new contract address");

        console.log("\n=== Integration Points ===");
        console.log("- KaraokeCreditsV1: Payment/ownership tracking");
        console.log("- Lit Actions: match-and-segment-v5, update-karaoke-contract-batch");
        console.log("- Demucs Modal API: Song-based processing");
        console.log("- Genius API: Metadata fetching");
        console.log("- Grove: Asset storage (audio, stems, covers)");
    }
}
