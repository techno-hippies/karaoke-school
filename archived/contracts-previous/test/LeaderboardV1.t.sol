// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/leaderboard/LeaderboardV1.sol";

contract LeaderboardV1Test is BaseTest {

    LeaderboardV1 public leaderboard;

    bytes32 public songId;
    bytes32 public segmentId;
    bytes32 public artistId;

    function setUp() public override {
        super.setUp();

        vm.startPrank(owner);
        leaderboard = new LeaderboardV1();
        leaderboard.setAuthorized(authorized, true);
        vm.stopPrank();

        // Generate test IDs
        songId = keccak256("song1");
        segmentId = keccak256("segment1");
        artistId = keccak256("artist1");
    }

    // ============ Constructor Tests ============

    function test_Constructor() public {
        assertEq(leaderboard.owner(), owner);
        assertTrue(leaderboard.isAuthorized(owner));
    }

    // ============ Update Score Tests ============

    function test_UpdateScore_Song() public {
        vm.prank(authorized);
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            8500
        );

        // Verify entry
        ILeaderboard.LeaderEntry memory entry = leaderboard.getStudentEntry(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1
        );

        assertEq(entry.student, user1);
        assertEq(entry.bestScore, 8500);
        assertEq(entry.totalAttempts, 1);
        assertGt(entry.lastUpdated, 0);
    }

    function test_UpdateScore_Improvement() public {
        vm.startPrank(authorized);

        // First attempt
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            7000
        );

        // Improved score
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            9000
        );

        vm.stopPrank();

        ILeaderboard.LeaderEntry memory entry = leaderboard.getStudentEntry(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1
        );

        assertEq(entry.bestScore, 9000); // Updated to better score
        assertEq(entry.totalAttempts, 2);
    }

    function test_RevertWhen_InvalidScore() public {
        vm.startPrank(authorized);

        vm.expectRevert(ILeaderboard.InvalidScore.selector);
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            10001 // > 10000
        );

        vm.stopPrank();
    }

    function test_RevertWhen_NotAuthorized_UpdateScore() public {
        vm.startPrank(user1);

        vm.expectRevert(ILeaderboard.NotAuthorized.selector);
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user2,
            8500
        );

        vm.stopPrank();
    }

    // ============ Top Students Tests ============

    function test_GetTopStudents_Single() public {
        vm.prank(authorized);
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            8500
        );

        ILeaderboard.LeaderEntry[] memory entries = leaderboard.getTopStudents(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            10
        );

        assertEq(entries.length, 1);
        assertEq(entries[0].student, user1);
        assertEq(entries[0].bestScore, 8500);
    }

    function test_GetTopStudents_Sorted() public {
        vm.startPrank(authorized);

        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            7000
        );

        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user2,
            9000
        );

        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user3,
            8000
        );

        vm.stopPrank();

        ILeaderboard.LeaderEntry[] memory entries = leaderboard.getTopStudents(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            10
        );

        assertEq(entries.length, 3);
        assertEq(entries[0].student, user2); // 9000 - highest
        assertEq(entries[1].student, user3); // 8000
        assertEq(entries[2].student, user1); // 7000 - lowest
    }

    // ============ Rank Tests ============

    function test_GetStudentRank_First() public {
        vm.startPrank(authorized);

        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            9000
        );

        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user2,
            8000
        );

        vm.stopPrank();

        (uint32 rank, ILeaderboard.LeaderEntry memory entry) = leaderboard.getStudentRank(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1
        );

        assertEq(rank, 1);
        assertEq(entry.student, user1);
        assertEq(entry.bestScore, 9000);
    }

    // ============ Admin Tests ============

    function test_SetAuthorized() public {
        assertFalse(leaderboard.isAuthorized(user1));

        vm.prank(owner);
        leaderboard.setAuthorized(user1, true);

        assertTrue(leaderboard.isAuthorized(user1));
    }

    function test_TransferOwnership() public {
        assertEq(leaderboard.owner(), owner);

        vm.prank(owner);
        leaderboard.transferOwnership(user1);

        assertEq(leaderboard.owner(), user1);
    }

    // ============ Integration Tests ============

    function test_MultipleLeaderboards() public {
        vm.startPrank(authorized);

        // Song leaderboard
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1,
            8500
        );

        // Segment leaderboard
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.SEGMENT,
            segmentId,
            user1,
            9000
        );

        // Artist leaderboard
        leaderboard.updateScore(
            ILeaderboard.LeaderboardType.ARTIST,
            artistId,
            user1,
            7500
        );

        vm.stopPrank();

        // Verify all three leaderboards are independent
        ILeaderboard.LeaderEntry memory songEntry = leaderboard.getStudentEntry(
            ILeaderboard.LeaderboardType.SONG,
            songId,
            user1
        );
        assertEq(songEntry.bestScore, 8500);

        ILeaderboard.LeaderEntry memory segmentEntry = leaderboard.getStudentEntry(
            ILeaderboard.LeaderboardType.SEGMENT,
            segmentId,
            user1
        );
        assertEq(segmentEntry.bestScore, 9000);

        ILeaderboard.LeaderEntry memory artistEntry = leaderboard.getStudentEntry(
            ILeaderboard.LeaderboardType.ARTIST,
            artistId,
            user1
        );
        assertEq(artistEntry.bestScore, 7500);
    }
}
