// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/events/KaraokeEvents.sol";

contract KaraokeEventsTest is Test {
    KaraokeEvents private karaokeEvents;
    address private trustedPKP = address(0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7);

    bytes32 private constant CLIP_HASH = keccak256("clip-hash");
    string private constant WORK_ID = "grc20-work-id";
    string private constant TRACK_ID = "spotify-track-id";
    uint32 private constant CLIP_START_MS = 15_000;
    uint32 private constant CLIP_END_MS = 45_000;

    event ClipRegistered(
        bytes32 indexed clipHash,
        string grc20WorkId,
        string spotifyTrackId,
        uint32 clipStartMs,
        uint32 clipEndMs,
        string metadataUri,
        address indexed registeredBy,
        uint64 timestamp
    );

    event ClipProcessed(
        bytes32 indexed clipHash,
        string instrumentalUri,
        string alignmentUri,
        uint8 translationCount,
        string metadataUri,
        uint64 timestamp
    );

    event SongEncrypted(
        bytes32 indexed clipHash,
        string spotifyTrackId,
        string encryptedFullUri,
        string encryptedManifestUri,
        address unlockLockAddress,
        uint32 unlockChainId,
        string metadataUri,
        uint64 timestamp
    );

    event ClipToggled(bytes32 indexed clipHash, bool enabled, uint64 timestamp);

    function setUp() public {
        karaokeEvents = new KaraokeEvents(trustedPKP);
    }

    function testEmitClipRegistered() public {
        vm.prank(address(0x1));
        vm.expectEmit();
        emit ClipRegistered(
            CLIP_HASH,
            WORK_ID,
            TRACK_ID,
            CLIP_START_MS,
            CLIP_END_MS,
            "grove://clip-metadata",
            address(0x1),
            uint64(block.timestamp)
        );

        karaokeEvents.emitClipRegistered(
            CLIP_HASH,
            WORK_ID,
            TRACK_ID,
            CLIP_START_MS,
            CLIP_END_MS,
            "grove://clip-metadata"
        );
    }

    function testEmitClipProcessed() public {
        vm.prank(address(0x2));
        vm.expectEmit();
        emit ClipProcessed(
            CLIP_HASH,
            "grove://instrumental",
            "grove://alignment",
            3,
            "grove://clip-updated",
            uint64(block.timestamp)
        );

        karaokeEvents.emitClipProcessed(
            CLIP_HASH,
            "grove://instrumental",
            "grove://alignment",
            3,
            "grove://clip-updated"
        );
    }

    function testEmitSongEncrypted() public {
        vm.prank(address(0x3));
        vm.expectEmit();
        emit SongEncrypted(
            CLIP_HASH,
            TRACK_ID,
            "grove://full-encrypted",
            "grove://manifest",
            address(0xabc),
            84532,
            "grove://song-metadata",
            uint64(block.timestamp)
        );

        karaokeEvents.emitSongEncrypted(
            CLIP_HASH,
            TRACK_ID,
            "grove://full-encrypted",
            "grove://manifest",
            address(0xabc),
            84532,
            "grove://song-metadata"
        );
    }

    function testEmitClipToggled() public {
        vm.prank(address(0x4));
        vm.expectEmit();
        emit ClipToggled(CLIP_HASH, true, uint64(block.timestamp));

        karaokeEvents.emitClipToggled(CLIP_HASH, true);
    }

    function testGetClipHash() public {
        bytes32 expected = keccak256(abi.encodePacked(TRACK_ID, CLIP_START_MS));
        bytes32 actual = karaokeEvents.getClipHash(TRACK_ID, CLIP_START_MS);

        assertEq(actual, expected);
    }
}
