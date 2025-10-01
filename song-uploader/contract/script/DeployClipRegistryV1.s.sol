// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {ClipRegistryV1} from "../src/ClipRegistryV1.sol";

/**
 * @title DeployClipRegistryV1
 * @notice Deployment script for ClipRegistryV1 contract
 * @dev Use with zkSync foundry for Lens Chain deployment
 */
contract DeployClipRegistryV1 is Script {
    function run() external returns (ClipRegistryV1) {
        vm.startBroadcast();

        ClipRegistryV1 registry = new ClipRegistryV1();

        console.log("ClipRegistryV1 deployed to:", address(registry));
        console.log("Owner:", registry.owner());

        vm.stopBroadcast();

        return registry;
    }
}
