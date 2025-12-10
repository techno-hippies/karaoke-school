// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SongAccess} from "../src/SongAccess.sol";

/**
 * @title DeploySongAccess
 * @notice Deploy SongAccess contract to Base or Base Sepolia
 *
 * Usage:
 *   # Base Sepolia (testnet)
 *   forge script script/DeploySongAccess.s.sol --rpc-url base-sepolia --broadcast
 *
 *   # Base (mainnet)
 *   forge script script/DeploySongAccess.s.sol --rpc-url base --broadcast
 */
contract DeploySongAccess is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Determine network based on chain
        uint256 chainId = block.chainid;
        string memory network;

        if (chainId == 8453) {
            network = "Base Mainnet";
        } else if (chainId == 84532) {
            network = "Base Sepolia";
        } else {
            revert("Unsupported chain");
        }

        console.log("Deploying SongAccess to", network);
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        SongAccess songAccess = new SongAccess(deployer);

        vm.stopBroadcast();

        console.log("SongAccess deployed to:", address(songAccess));
        console.log("Price: 0.0001 ETH");
    }
}
