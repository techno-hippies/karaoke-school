// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/core/ArtistRegistryV1.sol";
import "../src/core/SongRegistryV1.sol";

contract SongRegistryV1Test is BaseTest {

    ArtistRegistryV1 public artistRegistry;
    SongRegistryV1 public songRegistry;

    event SongRegistered(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        string title,
        string artist
    );

    function setUp() public override {
        super.setUp();

        vm.startPrank(owner);

        // Deploy artist registry
        artistRegistry = new ArtistRegistryV1();
        artistRegistry.setAuthorized(authorized, true);

        // Deploy song registry
        songRegistry = new SongRegistryV1(address(artistRegistry));
        songRegistry.setAuthorized(authorized, true);

        vm.stopPrank();

        // Register test artist
        vm.prank(authorized);
        artistRegistry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);
    }

    // ============ Constructor Tests ============

    function test_Constructor() public {
        assertEq(songRegistry.owner(), owner);
        assertTrue(songRegistry.isAuthorized(owner));
        assertEq(address(songRegistry.artistRegistry()), address(artistRegistry));
    }

    // ============ Registration Tests ============

    function test_RegisterSong() public {
        vm.startPrank(authorized);

        vm.expectEmit(true, true, false, true);
        emit SongRegistered(GENIUS_SONG_1, GENIUS_ARTIST_1, SONG_TITLE_1, SONG_ARTIST_1);

        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false // not copyright free
        );

        vm.stopPrank();

        // Verify song registered
        ISongRegistry.Song memory song = songRegistry.getSong(GENIUS_SONG_1);

        assertEq(song.geniusId, GENIUS_SONG_1);
        assertEq(song.geniusArtistId, GENIUS_ARTIST_1);
        assertEq(song.spotifyId, SPOTIFY_ID_1);
        assertEq(song.tiktokMusicId, TIKTOK_MUSIC_ID_1);
        assertEq(song.title, SONG_TITLE_1);
        assertEq(song.artist, SONG_ARTIST_1);
        assertEq(song.duration, SONG_DURATION_1);
        assertEq(song.coverUri, COVER_URI);
        assertEq(song.metadataUri, METADATA_URI);
        assertTrue(song.enabled);
        assertFalse(song.copyrightFree);
        assertGt(song.createdAt, 0);
    }

    function test_RegisterMultipleSongs() public {
        vm.startPrank(authorized);

        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        songRegistry.registerSong(
            GENIUS_SONG_2,
            GENIUS_ARTIST_1,
            "spotify2",
            "tiktok2",
            "Song 2",
            SONG_ARTIST_1,
            180,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();

        assertEq(songRegistry.totalSongs(), 2);
    }

    function test_RevertWhen_SongAlreadyExists() public {
        vm.startPrank(authorized);

        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ISongRegistry.SongAlreadyExists.selector,
                GENIUS_SONG_1
            )
        );
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();
    }

    function test_RevertWhen_InvalidGeniusId() public {
        vm.startPrank(authorized);

        vm.expectRevert(ISongRegistry.InvalidGeniusId.selector);
        songRegistry.registerSong(
            0, // invalid
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();
    }

    function test_RevertWhen_ArtistNotFound() public {
        vm.startPrank(authorized);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISongRegistry.ArtistNotFound.selector,
                999999 // non-existent artist
            )
        );
        songRegistry.registerSong(
            GENIUS_SONG_1,
            999999, // non-existent artist
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();
    }

    function test_RevertWhen_InvalidDuration() public {
        vm.startPrank(authorized);

        vm.expectRevert(ISongRegistry.InvalidDuration.selector);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            0, // invalid
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();
    }

    function test_RevertWhen_NotAuthorized() public {
        vm.startPrank(user1);

        vm.expectRevert(ISongRegistry.NotAuthorized.selector);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();
    }

    // ============ Query Tests ============

    function test_GetSong() public {
        vm.prank(authorized);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        ISongRegistry.Song memory song = songRegistry.getSong(GENIUS_SONG_1);

        assertEq(song.geniusId, GENIUS_SONG_1);
        assertEq(song.geniusArtistId, GENIUS_ARTIST_1);
    }

    function test_RevertWhen_SongNotFound() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                ISongRegistry.SongNotFound.selector,
                GENIUS_SONG_1
            )
        );
        songRegistry.getSong(GENIUS_SONG_1);
    }

    function test_GetSongsByArtist() public {
        vm.startPrank(authorized);

        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        songRegistry.registerSong(
            GENIUS_SONG_2,
            GENIUS_ARTIST_1,
            "spotify2",
            "tiktok2",
            "Song 2",
            SONG_ARTIST_1,
            180,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();

        uint32[] memory songs = songRegistry.getSongsByArtist(GENIUS_ARTIST_1);
        assertEq(songs.length, 2);
        assertEq(songs[0], GENIUS_SONG_1);
        assertEq(songs[1], GENIUS_SONG_2);
    }

    function test_GetRecentSongs() public {
        vm.startPrank(authorized);

        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        songRegistry.registerSong(
            GENIUS_SONG_2,
            GENIUS_ARTIST_1,
            "spotify2",
            "tiktok2",
            "Song 2",
            SONG_ARTIST_1,
            180,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.stopPrank();

        ISongRegistry.Song[] memory recent = songRegistry.getRecentSongs(10);
        assertEq(recent.length, 2);
        // Most recent first
        assertEq(recent[0].geniusId, GENIUS_SONG_2);
        assertEq(recent[1].geniusId, GENIUS_SONG_1);
    }

    function test_SongExists() public {
        assertFalse(songRegistry.songExists(GENIUS_SONG_1));

        vm.prank(authorized);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        assertTrue(songRegistry.songExists(GENIUS_SONG_1));
    }

    function test_IsEnabled() public {
        vm.prank(authorized);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        ISongRegistry.Song memory song = songRegistry.getSong(GENIUS_SONG_1);
        assertTrue(song.enabled);
    }

    function test_GetTotalSongs() public {
        assertEq(songRegistry.totalSongs(), 0);

        vm.startPrank(authorized);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );
        assertEq(songRegistry.totalSongs(), 1);
        vm.stopPrank();
    }

    // ============ Admin Tests ============

    function test_ToggleEnabled() public {
        vm.prank(authorized);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        ISongRegistry.Song memory song = songRegistry.getSong(GENIUS_SONG_1);
        assertTrue(song.enabled);

        vm.prank(owner);
        songRegistry.toggleSong(GENIUS_SONG_1, false);

        song = songRegistry.getSong(GENIUS_SONG_1);
        assertFalse(song.enabled);

        vm.prank(owner);
        songRegistry.toggleSong(GENIUS_SONG_1, true);

        song = songRegistry.getSong(GENIUS_SONG_1);
        assertTrue(song.enabled);
    }

    function test_RevertWhen_ToggleEnabled_NotOwner() public {
        vm.prank(authorized);
        songRegistry.registerSong(
            GENIUS_SONG_1,
            GENIUS_ARTIST_1,
            SPOTIFY_ID_1,
            TIKTOK_MUSIC_ID_1,
            SONG_TITLE_1,
            SONG_ARTIST_1,
            SONG_DURATION_1,
            COVER_URI,
            METADATA_URI,
            false
        );

        vm.startPrank(user1);
        vm.expectRevert(ISongRegistry.NotOwner.selector);
        songRegistry.toggleSong(GENIUS_SONG_1, false);
        vm.stopPrank();
    }

    function test_SetAuthorized() public {
        assertFalse(songRegistry.isAuthorized(user1));

        vm.prank(owner);
        songRegistry.setAuthorized(user1, true);

        assertTrue(songRegistry.isAuthorized(user1));
    }

    function test_TransferOwnership() public {
        assertEq(songRegistry.owner(), owner);

        vm.prank(owner);
        songRegistry.transferOwnership(user1);

        assertEq(songRegistry.owner(), user1);
    }
}
