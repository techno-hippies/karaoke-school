// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {KaraokeEvents} from "../src/events/KaraokeEvents.sol";

/**
 * @title DeployKaraokeEvents
 * @notice Deploys only the KaraokeEvents contract
 */
contract DeployKaraokeEvents is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address trustedPKP = 0x5CF2f231D15F3e71f997AAE0f3037ec3fafa8379;

        console.log("Deploying KaraokeEvents...");
        console.log("Trusted PKP:", trustedPKP);

        vm.startBroadcast(deployerPrivateKey);
        KaraokeEvents karaokeEvents = new KaraokeEvents(trustedPKP);
        vm.stopBroadcast();

        console.log("KaraokeEvents deployed at:", address(karaokeEvents));
    }
}
