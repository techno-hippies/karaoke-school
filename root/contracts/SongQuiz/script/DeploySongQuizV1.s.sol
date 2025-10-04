// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../SongQuizV1.sol";

/**
 * @title DeploySongQuizV1
 * @notice Deployment script for SongQuizV1
 *
 * Usage:
 * FOUNDRY_PROFILE=zksync forge script ArtistQuizTracker/script/DeploySongQuizV1.s.sol:DeploySongQuizV1 \
 *   --rpc-url https://rpc.testnet.lens.xyz \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --zksync
 */
contract DeploySongQuizV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address pkpAddress = vm.envAddress("PKP_ADDRESS");
        address studyTrackerAddress = vm.envAddress("STUDY_TRACKER_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        SongQuizV1 quizTracker = new SongQuizV1(pkpAddress, studyTrackerAddress);

        vm.stopBroadcast();

        console.log("SongQuizV1 deployed to:", address(quizTracker));
        console.log("Owner:", quizTracker.owner());
        console.log("Trusted Quiz Master (PKP):", quizTracker.trustedQuizMaster());
        console.log("StudyProgress Reference:", quizTracker.studyProgress());
        console.log("Time Limit:", quizTracker.TIME_LIMIT_SECONDS(), "seconds");
    }
}
