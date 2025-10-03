// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {KaraokeScoreboardV3} from "../src/KaraokeScoreboardV3.sol";

/**
 * @title DeployKaraokeScoreboardV3
 * @notice Deployment script for KaraokeScoreboardV3 contract
 * @dev Use with zkSync foundry for Lens Chain deployment
 *
 * CRITICAL: Must wrap in bash -c to properly handle FOUNDRY_PROFILE
 *
 * Usage:
 *   bash -c 'FOUNDRY_PROFILE=zksync forge create \
 *     src/KaraokeScoreboardV3.sol:KaraokeScoreboardV3 \
 *     --broadcast \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --private-key $PRIVATE_KEY \
 *     --constructor-args "$PKP_ADDRESS" \
 *     --zksync'
 *
 * Or using forge script:
 *   bash -c 'FOUNDRY_PROFILE=zksync forge script script/DeployKaraokeScoreboardV3.s.sol:DeployKaraokeScoreboardV3 \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --zksync'
 */
contract DeployKaraokeScoreboardV3 is Script {
    function run() external returns (KaraokeScoreboardV3) {
        // Get PKP address from environment variable
        address trustedScorer = vm.envAddress("PKP_ADDRESS");
        require(trustedScorer != address(0), "PKP_ADDRESS not set in environment");

        console.log("Deploying KaraokeScoreboardV3...");
        console.log("Trusted Scorer (PKP):", trustedScorer);

        vm.startBroadcast();

        KaraokeScoreboardV3 scoreboard = new KaraokeScoreboardV3(trustedScorer);

        console.log("KaraokeScoreboardV3 deployed to:", address(scoreboard));
        console.log("Owner:", scoreboard.owner());
        console.log("Trusted Scorer:", scoreboard.trustedScorer());
        console.log("Paused:", scoreboard.paused());

        vm.stopBroadcast();

        return scoreboard;
    }
}
