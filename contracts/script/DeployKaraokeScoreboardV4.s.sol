// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/KaraokeScoreboardV4.sol";

/**
 * @title DeployKaraokeScoreboardV4
 * @notice Deployment script for KaraokeScoreboardV4 contract
 * @dev Supports both local and testnet deployment
 *
 * Usage:
 * Local:
 *   forge script script/DeployKaraokeScoreboardV4.s.sol:DeployKaraokeScoreboardV4 --fork-url http://localhost:8545 --broadcast
 *
 * Lens Testnet (zkSync):
 *   FOUNDRY_PROFILE=zksync forge script script/DeployKaraokeScoreboardV4.s.sol:DeployKaraokeScoreboardV4 \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --zksync
 *
 * Verify:
 *   forge verify-contract <CONTRACT_ADDRESS> src/KaraokeScoreboardV4.sol:KaraokeScoreboardV4 \
 *     --chain-id 37111 \
 *     --constructor-args $(cast abi-encode "constructor(address)" "<PKP_ADDRESS>")
 */
contract DeployKaraokeScoreboardV4 is Script {
    function run() external {
        // Get PKP address from environment variable or use default
        address pkpAddress = vm.envOr("PKP_ADDRESS", address(0x254AA0096C9287a03eE62b97AA5643A2b8003657));

        require(pkpAddress != address(0), "PKP_ADDRESS not set");

        console.log("Deploying KaraokeScoreboardV4...");
        console.log("PKP Address (trusted scorer):", pkpAddress);
        console.log("Deployer:", msg.sender);

        vm.startBroadcast();

        KaraokeScoreboardV4 scoreboard = new KaraokeScoreboardV4(pkpAddress);

        vm.stopBroadcast();

        console.log("========================================");
        console.log("KaraokeScoreboardV4 deployed at:", address(scoreboard));
        console.log("Owner:", scoreboard.owner());
        console.log("Trusted Scorer:", scoreboard.trustedScorer());
        console.log("========================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Update site/src/config with new contract address");
        console.log("2. Generate ABI: forge inspect KaraokeScoreboardV4 abi > site/src/abi/KaraokeScoreboardV4.json");
        console.log("3. Configure tracks via configureTrack()");
        console.log("");
        console.log("Example track configuration:");
        console.log("  Native track:");
        console.log("    source: 0 (Native)");
        console.log("    trackId: 'heat-of-the-night-scarlett-x'");
        console.log("    segmentIds: ['verse-1', 'chorus-1', 'verse-2', ...]");
        console.log("");
        console.log("  Genius track:");
        console.log("    source: 1 (Genius)");
        console.log("    trackId: '123456' (genius_id)");
        console.log("    segmentIds: ['referent-5678', 'referent-5679', ...]");
    }
}
