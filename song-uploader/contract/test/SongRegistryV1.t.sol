// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {SongRegistryV1} from "../src/SongRegistryV1.sol";

contract SongRegistryV1Test is Test {
    SongRegistryV1 public registry;
    address public owner;
    address public nonOwner;

    event SongAdded(
        string indexed id,
        string title,
        string artist,
        string languages,
        uint64 addedAt
    );

    function setUp() public {
        owner = address(this);
        nonOwner = address(0x1);
        registry = new SongRegistryV1();
    }

    function test_OwnerIsSetCorrectly() public view {
        assertEq(registry.owner(), owner);
    }

    function test_AddSong() public {
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );

        assertEq(registry.getSongCount(), 1);
        assertTrue(registry.songExists("song-1"));

        SongRegistryV1.Song memory song = registry.getSong("song-1");
        assertEq(song.id, "song-1");
        assertEq(song.title, "Test Song");
        assertEq(song.artist, "Test Artist");
        assertEq(song.duration, 180);
        assertEq(song.audioUri, "lens://audio123");
        assertEq(song.timestampsUri, "lens://metadata123");
        assertEq(song.thumbnailUri, "lens://thumb123");
        assertEq(song.languages, "en");
        assertEq(song.addedAt, block.timestamp);
    }

    function test_AddSongWithMultipleLanguages() public {
        registry.addSong(
            "song-2",
            "K-Pop Mix",
            "BTS",
            200,
            "lens://audio456",
            "lens://metadata456",
            "lens://thumb456",
            "en,ko"
        );

        SongRegistryV1.Song memory song = registry.getSong("song-2");
        assertEq(song.languages, "en,ko");
    }

    function test_RevertWhen_NonOwnerAddsSong() public {
        vm.prank(nonOwner);
        vm.expectRevert();
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );
    }

    function test_RevertWhen_DuplicateId() public {
        registry.addSong(
            "song-1",
            "First Song",
            "Artist",
            180,
            "lens://audio1",
            "lens://metadata1",
            "lens://thumb1",
            "en"
        );

        vm.expectRevert("Song ID already exists");
        registry.addSong(
            "song-1",
            "Duplicate Song",
            "Artist",
            180,
            "lens://audio2",
            "lens://metadata2",
            "lens://thumb2",
            "en"
        );
    }

    function test_RevertWhen_EmptyId() public {
        vm.expectRevert("ID cannot be empty");
        registry.addSong(
            "",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );
    }

    function test_RevertWhen_EmptyTitle() public {
        vm.expectRevert("Title cannot be empty");
        registry.addSong(
            "song-1",
            "",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );
    }

    function test_RevertWhen_EmptyAudioUri() public {
        vm.expectRevert("Audio URI cannot be empty");
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );
    }

    function test_RevertWhen_EmptyTimestampsUri() public {
        vm.expectRevert("Timestamps URI cannot be empty");
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "",
            "lens://thumb123",
            "en"
        );
    }

    function test_RevertWhen_EmptyLanguages() public {
        vm.expectRevert("Languages cannot be empty");
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            ""
        );
    }

    function test_GetSongByIndex() public {
        registry.addSong(
            "song-1",
            "First Song",
            "Artist 1",
            180,
            "lens://audio1",
            "lens://metadata1",
            "lens://thumb1",
            "en"
        );

        registry.addSong(
            "song-2",
            "Second Song",
            "Artist 2",
            200,
            "lens://audio2",
            "lens://metadata2",
            "lens://thumb2",
            "ko"
        );

        SongRegistryV1.Song memory song = registry.getSongByIndex(0);
        assertEq(song.id, "song-1");

        song = registry.getSongByIndex(1);
        assertEq(song.id, "song-2");
    }

    function test_RevertWhen_GetSongByInvalidIndex() public {
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );

        vm.expectRevert("Index out of bounds");
        registry.getSongByIndex(1);
    }

    function test_GetAllSongs() public {
        registry.addSong(
            "song-1",
            "First Song",
            "Artist 1",
            180,
            "lens://audio1",
            "lens://metadata1",
            "lens://thumb1",
            "en"
        );

        registry.addSong(
            "song-2",
            "Second Song",
            "Artist 2",
            200,
            "lens://audio2",
            "lens://metadata2",
            "lens://thumb2",
            "ko"
        );

        SongRegistryV1.Song[] memory allSongs = registry.getAllSongs();
        assertEq(allSongs.length, 2);
        assertEq(allSongs[0].id, "song-1");
        assertEq(allSongs[1].id, "song-2");
    }

    function test_GetSongsBatch() public {
        // Add 5 songs
        for (uint256 i = 1; i <= 5; i++) {
            registry.addSong(
                string(abi.encodePacked("song-", vm.toString(i))),
                string(abi.encodePacked("Song ", vm.toString(i))),
                "Artist",
                180,
                "lens://audio",
                "lens://metadata",
                "lens://thumb",
                "en"
            );
        }

        // Get songs 1-3 (indices 1, 2)
        SongRegistryV1.Song[] memory batch = registry.getSongsBatch(1, 3);
        assertEq(batch.length, 2);
        assertEq(batch[0].id, "song-2");
        assertEq(batch[1].id, "song-3");
    }

    function test_RevertWhen_BatchInvalidRange() public {
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );

        vm.expectRevert("Invalid range");
        registry.getSongsBatch(2, 1);
    }

    function test_RevertWhen_BatchEndIndexOutOfBounds() public {
        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );

        vm.expectRevert("End index out of bounds");
        registry.getSongsBatch(0, 5);
    }

    function test_SongAddedEvent() public {
        vm.expectEmit(true, false, false, true);
        emit SongAdded(
            "song-1",
            "Test Song",
            "Test Artist",
            "en",
            uint64(block.timestamp)
        );

        registry.addSong(
            "song-1",
            "Test Song",
            "Test Artist",
            180,
            "lens://audio123",
            "lens://metadata123",
            "lens://thumb123",
            "en"
        );
    }

    function test_RevertWhen_GetNonExistentSong() public {
        vm.expectRevert("Song not found");
        registry.getSong("nonexistent");
    }

    function test_SongExistsReturnsFalse() public view {
        assertFalse(registry.songExists("nonexistent"));
    }

    function test_MultipleSongsWithDifferentLanguages() public {
        // English only
        registry.addSong(
            "song-en",
            "English Song",
            "Artist",
            180,
            "lens://audio1",
            "lens://meta1",
            "lens://thumb1",
            "en"
        );

        // Korean only
        registry.addSong(
            "song-ko",
            "Korean Song",
            "Artist",
            180,
            "lens://audio2",
            "lens://meta2",
            "lens://thumb2",
            "ko"
        );

        // Mixed English and Korean
        registry.addSong(
            "song-mix",
            "Mixed Song",
            "Artist",
            180,
            "lens://audio3",
            "lens://meta3",
            "lens://thumb3",
            "en,ko"
        );

        // Vietnamese
        registry.addSong(
            "song-vi",
            "Vietnamese Song",
            "Artist",
            180,
            "lens://audio4",
            "lens://meta4",
            "lens://thumb4",
            "vi"
        );

        assertEq(registry.getSongCount(), 4);
        assertEq(registry.getSong("song-en").languages, "en");
        assertEq(registry.getSong("song-ko").languages, "ko");
        assertEq(registry.getSong("song-mix").languages, "en,ko");
        assertEq(registry.getSong("song-vi").languages, "vi");
    }
}