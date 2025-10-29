// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PerformanceGrader} from "../src/events/PerformanceGrader.sol";

/**
 * @title Simple PerformanceGrader Deployment
 * @notice Direct deployment of PerformanceGrader to Lens Chain
 */
contract SimpleDeploy is Script {
    function run() external {
        // Load deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Load trusted PKP address
        address trustedPKP = vm.envAddress("TRUSTED_PKP_ADDRESS");

        console.log("Deploying PerformanceGrader to Lens Chain...");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Trusted PKP:", trustedPKP);
        
        // Check balance
        address deployer = vm.addr(deployerPrivateKey);
        uint256 balance = deployer.balance;
        console.log("Deployer balance:", balance, "wei");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy just PerformanceGrader
        PerformanceGrader performanceGrader = new PerformanceGrader(trustedPKP);
        
        
        
        console.log("PerformanceGrader deployed at:", address(performanceGrader));
        console.log("Trusted PKP set to:", trustedPKP);
        
        vm.stopBroadcast();
        
        
    }
}
