// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/events/SegmentEvents.sol";

/**
 * @title SegmentEventsTest
 * @notice Tests for SegmentEvents contract
 */
contract SegmentEventsTest is BaseTest {

    SegmentEvents public segmentEvents;

    bytes32 public segmentHash;

    function setUp() public override {
        super.setUp();

        // Deploy SegmentEvents
        segmentEvents = new SegmentEvents();

        // Pre-compute segment hash
        segmentHash = generateSegmentHash(GENIUS_SONG_1, TIKTOK_SEGMENT_ID);
    }

    // ============ Deployment Tests ============

    function test_Deployment() public view {
        assert(address(segmentEvents) != address(0));
    }

    // ============ getSegmentHash Tests ============

    function test_GetSegmentHash() public view {
        bytes32 hash = segmentEvents.getSegmentHash(GENIUS_SONG_1, TIKTOK_SEGMENT_ID);

        // Should match our helper function
        assertEq(hash, segmentHash, "Hash mismatch");
    }

    function test_GetSegmentHash_Deterministic() public view {
        // Same inputs should produce same hash
        bytes32 hash1 = segmentEvents.getSegmentHash(GENIUS_SONG_1, TIKTOK_SEGMENT_ID);
        bytes32 hash2 = segmentEvents.getSegmentHash(GENIUS_SONG_1, TIKTOK_SEGMENT_ID);

        assertEq(hash1, hash2, "Hashes should be deterministic");
    }

    function test_GetSegmentHash_DifferentInputs() public view {
        bytes32 hash1 = segmentEvents.getSegmentHash(GENIUS_SONG_1, TIKTOK_SEGMENT_ID);
        bytes32 hash2 = segmentEvents.getSegmentHash(GENIUS_SONG_2, TIKTOK_SEGMENT_ID);

        assertTrue(hash1 != hash2, "Different inputs should produce different hashes");
    }

    // ============ SegmentRegistered Event Tests ============

    function test_EmitSegmentRegistered() public {
        // Expect event
        vm.expectEmit(true, true, false, true);
        emit SegmentEvents.SegmentRegistered(
            segmentHash,
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            METADATA_URI,
            owner,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        segmentEvents.emitSegmentRegistered(
            segmentHash,
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            METADATA_URI
        );
    }

    function test_EmitSegmentRegistered_Gas() public {
        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        segmentEvents.emitSegmentRegistered(
            segmentHash,
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            METADATA_URI
        );
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~20k gas (even better than expected!)
        assertLt(gasUsed, 25_000, "Gas too high");
        assertGt(gasUsed, 17_000, "Gas unexpectedly low");

        emit log_named_uint("Gas used for SegmentRegistered", gasUsed);
    }

    function test_EmitSegmentRegistered_Multiple() public {
        // Register multiple segments
        for (uint32 i = 1; i <= 5; i++) {
            bytes32 hash = keccak256(abi.encodePacked(GENIUS_SONG_1, TIKTOK_SEGMENT_ID, i));

            vm.expectEmit(true, true, false, true);
            emit SegmentEvents.SegmentRegistered(
                hash,
                GENIUS_SONG_1,
                TIKTOK_SEGMENT_ID,
                METADATA_URI,
                owner,
                uint64(block.timestamp)
            );

            vm.prank(owner);
            segmentEvents.emitSegmentRegistered(
                hash,
                GENIUS_SONG_1,
                TIKTOK_SEGMENT_ID,
                METADATA_URI
            );
        }
    }

    // ============ SegmentProcessed Event Tests ============

    function test_EmitSegmentProcessed() public {
        // Expect event
        vm.expectEmit(true, false, false, true);
        emit SegmentEvents.SegmentProcessed(
            segmentHash,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI,
            METADATA_URI,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        segmentEvents.emitSegmentProcessed(
            segmentHash,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI,
            METADATA_URI
        );
    }

    function test_EmitSegmentProcessed_Gas() public {
        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        segmentEvents.emitSegmentProcessed(
            segmentHash,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI,
            METADATA_URI
        );
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~32k gas
        assertLt(gasUsed, 37_000, "Gas too high");

        emit log_named_uint("Gas used for SegmentProcessed", gasUsed);
    }

    // ============ SegmentToggled Event Tests ============

    function test_EmitSegmentToggled() public {
        bool enabled = false;

        // Expect event
        vm.expectEmit(true, false, false, true);
        emit SegmentEvents.SegmentToggled(
            segmentHash,
            enabled,
            uint64(block.timestamp)
        );

        // Call emit function
        vm.prank(owner);
        segmentEvents.emitSegmentToggled(segmentHash, enabled);
    }

    function test_EmitSegmentToggled_Gas() public {
        bool enabled = false;

        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(owner);
        segmentEvents.emitSegmentToggled(segmentHash, enabled);
        uint256 gasUsed = gasBefore - gasleft();

        // Should be ~25k gas
        assertLt(gasUsed, 30_000, "Gas too high");

        emit log_named_uint("Gas used for SegmentToggled", gasUsed);
    }

    // ============ Authorization Tests ============

    function test_EmitSegmentRegistered_AnyoneCanCall() public {
        // Should allow anyone to call (no auth)
        vm.prank(user1);
        segmentEvents.emitSegmentRegistered(
            segmentHash,
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            METADATA_URI
        );

        vm.prank(user2);
        segmentEvents.emitSegmentRegistered(
            segmentHash,
            GENIUS_SONG_2,
            TIKTOK_SEGMENT_ID,
            METADATA_URI
        );

        // No reverts expected
    }

    // ============ Edge Case Tests ============

    function test_EmitSegmentProcessed_EmptyUris() public {
        // Should still work (no validation)
        vm.prank(owner);
        segmentEvents.emitSegmentProcessed(
            segmentHash,
            "", // empty instrumental
            "", // empty alignment
            ""  // empty metadata
        );
    }

    function test_GetSegmentHash_EmptyTikTokId() public view {
        // Should still compute hash
        bytes32 hash = segmentEvents.getSegmentHash(GENIUS_SONG_1, "");
        assert(hash != bytes32(0));
    }

    // ============ Integration Tests ============

    function test_CompleteFlow() public {
        // 1. Register segment (before processing)
        vm.prank(owner);
        segmentEvents.emitSegmentRegistered(
            segmentHash,
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            METADATA_URI
        );

        // 2. Process segment (add audio assets)
        vm.prank(owner);
        segmentEvents.emitSegmentProcessed(
            segmentHash,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI,
            METADATA_URI
        );

        // 3. Disable segment
        vm.prank(owner);
        segmentEvents.emitSegmentToggled(segmentHash, false);

        // 4. Re-enable segment
        vm.prank(owner);
        segmentEvents.emitSegmentToggled(segmentHash, true);
    }

    function test_RegisterAndProcessMultipleSegments() public {
        for (uint32 i = 1; i <= 3; i++) {
            bytes32 hash = keccak256(abi.encodePacked(GENIUS_SONG_1, TIKTOK_SEGMENT_ID, i));

            // Register
            vm.prank(owner);
            segmentEvents.emitSegmentRegistered(
                hash,
                GENIUS_SONG_1,
                TIKTOK_SEGMENT_ID,
                METADATA_URI
            );

            // Process
            vm.prank(owner);
            segmentEvents.emitSegmentProcessed(
                hash,
                INSTRUMENTAL_URI,
                ALIGNMENT_URI,
                METADATA_URI
            );
        }
    }
}
