// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/core/ArtistRegistryV1.sol";
import "../src/core/SongRegistryV1.sol";
import "../src/core/SegmentRegistryV1.sol";
import "../src/core/PerformanceRegistryV1.sol";
import "../src/student/StudentProfileV2.sol";
import "../src/core/FSRSTrackerV1.sol";
import "../src/leaderboard/LeaderboardV1.sol";

/**
 * @title Deploy
 * @notice Deployment script for all v2 contracts
 * @dev Deploys contracts in dependency order
 */
contract Deploy is Script {

    function run() external {
        vm.startBroadcast();

        // 1. Deploy ArtistRegistry (no dependencies)
        console.log("Deploying ArtistRegistryV1...");
        ArtistRegistryV1 artistRegistry = new ArtistRegistryV1();
        console.log("ArtistRegistryV1 deployed at:", address(artistRegistry));

        // 2. Deploy SongRegistry (depends on ArtistRegistry)
        console.log("Deploying SongRegistryV1...");
        SongRegistryV1 songRegistry = new SongRegistryV1(address(artistRegistry));
        console.log("SongRegistryV1 deployed at:", address(songRegistry));

        // 3. Deploy SegmentRegistry (depends on SongRegistry)
        console.log("Deploying SegmentRegistryV1...");
        SegmentRegistryV1 segmentRegistry = new SegmentRegistryV1(address(songRegistry));
        console.log("SegmentRegistryV1 deployed at:", address(segmentRegistry));

        // 4. Deploy PerformanceRegistry (depends on SegmentRegistry)
        console.log("Deploying PerformanceRegistryV1...");
        PerformanceRegistryV1 performanceRegistry = new PerformanceRegistryV1(address(segmentRegistry));
        console.log("PerformanceRegistryV1 deployed at:", address(performanceRegistry));

        // 5. Deploy StudentProfileV2 (integrated FSRS + Performance tracking)
        console.log("Deploying StudentProfileV2...");
        StudentProfileV2 studentProfile = new StudentProfileV2();
        console.log("StudentProfileV2 deployed at:", address(studentProfile));

        // 6. Deploy FSRSTracker (requires trusted PKP address)
        console.log("Deploying FSRSTrackerV1...");
        // TODO: Replace with actual trusted PKP address
        address trustedPKP = vm.envOr("TRUSTED_PKP_ADDRESS", msg.sender);
        FSRSTrackerV1 fsrsTracker = new FSRSTrackerV1(trustedPKP);
        console.log("FSRSTrackerV1 deployed at:", address(fsrsTracker));

        // 6. Deploy Leaderboard (no dependencies)
        console.log("Deploying LeaderboardV1...");
        LeaderboardV1 leaderboard = new LeaderboardV1();
        console.log("LeaderboardV1 deployed at:", address(leaderboard));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n==== DEPLOYMENT SUMMARY ====");
        console.log("ArtistRegistry:", address(artistRegistry));
        console.log("SongRegistry:", address(songRegistry));
        console.log("SegmentRegistry:", address(segmentRegistry));
        console.log("PerformanceRegistry:", address(performanceRegistry));
        console.log("StudentProfile:", address(studentProfile));
        console.log("Leaderboard:", address(leaderboard));
        console.log("============================\n");
    }
}

/**
 * @title DeployArtistRegistry
 * @notice Deploy only ArtistRegistry (for testing)
 */
contract DeployArtistRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        ArtistRegistryV1 artistRegistry = new ArtistRegistryV1();
        console.log("ArtistRegistryV1 deployed at:", address(artistRegistry));

        vm.stopBroadcast();
    }
}

/**
 * @title DeploySongRegistry
 * @notice Deploy only SongRegistry (requires ArtistRegistry address)
 */
contract DeploySongRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address artistRegistry = vm.envAddress("ARTIST_REGISTRY");

        vm.startBroadcast(deployerPrivateKey);

        SongRegistryV1 songRegistry = new SongRegistryV1(artistRegistry);
        console.log("SongRegistryV1 deployed at:", address(songRegistry));

        vm.stopBroadcast();
    }
}

/**
 * @title DeploySegmentRegistry
 * @notice Deploy only SegmentRegistry (requires SongRegistry address)
 */
contract DeploySegmentRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address songRegistry = vm.envAddress("SONG_REGISTRY");

        vm.startBroadcast(deployerPrivateKey);

        SegmentRegistryV1 segmentRegistry = new SegmentRegistryV1(songRegistry);
        console.log("SegmentRegistryV1 deployed at:", address(segmentRegistry));

        vm.stopBroadcast();
    }
}

/**
 * @title DeployPerformanceRegistry
 * @notice Deploy only PerformanceRegistry (requires SegmentRegistry address)
 */
contract DeployPerformanceRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address segmentRegistry = vm.envAddress("SEGMENT_REGISTRY");

        vm.startBroadcast(deployerPrivateKey);

        PerformanceRegistryV1 performanceRegistry = new PerformanceRegistryV1(segmentRegistry);
        console.log("PerformanceRegistryV1 deployed at:", address(performanceRegistry));

        vm.stopBroadcast();
    }
}

/**
 * @title DeployStudentProfile
 * @notice Deploy only StudentProfileV2 (for testing)
 */
contract DeployStudentProfile is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        StudentProfileV2 studentProfile = new StudentProfileV2();
        console.log("StudentProfileV2 deployed at:", address(studentProfile));

        vm.stopBroadcast();
    }
}

/**
 * @title DeployLeaderboard
 * @notice Deploy only Leaderboard (for testing)
 */
contract DeployLeaderboard is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        LeaderboardV1 leaderboard = new LeaderboardV1();
        console.log("LeaderboardV1 deployed at:", address(leaderboard));

        vm.stopBroadcast();
    }
}
