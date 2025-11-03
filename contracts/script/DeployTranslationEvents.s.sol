// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {TranslationEvents} from "../src/events/TranslationEvents.sol";

/**
 * @title DeployTranslationEvents
 * @notice Deploy ONLY TranslationEvents (other contracts already deployed)
 *
 * Usage:
 *   cd contracts
 *   forge script script/DeployTranslationEvents.s.sol:DeployTranslationEvents \
 *     --rpc-url https://rpc.testnet.lens.xyz \
 *     --broadcast \
 *     --zksync \
 *     -vvv
 */
contract DeployTranslationEvents is Script {

    function run() external {
        // Load deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("=================================");
        console.log("Deploying TranslationEvents to Lens Testnet");
        console.log("=================================");
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy TranslationEvents (no constructor params)
        console.log("Deploying TranslationEvents...");
        TranslationEvents translationEvents = new TranslationEvents();
        console.log("  TranslationEvents deployed at:", address(translationEvents));
        console.log("");

        vm.stopBroadcast();

        // Print summary
        console.log("=================================");
        console.log("Deployment Summary");
        console.log("=================================");
        console.log("TranslationEvents:   ", address(translationEvents));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update karaoke-pipeline/scripts/contracts/emit-segment-events.ts:");
        console.log("   const TRANSLATION_EVENTS_ADDRESS = '", address(translationEvents), "';");
        console.log("2. Update subgraph/subgraph.yaml with this address");
        console.log("3. Run emission script to populate data");
    }
}
