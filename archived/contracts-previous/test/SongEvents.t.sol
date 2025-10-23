// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/events/SongEvents.sol";

/**
 * @title SongEventsTest
 * @notice Tests for SongEvents contract
 */
contract SongEventsTest is BaseTest {

    SongEvents public songEvents;

    function setUp() public override {
        super.setUp();

        // Deploy SongEvents
        songEvents = new SongEvents();
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        // Contract should deploy successfully
        assert(address(songEvents) != address(0));
    }

    // ============ SongRegistered Event Tests ============

    function test_EmitSongRegistered() public {
        uint32 geniusId = GENIUS_SONG_1;
        string memory metadataUri = METADATA_URI;
        uint32 geniusArtistId = GENIUS_ARTIST_1;

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit SongEvents.SongRegistered(
            geniusId,
            metadataUri,
            owner,
            geniusArtistId,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        songEvents.emitSongRegistered(geniusId, metadataUri, geniusArtistId);
    }

    function test_EmitSongRegistered_WithoutArtist() public {
        uint32 geniusId = GENIUS_SONG_1;
        string memory metadataUri = METADATA_URI;
        uint32 geniusArtistId = 0; // No artist ID

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit SongEvents.SongRegistered(
            geniusId,
            metadataUri,
            user1,
            geniusArtistId,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(user1);
        songEvents.emitSongRegistered(geniusId, metadataUri, geniusArtistId);
    }

    function test_EmitSongRegistered_Gas() public {
        uint32 geniusId = GENIUS_SONG_1;
        string memory metadataUri = "lens://song-123.json";
        uint32 geniusArtistId = GENIUS_ARTIST_1;

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        songEvents.emitSongRegistered(geniusId, metadataUri, geniusArtistId);
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~15k gas (even better than expected!)
        assertLt(gasUsed, 20_000, "Gas too high");
        assertGt(gasUsed, 12_000, "Gas unexpectedly low");

        emit log_named_uint("Gas used for SongRegistered", gasUsed);
    }

    function test_EmitSongRegistered_Multiple() public {
        // Register multiple songs
        for (uint32 i = 1; i <= 5; i++) {
            vm.expectEmit(true, true, false, true);
            emit SongEvents.SongRegistered(
                i,
                METADATA_URI,
                owner,
                GENIUS_ARTIST_1,
                uint64(block.timestamp)
            );

            vm.prank(owner);
            songEvents.emitSongRegistered(i, METADATA_URI, GENIUS_ARTIST_1);
        }
    }

    // ============ SongMetadataUpdated Event Tests ============

    function test_EmitSongMetadataUpdated() public {
        uint32 geniusId = GENIUS_SONG_1;
        string memory newMetadataUri = "lens://song-123-v2.json";

        // Expect event
        vm.expectEmit(true, true, false, true);
        emit SongEvents.SongMetadataUpdated(
            geniusId,
            newMetadataUri,
            owner,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        songEvents.emitSongMetadataUpdated(geniusId, newMetadataUri);
    }

    function test_EmitSongMetadataUpdated_Gas() public {
        uint32 geniusId = GENIUS_SONG_1;
        string memory newMetadataUri = "lens://song-123-v2.json";

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        songEvents.emitSongMetadataUpdated(geniusId, newMetadataUri);
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~30k gas
        assertLt(gasUsed, 35_000, "Gas too high");

        emit log_named_uint("Gas used for SongMetadataUpdated", gasUsed);
    }

    // ============ SongToggled Event Tests ============

    function test_EmitSongToggled_Disable() public {
        uint32 geniusId = GENIUS_SONG_1;
        bool enabled = false;

        // Expect event
        vm.expectEmit(true, false, false, true);
        emit SongEvents.SongToggled(
            geniusId,
            enabled,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        songEvents.emitSongToggled(geniusId, enabled);
    }

    function test_EmitSongToggled_Enable() public {
        uint32 geniusId = GENIUS_SONG_1;
        bool enabled = true;

        // Expect event
        vm.expectEmit(true, false, false, true);
        emit SongEvents.SongToggled(
            geniusId,
            enabled,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        songEvents.emitSongToggled(geniusId, enabled);
    }

    function test_EmitSongToggled_Gas() public {
        uint32 geniusId = GENIUS_SONG_1;
        bool enabled = false;

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        songEvents.emitSongToggled(geniusId, enabled);
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~25k gas
        assertLt(gasUsed, 30_000, "Gas too high");

        emit log_named_uint("Gas used for SongToggled", gasUsed);
    }

    // ============ Authorization Tests ============

    function test_EmitSongRegistered_AnyoneCanCall() public {
        // Should allow anyone to call (no auth)
        vm.prank(user1);
        songEvents.emitSongRegistered(GENIUS_SONG_1, METADATA_URI, GENIUS_ARTIST_1);

        vm.prank(user2);
        songEvents.emitSongRegistered(GENIUS_SONG_2, METADATA_URI, GENIUS_ARTIST_2);

        // No reverts expected
    }

    // ============ Edge Case Tests ============

    function test_EmitSongRegistered_LongMetadataUri() public {
        uint32 geniusId = GENIUS_SONG_1;
        // Create a long URI (100 chars)
        string memory longUri = "lens://song-12345678901234567890123456789012345678901234567890123456789012345678901234567890.json";
        uint32 geniusArtistId = GENIUS_ARTIST_1;

        // Should still work, but use more gas
        vm.prank(owner);
        songEvents.emitSongRegistered(geniusId, longUri, geniusArtistId);
    }

    function test_EmitSongRegistered_EmptyMetadataUri() public {
        uint32 geniusId = GENIUS_SONG_1;
        string memory emptyUri = "";
        uint32 geniusArtistId = GENIUS_ARTIST_1;

        // Should still work (no validation)
        vm.prank(owner);
        songEvents.emitSongRegistered(geniusId, emptyUri, geniusArtistId);
    }

    function test_EmitSongRegistered_ZeroGeniusId() public {
        uint32 geniusId = 0;
        string memory metadataUri = METADATA_URI;
        uint32 geniusArtistId = GENIUS_ARTIST_1;

        // Should still work (no validation)
        vm.prank(owner);
        songEvents.emitSongRegistered(geniusId, metadataUri, geniusArtistId);
    }

    // ============ Integration Tests ============

    function test_CompleteFlow() public {
        uint32 geniusId = GENIUS_SONG_1;

        // 1. Register song
        vm.prank(owner);
        songEvents.emitSongRegistered(geniusId, METADATA_URI, GENIUS_ARTIST_1);

        // 2. Update metadata
        vm.prank(owner);
        songEvents.emitSongMetadataUpdated(geniusId, "lens://song-123-v2.json");

        // 3. Disable song
        vm.prank(owner);
        songEvents.emitSongToggled(geniusId, false);

        // 4. Re-enable song
        vm.prank(owner);
        songEvents.emitSongToggled(geniusId, true);
    }
}
