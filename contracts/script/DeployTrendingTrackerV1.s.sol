// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/TrendingTrackerV1.sol";

/**
 * @title Deploy TrendingTrackerV1
 * @notice Deployment script for TrendingTrackerV1 contract
 *
 * Usage:
 * forge script script/DeployTrendingTrackerV1.s.sol:DeployTrendingTrackerV1 \
 *   --rpc-url https://rpc.testnet.lens.xyz \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --zksync
 *
 * Environment variables:
 * - PKP_ADDRESS: Trusted PKP address (required)
 * - PRIVATE_KEY: Deployer private key
 */
contract DeployTrendingTrackerV1 is Script {
    function run() external {
        // Get PKP address from environment
        address pkpAddress = vm.envAddress("PKP_ADDRESS");
        require(pkpAddress != address(0), "PKP_ADDRESS not set");

        console.log("Deploying TrendingTrackerV1...");
        console.log("Trusted Tracker (PKP):", pkpAddress);
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();

        // Deploy TrendingTrackerV1
        TrendingTrackerV1 tracker = new TrendingTrackerV1(pkpAddress);

        console.log("TrendingTrackerV1 deployed at:", address(tracker));
        console.log("");
        console.log("Contract Configuration:");
        console.log("  Owner:", tracker.owner());
        console.log("  Trusted Tracker:", tracker.trustedTracker());
        console.log("  Click Weight:", tracker.clickWeight());
        console.log("  Play Weight:", tracker.playWeight());
        console.log("  Completion Weight:", tracker.completionWeight());
        console.log("  Paused:", tracker.paused());

        vm.stopBroadcast();

        console.log("");
        console.log("=== Next Steps ===");
        console.log("1. Update trending-tracker-v1.js with contract address:");
        console.log("   const TRENDING_TRACKER_ADDRESS = '%s';", address(tracker));
        console.log("");
        console.log("2. Upload Lit Action to IPFS:");
        console.log("   npm run upload-lit-action -- lit-actions/src/trending/trending-tracker-v1.js");
        console.log("");
        console.log("3. Update PKP permissions to allow execution");
        console.log("");
        console.log("4. Test with frontend integration");
    }
}
