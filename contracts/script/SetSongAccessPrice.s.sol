// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SongAccess} from "../src/SongAccess.sol";

/**
 * @title SetSongAccessPrice
 * @notice Update the price on SongAccess contract
 *
 * Usage:
 *   # Base Sepolia (testnet) - set price to 0.000033 ETH (~$0.10)
 *   forge script script/SetSongAccessPrice.s.sol --rpc-url base-sepolia --broadcast
 */
contract SetSongAccessPrice is Script {
    // Base Sepolia contract address
    address constant SONG_ACCESS_TESTNET = 0x7856C6121b3Fb861C31cb593a65236858d789bDB;

    // New price: 0.000033 ETH = 33,000,000,000,000 wei (~$0.10 at $3000/ETH)
    uint256 constant NEW_PRICE = 33_000_000_000_000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        uint256 chainId = block.chainid;
        address contractAddress;

        if (chainId == 84532) {
            contractAddress = SONG_ACCESS_TESTNET;
            console.log("Network: Base Sepolia");
        } else if (chainId == 8453) {
            revert("Mainnet contract not deployed yet");
        } else {
            revert("Unsupported chain");
        }

        SongAccess songAccess = SongAccess(contractAddress);

        console.log("Contract:", contractAddress);
        console.log("Caller:", deployer);
        console.log("Current price:", songAccess.price());
        console.log("New price:", NEW_PRICE);

        vm.startBroadcast(deployerPrivateKey);

        songAccess.setPrice(NEW_PRICE);

        vm.stopBroadcast();

        console.log("Price updated successfully!");
        console.log("New price (wei):", NEW_PRICE);
        console.log("New price (ETH):", "0.000033");
    }
}
