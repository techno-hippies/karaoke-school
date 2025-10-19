// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../FSRSTrackerV1.sol";

/**
 * @title DeployFSRSTrackerV1
 * @notice Deployment script for FSRSTrackerV1 on Base Sepolia
 *
 * Base Sepolia:
 * - Chain ID: 84532
 * - RPC: https://sepolia.base.org
 * - Explorer: https://sepolia.basescan.org
 * - Gas: ~0.001 gwei (very cheap L2)
 *
 * Usage (with dotenvx):
 * DOTENV_PRIVATE_KEY=<key> dotenvx run -f /path/to/contracts/.env -- \
 *   forge script FSRSTracker/script/DeployFSRSTrackerV1.s.sol:DeployFSRSTrackerV1 \
 *   --rpc-url https://sepolia.base.org \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key $BASESCAN_API_KEY
 *
 * Environment Variables Required (in .env):
 * - PRIVATE_KEY: Deployer private key (encrypted via dotenvx)
 * - PKP_ADDRESS: Lit Protocol PKP address (study-scorer-v1.js signer)
 * - BASESCAN_API_KEY: BaseScan API key for verification
 */
contract DeployFSRSTrackerV1 is Script {

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address trustedPKP = vm.envAddress("PKP_ADDRESS");

        console.log("=== FSRSTrackerV1 Deployment ===");
        console.log("Network: Base Sepolia (84532)");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Trusted PKP:", trustedPKP);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        FSRSTrackerV1 tracker = new FSRSTrackerV1(trustedPKP);

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("FSRSTrackerV1 deployed to:", address(tracker));
        console.log("Owner:", tracker.owner());
        console.log("Trusted PKP:", tracker.trustedPKP());
        console.log("Paused:", tracker.paused());
        console.log("Max Line Count:", tracker.MAX_LINE_COUNT());

        console.log("\n=== Gas Estimates ===");
        console.log("Deployment: ~2-3M gas (~$0.01 on Base)");
        console.log("Per review: ~50k gas (~$0.00005 on Base)");
        console.log("Batch (5 lines): ~200k gas (~$0.0002 on Base)");

        console.log("\n=== Next Steps ===");
        console.log("1. Update app/src/config/contracts.ts with deployed address");
        console.log("2. Update lit-actions/src/karaoke/contracts.config.js");
        console.log("3. Fund PKP wallet with ETH (~0.001 ETH = 20k reviews)");
        console.log("4. Test via study-scorer-v1.js Lit Action");
        console.log("5. Monitor CardReviewed events for Grove indexing");

        console.log("\n=== Verification Command ===");
        console.log(string.concat(
            "forge verify-contract ",
            vm.toString(address(tracker)),
            " FSRSTracker/FSRSTrackerV1.sol:FSRSTrackerV1 ",
            "--chain-id 84532 ",
            "--constructor-args $(cast abi-encode 'constructor(address)' ",
            vm.toString(trustedPKP),
            ")"
        ));
    }
}
