// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../StudyProgress/StudyProgressV1.sol";
import "../SongQuiz/SongQuizV1.sol";
import "../SongCatalog/SongCatalogV1.sol";

/**
 * @title Integration Test Suite
 * @notice Tests integration between StudyProgress, SongQuiz, and SongCatalog
 */
contract IntegrationTest is Test {
    StudyProgressV1 public studyProgress;
    SongQuizV1 public songQuiz;
    SongCatalogV1 public songCatalog;

    address public owner;
    address public pkp;
    address public user;

    uint32 constant GENIUS_ID_1 = 123456;
    uint32 constant GENIUS_ARTIST_ID_1 = 789;
    string constant SONG_ID_1 = "test-song";
    string constant TITLE_1 = "Test Song";
    string constant ARTIST_1 = "Test Artist";

    function setUp() public {
        owner = address(this);
        pkp = address(0x1);
        user = address(0x2);

        studyProgress = new StudyProgressV1(pkp);
        songQuiz = new SongQuizV1(pkp, address(studyProgress));
        songCatalog = new SongCatalogV1();

        // Start at a reasonable timestamp to avoid underflow
        vm.warp(1000);
    }

    function addSingleQuestion(uint32 geniusId) internal {
        string[] memory c = new string[](1);
        c[0] = "cipher";
        string[] memory h = new string[](1);
        h[0] = "hash";
        bytes32[] memory r = new bytes32[](1);
        r[0] = keccak256("ref");
        vm.prank(pkp);
        songQuiz.addQuestions(geniusId, c, h, r);
    }

    // ========================================================================
    // Study Gating Tests
    // ========================================================================

    function test_Integration_QuizRequiresStudy() public {
        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);
        addSingleQuestion(GENIUS_ID_1);

        vm.warp(block.timestamp + 100); // Ensure timestamp is large enough

        vm.prank(pkp);
        vm.expectRevert("Must study before quiz");
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 0, true, uint64(block.timestamp), uint64(block.timestamp - 10));
    }

    function test_Integration_StudyUnlocksQuiz() public {
        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);
        addSingleQuestion(GENIUS_ID_1);

        vm.prank(pkp);
        studyProgress.recordStudySession(user, 1, "song-id", 10, 85);

        assertTrue(studyProgress.studiedToday(user));

        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 0, true, uint64(block.timestamp), uint64(block.timestamp - 10));

        SongQuizV1.SongProgress memory progress = songQuiz.getUserProgress(GENIUS_ID_1, user);
        assertEq(progress.questionsCompleted, 1);
        assertEq(progress.questionsCorrect, 1);
    }

    function test_Integration_StudyGatingResetsDaily() public {
        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);

        // Add 2 questions so we can test sequential progression
        string[] memory c = new string[](2);
        c[0] = "q1"; c[1] = "q2";
        string[] memory h = new string[](2);
        h[0] = "h1"; h[1] = "h2";
        bytes32[] memory r = new bytes32[](2);
        r[0] = keccak256("r1"); r[1] = keccak256("r2");
        vm.prank(pkp);
        songQuiz.addQuestions(GENIUS_ID_1, c, h, r);

        // Day 1
        vm.prank(pkp);
        studyProgress.recordStudySession(user, 1, "song", 10, 85);

        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 0, true, uint64(block.timestamp), uint64(block.timestamp - 10));

        // Day 2 - no study, try question 1 (next in sequence)
        vm.warp(block.timestamp + 1 days);
        assertFalse(studyProgress.studiedToday(user));

        vm.prank(pkp);
        vm.expectRevert("Must study before quiz");
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 1, true, uint64(block.timestamp), uint64(block.timestamp - 10));

        // Study again
        vm.prank(pkp);
        studyProgress.recordStudySession(user, 1, "song", 10, 90);

        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 1, true, uint64(block.timestamp), uint64(block.timestamp - 10));
    }

    // ========================================================================
    // Catalog Cross-Reference Tests
    // ========================================================================

    function test_Integration_CatalogAndQuizGeniusIds() public {
        songCatalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, 194,
            "lens://audio", "lens://meta", "lens://cover", "lens://thumb", "",
            "seg1", "en"
        );

        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);

        SongCatalogV1.Song memory song = songCatalog.getSongByGeniusId(GENIUS_ID_1);
        assertEq(song.geniusId, GENIUS_ID_1);
        assertEq(song.geniusArtistId, GENIUS_ARTIST_ID_1);
        assertTrue(bytes(songQuiz.songNames(GENIUS_ID_1)).length > 0);
    }

    function test_Integration_MultipleContracts_SamePKP() public {
        assertEq(studyProgress.trustedTracker(), pkp);
        assertEq(songQuiz.trustedQuizMaster(), pkp);

        vm.startPrank(pkp);
        studyProgress.recordStudySession(user, 1, "song", 10, 85);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);
        vm.stopPrank();

        assertTrue(studyProgress.studiedToday(user));
        assertTrue(bytes(songQuiz.songNames(GENIUS_ID_1)).length > 0);
    }

    // ========================================================================
    // End-to-End Flow
    // ========================================================================

    function test_Integration_FullUserJourney() public {
        // Setup catalog
        songCatalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, 194,
            "lens://a", "lens://m", "lens://c", "lens://t", "", "s1", "en"
        );

        // Setup quiz
        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);

        string[] memory c = new string[](3);
        c[0] = "q1"; c[1] = "q2"; c[2] = "q3";
        string[] memory h = new string[](3);
        h[0] = "h1"; h[1] = "h2"; h[2] = "h3";
        bytes32[] memory r = new bytes32[](3);
        r[0] = keccak256("r1"); r[1] = keccak256("r2"); r[2] = keccak256("r3");
        vm.prank(pkp);
        songQuiz.addQuestions(GENIUS_ID_1, c, h, r);

        // Day 1: Study + Quiz
        vm.prank(pkp);
        studyProgress.recordStudySession(user, 0, SONG_ID_1, 10, 85);

        StudyProgressV1.StudyStats memory stats1 = studyProgress.getUserStats(user);
        assertEq(stats1.currentStreak, 1);

        // Complete one question (daily limit is 1 quiz per song per day)
        uint64 t1 = uint64(block.timestamp);
        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 0, true, t1, t1 - 10);

        SongQuizV1.SongProgress memory quiz1 = songQuiz.getUserProgress(GENIUS_ID_1, user);
        assertEq(quiz1.questionsCompleted, 1);
        assertEq(quiz1.questionsCorrect, 1);

        // Day 2 - Study again to maintain streak
        vm.warp(block.timestamp + 1 days);
        vm.prank(pkp);
        studyProgress.recordStudySession(user, 0, SONG_ID_1, 15, 90);

        StudyProgressV1.StudyStats memory stats2 = studyProgress.getUserStats(user);
        assertEq(stats2.currentStreak, 2);
        assertEq(stats2.totalSessions, 2);

        // Note: Can't do same quiz again on Day 2 due to daily limit per song
        // This is correct behavior - each song quiz is once per day
    }

    function test_Integration_MultipleUsers() public {
        address user2 = address(0x3);

        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);
        addSingleQuestion(GENIUS_ID_1);

        // User 1
        uint64 time1 = uint64(block.timestamp);
        vm.prank(pkp);
        studyProgress.recordStudySession(user, 1, "s", 10, 85);
        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 0, true, time1, time1 - 10);

        // User 2 (different time)
        vm.warp(block.timestamp + 1 hours);
        uint64 time2 = uint64(block.timestamp);
        vm.prank(pkp);
        studyProgress.recordStudySession(user2, 1, "s", 15, 90);
        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user2, 0, false, time2, time2 - 14);

        StudyProgressV1.StudyStats memory s1 = studyProgress.getUserStats(user);
        StudyProgressV1.StudyStats memory s2 = studyProgress.getUserStats(user2);
        assertEq(s1.totalSessions, 1);
        assertEq(s2.totalSessions, 1);

        SongQuizV1.SongProgress memory q1 = songQuiz.getUserProgress(GENIUS_ID_1, user);
        SongQuizV1.SongProgress memory q2 = songQuiz.getUserProgress(GENIUS_ID_1, user2);
        assertEq(q1.questionsCorrect, 1);
        assertEq(q2.questionsCorrect, 0);
    }

    // ========================================================================
    // Edge Cases
    // ========================================================================

    function test_Integration_PausedStudyProgress() public {
        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);
        addSingleQuestion(GENIUS_ID_1);

        vm.prank(pkp);
        studyProgress.recordStudySession(user, 1, "s", 10, 85);

        studyProgress.pause();
        assertTrue(studyProgress.studiedToday(user));

        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 0, true, uint64(block.timestamp), uint64(block.timestamp - 10));

        vm.prank(pkp);
        vm.expectRevert("Contract is paused");
        studyProgress.recordStudySession(user, 1, "s", 10, 85);
    }

    function test_Integration_DisabledCatalogSong() public {
        songCatalog.addSong(
            SONG_ID_1, GENIUS_ID_1, GENIUS_ARTIST_ID_1,
            TITLE_1, ARTIST_1, 194,
            "lens://a", "lens://m", "lens://c", "lens://t", "", "s", "en"
        );

        vm.prank(pkp);
        songQuiz.registerSong(GENIUS_ID_1, GENIUS_ARTIST_ID_1, TITLE_1, ARTIST_1);
        addSingleQuestion(GENIUS_ID_1);

        songCatalog.toggleSong(SONG_ID_1, false);

        vm.prank(pkp);
        studyProgress.recordStudySession(user, 1, "s", 10, 85);

        vm.prank(pkp);
        songQuiz.recordQuizCompletion(GENIUS_ID_1, user, 0, true, uint64(block.timestamp), uint64(block.timestamp - 10));

        SongQuizV1.SongProgress memory p = songQuiz.getUserProgress(GENIUS_ID_1, user);
        assertEq(p.questionsCorrect, 1);
    }
}
