// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/events/SegmentEvents.sol";

contract SegmentEventsTest is Test {
    SegmentEvents public segmentEvents;
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    
    bytes32 constant SEGMENT_HASH_1 = keccak256("segment-1");
    bytes32 constant SEGMENT_HASH_2 = keccak256("segment-2");
    string constant SPOTIFY_TRACK_ID = "4iV5W9uYEdYUVa79Axb7Rh";
    string constant GRC20_WORK_ID = "grc20-work-uuid-12345";
    uint32 constant SEGMENT_START_MS = 30000; // 30 seconds
    uint32 constant SEGMENT_END_MS = 60000;   // 60 seconds
    
    event SegmentRegistered(
        bytes32 indexed segmentHash,
        string indexed grc20WorkId,
        string spotifyTrackId,
        uint32 segmentStartMs,
        uint32 segmentEndMs,
        string metadataUri,
        address indexed registeredBy,
        uint64 timestamp
    );
    
    event SegmentProcessed(
        bytes32 indexed segmentHash,
        string instrumentalUri,
        string alignmentUri,
        uint8 translationCount,
        string metadataUri,
        uint64 timestamp
    );
    
    event SegmentToggled(
        bytes32 indexed segmentHash,
        bool enabled,
        uint64 timestamp
    );
    
    function setUp() public {
        segmentEvents = new SegmentEvents();
    }
    
    // ============ emitSegmentRegistered Tests ============
    
    function testEmitSegmentRegisteredSuccess() public {
        string memory metadataUri = "lens://segment-registered-1";
        
        vm.prank(user1);
        vm.expectEmit();
        emit SegmentRegistered(
            SEGMENT_HASH_1,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            metadataUri,
            user1,
            uint64(block.timestamp)
        );
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_1,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            metadataUri
        );
    }
    
    function testEmitSegmentRegisteredWithZeroArtistId() public {
        string memory metadataUri = "lens://segment-noartist";
        
        vm.prank(user1);
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_1,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            metadataUri
        );
    }
    
    function testEmitSegmentRegisteredOpenAccess() public {
        string memory metadataUri = "lens://segment-open";
        
        vm.prank(user2);
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_1,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            metadataUri
        );
    }
    
    function testEmitSegmentRegisteredDifferentUsers() public {
        string memory uri1 = "lens://segment-user1";
        string memory uri2 = "lens://segment-user2";
        
        vm.startPrank(user1);
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_1,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            uri1
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_2,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS + 1000,
            SEGMENT_END_MS + 1000,
            uri2
        );
        vm.stopPrank();
    }
    
    // ============ emitSegmentProcessed Tests ============
    
    function testEmitSegmentProcessedSuccess() public {
        string memory instrumentalUri = "grove://instrumental-segment-1";
        string memory alignmentUri = "grove://alignment-segment-1";
        string memory metadataUri = "lens://segment-processed-1";
        uint8 translationCount = 4;
        
        vm.prank(user1);
        vm.expectEmit();
        emit SegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri,
            uint64(block.timestamp)
        );
        segmentEvents.emitSegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri
        );
    }
    
    function testEmitSegmentProcessedWithZeroTranslations() public {
        string memory instrumentalUri = "grove://instrumental-no-translations";
        string memory alignmentUri = "grove://alignment-no-translations";
        string memory metadataUri = "lens://segment-no-translations";
        uint8 translationCount = 0;
        
        vm.prank(user1);
        segmentEvents.emitSegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri
        );
    }
    
    function testEmitSegmentProcessedWithManyTranslations() public {
        string memory instrumentalUri = "grove://instrumental-many";
        string memory alignmentUri = "grove://alignment-many";
        string memory metadataUri = "lens://segment-many-translations";
        uint8 translationCount = 10;
        
        vm.prank(user1);
        segmentEvents.emitSegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri
        );
    }
    
    function testEmitSegmentProcessedByDifferentUser() public {
        string memory instrumentalUri = "grove://instrumental-other-user";
        string memory alignmentUri = "grove://alignment-other-user";
        string memory metadataUri = "lens://segment-processed-by-other";
        uint8 translationCount = 2;
        
        vm.prank(user2);
        vm.expectEmit();
        emit SegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri,
            uint64(block.timestamp)
        );
        segmentEvents.emitSegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri
        );
    }
    
    function testEmitSegmentProcessedOpenAccess() public {
        string memory instrumentalUri = "grove://instrumental-open";
        string memory alignmentUri = "grove://alignment-open";
        string memory metadataUri = "lens://segment-open-process";
        uint8 translationCount = 1;
        
        address randomUser = address(0x999);
        vm.prank(randomUser);
        segmentEvents.emitSegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri
        );
    }
    
    // ============ emitSegmentToggled Tests ============
    
    function testEmitSegmentToggledEnabled() public {
        vm.prank(user1);
        vm.expectEmit();
        emit SegmentToggled(SEGMENT_HASH_1, true, uint64(block.timestamp));
        segmentEvents.emitSegmentToggled(SEGMENT_HASH_1, true);
    }
    
    function testEmitSegmentToggledDisabled() public {
        vm.prank(user1);
        vm.expectEmit();
        emit SegmentToggled(SEGMENT_HASH_1, false, uint64(block.timestamp));
        segmentEvents.emitSegmentToggled(SEGMENT_HASH_1, false);
    }
    
    function testEmitSegmentToggledByDifferentUser() public {
        vm.prank(user2);
        vm.expectEmit();
        emit SegmentToggled(SEGMENT_HASH_2, true, uint64(block.timestamp));
        segmentEvents.emitSegmentToggled(SEGMENT_HASH_2, true);
    }
    
    function testEmitSegmentToggledOpenAccess() public {
        address randomUser = address(0x888);
        vm.prank(randomUser);
        segmentEvents.emitSegmentToggled(SEGMENT_HASH_1, false);
    }
    
    // ============ getSegmentHash Tests ============
    
    function testGetSegmentHashSuccess() public {
        string memory testTrackId = "test-track-123";
        uint32 testStartMs = 45000;
        bytes32 expectedHash = keccak256(abi.encodePacked(testTrackId, testStartMs));
        bytes32 actualHash = segmentEvents.getSegmentHash(testTrackId, testStartMs);
        
        assertEq(actualHash, expectedHash);
    }
    
    function testGetSegmentHashDifferentInputs() public {
        string memory trackId1 = "track-a";
        string memory trackId2 = "track-b";
        uint32 startMs1 = 10000;
        uint32 startMs2 = 20000;
        
        bytes32 hash1 = segmentEvents.getSegmentHash(trackId1, startMs1);
        bytes32 hash2 = segmentEvents.getSegmentHash(trackId2, startMs1);
        bytes32 hash3 = segmentEvents.getSegmentHash(trackId1, startMs2);
        
        assertTrue(hash1 != hash2);
        assertTrue(hash1 != hash3);
        assertTrue(hash2 != hash3);
    }
    
    function testGetSegmentHashConsistency() public {
        string memory testTrackId = "consistent-track";
        uint32 testStartMs = 12345;
        
        bytes32 hash1 = segmentEvents.getSegmentHash(testTrackId, testStartMs);
        bytes32 hash2 = segmentEvents.getSegmentHash(testTrackId, testStartMs);
        
        assertEq(hash1, hash2);
    }
    
    function testGetSegmentHashEmptyString() public {
        string memory emptyTrackId = "";
        uint32 startMs = 1000;
        bytes32 expectedHash = keccak256(abi.encodePacked("", startMs));
        bytes32 actualHash = segmentEvents.getSegmentHash(emptyTrackId, startMs);
        
        assertEq(actualHash, expectedHash);
    }
    
    function testGetSegmentHashZeroStartMs() public {
        string memory trackId = "track-zero";
        uint32 startMs = 0;
        bytes32 expectedHash = keccak256(abi.encodePacked(trackId, startMs));
        bytes32 actualHash = segmentEvents.getSegmentHash(trackId, startMs);
        
        assertEq(actualHash, expectedHash);
    }
    
    // ============ Integration Tests ============
    
    function testFullSegmentLifecycle() public {
        string memory uri1 = "lens://segment-initial";
        string memory uri2 = "lens://segment-updated";
        string memory instrumentalUri = "grove://instrumental-processed";
        string memory alignmentUri = "grove://alignment-processed";
        
        // Register segment
        vm.prank(user1);
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_1,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            uri1
        );
        
        // Process segment
        vm.prank(user2);
        segmentEvents.emitSegmentProcessed(
            SEGMENT_HASH_1,
            instrumentalUri,
            alignmentUri,
            3,
            uri2
        );
        
        // Enable segment
        vm.prank(user1);
        segmentEvents.emitSegmentToggled(SEGMENT_HASH_1, true);
        
        // Disable segment
        vm.prank(user2);
        segmentEvents.emitSegmentToggled(SEGMENT_HASH_1, false);
    }
    
    function testMultipleSegments() public {
        bytes32 hash1 = keccak256("multi-segment-1");
        bytes32 hash2 = keccak256("multi-segment-2");
        bytes32 hash3 = keccak256("multi-segment-3");
        
        vm.startPrank(user1);
        segmentEvents.emitSegmentRegistered(
            hash1,
            "grc20-work-1",
            "spotify-track-1",
            0,
            10000,
            "lens://segment1"
        );
        segmentEvents.emitSegmentProcessed(
            hash1,
            "grove://inst1",
            "grove://align1",
            2,
            "lens://segment1-processed"
        );
        vm.stopPrank();
        
        vm.startPrank(user2);
        segmentEvents.emitSegmentRegistered(
            hash2,
            "grc20-work-2",
            "spotify-track-2",
            15000,
            30000,
            "lens://segment2"
        );
        segmentEvents.emitSegmentToggled(hash2, true);
        vm.stopPrank();
        
        vm.startPrank(user1);
        segmentEvents.emitSegmentRegistered(
            hash3,
            "grc20-work-3",
            "spotify-track-3",
            45000,
            60000,
            "lens://segment3"
        );
        segmentEvents.emitSegmentProcessed(
            hash3,
            "grove://inst3",
            "grove://align3",
            5,
            "lens://segment3-processed"
        );
        segmentEvents.emitSegmentToggled(hash3, true);
        vm.stopPrank();
    }
    
    // ============ Edge Case Tests ============
    
    function testEdgeCaseTimestamps() public {
        uint32 minStartMs = 0;
        uint32 maxStartMs = type(uint32).max - 1000; // Prevent overflow
        uint32 endMs = 1000;
        
        vm.prank(user1);
        segmentEvents.emitSegmentRegistered(
            keccak256("min-time"),
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            minStartMs,
            endMs,
            "lens://min-time"
        );
        
        vm.prank(user1);
        segmentEvents.emitSegmentRegistered(
            keccak256("max-time"),
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            maxStartMs,
            maxStartMs + 1000,
            "lens://max-time"
        );
    }
    
    function testVariousMetadataUris() public {
        string memory uri1 = "lens://short";
        string memory uri2 = "lens://very-long-uri-that-should-still-work-without-issues-and-be-handled-properly-by-the-system";
        string memory uri3 = "lens://with-dashes-and_underscores.and.numbers123";
        
        vm.startPrank(user1);
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_1,
            GRC20_WORK_ID,
            SPOTIFY_TRACK_ID,
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            uri1
        );
        segmentEvents.emitSegmentProcessed(
            SEGMENT_HASH_1,
            "grove://inst-short",
            "grove://align-short",
            1,
            uri2
        );
        segmentEvents.emitSegmentToggled(SEGMENT_HASH_1, true);
        vm.stopPrank();
        
        vm.startPrank(user2);
        segmentEvents.emitSegmentRegistered(
            SEGMENT_HASH_2,
            "different-grc20",
            "different-spotify",
            SEGMENT_START_MS,
            SEGMENT_END_MS,
            uri3
        );
        vm.stopPrank();
    }
}
