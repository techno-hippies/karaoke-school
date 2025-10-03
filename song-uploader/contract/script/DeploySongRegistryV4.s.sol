// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/SongRegistryV4.sol";

contract DeploySongRegistryV4 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        SongRegistryV4 registry = new SongRegistryV4();

        console.log("SongRegistryV4 deployed to:", address(registry));
        console.log("Owner:", registry.owner());

        vm.stopBroadcast();
    }
}
