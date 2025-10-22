// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/events/AccountEvents.sol";

/**
 * @title AccountEventsTest
 * @notice Tests for AccountEvents contract (optional analytics contract)
 */
contract AccountEventsTest is BaseTest {

    AccountEvents public accountEvents;

    address public lensAccount = makeAddr("lensAccount");
    address public pkpAddress = makeAddr("pkpAddress");
    string public username = "taylorswift";

    function setUp() public override {
        super.setUp();

        // Deploy AccountEvents
        accountEvents = new AccountEvents();

        // Label addresses
        vm.label(lensAccount, "LensAccount");
        vm.label(pkpAddress, "PKP");
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        // Contract should deploy successfully
        assert(address(accountEvents) != address(0));
    }

    // ============ AccountCreated Event Tests ============

    function test_EmitAccountCreated() public {
        uint32 geniusArtistId = GENIUS_ARTIST_1;

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit AccountEvents.AccountCreated(
            lensAccount,
            pkpAddress,
            username,
            METADATA_URI,
            geniusArtistId,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            username,
            METADATA_URI,
            geniusArtistId
        );
    }

    function test_EmitAccountCreated_NonArtist() public {
        uint32 geniusArtistId = 0; // Not an artist

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit AccountEvents.AccountCreated(
            lensAccount,
            pkpAddress,
            username,
            METADATA_URI,
            geniusArtistId,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(user1);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            username,
            METADATA_URI,
            geniusArtistId
        );
    }

    function test_EmitAccountCreated_Gas() public {
        uint32 geniusArtistId = GENIUS_ARTIST_1;

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            username,
            METADATA_URI,
            geniusArtistId
        );
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~25k gas (within 5k tolerance)
        assertLt(gasUsed, 30_000, "Gas too high");
        assertGt(gasUsed, 20_000, "Gas unexpectedly low");

        emit log_named_uint("Gas used for AccountCreated", gasUsed);
    }

    function test_EmitAccountCreated_Multiple() public {
        // Register multiple accounts
        for (uint32 i = 1; i <= 5; i++) {
            address account = address(uint160(i + 1000));
            address pkp = address(uint160(i + 2000));
            string memory name = string(abi.encodePacked("user", vm.toString(i)));

            vm.expectEmit(true, true, false, true);
            emit AccountEvents.AccountCreated(
                account,
                pkp,
                name,
                METADATA_URI,
                0, // Non-artist
                uint64(block.timestamp)
            );

            vm.prank(owner);
            accountEvents.emitAccountCreated(
                account,
                pkp,
                name,
                METADATA_URI,
                0
            );
        }
    }

    // ============ AccountMetadataUpdated Event Tests ============

    function test_EmitAccountMetadataUpdated() public {
        string memory newMetadataUri = "lens://account-123-v2.json";

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit AccountEvents.AccountMetadataUpdated(
            lensAccount,
            newMetadataUri,
            owner,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        accountEvents.emitAccountMetadataUpdated(
            lensAccount,
            newMetadataUri
        );
    }

    function test_EmitAccountMetadataUpdated_Gas() public {
        string memory newMetadataUri = "lens://account-123-v2.json";

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        accountEvents.emitAccountMetadataUpdated(
            lensAccount,
            newMetadataUri
        );
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~25k gas
        assertLt(gasUsed, 30_000, "Gas too high");

        emit log_named_uint("Gas used for AccountMetadataUpdated", gasUsed);
    }

    function test_EmitAccountMetadataUpdated_MultipleUpdates() public {
        // Multiple updates for same account
        for (uint256 i = 1; i <= 3; i++) {
            string memory uri = string(abi.encodePacked("lens://account-v", vm.toString(i), ".json"));

            vm.prank(owner);
            accountEvents.emitAccountMetadataUpdated(lensAccount, uri);
        }
    }

    // ============ AccountVerified Event Tests ============

    function test_EmitAccountVerified_Verify() public {
        bool verified = true;

        // Expect event
        vm.expectEmit(true, false, true, true);
        emit AccountEvents.AccountVerified(
            lensAccount,
            verified,
            owner,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        accountEvents.emitAccountVerified(lensAccount, verified);
    }

    function test_EmitAccountVerified_Unverify() public {
        bool verified = false;

        // Expect event
        vm.expectEmit(true, false, true, true);
        emit AccountEvents.AccountVerified(
            lensAccount,
            verified,
            owner,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        accountEvents.emitAccountVerified(lensAccount, verified);
    }

    function test_EmitAccountVerified_Gas() public {
        bool verified = true;

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        accountEvents.emitAccountVerified(lensAccount, verified);
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~25k gas
        assertLt(gasUsed, 30_000, "Gas too high");

        emit log_named_uint("Gas used for AccountVerified", gasUsed);
    }

    // ============ Authorization Tests ============

    function test_EmitAccountCreated_AnyoneCanCall() public {
        // Should allow anyone to call (no auth)
        vm.prank(user1);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            username,
            METADATA_URI,
            GENIUS_ARTIST_1
        );

        vm.prank(user2);
        accountEvents.emitAccountCreated(
            address(0x123),
            address(0x456),
            "user2",
            METADATA_URI,
            0
        );

        // No reverts expected
    }

    function test_EmitAccountMetadataUpdated_AnyoneCanCall() public {
        // Should allow anyone to call (no auth)
        vm.prank(user1);
        accountEvents.emitAccountMetadataUpdated(
            lensAccount,
            "lens://new-uri.json"
        );

        vm.prank(user2);
        accountEvents.emitAccountMetadataUpdated(
            lensAccount,
            "lens://another-uri.json"
        );

        // No reverts expected
    }

    function test_EmitAccountVerified_AnyoneCanCall() public {
        // Should allow anyone to call (no auth)
        vm.prank(user1);
        accountEvents.emitAccountVerified(lensAccount, true);

        vm.prank(user2);
        accountEvents.emitAccountVerified(lensAccount, false);

        // No reverts expected
    }

    // ============ Edge Case Tests ============

    function test_EmitAccountCreated_ZeroAddresses() public {
        // Should still work (no validation)
        vm.prank(owner);
        accountEvents.emitAccountCreated(
            address(0), // Zero lens account
            address(0), // Zero PKP
            username,
            METADATA_URI,
            0
        );
    }

    function test_EmitAccountCreated_EmptyUsername() public {
        // Should still work (no validation)
        vm.prank(owner);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            "", // Empty username
            METADATA_URI,
            0
        );
    }

    function test_EmitAccountCreated_LongUsername() public {
        // Create a long username (100 chars)
        string memory longUsername = "abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz";

        // Should still work, but use more gas
        vm.prank(owner);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            longUsername,
            METADATA_URI,
            0
        );
    }

    function test_EmitAccountCreated_EmptyMetadataUri() public {
        // Should still work (no validation)
        vm.prank(owner);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            username,
            "", // Empty metadata URI
            0
        );
    }

    function test_EmitAccountMetadataUpdated_ZeroAddress() public {
        // Should still work (no validation)
        vm.prank(owner);
        accountEvents.emitAccountMetadataUpdated(
            address(0), // Zero address
            METADATA_URI
        );
    }

    // ============ Integration Tests ============

    function test_CompleteFlow() public {
        // 1. Create account
        vm.prank(owner);
        accountEvents.emitAccountCreated(
            lensAccount,
            pkpAddress,
            username,
            METADATA_URI,
            GENIUS_ARTIST_1
        );

        // 2. Update metadata
        vm.prank(owner);
        accountEvents.emitAccountMetadataUpdated(
            lensAccount,
            "lens://account-123-v2.json"
        );

        // 3. Verify account
        vm.prank(owner);
        accountEvents.emitAccountVerified(lensAccount, true);

        // 4. Update metadata again
        vm.prank(owner);
        accountEvents.emitAccountMetadataUpdated(
            lensAccount,
            "lens://account-123-v3.json"
        );

        // 5. Unverify account
        vm.prank(owner);
        accountEvents.emitAccountVerified(lensAccount, false);
    }

    function test_MultipleAccountsFlow() public {
        address[] memory accounts = new address[](3);
        address[] memory pkps = new address[](3);
        string[] memory usernames = new string[](3);

        accounts[0] = makeAddr("account1");
        accounts[1] = makeAddr("account2");
        accounts[2] = makeAddr("account3");

        pkps[0] = makeAddr("pkp1");
        pkps[1] = makeAddr("pkp2");
        pkps[2] = makeAddr("pkp3");

        usernames[0] = "taylorswift";
        usernames[1] = "brookemonk";
        usernames[2] = "charlidamelio";

        // Create multiple accounts
        for (uint256 i = 0; i < accounts.length; i++) {
            vm.prank(owner);
            accountEvents.emitAccountCreated(
                accounts[i],
                pkps[i],
                usernames[i],
                METADATA_URI,
                i == 0 ? GENIUS_ARTIST_1 : 0 // Only first is artist
            );
        }

        // Update all accounts
        for (uint256 i = 0; i < accounts.length; i++) {
            vm.prank(owner);
            accountEvents.emitAccountMetadataUpdated(
                accounts[i],
                string(abi.encodePacked("lens://account-", vm.toString(i), ".json"))
            );
        }

        // Verify all accounts
        for (uint256 i = 0; i < accounts.length; i++) {
            vm.prank(owner);
            accountEvents.emitAccountVerified(accounts[i], true);
        }
    }

    function test_ArtistAndUserAccounts() public {
        // Artist account (Taylor Swift)
        address artistAccount = makeAddr("artist");
        address artistPKP = makeAddr("artistPKP");

        vm.prank(owner);
        accountEvents.emitAccountCreated(
            artistAccount,
            artistPKP,
            "taylorswift",
            METADATA_URI,
            GENIUS_ARTIST_1 // Has Genius ID
        );

        // Regular user account (Brooke Monk)
        address userAccount = makeAddr("user");
        address userPKP = makeAddr("userPKP");

        vm.prank(owner);
        accountEvents.emitAccountCreated(
            userAccount,
            userPKP,
            "brookemonk",
            METADATA_URI,
            0 // No Genius ID
        );

        // Both should work the same way (unified account structure)
    }
}
