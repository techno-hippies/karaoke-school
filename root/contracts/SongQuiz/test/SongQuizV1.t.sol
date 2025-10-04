// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../SongQuizV1.sol";

/**
 * @title Mock StudyProgress Contract
 * @notice Simple mock for testing study gating
 */
contract MockStudyProgress {
    mapping(address => bool) public studiedToday;

    function setStudiedToday(address user, bool studied) external {
        studiedToday[user] = studied;
    }
}

/**
 * @title SongQuizV1 Test Harness
 * @notice Exposes internal functions for testing
 */
contract SongQuizV1Harness is SongQuizV1 {
    constructor(address _trustedQuizMaster, address _studyProgress)
        SongQuizV1(_trustedQuizMaster, _studyProgress)
    {}

    // Expose utility functions
    function exposed_getDayNumber(uint64 timestamp) external pure returns (uint256) {
        return getDayNumber(timestamp);
    }

    function exposed_getDailyCompletionHash(uint32 geniusId, address user, uint256 dayNumber)
        external
        pure
        returns (bytes32)
    {
        return getDailyCompletionHash(geniusId, user, dayNumber);
    }
}

/**
 * @title SongQuizV1 Unit Tests
 * @notice Comprehensive test suite for SongQuizV1 contract
 */
contract SongQuizV1Test is Test {
    SongQuizV1Harness public quiz;
    MockStudyProgress public studyProgress;

    address public owner = address(this);
    address public pkp = address(0x1234);
    address public user1 = address(0x5678);
    address public user2 = address(0x9ABC);

    // Test constants
    uint32 constant GENIUS_ID = 12345;
    uint32 constant GENIUS_ARTIST_ID = 67890;
    string constant SONG_NAME = "Heat of the Night";
    string constant ARTIST_NAME = "Scarlett X";

    // Events for testing
    event SongRegistered(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        string songName,
        string artistName,
        uint64 timestamp
    );

    event QuestionsAdded(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 startIndex,
        uint32 count,
        uint64 timestamp
    );

    event QuizCompleted(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        address indexed user,
        bool correct,
        uint32 questionIndex,
        uint64 timestamp,
        uint32 songStreak,
        uint32 songTotalCorrect,
        uint32 songTotalCompleted,
        bool isNewRecord,
        uint8 leaderboardPosition
    );

    event QuestionDisabled(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 questionIndex,
        uint64 timestamp
    );

    event QuestionEnabled(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 questionIndex,
        uint64 timestamp
    );

    event QuestionReplaced(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 questionIndex,
        uint64 timestamp
    );

    event UserProgressReset(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        address indexed user,
        uint64 timestamp
    );

    function setUp() public {
        studyProgress = new MockStudyProgress();
        quiz = new SongQuizV1Harness(pkp, address(studyProgress));
    }

    // ========================================================================
    // Setup State Tests
    // ========================================================================

    function test_SetUpState() public view {
        assertEq(quiz.owner(), owner, "Owner should be test contract");
        assertEq(quiz.trustedQuizMaster(), pkp, "PKP should be quiz master");
        assertEq(quiz.studyProgress(), address(studyProgress), "Study progress should be set");
        assertEq(quiz.TIME_LIMIT_SECONDS(), 15, "Time limit should be 15 seconds");
        assertFalse(quiz.paused(), "Contract should not be paused");
    }

    // ========================================================================
    // Song Registration Tests
    // ========================================================================

    function test_RegisterSong_Owner() public {
        vm.expectEmit(true, true, false, true);
        emit SongRegistered(GENIUS_ID, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME, uint64(block.timestamp));

        quiz.registerSong(GENIUS_ID, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);

        assertEq(quiz.songNames(GENIUS_ID), SONG_NAME, "Song name should be set");
        assertEq(quiz.songToArtist(GENIUS_ID), GENIUS_ARTIST_ID, "Artist ID should be mapped");
        assertEq(quiz.artistNames(GENIUS_ARTIST_ID), ARTIST_NAME, "Artist name should be set");

        uint32[] memory songs = quiz.getArtistSongs(GENIUS_ARTIST_ID);
        assertEq(songs.length, 1, "Artist should have 1 song");
        assertEq(songs[0], GENIUS_ID, "Song should be in artist's list");
    }

    function test_RegisterSong_PKP() public {
        vm.prank(pkp);
        quiz.registerSong(GENIUS_ID, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);

        assertEq(quiz.songNames(GENIUS_ID), SONG_NAME, "PKP should be able to register song");
    }

    function test_RevertIf_RegisterSong_Unauthorized() public {
        vm.prank(user1);
        vm.expectRevert("Not authorized");
        quiz.registerSong(GENIUS_ID, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);
    }

    function test_RevertIf_RegisterSong_AlreadyExists() public {
        quiz.registerSong(GENIUS_ID, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);

        vm.expectRevert("Song already registered");
        quiz.registerSong(GENIUS_ID, GENIUS_ARTIST_ID, "Different Song", "Different Artist");
    }

    function test_RevertIf_RegisterSong_InvalidID() public {
        vm.expectRevert("Invalid song ID");
        quiz.registerSong(0, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);

        vm.expectRevert("Invalid artist ID");
        quiz.registerSong(GENIUS_ID, 0, SONG_NAME, ARTIST_NAME);
    }

    // ========================================================================
    // Question Management Tests
    // ========================================================================

    function test_AddQuestions() public {
        quiz.registerSong(GENIUS_ID, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);

        string[] memory ciphertexts = new string[](2);
        ciphertexts[0] = "encrypted_question_1";
        ciphertexts[1] = "encrypted_question_2";

        string[] memory hashes = new string[](2);
        hashes[0] = "hash_1";
        hashes[1] = "hash_2";

        bytes32[] memory referentHashes = new bytes32[](2);
        referentHashes[0] = keccak256("referent_1");
        referentHashes[1] = keccak256("referent_2");

        vm.expectEmit(true, true, false, true);
        emit QuestionsAdded(GENIUS_ID, GENIUS_ARTIST_ID, 0, 2, uint64(block.timestamp));

        vm.prank(pkp);
        quiz.addQuestions(GENIUS_ID, ciphertexts, hashes, referentHashes);

        assertEq(quiz.questionCount(GENIUS_ID), 2, "Should have 2 questions");

        SongQuizV1.EncryptedQuestion memory q0 = quiz.getQuestion(GENIUS_ID, 0);
        assertEq(q0.ciphertext, "encrypted_question_1", "Question 0 ciphertext");
        assertTrue(q0.exists, "Question 0 should exist");
        assertTrue(q0.enabled, "Question 0 should be enabled");
    }

    function test_DisableQuestion() public {
        _setupQuestions();

        vm.expectEmit(true, true, false, true);
        emit QuestionDisabled(GENIUS_ID, GENIUS_ARTIST_ID, 0, uint64(block.timestamp));

        quiz.disableQuestion(GENIUS_ID, 0);

        SongQuizV1.EncryptedQuestion memory q = quiz.getQuestion(GENIUS_ID, 0);
        assertFalse(q.enabled, "Question should be disabled");
    }

    function test_EnableQuestion() public {
        _setupQuestions();
        quiz.disableQuestion(GENIUS_ID, 0);

        vm.expectEmit(true, true, false, true);
        emit QuestionEnabled(GENIUS_ID, GENIUS_ARTIST_ID, 0, uint64(block.timestamp));

        quiz.enableQuestion(GENIUS_ID, 0);

        SongQuizV1.EncryptedQuestion memory q = quiz.getQuestion(GENIUS_ID, 0);
        assertTrue(q.enabled, "Question should be enabled");
    }

    function test_ReplaceQuestion() public {
        _setupQuestions();

        vm.expectEmit(true, true, false, true);
        emit QuestionReplaced(GENIUS_ID, GENIUS_ARTIST_ID, 0, uint64(block.timestamp));

        quiz.replaceQuestion(GENIUS_ID, 0, "new_ciphertext", "new_hash");

        SongQuizV1.EncryptedQuestion memory q = quiz.getQuestion(GENIUS_ID, 0);
        assertEq(q.ciphertext, "new_ciphertext", "Ciphertext should be updated");
        assertEq(q.dataToEncryptHash, "new_hash", "Hash should be updated");
        assertTrue(q.enabled, "Replaced question should be enabled");
    }

    function test_RevertIf_DisableQuestion_NotOwner() public {
        _setupQuestions();

        vm.prank(user1);
        vm.expectRevert("Not owner");
        quiz.disableQuestion(GENIUS_ID, 0);
    }

    function test_RevertIf_DisableQuestion_AlreadyDisabled() public {
        _setupQuestions();
        quiz.disableQuestion(GENIUS_ID, 0);

        vm.expectRevert("Question already disabled");
        quiz.disableQuestion(GENIUS_ID, 0);
    }

    // ========================================================================
    // Quiz Completion Tests
    // ========================================================================

    function test_RecordQuizCompletion_FirstQuiz() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 10; // Within 15 second limit

        vm.expectEmit(true, true, true, true);
        emit QuizCompleted(
            GENIUS_ID,
            GENIUS_ARTIST_ID,
            user1,
            true, // correct
            0, // questionIndex
            uint64(block.timestamp),
            1, // streak (first quiz)
            1, // totalCorrect
            1, // totalCompleted
            false, // isNewRecord (first quiz doesn't count as record)
            0 // leaderboard position
        );

        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, submittedAt, questionShownAt);

        SongQuizV1.SongProgress memory progress = quiz.getUserProgress(GENIUS_ID, user1);
        assertEq(progress.questionsCompleted, 1, "Should have 1 completed");
        assertEq(progress.questionsCorrect, 1, "Should have 1 correct");
        assertEq(progress.currentStreak, 1, "Should have streak of 1");
        assertEq(progress.nextQuestionIndex, 1, "Next question should be 1");
    }

    function test_RecordQuizCompletion_IncorrectAnswer() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 10;

        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, false, submittedAt, questionShownAt);

        SongQuizV1.SongProgress memory progress = quiz.getUserProgress(GENIUS_ID, user1);
        assertEq(progress.questionsCompleted, 1, "Should have 1 completed");
        assertEq(progress.questionsCorrect, 0, "Should have 0 correct");
    }

    function test_RecordQuizCompletion_StreakIncrement() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        // Day 1: First quiz
        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        // Day 2: Next day quiz (increment streak)
        vm.warp(block.timestamp + 1 days);
        studyProgress.setStudiedToday(user1, true);

        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 1, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        SongQuizV1.SongProgress memory progress = quiz.getUserProgress(GENIUS_ID, user1);
        assertEq(progress.currentStreak, 2, "Streak should be 2");
        assertEq(progress.longestStreak, 2, "Longest streak should be 2");
    }

    function test_RecordQuizCompletion_StreakReset() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        // Day 1: First quiz
        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        // Day 3: Skipped day 2 (reset streak)
        vm.warp(block.timestamp + 2 days);
        studyProgress.setStudiedToday(user1, true);

        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 1, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        SongQuizV1.SongProgress memory progress = quiz.getUserProgress(GENIUS_ID, user1);
        assertEq(progress.currentStreak, 1, "Streak should reset to 1");
        assertEq(progress.longestStreak, 1, "Longest streak should still be 1");
    }

    function test_RevertIf_QuizCompletion_NotStudied() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, false);

        vm.prank(pkp);
        vm.expectRevert("Must study before quiz");
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));
    }

    function test_RevertIf_QuizCompletion_TimeLimitExceeded() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 16; // Over 15 second limit

        vm.prank(pkp);
        vm.expectRevert("Time limit exceeded");
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, submittedAt, questionShownAt);
    }

    function test_RevertIf_QuizCompletion_AlreadyCompletedToday() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        vm.prank(pkp);
        vm.expectRevert("Already completed quiz today for this song");
        quiz.recordQuizCompletion(GENIUS_ID, user1, 1, true, uint64(block.timestamp) + 5, uint64(block.timestamp));
    }

    function test_RevertIf_QuizCompletion_WrongSequence() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        vm.prank(pkp);
        vm.expectRevert("Must complete questions in order");
        quiz.recordQuizCompletion(GENIUS_ID, user1, 1, true, uint64(block.timestamp) + 5, uint64(block.timestamp));
    }

    function test_RevertIf_QuizCompletion_QuestionDisabled() public {
        _setupQuestions();
        quiz.disableQuestion(GENIUS_ID, 0);
        studyProgress.setStudiedToday(user1, true);

        vm.prank(pkp);
        vm.expectRevert("Question is disabled");
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));
    }

    // ========================================================================
    // Sequential Unlock with Disabled Questions Tests
    // ========================================================================

    function test_SequentialUnlock_SkipsDisabledQuestions() public {
        _setupQuestions();
        quiz.disableQuestion(GENIUS_ID, 1); // Disable question 1
        studyProgress.setStudiedToday(user1, true);

        // Complete question 0
        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        SongQuizV1.SongProgress memory progress = quiz.getUserProgress(GENIUS_ID, user1);
        assertEq(progress.nextQuestionIndex, 2, "Should skip disabled question 1, next should be 2");

        // Next day: Can complete question 2 directly (skipping disabled 1)
        vm.warp(block.timestamp + 1 days);
        studyProgress.setStudiedToday(user1, true);

        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 2, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        progress = quiz.getUserProgress(GENIUS_ID, user1);
        assertEq(progress.questionsCompleted, 2, "Should have 2 completed");
    }

    // ========================================================================
    // Artist Songs Pagination Tests
    // ========================================================================

    function test_GetArtistSongsPaginated() public {
        // Register multiple songs for same artist
        for (uint32 i = 0; i < 5; i++) {
            quiz.registerSong(GENIUS_ID + i, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);
        }

        // Get first 2
        (uint32[] memory songs, uint256 total) = quiz.getArtistSongsPaginated(GENIUS_ARTIST_ID, 0, 2);
        assertEq(total, 5, "Total should be 5");
        assertEq(songs.length, 2, "Should return 2 songs");
        assertEq(songs[0], GENIUS_ID, "First song should be correct");
        assertEq(songs[1], GENIUS_ID + 1, "Second song should be correct");

        // Get next 2
        (songs,) = quiz.getArtistSongsPaginated(GENIUS_ARTIST_ID, 2, 2);
        assertEq(songs.length, 2, "Should return 2 songs");
        assertEq(songs[0], GENIUS_ID + 2, "Third song should be correct");
    }

    // ========================================================================
    // User Progress Reset Tests
    // ========================================================================

    function test_ResetUserProgress() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);

        vm.prank(pkp);
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));

        vm.expectEmit(true, true, true, true);
        emit UserProgressReset(GENIUS_ID, GENIUS_ARTIST_ID, user1, uint64(block.timestamp));

        quiz.resetUserProgress(GENIUS_ID, user1);

        SongQuizV1.SongProgress memory progress = quiz.getUserProgress(GENIUS_ID, user1);
        assertEq(progress.questionsCompleted, 0, "Should be reset");
        assertEq(progress.currentStreak, 0, "Streak should be reset");
        assertEq(progress.nextQuestionIndex, 0, "Next question should be 0");
    }

    // ========================================================================
    // Utility Functions Tests
    // ========================================================================

    function test_GetDayNumber() public view {
        uint256 day = quiz.exposed_getDayNumber(uint64(block.timestamp));
        assertEq(day, block.timestamp / 1 days, "Day number calculation");
    }

    function test_GetDailyCompletionHash() public view {
        uint256 dayNumber = block.timestamp / 1 days;
        bytes32 hash = quiz.exposed_getDailyCompletionHash(GENIUS_ID, user1, dayNumber);
        bytes32 expected = keccak256(abi.encodePacked(GENIUS_ID, user1, dayNumber));
        assertEq(hash, expected, "Daily completion hash");
    }

    // ========================================================================
    // Admin Functions Tests
    // ========================================================================

    function test_SetStudyProgress() public {
        address newProgress = address(0xABCD);
        quiz.setStudyProgress(newProgress);
        assertEq(quiz.studyProgress(), newProgress, "Study progress should be updated");
    }

    function test_SetTrustedQuizMaster() public {
        address newPKP = address(0xDEAD);
        quiz.setTrustedQuizMaster(newPKP);
        assertEq(quiz.trustedQuizMaster(), newPKP, "Quiz master should be updated");
    }

    function test_Pause() public {
        quiz.pause();
        assertTrue(quiz.paused(), "Should be paused");
    }

    function test_Unpause() public {
        quiz.pause();
        quiz.unpause();
        assertFalse(quiz.paused(), "Should be unpaused");
    }

    function test_RevertIf_QuizCompletion_Paused() public {
        _setupQuestions();
        studyProgress.setStudiedToday(user1, true);
        quiz.pause();

        vm.prank(pkp);
        vm.expectRevert("Contract is paused");
        quiz.recordQuizCompletion(GENIUS_ID, user1, 0, true, uint64(block.timestamp) + 5, uint64(block.timestamp));
    }

    // ========================================================================
    // Helper Functions
    // ========================================================================

    function _setupQuestions() internal {
        quiz.registerSong(GENIUS_ID, GENIUS_ARTIST_ID, SONG_NAME, ARTIST_NAME);

        string[] memory ciphertexts = new string[](3);
        ciphertexts[0] = "q1";
        ciphertexts[1] = "q2";
        ciphertexts[2] = "q3";

        string[] memory hashes = new string[](3);
        hashes[0] = "h1";
        hashes[1] = "h2";
        hashes[2] = "h3";

        bytes32[] memory referentHashes = new bytes32[](3);
        referentHashes[0] = keccak256("r1");
        referentHashes[1] = keccak256("r2");
        referentHashes[2] = keccak256("r3");

        vm.prank(pkp);
        quiz.addQuestions(GENIUS_ID, ciphertexts, hashes, referentHashes);
    }
}
