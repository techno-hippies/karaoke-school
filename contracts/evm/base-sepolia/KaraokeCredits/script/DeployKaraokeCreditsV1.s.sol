// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../KaraokeCreditsV1.sol";

/**
 * @title DeployKaraokeCreditsV1
 * @notice Deployment script for KaraokeCreditsV1 on Base Sepolia
 *
 * Base Sepolia:
 * - Chain ID: 84532
 * - RPC: https://sepolia.base.org
 * - Explorer: https://sepolia.basescan.org
 * - USDC (Mock): 0x036CbD53842c5426634e7929541eC2318f3dCF7e
 *
 * Usage:
 * forge script KaraokeCredits/script/DeployKaraokeCreditsV1.s.sol:DeployKaraokeCreditsV1 \
 *   --rpc-url https://sepolia.base.org \
 *   --private-key $PRIVATE_KEY \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key $BASESCAN_API_KEY
 *
 * Environment Variables Required:
 * - PRIVATE_KEY: Deployer private key
 * - TREASURY_ADDRESS: Address to receive payments
 * - PKP_ADDRESS: Lit Protocol PKP address (for granting free credits)
 * - SONG_CATALOG_ADDRESS (optional): SongCatalogV1 address on Lens Testnet
 * - USDC_TOKEN_ADDRESS (optional): Defaults to Base Sepolia USDC mock
 */
contract DeployKaraokeCreditsV1 is Script {
    // Base Sepolia USDC mock (default)
    address constant DEFAULT_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address trustedPKP = vm.envAddress("PKP_ADDRESS");

        // Optional: SongCatalog address (can be 0x0 initially)
        address songCatalog = vm.envOr("SONG_CATALOG_ADDRESS", address(0));

        // Optional: Custom USDC address
        address usdcToken = vm.envOr("USDC_TOKEN_ADDRESS", DEFAULT_USDC);

        console.log("=== KaraokeCreditsV1 Deployment ===");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Treasury:", treasury);
        console.log("Trusted PKP:", trustedPKP);
        console.log("USDC Token:", usdcToken);
        console.log("SongCatalog:", songCatalog == address(0) ? "Not set (can be set later)" : vm.toString(songCatalog));

        vm.startBroadcast(deployerPrivateKey);

        KaraokeCreditsV1 credits = new KaraokeCreditsV1(
            usdcToken,
            treasury,
            trustedPKP,
            songCatalog
        );

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("KaraokeCreditsV1 deployed to:", address(credits));
        console.log("Owner:", credits.owner());
        console.log("Package Count:", credits.packageCount());

        // Display default packages
        console.log("\n=== Default Credit Packages ===");
        for (uint8 i = 0; i < credits.packageCount(); i++) {
            (uint16 creditAmount, uint256 priceUSDC, uint256 priceETH, bool enabled) = credits.packages(i);
            console.log(string.concat("Package ", vm.toString(i), ":"));
            console.log("  Credits:", creditAmount);
            console.log("  Price USDC:", priceUSDC);
            console.log("  Price ETH:", priceETH);
            console.log("  Enabled:", enabled);
        }

        console.log("\n=== Next Steps ===");
        console.log("1. Verify contract on BaseScan");
        console.log("2. Set SongCatalog address (if not set)");
        console.log("3. Update frontend with contract address");
        console.log("4. Fund treasury with ETH for gas");
        console.log("5. Test credit purchase with USDC");
    }
}
