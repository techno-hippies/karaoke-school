// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../SongCatalogV1.sol";

/**
 * @title SongCatalogV1 Test Suite
 * @notice Comprehensive unit tests for SongCatalogV1 contract
 *
 * Coverage:
 * - Song Addition & Validation
 * - Song Updates & Toggles
 * - Song Removal (Hard Delete)
 * - Genius ID Management
 * - Query Functions (by ID, by Genius ID, by index)
 * - Batch Queries & Pagination
 * - Artist Search
 * - Ownership & Access Control
 */
contract SongCatalogV1Test is Test {
    SongCatalogV1 public catalog;

    address public owner;
    address public nonOwner;

    // Sample song data
    string constant SONG_ID_1 = "heat-of-the-night-scarlett-x";
    uint32 constant GENIUS_ID_1 = 123456;
    uint32 constant GENIUS_ARTIST_ID_1 = 789;
    string constant TITLE_1 = "Heat of the Night";
    string constant ARTIST_1 = "Scarlett X";
    uint32 constant DURATION_1 = 194;
    string constant AUDIO_URI_1 = "lens://audio1";
    string constant METADATA_URI_1 = "lens://metadata1";
    string constant COVER_URI_1 = "lens://cover1";
    string constant THUMBNAIL_URI_1 = "lens://thumbnail1";
    string constant VIDEO_URI_1 = "lens://video1";
    string constant SEGMENT_IDS_1 = "verse-1,chorus-1,verse-2";
    string constant LANGUAGES_1 = "en,cn,vi";

    string constant SONG_ID_2 = "down-home-blues-ethel-waters";
    uint32 constant GENIUS_ID_2 = 654321;
    uint32 constant GENIUS_ARTIST_ID_2 = 987;
    string constant TITLE_2 = "Down Home Blues";
    string constant ARTIST_2 = "Ethel Waters";
    uint32 constant DURATION_2 = 167;
    string constant AUDIO_URI_2 = "lens://audio2";
    string constant METADATA_URI_2 = "lens://metadata2";
    string constant COVER_URI_2 = "lens://cover2";
    string constant THUMBNAIL_URI_2 = "lens://thumbnail2";
    string constant VIDEO_URI_2 = "";
    string constant SEGMENT_IDS_2 = "intro,verse-1,chorus-1";
    string constant LANGUAGES_2 = "en";

    // Song without Genius ID (native only)
    string constant SONG_ID_3 = "native-song-artist-name";
    uint32 constant GENIUS_ID_3 = 0;
    uint32 constant GENIUS_ARTIST_ID_3 = 0;
    string constant TITLE_3 = "Native Song";
    string constant ARTIST_3 = "Artist Name";
    uint32 constant DURATION_3 = 180;
    string constant AUDIO_URI_3 = "lens://audio3";
    string constant METADATA_URI_3 = "lens://metadata3";
    string constant COVER_URI_3 = "lens://cover3";
    string constant THUMBNAIL_URI_3 = "lens://thumbnail3";
    string constant VIDEO_URI_3 = "";
    string constant SEGMENT_IDS_3 = "verse-1,chorus-1";
    string constant LANGUAGES_3 = "en,es";

    function setUp() public {
        owner = address(this);
        nonOwner = address(0x1);

        catalog = new SongCatalogV1();
    }

    // ========================================================================
    // Setup & Configuration Tests
    // ========================================================================

    function test_InitialState() public view {
        assertEq(catalog.owner(), owner);
        assertEq(catalog.getSongCount(), 0);
        assertEq(catalog.getEnabledSongCount(), 0);
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x2);

        catalog.transferOwnership(newOwner);

        assertEq(catalog.owner(), newOwner);
    }

    function test_TransferOwnership_RevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert("Not owner");
        catalog.transferOwnership(nonOwner);
    }

    function test_TransferOwnership_RevertIfInvalidAddress() public {
        vm.expectRevert("Invalid address");
        catalog.transferOwnership(address(0));
    }

    // ========================================================================
    // Song Addition Tests
    // ========================================================================

    function test_AddSong_WithGeniusId() public {
        uint64 beforeTimestamp = uint64(block.timestamp);

        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        assertEq(catalog.getSongCount(), 1);
        assertEq(catalog.getEnabledSongCount(), 1);

        SongCatalogV1.Song memory song = catalog.getSong(SONG_ID_1);
        assertEq(song.id, SONG_ID_1);
        assertEq(song.geniusId, GENIUS_ID_1);
        assertEq(song.geniusArtistId, GENIUS_ARTIST_ID_1);
        assertEq(song.title, TITLE_1);
        assertEq(song.artist, ARTIST_1);
        assertEq(song.duration, DURATION_1);
        assertEq(song.audioUri, AUDIO_URI_1);
        assertEq(song.metadataUri, METADATA_URI_1);
        assertEq(song.coverUri, COVER_URI_1);
        assertEq(song.thumbnailUri, THUMBNAIL_URI_1);
        assertEq(song.musicVideoUri, VIDEO_URI_1);
        assertEq(song.segmentIds, SEGMENT_IDS_1);
        assertEq(song.languages, LANGUAGES_1);
        assertTrue(song.enabled);
        assertGe(song.addedAt, beforeTimestamp);
    }

    function test_AddSong_WithoutGeniusId() public {
        catalog.addSong(
            SONG_ID_3, GENIUS_ID_3, GENIUS_ARTIST_ID_3,
            TITLE_3, ARTIST_3, DURATION_3,
            AUDIO_URI_3, METADATA_URI_3, COVER_URI_3, THUMBNAIL_URI_3, VIDEO_URI_3,
            SEGMENT_IDS_3, LANGUAGES_3
        );

        assertEq(catalog.getSongCount(), 1);

        SongCatalogV1.Song memory song = catalog.getSong(SONG_ID_3);
        assertEq(song.geniusId, 0);
        assertEq(song.geniusArtistId, 0);

        // Should not be findable by Genius ID
        assertFalse(catalog.songExistsByGeniusId(GENIUS_ID_3));
    }

    function test_AddSong_RevertIfNotOwner() public {
        vm.prank(nonOwner);
        vm.expectRevert("Not owner");
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );
    }

    function test_AddSong_RevertIfEmptyId() public {
        vm.expectRevert("ID cannot be empty");
        catalog.addSong(
            "", GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );
    }

    function test_AddSong_RevertIfEmptyTitle() public {
        vm.expectRevert("Title cannot be empty");
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            "", ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );
    }

    function test_AddSong_RevertIfEmptyAudioUri() public {
        vm.expectRevert("Audio URI cannot be empty");
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            "", METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );
    }

    function test_AddSong_RevertIfEmptyMetadataUri() public {
        vm.expectRevert("Metadata URI cannot be empty");
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, "", COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );
    }

    function test_AddSong_RevertIfEmptyLanguages() public {
        vm.expectRevert("Languages cannot be empty");
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, ""
        );
    }

    function test_AddSong_RevertIfDuplicateId() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        vm.expectRevert("Song ID already exists");
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );
    }

    function test_AddSong_RevertIfDuplicateGeniusId() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        vm.expectRevert("Genius ID already exists");
        catalog.addSong(
            SONG_ID_2, GENIUS_ID_1, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );
    }

    // ========================================================================
    // Song Update Tests
    // ========================================================================

    function test_UpdateSong() public {
        // Add initial song
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        // Update with new data
        string memory newTitle = "Updated Title";
        string memory newArtist = "Updated Artist";

        catalog.updateSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            newTitle, newArtist, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1, true
        );

        SongCatalogV1.Song memory song = catalog.getSong(SONG_ID_1);
        assertEq(song.title, newTitle);
        assertEq(song.artist, newArtist);
    }

    function test_UpdateSong_ChangeGeniusId() public {
        // Add song with Genius ID
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        assertTrue(catalog.songExistsByGeniusId(GENIUS_ID_1));

        // Update to new Genius ID
        catalog.updateSong(
            SONG_ID_1, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1, true
        );

        // Old Genius ID should not exist
        assertFalse(catalog.songExistsByGeniusId(GENIUS_ID_1));

        // New Genius ID should exist
        assertTrue(catalog.songExistsByGeniusId(GENIUS_ID_2));

        SongCatalogV1.Song memory song = catalog.getSongByGeniusId(GENIUS_ID_2);
        assertEq(song.id, SONG_ID_1);
    }

    function test_UpdateSong_RemoveGeniusId() public {
        // Add song with Genius ID
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        // Update to remove Genius ID (set to 0)
        catalog.updateSong(
            SONG_ID_1, 0, 0,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1, true
        );

        assertFalse(catalog.songExistsByGeniusId(GENIUS_ID_1));

        SongCatalogV1.Song memory song = catalog.getSong(SONG_ID_1);
        assertEq(song.geniusId, 0);
    }

    function test_UpdateSong_RevertIfNotOwner() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        vm.prank(nonOwner);
        vm.expectRevert("Not owner");
        catalog.updateSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1, true
        );
    }

    function test_UpdateSong_RevertIfNotFound() public {
        vm.expectRevert("Song not found");
        catalog.updateSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1, true
        );
    }

    function test_UpdateSong_RevertIfGeniusIdAlreadyExists() public {
        // Add two songs
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        // Try to update song 2 to use song 1's Genius ID
        vm.expectRevert("Genius ID already exists");
        catalog.updateSong(
            SONG_ID_2, GENIUS_ID_1, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2, true
        );
    }

    // ========================================================================
    // Toggle Song Tests
    // ========================================================================

    function test_ToggleSong_Disable() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        assertEq(catalog.getEnabledSongCount(), 1);

        catalog.toggleSong(SONG_ID_1, false);

        SongCatalogV1.Song memory song = catalog.getSong(SONG_ID_1);
        assertFalse(song.enabled);
        assertEq(catalog.getEnabledSongCount(), 0);
    }

    function test_ToggleSong_Enable() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.toggleSong(SONG_ID_1, false);
        assertEq(catalog.getEnabledSongCount(), 0);

        catalog.toggleSong(SONG_ID_1, true);

        SongCatalogV1.Song memory song = catalog.getSong(SONG_ID_1);
        assertTrue(song.enabled);
        assertEq(catalog.getEnabledSongCount(), 1);
    }

    function test_ToggleSong_RevertIfNotOwner() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        vm.prank(nonOwner);
        vm.expectRevert("Not owner");
        catalog.toggleSong(SONG_ID_1, false);
    }

    function test_ToggleSong_RevertIfNotFound() public {
        vm.expectRevert("Song not found");
        catalog.toggleSong(SONG_ID_1, false);
    }

    // ========================================================================
    // Remove Song Tests (Hard Delete)
    // ========================================================================

    function test_RemoveSong_OnlyOne() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.removeSong(SONG_ID_1);

        assertEq(catalog.getSongCount(), 0);
        assertFalse(catalog.songExists(SONG_ID_1));
        assertFalse(catalog.songExistsByGeniusId(GENIUS_ID_1));
    }

    function test_RemoveSong_SwapAndPop() public {
        // Add three songs
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        catalog.addSong(
            SONG_ID_3, GENIUS_ID_3, GENIUS_ARTIST_ID_3,
            TITLE_3, ARTIST_3, DURATION_3,
            AUDIO_URI_3, METADATA_URI_3, COVER_URI_3, THUMBNAIL_URI_3, VIDEO_URI_3,
            SEGMENT_IDS_3, LANGUAGES_3
        );

        assertEq(catalog.getSongCount(), 3);

        // Remove middle song (should swap with last)
        catalog.removeSong(SONG_ID_2);

        assertEq(catalog.getSongCount(), 2);
        assertFalse(catalog.songExists(SONG_ID_2));
        assertFalse(catalog.songExistsByGeniusId(GENIUS_ID_2));

        // First and third should still exist
        assertTrue(catalog.songExists(SONG_ID_1));
        assertTrue(catalog.songExists(SONG_ID_3));

        // Verify songs are still accessible
        SongCatalogV1.Song memory song1 = catalog.getSong(SONG_ID_1);
        assertEq(song1.title, TITLE_1);

        SongCatalogV1.Song memory song3 = catalog.getSong(SONG_ID_3);
        assertEq(song3.title, TITLE_3);
    }

    function test_RemoveSong_WithoutGeniusId() public {
        catalog.addSong(
            SONG_ID_3, GENIUS_ID_3, GENIUS_ARTIST_ID_3,
            TITLE_3, ARTIST_3, DURATION_3,
            AUDIO_URI_3, METADATA_URI_3, COVER_URI_3, THUMBNAIL_URI_3, VIDEO_URI_3,
            SEGMENT_IDS_3, LANGUAGES_3
        );

        catalog.removeSong(SONG_ID_3);

        assertEq(catalog.getSongCount(), 0);
        assertFalse(catalog.songExists(SONG_ID_3));
    }

    function test_RemoveSong_RevertIfNotOwner() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        vm.prank(nonOwner);
        vm.expectRevert("Not owner");
        catalog.removeSong(SONG_ID_1);
    }

    function test_RemoveSong_RevertIfNotFound() public {
        vm.expectRevert("Song not found");
        catalog.removeSong(SONG_ID_1);
    }

    // ========================================================================
    // Query Tests
    // ========================================================================

    function test_GetSong() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        SongCatalogV1.Song memory song = catalog.getSong(SONG_ID_1);
        assertEq(song.id, SONG_ID_1);
        assertEq(song.title, TITLE_1);
    }

    function test_GetSong_RevertIfNotFound() public {
        vm.expectRevert("Song not found");
        catalog.getSong(SONG_ID_1);
    }

    function test_GetSongByGeniusId() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        SongCatalogV1.Song memory song = catalog.getSongByGeniusId(GENIUS_ID_1);
        assertEq(song.id, SONG_ID_1);
        assertEq(song.geniusId, GENIUS_ID_1);
    }

    function test_GetSongByGeniusId_RevertIfInvalid() public {
        vm.expectRevert("Invalid Genius ID");
        catalog.getSongByGeniusId(0);
    }

    function test_GetSongByGeniusId_RevertIfNotFound() public {
        vm.expectRevert("Song not found");
        catalog.getSongByGeniusId(GENIUS_ID_1);
    }

    function test_GetSongByIndex() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        SongCatalogV1.Song memory song0 = catalog.getSongByIndex(0);
        assertEq(song0.id, SONG_ID_1);

        SongCatalogV1.Song memory song1 = catalog.getSongByIndex(1);
        assertEq(song1.id, SONG_ID_2);
    }

    function test_GetSongByIndex_RevertIfOutOfBounds() public {
        vm.expectRevert("Index out of bounds");
        catalog.getSongByIndex(0);
    }

    function test_SongExists() public {
        assertFalse(catalog.songExists(SONG_ID_1));

        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        assertTrue(catalog.songExists(SONG_ID_1));
    }

    function test_SongExistsByGeniusId() public {
        assertFalse(catalog.songExistsByGeniusId(GENIUS_ID_1));

        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        assertTrue(catalog.songExistsByGeniusId(GENIUS_ID_1));
        assertFalse(catalog.songExistsByGeniusId(0));
    }

    function test_GetAllSongs() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        SongCatalogV1.Song[] memory songs = catalog.getAllSongs();
        assertEq(songs.length, 2);
        assertEq(songs[0].id, SONG_ID_1);
        assertEq(songs[1].id, SONG_ID_2);
    }

    function test_GetEnabledSongs() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        catalog.addSong(
            SONG_ID_3, GENIUS_ID_3, GENIUS_ARTIST_ID_3,
            TITLE_3, ARTIST_3, DURATION_3,
            AUDIO_URI_3, METADATA_URI_3, COVER_URI_3, THUMBNAIL_URI_3, VIDEO_URI_3,
            SEGMENT_IDS_3, LANGUAGES_3
        );

        // Disable song 2
        catalog.toggleSong(SONG_ID_2, false);

        SongCatalogV1.Song[] memory enabledSongs = catalog.getEnabledSongs();
        assertEq(enabledSongs.length, 2);
        assertEq(enabledSongs[0].id, SONG_ID_1);
        assertEq(enabledSongs[1].id, SONG_ID_3);
    }

    function test_GetSongsBatch() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, ARTIST_2, DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        catalog.addSong(
            SONG_ID_3, GENIUS_ID_3, GENIUS_ARTIST_ID_3,
            TITLE_3, ARTIST_3, DURATION_3,
            AUDIO_URI_3, METADATA_URI_3, COVER_URI_3, THUMBNAIL_URI_3, VIDEO_URI_3,
            SEGMENT_IDS_3, LANGUAGES_3
        );

        SongCatalogV1.Song[] memory batch = catalog.getSongsBatch(1, 3);
        assertEq(batch.length, 2);
        assertEq(batch[0].id, SONG_ID_2);
        assertEq(batch[1].id, SONG_ID_3);
    }

    function test_GetSongsBatch_RevertIfInvalidRange() public {
        vm.expectRevert("Invalid range");
        catalog.getSongsBatch(2, 1);
    }

    function test_GetSongsBatch_RevertIfOutOfBounds() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        vm.expectRevert("End index out of bounds");
        catalog.getSongsBatch(0, 5);
    }

    // ========================================================================
    // Artist Search Tests
    // ========================================================================

    function test_GetSongsByArtist() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, "Scarlett X", DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, "Ethel Waters", DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        catalog.addSong(
            SONG_ID_3, GENIUS_ID_3, GENIUS_ARTIST_ID_3,
            TITLE_3, "Scarlett Y", DURATION_3,
            AUDIO_URI_3, METADATA_URI_3, COVER_URI_3, THUMBNAIL_URI_3, VIDEO_URI_3,
            SEGMENT_IDS_3, LANGUAGES_3
        );

        // Search for "Scarlett" substring
        SongCatalogV1.Song[] memory results = catalog.getSongsByArtist("Scarlett");
        assertEq(results.length, 2);
        assertEq(results[0].id, SONG_ID_1);
        assertEq(results[1].id, SONG_ID_3);
    }

    function test_GetSongsByArtist_CaseSensitive() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, "Scarlett X", DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        // Lowercase search should not match
        SongCatalogV1.Song[] memory results = catalog.getSongsByArtist("scarlett");
        assertEq(results.length, 0);
    }

    function test_GetSongsByArtist_OnlyEnabled() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, "Scarlett X", DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        catalog.addSong(
            SONG_ID_2, GENIUS_ID_2, GENIUS_ARTIST_ID_2,
            TITLE_2, "Scarlett Y", DURATION_2,
            AUDIO_URI_2, METADATA_URI_2, COVER_URI_2, THUMBNAIL_URI_2, VIDEO_URI_2,
            SEGMENT_IDS_2, LANGUAGES_2
        );

        // Disable one
        catalog.toggleSong(SONG_ID_2, false);

        // Search should only return enabled
        SongCatalogV1.Song[] memory results = catalog.getSongsByArtist("Scarlett");
        assertEq(results.length, 1);
        assertEq(results[0].id, SONG_ID_1);
    }

    function test_GetSongsByArtist_EmptyQuery() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        // Empty query should match all
        SongCatalogV1.Song[] memory results = catalog.getSongsByArtist("");
        assertEq(results.length, 1);
    }

    function test_GetSongsByArtist_NoMatches() public {
        catalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, "Scarlett X", DURATION_1,
            AUDIO_URI_1, METADATA_URI_1, COVER_URI_1, THUMBNAIL_URI_1, VIDEO_URI_1,
            SEGMENT_IDS_1, LANGUAGES_1
        );

        SongCatalogV1.Song[] memory results = catalog.getSongsByArtist("NonExistent");
        assertEq(results.length, 0);
    }
}
