// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../KaraokeSegmentRegistryV1.sol";

/**
 * @title DeployKaraokeSegmentRegistryV1
 * @notice Deployment script for KaraokeSegmentRegistryV1 on Base Sepolia
 *
 * Usage:
 * forge script KaraokeSegmentRegistry/script/DeployKaraokeSegmentRegistryV1.s.sol:DeployKaraokeSegmentRegistryV1 \
 *   --rpc-url https://sepolia.base.org \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key $BASESCAN_API_KEY
 *
 * Environment Variables Required:
 * - PRIVATE_KEY: Deployer private key
 * - PKP_ADDRESS: Lit Protocol PKP address (for segment registration)
 */
contract DeployKaraokeSegmentRegistryV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address trustedProcessor = vm.envAddress("PKP_ADDRESS");

        console.log("=== KaraokeSegmentRegistryV1 Deployment ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Trusted Processor (PKP):", trustedProcessor);

        vm.startBroadcast(deployerPrivateKey);

        KaraokeSegmentRegistryV1 registry = new KaraokeSegmentRegistryV1(trustedProcessor);

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("KaraokeSegmentRegistryV1 deployed to:", address(registry));
        console.log("Owner:", registry.owner());
        console.log("Trusted Processor:", registry.trustedProcessor());

        console.log("\n=== Next Steps ===");
        console.log("1. Verify contract on BaseScan");
        console.log("2. Update Lit Actions with registry address");
        console.log("3. Update frontend with registry address");
        console.log("4. Test segment registration flow");
    }
}
