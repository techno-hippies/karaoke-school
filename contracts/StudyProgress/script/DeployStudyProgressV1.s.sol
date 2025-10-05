// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../StudyProgressV1.sol";

/**
 * @title DeployStudyProgressV1
 * @notice Deployment script for StudyProgressV1
 *
 * Usage:
 * FOUNDRY_PROFILE=zksync forge script StudyTracker/script/DeployStudyProgressV1.s.sol:DeployStudyProgressV1 \
 *   --rpc-url https://rpc.testnet.lens.xyz \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --zksync
 */
contract DeployStudyProgressV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address pkpAddress = vm.envAddress("PKP_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        StudyProgressV1 tracker = new StudyProgressV1(pkpAddress);

        vm.stopBroadcast();

        console.log("StudyProgressV1 deployed to:", address(tracker));
        console.log("Owner:", tracker.owner());
        console.log("Trusted Tracker (PKP):", tracker.trustedTracker());
    }
}
