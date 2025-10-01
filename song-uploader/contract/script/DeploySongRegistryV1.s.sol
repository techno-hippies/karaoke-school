// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {SongRegistryV1} from "../src/SongRegistryV1.sol";

contract DeploySongRegistryV1 is Script {
    function run() external returns (SongRegistryV1) {
        // Get the private key from environment (supports both 0x-prefixed and non-prefixed)
        string memory pkString = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey;

        // Check if it starts with 0x
        if (bytes(pkString).length > 2 && bytes(pkString)[0] == '0' && bytes(pkString)[1] == 'x') {
            deployerPrivateKey = vm.parseUint(pkString);
        } else {
            // Add 0x prefix
            deployerPrivateKey = vm.parseUint(string(abi.encodePacked("0x", pkString)));
        }

        vm.startBroadcast(deployerPrivateKey);

        SongRegistryV1 registry = new SongRegistryV1();

        vm.stopBroadcast();

        console.log("SongRegistryV1 deployed to:", address(registry));
        console.log("Owner:", registry.owner());

        return registry;
    }
}