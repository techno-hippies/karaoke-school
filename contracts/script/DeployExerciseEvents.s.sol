// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {ExerciseEvents} from "../src/events/ExerciseEvents.sol";

/**
 * @title DeployExerciseEvents
 * @notice Deploy only ExerciseEvents contract
 *
 * Usage:
 *   PRIVATE_KEY=0x... TRUSTED_PKP_ADDRESS=0x... forge script script/DeployExerciseEvents.s.sol:DeployExerciseEvents \
 *     --rpc-url lens-testnet \
 *     --broadcast \
 *     --zksync \
 *     -vvvv
 */
contract DeployExerciseEvents is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address trustedPKP = vm.envAddress("TRUSTED_PKP_ADDRESS");

        console.log("Deploying ExerciseEvents...");
        console.log("Trusted PKP:", trustedPKP);

        vm.startBroadcast(deployerPrivateKey);
        ExerciseEvents exerciseEvents = new ExerciseEvents(trustedPKP);
        vm.stopBroadcast();

        console.log("ExerciseEvents deployed at:", address(exerciseEvents));
    }
}
