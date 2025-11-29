// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {KaraokeEvents} from "../src/events/KaraokeEvents.sol";
import {TranslationEvents} from "../src/events/TranslationEvents.sol";
import {ExerciseEvents} from "../src/events/ExerciseEvents.sol";
import {AccountEvents} from "../src/events/AccountEvents.sol";

/**
 * @title DeployEvents
 * @notice Deployment script for V2 event contracts on Lens Chain
 * @dev Deploys minimal event-only contracts for Grove + The Graph architecture
 *
 * Usage:
 *   # Deploy to Lens Chain testnet
 *   forge script script/DeployEvents.s.sol:DeployEvents \
 *     --rpc-url lens-testnet \
 *     --broadcast \
 *     --zksync \
 *     -vvvv
 *
 *   # With verification
 *   forge script script/DeployEvents.s.sol:DeployEvents \
 *     --rpc-url lens-testnet \
 *     --broadcast \
 *     --verify \
 *     --zksync \
 *     -vvvv
 */
contract DeployEvents is Script {

    function run() external {
        // Load deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load trusted PKP address for grading functions
        address trustedPKP = vm.envAddress("TRUSTED_PKP_ADDRESS");

        console.log("=================================");
        console.log("Deploying Event Contracts to Lens Chain");
        console.log("=================================");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy KaraokeEvents (clip lifecycle + grading, with trusted PKP)
        console.log("Deploying KaraokeEvents...");
        console.log("  Trusted PKP:", trustedPKP);
        KaraokeEvents karaokeEvents = new KaraokeEvents(trustedPKP);
        console.log("  KaraokeEvents deployed at:", address(karaokeEvents));
        console.log("");

        // Deploy ExerciseEvents (FSRS study cards, with trusted PKP)
        console.log("Deploying ExerciseEvents...");
        console.log("  Trusted PKP:", trustedPKP);
        ExerciseEvents exerciseEvents = new ExerciseEvents(trustedPKP);
        console.log("  ExerciseEvents deployed at:", address(exerciseEvents));
        console.log("");

        // Deploy TranslationEvents (no constructor params)
        console.log("Deploying TranslationEvents...");
        TranslationEvents translationEvents = new TranslationEvents();
        console.log("  TranslationEvents deployed at:", address(translationEvents));
        console.log("");

        // Deploy AccountEvents (no constructor params)
        console.log("Deploying AccountEvents...");
        AccountEvents accountEvents = new AccountEvents();
        console.log("  AccountEvents deployed at:", address(accountEvents));
        console.log("");

        vm.stopBroadcast();

        // Print summary
        console.log("=================================");
        console.log("Deployment Summary");
        console.log("=================================");
        console.log("KaraokeEvents:       ", address(karaokeEvents));
        console.log("ExerciseEvents:      ", address(exerciseEvents));
        console.log("TranslationEvents:   ", address(translationEvents));
        console.log("AccountEvents:       ", address(accountEvents));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update subgraph/subgraph.yaml with contract addresses");
        console.log("2. Run: cd subgraph && bun run codegen && bun run build");
        console.log("3. Deploy subgraph to The Graph");
    }
}
