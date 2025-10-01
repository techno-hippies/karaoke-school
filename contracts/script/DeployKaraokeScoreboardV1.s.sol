// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {KaraokeScoreboardV1} from "../src/KaraokeScoreboardV1.sol";

/**
 * @title DeployKaraokeScoreboardV1
 * @notice Deployment script for KaraokeScoreboardV1 contract
 * @dev Use with zkSync foundry for Lens Chain deployment
 *
 * Usage:
 *   FOUNDRY_PROFILE=zksync forge script script/DeployKaraokeScoreboardV1.s.sol:DeployKaraokeScoreboardV1 \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast \
 *     --zksync
 *
 * Or using forge create directly:
 *   FOUNDRY_PROFILE=zksync forge create \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --private-key $PRIVATE_KEY \
 *     --constructor-args "0xYourPKPAddress" \
 *     src/KaraokeScoreboardV1.sol:KaraokeScoreboardV1 \
 *     --zksync \
 *     --gas-limit 10000000 \
 *     --gas-price 300000000 \
 *     --broadcast
 */
contract DeployKaraokeScoreboardV1 is Script {
    function run() external returns (KaraokeScoreboardV1) {
        // Get PKP address from environment variable
        address trustedScorer = vm.envAddress("PKP_ADDRESS");
        require(trustedScorer != address(0), "PKP_ADDRESS not set in environment");

        console.log("Deploying KaraokeScoreboardV1...");
        console.log("Trusted Scorer (PKP):", trustedScorer);

        vm.startBroadcast();

        KaraokeScoreboardV1 scoreboard = new KaraokeScoreboardV1(trustedScorer);

        console.log("KaraokeScoreboardV1 deployed to:", address(scoreboard));
        console.log("Owner:", scoreboard.owner());
        console.log("Trusted Scorer:", scoreboard.trustedScorer());

        vm.stopBroadcast();

        return scoreboard;
    }
}
