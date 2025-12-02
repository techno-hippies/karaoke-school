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
    // USDC addresses
    address constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Determine USDC address based on chain
        uint256 chainId = block.chainid;
        address usdc;
        string memory network;

        if (chainId == 8453) {
            usdc = USDC_BASE;
            network = "Base Mainnet";
        } else if (chainId == 84532) {
            usdc = USDC_BASE_SEPOLIA;
            network = "Base Sepolia";
        } else {
            revert("Unsupported chain");
        }

        console.log("Deploying SongAccess to", network);
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);

        vm.startBroadcast(deployerPrivateKey);

        SongAccess songAccess = new SongAccess(usdc, deployer);

        vm.stopBroadcast();

        console.log("SongAccess deployed to:", address(songAccess));
        console.log("Price: 0.10 USDC (100000 units)");
    }
}
