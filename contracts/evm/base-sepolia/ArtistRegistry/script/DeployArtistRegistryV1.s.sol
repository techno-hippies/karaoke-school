// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../ArtistRegistryV1.sol";

/**
 * @title DeployArtistRegistryV1
 * @notice Deployment script for ArtistRegistryV1 on Base Sepolia
 *
 * Purpose:
 * - Maps Genius Artist IDs to PKP addresses and Lens profiles
 * - Supports both MANUAL (pipeline) and GENERATED (on-demand) profiles
 * - Minimal on-chain storage (~$1-2 per artist on Base mainnet)
 * - Rich metadata stored in Lens Account Metadata (queryable via GraphQL)
 *
 * Base Sepolia:
 * - Chain ID: 84532
 * - RPC: https://sepolia.base.org
 * - Explorer: https://sepolia.basescan.org
 *
 * Usage (with dotenvx):
 * DOTENV_PRIVATE_KEY=<key> dotenvx run -f ../../../.env -- \
 *   forge script script/DeployArtistRegistryV1.s.sol:DeployArtistRegistryV1 \
 *   --rpc-url https://sepolia.base.org \
 *   --broadcast \
 *   --verify \
 *   --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
 *
 * Environment Variables Required (in .env):
 * - PRIVATE_KEY: Deployer private key (encrypted)
 * - BASESCAN_API_KEY: BaseScan API key for verification
 */
contract DeployArtistRegistryV1 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== ArtistRegistryV1 Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        ArtistRegistryV1 registry = new ArtistRegistryV1();

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("ArtistRegistryV1 deployed to:", address(registry));
        console.log("Owner:", registry.owner());
        console.log("Total Artists:", registry.totalArtists());
        console.log("Manual Artists:", registry.manualArtists());
        console.log("Generated Artists:", registry.generatedArtists());

        console.log("\n=== Contract Capabilities ===");
        console.log("- Register artists (MANUAL or GENERATED)");
        console.log("- Map geniusArtistId -> PKP address -> Lens handle");
        console.log("- Reverse lookups (PKP/Lens handle -> geniusId)");
        console.log("- Verification and content flags");
        console.log("- Batch queries for frontend optimization");
        console.log("- Subgraph-ready events");

        console.log("\n=== Data Architecture ===");
        console.log("On-Chain (Registry):");
        console.log("  - geniusArtistId, PKP address, Lens handle");
        console.log("  - Profile source (MANUAL/GENERATED)");
        console.log("  - Verification and content flags");
        console.log("  - Timestamps (createdAt, updatedAt)");
        console.log("");
        console.log("Off-Chain (Lens Account Metadata):");
        console.log("  - Industry IDs: ISNI, IPI, IPN, Spotify, Apple, Amazon");
        console.log("  - Social handles: TikTok, Twitter, Instagram, SoundCloud");
        console.log("  - Photos: thumbnail, main, cover");
        console.log("  - Personal: date of birth, nationality, birthplace");

        console.log("\n=== Gas Cost Estimate ===");
        console.log("- ~150k gas per registration");
        console.log("- Base mainnet @ 0.1 gwei: ~$0.015 per artist");
        console.log("- 10,000 artists: ~$150 (vs $50k-100k with full on-chain)");

        console.log("\n=== Next Steps ===");
        console.log("1. Update pkp-lens-flow pipeline:");
        console.log("   - Add 08-register-in-contract.ts step");
        console.log("   - Register existing artists (@billieeilish, @taylorswift, etc.)");
        console.log("2. Deploy The Graph subgraph (optional):");
        console.log("   - Index ArtistRegistered events");
        console.log("   - Enable advanced queries");
        console.log("3. Create frontend hook:");
        console.log("   - Check registry in /artist/:geniusId");
        console.log("   - Redirect to /u/:lensHandle if exists");
        console.log("4. Implement V2 generative flow:");
        console.log("   - Lit Action trigger -> webhook -> backend job");
        console.log("   - Auto-create PKP + Lens account + register");

        console.log("\n=== Integration Points ===");
        console.log("- PKP Minting: lit-actions/src/decrypt/*.js");
        console.log("- Lens Account: pkp-lens-flow/local/06-create-lens-account.ts");
        console.log("- Frontend: app/src/hooks/useArtistData.ts");
        console.log("- Registry Address: ", address(registry));
    }
}
