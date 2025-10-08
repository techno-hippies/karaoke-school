// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../SongCatalog/SongCatalogV1.sol";

contract DeploySongCatalogV1 is Script {
    function run() external {
        vm.startBroadcast();

        // Deploy SongCatalogV1
        SongCatalogV1 catalog = new SongCatalogV1();

        console.log("SongCatalogV1 deployed at:", address(catalog));
        console.log("Owner:", catalog.owner());

        vm.stopBroadcast();
    }
}
