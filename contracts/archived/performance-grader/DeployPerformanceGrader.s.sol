// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {PerformanceGrader} from "../src/events/PerformanceGrader.sol";

/**
 * @title DeployPerformanceGrader
 * @notice Deployment script for PerformanceGrader contract only
 */
contract DeployPerformanceGrader is Script {

    function run() external {
        // Load deployer private key from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load trusted PKP address for PerformanceGrader
        address trustedPKP = vm.envAddress("TRUSTED_PKP_ADDRESS");

        console.log("=================================");
        console.log("Deploying PerformanceGrader to Lens Chain");
        console.log("=================================");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Trusted PKP:", trustedPKP);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy PerformanceGrader (requires PKP address)
        console.log("Deploying PerformanceGrader...");
        PerformanceGrader performanceGrader = new PerformanceGrader(trustedPKP);
        console.log("  PerformanceGrader deployed at:", address(performanceGrader));

        vm.stopBroadcast();

        // Print summary
        console.log("");
        console.log("=================================");
        console.log("Deployment Complete");
        console.log("=================================");
        console.log("PerformanceGrader:", address(performanceGrader));
        console.log("Owner:", vm.addr(deployerPrivateKey));
        console.log("Trusted PKP:", trustedPKP);
    }
}
