// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/events/AccountEvents.sol";

contract AccountEventsTest is Test {
    AccountEvents public accountEvents;
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public lensAccount = address(0x3);
    address public pkpAddress = address(0x4);
    
    event AccountCreated(
        address indexed lensAccountAddress,
        address indexed pkpAddress,
        string username,
        string metadataUri,
        uint32 geniusArtistId,
        uint64 timestamp
    );
    
    event AccountMetadataUpdated(
        address indexed lensAccountAddress,
        string metadataUri,
        address indexed updatedBy,
        uint64 timestamp
    );
    
    event AccountVerified(
        address indexed lensAccountAddress,
        bool verified,
        address indexed verifiedBy,
        uint64 timestamp
    );
    
    function setUp() public {
        accountEvents = new AccountEvents();
    }
    
    // ============ emitAccountCreated Tests ============
    
    function testEmitAccountCreatedSuccess() public {
        string memory username = "testuser";
        string memory metadataUri = "lens://account-test";
        uint32 geniusArtistId = 12345;
        
        vm.prank(user1);
        vm.expectEmit();
        emit AccountCreated(lensAccount, pkpAddress, username, metadataUri, geniusArtistId, uint64(block.timestamp));
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, username, metadataUri, geniusArtistId);
    }
    
    function testEmitAccountCreatedWithZeroArtistId() public {
        string memory username = "noartist";
        string memory metadataUri = "lens://account-noartist";
        uint32 geniusArtistId = 0;
        
        vm.prank(user1);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, username, metadataUri, geniusArtistId);
    }
    
    function testEmitAccountCreatedOpenAccess() public {
        // Anyone should be able to call this function
        vm.prank(user2);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, "anotheruser", "lens://another", 0);
    }
    
    function testEmitAccountCreatedWithVariousUsernames() public {
        string memory username1 = "user_with_underscores";
        string memory username2 = "user123";
        string memory username3 = "very-long-username-that-should-still-work";
        
        vm.prank(user1);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, username1, "lens://uri1", 0);
        
        vm.prank(user2);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, username2, "lens://uri2", 0);
        
        vm.prank(user1);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, username3, "lens://uri3", 0);
    }
    
    // ============ emitAccountMetadataUpdated Tests ============
    
    function testEmitAccountMetadataUpdatedSuccess() public {
        string memory newMetadataUri = "lens://updated-account";
        
        vm.prank(user1);
        vm.expectEmit();
        emit AccountMetadataUpdated(lensAccount, newMetadataUri, user1, uint64(block.timestamp));
        accountEvents.emitAccountMetadataUpdated(lensAccount, newMetadataUri);
    }
    
    function testEmitAccountMetadataUpdatedByDifferentUser() public {
        string memory metadataUri = "lens://updated-by-other";
        
        vm.prank(user2);
        vm.expectEmit();
        emit AccountMetadataUpdated(lensAccount, metadataUri, user2, uint64(block.timestamp));
        accountEvents.emitAccountMetadataUpdated(lensAccount, metadataUri);
    }
    
    function testEmitAccountMetadataUpdatedOpenAccess() public {
        string memory metadataUri = "lens://open-update";
        
        // Anyone should be able to update metadata
        address randomUser = address(0x999);
        vm.prank(randomUser);
        accountEvents.emitAccountMetadataUpdated(lensAccount, metadataUri);
    }
    
    // ============ emitAccountVerified Tests ============
    
    function testEmitAccountVerifiedTrue() public {
        vm.prank(user1);
        vm.expectEmit();
        emit AccountVerified(lensAccount, true, user1, uint64(block.timestamp));
        accountEvents.emitAccountVerified(lensAccount, true);
    }
    
    function testEmitAccountVerifiedFalse() public {
        vm.prank(user1);
        vm.expectEmit();
        emit AccountVerified(lensAccount, false, user1, uint64(block.timestamp));
        accountEvents.emitAccountVerified(lensAccount, false);
    }
    
    function testEmitAccountVerifiedByDifferentUser() public {
        vm.prank(user2);
        vm.expectEmit();
        emit AccountVerified(lensAccount, true, user2, uint64(block.timestamp));
        accountEvents.emitAccountVerified(lensAccount, true);
    }
    
    // ============ Event Structure Tests ============
    
    function testAccountCreatedEventStructure() public {
        string memory username = "structureduser";
        string memory metadataUri = "lens://structured-account";
        uint32 geniusArtistId = 98765;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(user1);
        vm.expectEmit();
        emit AccountCreated(lensAccount, pkpAddress, username, metadataUri, geniusArtistId, expectedTimestamp);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, username, metadataUri, geniusArtistId);
    }
    
    function testAccountMetadataUpdatedEventStructure() public {
        string memory metadataUri = "lens://structured-update";
        address expectedUpdater = user2;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(expectedUpdater);
        vm.expectEmit();
        emit AccountMetadataUpdated(lensAccount, metadataUri, expectedUpdater, expectedTimestamp);
        accountEvents.emitAccountMetadataUpdated(lensAccount, metadataUri);
    }
    
    function testAccountVerifiedEventStructure() public {
        bool verified = true;
        address expectedVerifier = user1;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(expectedVerifier);
        vm.expectEmit();
        emit AccountVerified(lensAccount, verified, expectedVerifier, expectedTimestamp);
        accountEvents.emitAccountVerified(lensAccount, verified);
    }
    
    // ============ Edge Case Tests ============
    
    function testEmitAccountCreatedWithEmptyStrings() public {
        // Should handle empty strings without issues
        vm.prank(user1);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, "", "", 0);
    }
    
    function testEmitAccountCreatedWithLongUsername() public {
        string memory longUsername = "very-very-very-very-very-very-very-very-very-very-very-very-very-very-long-username";
        vm.prank(user1);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, longUsername, "lens://long-user", 0);
    }
    
    function testMultipleEventsSameAccount() public {
        string memory uri1 = "lens://account-v1";
        string memory uri2 = "lens://account-v2";
        
        vm.startPrank(user1);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, "user", uri1, 0);
        accountEvents.emitAccountMetadataUpdated(lensAccount, uri2);
        accountEvents.emitAccountVerified(lensAccount, true);
        vm.stopPrank();
    }
    
    function testMultipleAccounts() public {
        address lensAccount2 = address(0x5);
        address lensAccount3 = address(0x6);
        
        vm.startPrank(user1);
        accountEvents.emitAccountCreated(lensAccount, pkpAddress, "user1", "lens://acc1", 0);
        accountEvents.emitAccountCreated(lensAccount2, pkpAddress, "user2", "lens://acc2", 0);
        accountEvents.emitAccountCreated(lensAccount3, pkpAddress, "user3", "lens://acc3", 0);
        vm.stopPrank();
    }
}
