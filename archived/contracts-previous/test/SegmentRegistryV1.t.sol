// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/core/ArtistRegistryV1.sol";
import "../src/core/SongRegistryV1.sol";
import "../src/core/SegmentRegistryV1.sol";

contract SegmentRegistryV1Test is BaseTest {

    ArtistRegistryV1 public artistRegistry;
    SongRegistryV1 public songRegistry;
    SegmentRegistryV1 public segmentRegistry;

    bytes32 public segmentHash;

    event SegmentRegistered(
        bytes32 indexed segmentHash,
        uint32 indexed geniusId,
        string tiktokSegmentId,
        uint32 startTime,
        uint32 endTime
    );

    event SegmentProcessed(
        bytes32 indexed segmentHash,
        string vocalsUri,
        string instrumentalUri,
        string alignmentUri
    );

    function setUp() public override {
        super.setUp();

        vm.startPrank(owner);

        // Deploy registries
        artistRegistry = new ArtistRegistryV1();
        artistRegistry.setAuthorized(authorized, true);

        songRegistry = new SongRegistryV1(address(artistRegistry));
        songRegistry.setAuthorized(authorized, true);

        segmentRegistry = new SegmentRegistryV1(address(songRegistry));
        segmentRegistry.setAuthorized(authorized, true);

        vm.stopPrank();

        // Register test artist and song
        vm.startPrank(authorized);
        artistRegistry.registerArtist(GENIUS_ARTIST_1, pkp1, LENS_HANDLE_1, lensAccount1);
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

        // Pre-calculate segment hash
        segmentHash = generateSegmentHash(GENIUS_SONG_1, TIKTOK_SEGMENT_ID);
    }

    // ============ Constructor Tests ============

    function test_Constructor() public {
        assertEq(segmentRegistry.owner(), owner);
        assertTrue(segmentRegistry.isAuthorized(owner));
        assertEq(address(segmentRegistry.songRegistry()), address(songRegistry));
    }

    // ============ Phase 1: Registration Tests ============

    function test_RegisterSegment() public {
        vm.startPrank(authorized);

        vm.expectEmit(true, true, false, true);
        emit SegmentRegistered(segmentHash, GENIUS_SONG_1, TIKTOK_SEGMENT_ID, SEGMENT_START, SEGMENT_END);

        bytes32 returnedHash = segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        vm.stopPrank();

        assertEq(returnedHash, segmentHash);

        // Verify segment registered
        ISegmentRegistry.Segment memory segment = segmentRegistry.getSegment(segmentHash);

        assertEq(segment.geniusId, GENIUS_SONG_1);
        assertEq(segment.tiktokSegmentId, TIKTOK_SEGMENT_ID);
        assertEq(segment.startTime, SEGMENT_START);
        assertEq(segment.endTime, SEGMENT_END);
        assertEq(segment.coverUri, COVER_URI);
        assertEq(segment.vocalsUri, "");
        assertEq(segment.instrumentalUri, "");
        assertEq(segment.alignmentUri, "");
        assertFalse(segment.processed);
        assertGt(segment.createdAt, 0);
    }

    function test_RevertWhen_SegmentAlreadyExists() public {
        vm.startPrank(authorized);

        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ISegmentRegistry.SegmentAlreadyExists.selector,
                segmentHash
            )
        );
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        vm.stopPrank();
    }

    function test_RevertWhen_SongNotFound() public {
        vm.startPrank(authorized);

        vm.expectRevert(
            abi.encodeWithSelector(
                ISegmentRegistry.SongNotFound.selector,
                999999
            )
        );
        segmentRegistry.registerSegment(
            999999, // non-existent song
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        vm.stopPrank();
    }

    function test_RevertWhen_InvalidTimeRange() public {
        vm.startPrank(authorized);

        vm.expectRevert(ISegmentRegistry.InvalidTimeRange.selector);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            100, // start > end
            90,
            COVER_URI
        );

        vm.stopPrank();
    }

    function test_RevertWhen_NotAuthorized_Register() public {
        vm.startPrank(user1);

        vm.expectRevert(ISegmentRegistry.NotAuthorized.selector);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        vm.stopPrank();
    }

    // ============ Phase 2: Processing Tests ============

    function test_ProcessSegment() public {
        vm.startPrank(authorized);

        // Phase 1: Register
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        // Phase 2: Process
        vm.expectEmit(true, false, false, true);
        emit SegmentProcessed(segmentHash, VOCALS_URI, INSTRUMENTAL_URI, ALIGNMENT_URI);

        segmentRegistry.processSegment(
            segmentHash,
            VOCALS_URI,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI
        );

        vm.stopPrank();

        // Verify processing complete
        ISegmentRegistry.Segment memory segment = segmentRegistry.getSegment(segmentHash);

        assertEq(segment.vocalsUri, VOCALS_URI);
        assertEq(segment.instrumentalUri, INSTRUMENTAL_URI);
        assertEq(segment.alignmentUri, ALIGNMENT_URI);
        assertTrue(segment.processed);
    }

    function test_RevertWhen_SegmentNotFound_Process() public {
        vm.startPrank(authorized);

        bytes32 fakeHash = keccak256("fake");

        vm.expectRevert(
            abi.encodeWithSelector(
                ISegmentRegistry.SegmentNotFound.selector,
                fakeHash
            )
        );
        segmentRegistry.processSegment(
            fakeHash,
            VOCALS_URI,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI
        );

        vm.stopPrank();
    }

    // Note: Contract allows reprocessing segments (no AlreadyProcessed error)

    function test_RevertWhen_NotAuthorized_Process() public {
        vm.prank(authorized);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        vm.startPrank(user1);
        vm.expectRevert(ISegmentRegistry.NotAuthorized.selector);
        segmentRegistry.processSegment(
            segmentHash,
            VOCALS_URI,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI
        );
        vm.stopPrank();
    }

    // ============ Query Tests ============

    function test_GetSegment() public {
        vm.startPrank(authorized);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );
        vm.stopPrank();

        ISegmentRegistry.Segment memory segment = segmentRegistry.getSegment(segmentHash);

        assertEq(segment.geniusId, GENIUS_SONG_1);
        assertEq(segment.tiktokSegmentId, TIKTOK_SEGMENT_ID);
    }

    function test_GetSegmentsBySong() public {
        vm.startPrank(authorized);

        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            "segment2",
            100,
            130,
            COVER_URI
        );

        vm.stopPrank();

        bytes32[] memory segments = segmentRegistry.getSegmentsBySong(GENIUS_SONG_1);
        assertEq(segments.length, 2);
    }

    function test_SegmentExists() public {
        assertFalse(segmentRegistry.segmentExists(segmentHash));

        vm.prank(authorized);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        assertTrue(segmentRegistry.segmentExists(segmentHash));
    }

    function test_IsProcessed() public {
        vm.startPrank(authorized);

        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        ISegmentRegistry.Segment memory segment = segmentRegistry.getSegment(segmentHash);
        assertFalse(segment.processed);

        segmentRegistry.processSegment(
            segmentHash,
            VOCALS_URI,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI
        );

        segment = segmentRegistry.getSegment(segmentHash);
        assertTrue(segment.processed);

        vm.stopPrank();
    }

    function test_GetTotalSegments() public {
        assertEq(segmentRegistry.totalSegments(), 0);

        vm.startPrank(authorized);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );
        assertEq(segmentRegistry.totalSegments(), 1);
        vm.stopPrank();
    }

    // ============ Admin Tests ============

    function test_ToggleEnabled() public {
        vm.prank(authorized);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        ISegmentRegistry.Segment memory segment = segmentRegistry.getSegment(segmentHash);
        assertTrue(segment.enabled);

        vm.prank(owner);
        segmentRegistry.toggleSegment(segmentHash, false);

        segment = segmentRegistry.getSegment(segmentHash);
        assertFalse(segment.enabled);

        vm.prank(owner);
        segmentRegistry.toggleSegment(segmentHash, true);

        segment = segmentRegistry.getSegment(segmentHash);
        assertTrue(segment.enabled);
    }

    function test_RevertWhen_ToggleEnabled_NotOwner() public {
        vm.prank(authorized);
        segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        vm.startPrank(user1);
        vm.expectRevert(ISegmentRegistry.NotOwner.selector);
        segmentRegistry.toggleSegment(segmentHash, false);
        vm.stopPrank();
    }

    function test_SetAuthorized() public {
        assertFalse(segmentRegistry.isAuthorized(user1));

        vm.prank(owner);
        segmentRegistry.setAuthorized(user1, true);

        assertTrue(segmentRegistry.isAuthorized(user1));
    }

    function test_TransferOwnership() public {
        assertEq(segmentRegistry.owner(), owner);

        vm.prank(owner);
        segmentRegistry.transferOwnership(user1);

        assertEq(segmentRegistry.owner(), user1);
    }

    // ============ Integration Tests ============

    function test_FullSegmentLifecycle() public {
        vm.startPrank(authorized);

        // Phase 1: Register segment
        bytes32 hash = segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );

        assertTrue(segmentRegistry.segmentExists(hash));

        ISegmentRegistry.Segment memory segment = segmentRegistry.getSegment(hash);
        assertFalse(segment.processed);

        // Phase 2: Process segment
        segmentRegistry.processSegment(
            hash,
            VOCALS_URI,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI
        );

        segment = segmentRegistry.getSegment(hash);
        assertTrue(segment.processed);

        // Verify complete data

        assertEq(segment.geniusId, GENIUS_SONG_1);
        assertEq(segment.tiktokSegmentId, TIKTOK_SEGMENT_ID);
        assertEq(segment.startTime, SEGMENT_START);
        assertEq(segment.endTime, SEGMENT_END);
        assertEq(segment.coverUri, COVER_URI);
        assertEq(segment.vocalsUri, VOCALS_URI);
        assertEq(segment.instrumentalUri, INSTRUMENTAL_URI);
        assertEq(segment.alignmentUri, ALIGNMENT_URI);
        assertTrue(segment.processed);
        assertGt(segment.createdAt, 0);

        vm.stopPrank();
    }
}
