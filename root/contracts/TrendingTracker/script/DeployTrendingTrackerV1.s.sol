// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../TrendingTrackerV1.sol";

/**
 * @title DeployTrendingTrackerV1
 * @notice Deployment script for TrendingTrackerV1
 *
 * Usage:
 * FOUNDRY_PROFILE=zksync forge script TrendingTracker/script/DeployTrendingTrackerV1.s.sol:DeployTrendingTrackerV1 \
 *   --rpc-url https://rpc.testnet.lens.xyz \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --zksync
 */
contract DeployTrendingTrackerV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address pkpAddress = vm.envAddress("PKP_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        TrendingTrackerV1 tracker = new TrendingTrackerV1(pkpAddress);

        vm.stopBroadcast();

        console.log("TrendingTrackerV1 deployed to:", address(tracker));
        console.log("Owner:", tracker.owner());
        console.log("Trusted Tracker (PKP):", tracker.trustedTracker());
        console.log("Click Weight:", tracker.clickWeight());
    }
}
