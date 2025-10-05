// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../SongCatalogV1.sol";

/**
 * @title DeploySongCatalogV1
 * @notice Deployment script for SongCatalogV1
 *
 * Usage:
 * forge script SongCatalog/script/DeploySongCatalogV1.s.sol:DeploySongCatalogV1 \
 *   --rpc-url https://rpc.testnet.lens.xyz \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast
 *
 * For zkSync:
 * FOUNDRY_PROFILE=zksync forge script SongCatalog/script/DeploySongCatalogV1.s.sol:DeploySongCatalogV1 \
 *   --rpc-url https://rpc.testnet.lens.xyz \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --zksync
 */
contract DeploySongCatalogV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        SongCatalogV1 catalog = new SongCatalogV1();

        vm.stopBroadcast();

        console.log("SongCatalogV1 deployed to:", address(catalog));
        console.log("Owner:", catalog.owner());
    }
}
