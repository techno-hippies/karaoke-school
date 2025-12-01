// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/events/KaraokeEvents.sol";

contract KaraokeEventsTest is Test {
    KaraokeEvents private karaokeEvents;
    address private trustedPKP = address(0x7d8003DFAc78C1775EDD518772162A7766Bd4AC7);

    bytes32 private constant CLIP_HASH = keccak256("clip-hash");
    string private constant TRACK_ID = "spotify-track-id";
    string private constant ISWC = "T0123456789";
    string private constant TITLE = "Test Song";
    string private constant ARTIST = "Test Artist";
    string private constant ARTIST_SLUG = "test-artist";
    string private constant SONG_SLUG = "test-song";
    string private constant COVER_URI = "https://api.grove.storage/cover";
    string private constant THUMBNAIL_URI = "https://api.grove.storage/thumbnail";
    uint32 private constant CLIP_START_MS = 15_000;
    uint32 private constant CLIP_END_MS = 45_000;

    event ClipRegistered(
        bytes32 indexed clipHash,
        string spotifyTrackId,
        string iswc,
        string title,
        string artist,
        string artistSlug,
        string songSlug,
        string coverUri,
        string thumbnailUri,
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

    event KaraokeSessionStarted(
        bytes32 indexed sessionId,
        bytes32 indexed clipHash,
        address indexed performer,
        uint16 expectedLineCount,
        uint64 timestamp
    );

    event KaraokeLineGraded(
        bytes32 indexed sessionId,
        uint16 lineIndex,
        uint16 score,
        uint8 rating,
        string metadataUri,
        uint64 timestamp
    );

    event KaraokeSessionEnded(
        bytes32 indexed sessionId,
        bool completed,
        uint64 timestamp
    );

    function setUp() public {
        karaokeEvents = new KaraokeEvents(trustedPKP);
    }

    function testEmitClipRegistered() public {
        vm.prank(address(0x1));
        vm.expectEmit();
        emit ClipRegistered(
            CLIP_HASH,
            TRACK_ID,
            ISWC,
            TITLE,
            ARTIST,
            ARTIST_SLUG,
            SONG_SLUG,
            COVER_URI,
            THUMBNAIL_URI,
            CLIP_START_MS,
            CLIP_END_MS,
            "grove://clip-metadata",
            address(0x1),
            uint64(block.timestamp)
        );

        karaokeEvents.emitClipRegistered(
            CLIP_HASH,
            TRACK_ID,
            ISWC,
            TITLE,
            ARTIST,
            ARTIST_SLUG,
            SONG_SLUG,
            COVER_URI,
            THUMBNAIL_URI,
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

    // ============ Session Function Tests ============

    function testStartKaraokeSession() public {
        bytes32 sessionId = keccak256("session-1");
        address performer = address(0x1234);
        uint16 expectedLineCount = 12;

        vm.prank(trustedPKP);
        vm.expectEmit();
        emit KaraokeSessionStarted(
            sessionId,
            CLIP_HASH,
            performer,
            expectedLineCount,
            uint64(block.timestamp)
        );

        karaokeEvents.startKaraokeSession(
            sessionId,
            CLIP_HASH,
            performer,
            expectedLineCount
        );
    }

    function testStartKaraokeSession_RevertNotTrustedPKP() public {
        bytes32 sessionId = keccak256("session-1");
        address performer = address(0x1234);

        vm.prank(address(0x999));
        vm.expectRevert(KaraokeEvents.NotTrustedPKP.selector);
        karaokeEvents.startKaraokeSession(
            sessionId,
            CLIP_HASH,
            performer,
            12
        );
    }

    function testStartKaraokeSession_RevertInvalidSession() public {
        vm.prank(trustedPKP);
        vm.expectRevert(KaraokeEvents.InvalidSession.selector);
        karaokeEvents.startKaraokeSession(
            bytes32(0), // invalid
            CLIP_HASH,
            address(0x1234),
            12
        );
    }

    function testGradeKaraokeLine() public {
        bytes32 sessionId = keccak256("session-1");
        uint16 lineIndex = 3;
        uint16 score = 8500; // 85% similarity
        uint8 rating = 2; // Good

        vm.prank(trustedPKP);
        vm.expectEmit();
        emit KaraokeLineGraded(
            sessionId,
            lineIndex,
            score,
            rating,
            "grove://line-metadata",
            uint64(block.timestamp)
        );

        karaokeEvents.gradeKaraokeLine(
            sessionId,
            lineIndex,
            score,
            rating,
            "grove://line-metadata"
        );
    }

    function testGradeKaraokeLine_RevertNotTrustedPKP() public {
        bytes32 sessionId = keccak256("session-1");

        vm.prank(address(0x999));
        vm.expectRevert(KaraokeEvents.NotTrustedPKP.selector);
        karaokeEvents.gradeKaraokeLine(
            sessionId,
            0,
            8500,
            2,
            "grove://metadata"
        );
    }

    function testGradeKaraokeLine_RevertInvalidScore() public {
        bytes32 sessionId = keccak256("session-1");

        vm.prank(trustedPKP);
        vm.expectRevert(KaraokeEvents.InvalidScore.selector);
        karaokeEvents.gradeKaraokeLine(
            sessionId,
            0,
            10001, // > 10000
            2,
            "grove://metadata"
        );
    }

    function testGradeKaraokeLine_RevertInvalidRating() public {
        bytes32 sessionId = keccak256("session-1");

        vm.prank(trustedPKP);
        vm.expectRevert(KaraokeEvents.InvalidRating.selector);
        karaokeEvents.gradeKaraokeLine(
            sessionId,
            0,
            8500,
            4, // > 3
            "grove://metadata"
        );
    }

    function testEndKaraokeSession_Completed() public {
        bytes32 sessionId = keccak256("session-1");

        vm.prank(trustedPKP);
        vm.expectEmit();
        emit KaraokeSessionEnded(
            sessionId,
            true,
            uint64(block.timestamp)
        );

        karaokeEvents.endKaraokeSession(sessionId, true);
    }

    function testEndKaraokeSession_Abandoned() public {
        bytes32 sessionId = keccak256("session-1");

        vm.prank(trustedPKP);
        vm.expectEmit();
        emit KaraokeSessionEnded(
            sessionId,
            false, // abandoned
            uint64(block.timestamp)
        );

        karaokeEvents.endKaraokeSession(sessionId, false);
    }

    function testEndKaraokeSession_RevertNotTrustedPKP() public {
        bytes32 sessionId = keccak256("session-1");

        vm.prank(address(0x999));
        vm.expectRevert(KaraokeEvents.NotTrustedPKP.selector);
        karaokeEvents.endKaraokeSession(sessionId, true);
    }

    function testEndKaraokeSession_RevertInvalidSession() public {
        vm.prank(trustedPKP);
        vm.expectRevert(KaraokeEvents.InvalidSession.selector);
        karaokeEvents.endKaraokeSession(bytes32(0), true);
    }

    // ============ Full Session Flow Test ============

    function testFullSessionFlow() public {
        bytes32 sessionId = keccak256("session-flow-test");
        address performer = address(0xBEEF);
        uint16 lineCount = 3;

        // 1. Start session
        vm.prank(trustedPKP);
        karaokeEvents.startKaraokeSession(sessionId, CLIP_HASH, performer, lineCount);

        // 2. Grade lines
        vm.startPrank(trustedPKP);
        karaokeEvents.gradeKaraokeLine(sessionId, 0, 9200, 3, "grove://line0");
        karaokeEvents.gradeKaraokeLine(sessionId, 1, 7500, 2, "grove://line1");
        karaokeEvents.gradeKaraokeLine(sessionId, 2, 8800, 2, "grove://line2");

        // 3. End session
        karaokeEvents.endKaraokeSession(sessionId, true);
        vm.stopPrank();
    }
}
