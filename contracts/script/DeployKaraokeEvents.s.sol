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
        address trustedPKP = 0x3345Cb3A0CfEcb47bC3D638e338D26c870FA2b23;

        console.log("Deploying KaraokeEvents...");
        console.log("Trusted PKP:", trustedPKP);

        vm.startBroadcast(deployerPrivateKey);
        KaraokeEvents karaokeEvents = new KaraokeEvents(trustedPKP);
        vm.stopBroadcast();

        console.log("KaraokeEvents deployed at:", address(karaokeEvents));
    }
}
