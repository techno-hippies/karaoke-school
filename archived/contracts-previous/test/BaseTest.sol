// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";

/**
 * @title BaseTest
 * @notice Base test contract with common utilities and helpers
 */
abstract contract BaseTest is Test {

    // ============ Common Test Accounts ============

    address public owner = makeAddr("owner");
    address public authorized = makeAddr("authorized");
    address public user1 = makeAddr("user1");
    address public user2 = makeAddr("user2");
    address public user3 = makeAddr("user3");

    address public pkp1 = makeAddr("pkp1");
    address public pkp2 = makeAddr("pkp2");

    address public lensAccount1 = makeAddr("lensAccount1");
    address public lensAccount2 = makeAddr("lensAccount2");

    // ============ Common Test Data ============

    string public constant LENS_HANDLE_1 = "beyonce";
    string public constant LENS_HANDLE_2 = "drake";

    uint32 public constant GENIUS_ARTIST_1 = 498; // Beyoncé
    uint32 public constant GENIUS_ARTIST_2 = 130; // Drake

    uint32 public constant GENIUS_SONG_1 = 8765432;
    uint32 public constant GENIUS_SONG_2 = 8765433;

    string public constant SPOTIFY_ID_1 = "6WzRpISELf3YglGAh7TXcG";
    string public constant TIKTOK_MUSIC_ID_1 = "7123456789";

    string public constant SONG_TITLE_1 = "CUFF IT";
    string public constant SONG_ARTIST_1 = "Beyonce";
    uint32 public constant SONG_DURATION_1 = 215; // 3:35

    string public constant COVER_URI = "lens://cover1";
    string public constant METADATA_URI = "lens://metadata1";
    string public constant VOCALS_URI = "lens://vocals1";
    string public constant INSTRUMENTAL_URI = "lens://instrumental1";
    string public constant ALIGNMENT_URI = "lens://alignment1";
    string public constant VIDEO_URI = "lens://video1";
    string public constant AUDIO_URI = "lens://audio1";

    string public constant TIKTOK_SEGMENT_ID = "7234567890";
    uint32 public constant SEGMENT_START = 60; // 1:00
    uint32 public constant SEGMENT_END = 90;   // 1:30

    // ============ Setup ============

    function setUp() public virtual {
        // Label accounts for better trace output
        vm.label(owner, "Owner");
        vm.label(authorized, "Authorized");
        vm.label(user1, "User1");
        vm.label(user2, "User2");
        vm.label(user3, "User3");
        vm.label(pkp1, "PKP1");
        vm.label(pkp2, "PKP2");
        vm.label(lensAccount1, "LensAccount1");
        vm.label(lensAccount2, "LensAccount2");
    }

    // ============ Helper Functions ============

    /**
     * @notice Generate a segment hash (same as contract logic)
     */
    function generateSegmentHash(uint32 geniusId, string memory tiktokSegmentId)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(geniusId, tiktokSegmentId));
    }

    /**
     * @notice Fast forward time by N days
     */
    function skipDays(uint256 numDays) internal {
        skip(numDays * 1 days);
    }

    /**
     * @notice Create a sample FSRS card
     */
    function createSampleCard(uint8 state, uint40 dueTimestamp)
        internal
        view
        returns (
            uint40 due,
            uint16 stability,
            uint8 difficulty,
            uint16 elapsedDays,
            uint16 scheduledDays,
            uint8 reps,
            uint8 lapses,
            uint8 cardState,
            uint40 lastReview
        )
    {
        return (
            dueTimestamp,
            100, // stability * 100
            50,  // difficulty * 10
            10,  // elapsedDays * 10
            30,  // scheduledDays * 10
            5,   // reps
            1,   // lapses
            state,
            uint40(block.timestamp)
        );
    }

    /**
     * @notice Expect an event without checking the indexed parameters
     */
    function expectEventApproximate() internal {
        vm.recordLogs();
    }

    /**
     * @notice Check that the last event matches the expected signature
     */
    function assertLastEventSignature(bytes32 expectedSig) internal {
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertGt(logs.length, 0, "No events emitted");
        assertEq(logs[logs.length - 1].topics[0], expectedSig, "Event signature mismatch");
    }
}
