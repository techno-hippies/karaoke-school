// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {KaraokeScoreboardV2} from "../src/KaraokeScoreboardV2.sol";

/**
 * @title DeployKaraokeScoreboardV2
 * @notice Deployment script for KaraokeScoreboardV2 contract
 * @dev Use with zkSync foundry for Lens Chain deployment
 *
 * Usage (IMPORTANT: Must use bash -c to properly handle FOUNDRY_PROFILE):
 *   bash -c 'FOUNDRY_PROFILE=zksync forge create \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --private-key $PRIVATE_KEY \
 *     --constructor-args "0x254AA0096C9287a03eE62b97AA5643A2b8003657" \
 *     src/KaraokeScoreboardV2.sol:KaraokeScoreboardV2 \
 *     --zksync \
 *     --broadcast'
 *
 * Or using forge script:
 *   bash -c 'FOUNDRY_PROFILE=zksync forge script script/DeployKaraokeScoreboardV2.s.sol:DeployKaraokeScoreboardV2 \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --zksync'
 */
contract DeployKaraokeScoreboardV2 is Script {
    function run() external returns (KaraokeScoreboardV2) {
        // Get PKP address from environment variable
        address trustedScorer = vm.envAddress("PKP_ADDRESS");
        require(trustedScorer != address(0), "PKP_ADDRESS not set in environment");

        console.log("Deploying KaraokeScoreboardV2...");
        console.log("Trusted Scorer (PKP):", trustedScorer);

        vm.startBroadcast();

        KaraokeScoreboardV2 scoreboard = new KaraokeScoreboardV2(trustedScorer);

        console.log("KaraokeScoreboardV2 deployed to:", address(scoreboard));
        console.log("Owner:", scoreboard.owner());
        console.log("Trusted Scorer:", scoreboard.trustedScorer());

        vm.stopBroadcast();

        return scoreboard;
    }
}
