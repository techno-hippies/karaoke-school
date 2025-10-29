// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/events/SongEvents.sol";

contract SongEventsTest is Test {
    SongEvents public songEvents;
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    
    uint32 constant GENIUS_SONG_ID_1 = 12345678;
    uint32 constant GENIUS_SONG_ID_2 = 87654321;
    uint32 constant GENIUS_ARTIST_ID = 98765;
    
    event SongRegistered(
        uint32 indexed geniusId,
        string metadataUri,
        address indexed registeredBy,
        uint32 geniusArtistId,
        uint64 timestamp
    );
    
    event SongMetadataUpdated(
        uint32 indexed geniusId,
        string metadataUri,
        address indexed updatedBy,
        uint64 timestamp
    );
    
    event SongToggled(
        uint32 indexed geniusId,
        bool enabled,
        uint64 timestamp
    );
    
    function setUp() public {
        songEvents = new SongEvents();
    }
    
    // ============ emitSongRegistered Tests ============
    
    function testEmitSongRegisteredSuccess() public {
        string memory metadataUri = "lens://song-12345678";
        
        vm.prank(user1);
        vm.expectEmit();
        emit SongRegistered(GENIUS_SONG_ID_1, metadataUri, user1, GENIUS_ARTIST_ID, uint64(block.timestamp));
        songEvents.emitSongRegistered(GENIUS_SONG_ID_1, metadataUri, GENIUS_ARTIST_ID);
    }
    
    function testEmitSongRegisteredWithZeroArtistId() public {
        string memory metadataUri = "lens://song-noartist";
        uint32 zeroArtistId = 0;
        
        vm.prank(user1);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_1, metadataUri, zeroArtistId);
    }
    
    function testEmitSongRegisteredOpenAccess() public {
        // Anyone should be able to register songs
        string memory metadataUri = "lens://song-open";
        
        vm.prank(user2);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_2, metadataUri, GENIUS_ARTIST_ID);
    }
    
    function testEmitSongRegisteredDifferentUsers() public {
        string memory uri1 = "lens://song-user1";
        string memory uri2 = "lens://song-user2";
        
        vm.startPrank(user1);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_1, uri1, GENIUS_ARTIST_ID);
        vm.stopPrank();
        
        vm.startPrank(user2);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_2, uri2, GENIUS_ARTIST_ID);
        vm.stopPrank();
    }
    
    // ============ emitSongMetadataUpdated Tests ============
    
    function testEmitSongMetadataUpdatedSuccess() public {
        string memory newMetadataUri = "lens://song-updated-12345678";
        
        vm.prank(user1);
        vm.expectEmit();
        emit SongMetadataUpdated(GENIUS_SONG_ID_1, newMetadataUri, user1, uint64(block.timestamp));
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, newMetadataUri);
    }
    
    function testEmitSongMetadataUpdatedByDifferentUser() public {
        string memory metadataUri = "lens://song-updated-by-other";
        
        vm.prank(user2);
        vm.expectEmit();
        emit SongMetadataUpdated(GENIUS_SONG_ID_1, metadataUri, user2, uint64(block.timestamp));
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, metadataUri);
    }
    
    function testEmitSongMetadataUpdatedOpenAccess() public {
        string memory metadataUri = "lens://song-open-update";
        
        // Anyone should be able to update song metadata
        address randomUser = address(0x999);
        vm.prank(randomUser);
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, metadataUri);
    }
    
    function testMultipleMetadataUpdates() public {
        string memory uri1 = "lens://song-v1";
        string memory uri2 = "lens://song-v2";
        string memory uri3 = "lens://song-v3";
        
        vm.startPrank(user1);
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, uri1);
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, uri2);
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, uri3);
        vm.stopPrank();
    }
    
    // ============ emitSongToggled Tests ============
    
    function testEmitSongToggledEnabled() public {
        vm.prank(user1);
        vm.expectEmit();
        emit SongToggled(GENIUS_SONG_ID_1, true, uint64(block.timestamp));
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, true);
    }
    
    function testEmitSongToggledDisabled() public {
        vm.prank(user1);
        vm.expectEmit();
        emit SongToggled(GENIUS_SONG_ID_1, false, uint64(block.timestamp));
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, false);
    }
    
    function testEmitSongToggledByDifferentUser() public {
        vm.prank(user2);
        vm.expectEmit();
        emit SongToggled(GENIUS_SONG_ID_2, true, uint64(block.timestamp));
        songEvents.emitSongToggled(GENIUS_SONG_ID_2, true);
    }
    
    function testEmitSongToggledOpenAccess() public {
        // Anyone should be able to toggle songs
        address randomUser = address(0x888);
        vm.prank(randomUser);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, false);
    }
    
    function testMultipleSongToggles() public {
        vm.startPrank(user1);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, true);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, false);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, true);
        vm.stopPrank();
    }
    
    // ============ Event Structure Tests ============
    
    function testSongRegisteredEventStructure() public {
        string memory metadataUri = "lens://structured-song";
        uint32 expectedArtistId = 12345;
        address expectedRegistrar = user1;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(expectedRegistrar);
        vm.expectEmit();
        emit SongRegistered(GENIUS_SONG_ID_1, metadataUri, expectedRegistrar, expectedArtistId, expectedTimestamp);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_1, metadataUri, expectedArtistId);
    }
    
    function testSongMetadataUpdatedEventStructure() public {
        string memory metadataUri = "lens://structured-update";
        address expectedUpdater = user2;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(expectedUpdater);
        vm.expectEmit();
        emit SongMetadataUpdated(GENIUS_SONG_ID_1, metadataUri, expectedUpdater, expectedTimestamp);
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, metadataUri);
    }
    
    function testSongToggledEventStructure() public {
        bool enabled = true;
        uint64 expectedTimestamp = uint64(block.timestamp);
        
        vm.prank(user1);
        vm.expectEmit();
        emit SongToggled(GENIUS_SONG_ID_1, enabled, expectedTimestamp);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, enabled);
    }
    
    // ============ Integration Tests ============
    
    function testFullSongLifecycle() public {
        string memory uri1 = "lens://song-initial";
        string memory uri2 = "lens://song-updated";
        
        // Register song
        vm.prank(user1);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_1, uri1, GENIUS_ARTIST_ID);
        
        // Update metadata
        vm.prank(user2);
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, uri2);
        
        // Enable song
        vm.prank(user1);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, true);
        
        // Disable song
        vm.prank(user2);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, false);
        
        // Re-enable song
        vm.prank(user1);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, true);
    }
    
    function testMultipleSongs() public {
        uint32 songId1 = 11111111;
        uint32 songId2 = 22222222;
        uint32 songId3 = 33333333;
        
        vm.startPrank(user1);
        songEvents.emitSongRegistered(songId1, "lens://song1", 100);
        songEvents.emitSongMetadataUpdated(songId1, "lens://song1-updated");
        songEvents.emitSongToggled(songId1, true);
        vm.stopPrank();
        
        vm.startPrank(user2);
        songEvents.emitSongRegistered(songId2, "lens://song2", 200);
        songEvents.emitSongToggled(songId2, false);
        vm.stopPrank();
        
        vm.startPrank(user1);
        songEvents.emitSongRegistered(songId3, "lens://song3", 0);
        vm.stopPrank();
    }
    
    function testEdgeCaseIds() public {
        // Test with minimum and maximum possible IDs
        uint32 minId = 0;
        uint32 maxId = type(uint32).max;
        
        vm.prank(user1);
        songEvents.emitSongRegistered(minId, "lens://min-id", 0);
        songEvents.emitSongRegistered(maxId, "lens://max-id", 0);
    }
    
    function testVariousMetadataUris() public {
        string memory uri1 = "lens://short";
        string memory uri2 = "lens://very-long-uri-that-should-still-work-without-issues-and-be-handled-properly-by-the-system";
        string memory uri3 = "lens://with-dashes-and_underscores.and.numbers123";
        
        vm.startPrank(user1);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_1, uri1, GENIUS_ARTIST_ID);
        songEvents.emitSongMetadataUpdated(GENIUS_SONG_ID_1, uri2);
        songEvents.emitSongToggled(GENIUS_SONG_ID_1, true);
        vm.stopPrank();
        
        vm.startPrank(user2);
        songEvents.emitSongRegistered(GENIUS_SONG_ID_2, uri3, 0);
        vm.stopPrank();
    }
}
