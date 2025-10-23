// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/core/ArtistRegistryV1.sol";
import "../src/core/SongRegistryV1.sol";
import "../src/core/SegmentRegistryV1.sol";
import "../src/core/PerformanceRegistryV1.sol";

contract PerformanceRegistryV1Test is BaseTest {

    ArtistRegistryV1 public artistRegistry;
    SongRegistryV1 public songRegistry;
    SegmentRegistryV1 public segmentRegistry;
    PerformanceRegistryV1 public performanceRegistry;

    bytes32 public segmentHash;

    event PerformanceSubmitted(
        uint256 indexed performanceId,
        bytes32 indexed segmentHash,
        address indexed student,
        string videoUri
    );

    event PerformanceGraded(
        uint256 indexed performanceId,
        uint16 score,
        string gradeUri
    );

    function setUp() public override {
        super.setUp();

        vm.startPrank(owner);

        // Deploy all registries
        artistRegistry = new ArtistRegistryV1();
        artistRegistry.setAuthorized(authorized, true);

        songRegistry = new SongRegistryV1(address(artistRegistry));
        songRegistry.setAuthorized(authorized, true);

        segmentRegistry = new SegmentRegistryV1(address(songRegistry));
        segmentRegistry.setAuthorized(authorized, true);

        performanceRegistry = new PerformanceRegistryV1(address(segmentRegistry));
        performanceRegistry.setAuthorized(authorized, true);

        vm.stopPrank();

        // Setup test data
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
        segmentHash = segmentRegistry.registerSegment(
            GENIUS_SONG_1,
            TIKTOK_SEGMENT_ID,
            SEGMENT_START,
            SEGMENT_END,
            COVER_URI
        );
        segmentRegistry.processSegment(
            segmentHash,
            VOCALS_URI,
            INSTRUMENTAL_URI,
            ALIGNMENT_URI
        );
        vm.stopPrank();
    }

    // ============ Constructor Tests ============

    function test_Constructor() public {
        assertEq(performanceRegistry.owner(), owner);
        assertTrue(performanceRegistry.isAuthorized(owner));
        assertEq(
            address(performanceRegistry.segmentRegistry()),
            address(segmentRegistry)
        );
    }

    // ============ Submit Performance Tests ============

    function test_SubmitPerformance() public {
        vm.startPrank(user1);

        vm.expectEmit(true, true, true, true);
        emit PerformanceSubmitted(1, segmentHash, user1, VIDEO_URI);

        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        vm.stopPrank();

        assertEq(performanceId, 1);

        // Verify performance
        IPerformanceRegistry.Performance memory perf = performanceRegistry.getPerformance(performanceId);

        assertEq(perf.performanceId, performanceId);
        assertEq(perf.segmentHash, segmentHash);
        assertEq(perf.student, user1);
        assertEq(perf.videoUri, VIDEO_URI);
        assertEq(perf.audioUri, AUDIO_URI);
        assertEq(perf.score, 0);
        assertEq(perf.gradeUri, "");
        assertFalse(perf.graded);
        assertGt(perf.createdAt, 0);
        assertEq(perf.gradedAt, 0);
    }

    function test_SubmitMultiplePerformances() public {
        vm.startPrank(user1);
        uint256 id1 = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );
        uint256 id2 = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );
        vm.stopPrank();

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(performanceRegistry.totalPerformances(), 2);
    }

    function test_RevertWhen_SegmentNotFound_Submit() public {
        bytes32 fakeHash = keccak256("fake");

        vm.startPrank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                IPerformanceRegistry.SegmentNotFound.selector,
                fakeHash
            )
        );
        performanceRegistry.submitPerformance(
            fakeHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );
        vm.stopPrank();
    }

    function test_RevertWhen_InvalidStudent() public {
        vm.startPrank(user1);
        vm.expectRevert(IPerformanceRegistry.InvalidStudent.selector);
        performanceRegistry.submitPerformance(
            segmentHash,
            address(0),
            VIDEO_URI,
            AUDIO_URI
        );
        vm.stopPrank();
    }

    // ============ Grade Performance Tests ============

    function test_GradePerformance() public {
        // Submit performance
        vm.prank(user1);
        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        // Grade performance
        uint16 score = 8500; // 85%

        vm.startPrank(authorized);
        vm.expectEmit(true, false, false, true);
        emit PerformanceGraded(performanceId, score, "lens://grade1");

        performanceRegistry.gradePerformance(
            performanceId,
            score,
            "lens://grade1"
        );
        vm.stopPrank();

        // Verify grading
        IPerformanceRegistry.Performance memory perf = performanceRegistry.getPerformance(performanceId);

        assertTrue(perf.graded);
        assertEq(perf.gradeUri, "lens://grade1");
        assertEq(perf.score, score);
        assertGt(perf.gradedAt, 0);
    }

    function test_RevertWhen_PerformanceNotFound_Grade() public {
        vm.startPrank(authorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                IPerformanceRegistry.PerformanceNotFound.selector,
                999
            )
        );
        performanceRegistry.gradePerformance(999, 8500, "lens://grade1");
        vm.stopPrank();
    }

    function test_RevertWhen_AlreadyGraded() public {
        vm.prank(user1);
        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        vm.startPrank(authorized);
        performanceRegistry.gradePerformance(performanceId, 8500, "lens://grade1");

        vm.expectRevert(
            abi.encodeWithSelector(
                IPerformanceRegistry.AlreadyGraded.selector,
                performanceId
            )
        );
        performanceRegistry.gradePerformance(performanceId, 9000, "lens://grade2");
        vm.stopPrank();
    }

    function test_RevertWhen_InvalidScore() public {
        vm.prank(user1);
        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        vm.startPrank(authorized);
        vm.expectRevert(IPerformanceRegistry.InvalidScore.selector);
        performanceRegistry.gradePerformance(
            performanceId,
            10001, // > 10000
            "lens://grade1"
        );
        vm.stopPrank();
    }

    function test_RevertWhen_NotAuthorized_Grade() public {
        vm.prank(user1);
        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        vm.startPrank(user2);
        vm.expectRevert(IPerformanceRegistry.NotAuthorized.selector);
        performanceRegistry.gradePerformance(performanceId, 8500, "lens://grade1");
        vm.stopPrank();
    }

    // ============ Query Tests ============

    function test_GetPerformance() public {
        vm.prank(user1);
        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        IPerformanceRegistry.Performance memory perf = performanceRegistry.getPerformance(performanceId);

        assertEq(perf.segmentHash, segmentHash);
        assertEq(perf.student, user1);
    }

    function test_GetPerformancesByStudent() public {
        vm.startPrank(user1);
        performanceRegistry.submitPerformance(segmentHash, user1, VIDEO_URI, AUDIO_URI);
        performanceRegistry.submitPerformance(segmentHash, user1, VIDEO_URI, AUDIO_URI);
        vm.stopPrank();

        uint256[] memory performances = performanceRegistry.getPerformancesByStudent(user1);

        assertEq(performances.length, 2);
    }

    function test_GetPerformancesBySegment() public {
        vm.startPrank(user1);
        performanceRegistry.submitPerformance(segmentHash, user1, VIDEO_URI, AUDIO_URI);
        vm.stopPrank();

        vm.startPrank(user2);
        performanceRegistry.submitPerformance(segmentHash, user2, VIDEO_URI, AUDIO_URI);
        vm.stopPrank();

        uint256[] memory performances = performanceRegistry.getPerformancesBySegment(segmentHash);

        assertEq(performances.length, 2);
    }

    function test_GetTopPerformancesBySegment() public {
        // Submit and grade multiple performances
        vm.prank(user1);
        uint256 id1 = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        vm.prank(user2);
        uint256 id2 = performanceRegistry.submitPerformance(
            segmentHash,
            user2,
            VIDEO_URI,
            AUDIO_URI
        );

        vm.prank(user3);
        uint256 id3 = performanceRegistry.submitPerformance(
            segmentHash,
            user3,
            VIDEO_URI,
            AUDIO_URI
        );

        // Grade with different scores
        vm.startPrank(authorized);
        performanceRegistry.gradePerformance(id1, 7000, "lens://grade1");
        performanceRegistry.gradePerformance(id2, 9000, "lens://grade2"); // Best
        performanceRegistry.gradePerformance(id3, 8000, "lens://grade3");
        vm.stopPrank();

        IPerformanceRegistry.Performance[] memory topPerformances = performanceRegistry.getTopPerformancesBySegment(
            segmentHash,
            3
        );

        assertEq(topPerformances.length, 3);
        assertEq(topPerformances[0].performanceId, id2); // Best score first
        assertEq(topPerformances[0].score, 9000);
    }

    function test_PerformanceExists() public {
        assertFalse(performanceRegistry.performanceExists(1));

        vm.prank(user1);
        performanceRegistry.submitPerformance(segmentHash, user1, VIDEO_URI, AUDIO_URI);

        assertTrue(performanceRegistry.performanceExists(1));
    }

    function test_IsGraded() public {
        vm.prank(user1);
        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        IPerformanceRegistry.Performance memory perf = performanceRegistry.getPerformance(performanceId);
        assertFalse(perf.graded);

        vm.prank(authorized);
        performanceRegistry.gradePerformance(performanceId, 8500, "lens://grade1");

        perf = performanceRegistry.getPerformance(performanceId);
        assertTrue(perf.graded);
    }

    function test_GetTotalPerformances() public {
        assertEq(performanceRegistry.totalPerformances(), 0);

        vm.startPrank(user1);
        performanceRegistry.submitPerformance(segmentHash, user1, VIDEO_URI, AUDIO_URI);
        assertEq(performanceRegistry.totalPerformances(), 1);

        performanceRegistry.submitPerformance(segmentHash, user1, VIDEO_URI, AUDIO_URI);
        assertEq(performanceRegistry.totalPerformances(), 2);
        vm.stopPrank();
    }

    // ============ Admin Tests ============

    function test_SetAuthorized() public {
        assertFalse(performanceRegistry.isAuthorized(user1));

        vm.prank(owner);
        performanceRegistry.setAuthorized(user1, true);

        assertTrue(performanceRegistry.isAuthorized(user1));
    }

    function test_TransferOwnership() public {
        assertEq(performanceRegistry.owner(), owner);

        vm.prank(owner);
        performanceRegistry.transferOwnership(user1);

        assertEq(performanceRegistry.owner(), user1);
    }

    // ============ Integration Tests ============

    function test_FullPerformanceLifecycle() public {
        // Submit performance
        vm.prank(user1);
        uint256 performanceId = performanceRegistry.submitPerformance(
            segmentHash,
            user1,
            VIDEO_URI,
            AUDIO_URI
        );

        assertEq(performanceId, 1);
        assertTrue(performanceRegistry.performanceExists(performanceId));

        IPerformanceRegistry.Performance memory perf = performanceRegistry.getPerformance(performanceId);
        assertFalse(perf.graded);

        // Grade performance
        vm.prank(authorized);
        performanceRegistry.gradePerformance(performanceId, 8500, "lens://grade1");

        perf = performanceRegistry.getPerformance(performanceId);
        assertTrue(perf.graded);

        // Verify complete data
        assertEq(perf.segmentHash, segmentHash);
        assertEq(perf.student, user1);
        assertEq(perf.videoUri, VIDEO_URI);
        assertEq(perf.audioUri, AUDIO_URI);
        assertEq(perf.score, 8500);
        assertEq(perf.gradeUri, "lens://grade1");
        assertTrue(perf.graded);
        assertGt(perf.createdAt, 0);
        assertGt(perf.gradedAt, 0);
    }
}
