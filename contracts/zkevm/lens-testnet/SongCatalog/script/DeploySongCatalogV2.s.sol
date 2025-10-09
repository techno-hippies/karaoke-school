// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../SongCatalogV2.sol";

/**
 * @title DeploySongCatalogV2
 * @notice Deployment script for SongCatalogV2 on Lens Testnet
 *
 * Lens Testnet (zkSync):
 * - Chain ID: 37111
 * - RPC: https://rpc.testnet.lens.xyz
 * - Explorer: https://explorer.testnet.lens.xyz
 *
 * Usage:
 * forge script SongCatalog/script/DeploySongCatalogV2.s.sol:DeploySongCatalogV2 \
 *   --rpc-url https://rpc.testnet.lens.xyz \
 *   --broadcast
 *
 * Environment Variables:
 * - PKP_ADDRESS: Lit Protocol PKP address (for automated segment generation)
 */
contract DeploySongCatalogV2 is Script {
    function run() external {
        address trustedPKP = vm.envAddress("PKP_ADDRESS");

        console.log("=== SongCatalogV2 Deployment ===");
        console.log("Deployer:", msg.sender);
        console.log("Trusted PKP:", trustedPKP);

        vm.startBroadcast();

        SongCatalogV2 catalog = new SongCatalogV2(trustedPKP);

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("SongCatalogV2 deployed to:", address(catalog));
        console.log("Owner:", catalog.owner());
        console.log("Trusted PKP:", catalog.trustedPKP());
        console.log("Total Songs:", catalog.getTotalSongs());

        console.log("\n=== Next Steps ===");
        console.log("1. Migrate songs from SongCatalogV1 (if needed)");
        console.log("2. Update frontend config with new address");
        console.log("3. Update Lit Actions to use SongCatalogV2");
        console.log("4. Test adding a full song");
        console.log("5. Test generating a segment");
    }
}
