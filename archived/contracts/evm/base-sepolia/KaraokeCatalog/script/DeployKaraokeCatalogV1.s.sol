// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../KaraokeCatalogV1.sol";

/**
 * @title DeployKaraokeCatalogV1
 * @notice Deployment script for KaraokeCatalogV1 on Base Sepolia
 *
 * Base Sepolia:
 * - Chain ID: 84532
 * - RPC: https://sepolia.base.org
 * - Explorer: https://sepolia.basescan.org
 *
 * Usage (with dotenvx):
 * DOTENV_PRIVATE_KEY=<key> dotenvx run -f /path/to/contracts/.env -- \
 *   forge script KaraokeCatalog/script/DeployKaraokeCatalogV1.s.sol:DeployKaraokeCatalogV1 \
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
contract DeployKaraokeCatalogV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address trustedProcessor = vm.envAddress("PKP_ADDRESS");

        console.log("=== KaraokeCatalogV1 Deployment ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Trusted Processor (PKP):", trustedProcessor);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        KaraokeCatalogV1 catalog = new KaraokeCatalogV1(trustedProcessor);

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("KaraokeCatalogV1 deployed to:", address(catalog));
        console.log("Owner:", catalog.owner());
        console.log("Trusted Processor:", catalog.trustedProcessor());
        console.log("Paused:", catalog.paused());
        console.log("Total Songs:", catalog.getTotalSongs());

        console.log("\n=== Contract Capabilities ===");
        console.log("- Full songs with audio/metadata/covers");
        console.log("- Segment-only songs (copyrighted content)");
        console.log("- Genius API integration");
        console.log("- Batch segment creation");
        console.log("- Two-phase segment lifecycle (Create -> Process)");

        console.log("\n=== Next Steps ===");
        console.log("1. Update frontend with contract address");
        console.log("2. Grant PKP permission to call processor functions");
        console.log("3. Add initial songs via addFullSong()");
        console.log("4. Test segment creation with Lit Actions");
        console.log("5. Update KaraokeCreditsV1 with this catalog address");

        console.log("\n=== Integration Points ===");
        console.log("- KaraokeCreditsV1: Payment/ownership tracking");
        console.log("- Lit Actions: match-and-segment-v2, audio-processor-v2");
        console.log("- Genius API: Metadata fetching");
        console.log("- Grove: Asset storage (audio, stems, covers)");
    }
}
