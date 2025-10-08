// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../SongQuizV2.sol";

/**
 * @title MockStudyProgress
 * @notice Mock contract for testing study gating
 */
contract MockStudyProgress {
    mapping(address => bool) public studied;

    function setStudied(address user, bool hasStudied) external {
        studied[user] = hasStudied;
    }

    function studiedToday(address user) external view returns (bool) {
        return studied[user];
    }
}

/**
 * @title SongQuizV2Test
 * @notice Comprehensive tests for SongQuizV2 translation system and access control
 */
contract SongQuizV2Test is Test {
    SongQuizV2 public quiz;
    MockStudyProgress public studyProgress;

    address public owner;
    address public pkp;       // PKP address (trustedQuizMaster)
    address public alice;     // Regular user
    address public bob;       // Regular user

    uint32 constant SONG_ID = 90986;
    uint32 constant ARTIST_ID = 1;
    bytes32 constant REFERENT_HASH_1 = keccak256("genius:31095951");
    bytes32 constant REFERENT_HASH_2 = keccak256("genius:10304915");

    function setUp() public {
        owner = address(this);
        pkp = makeAddr("pkp");
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        // Deploy mock study progress
        studyProgress = new MockStudyProgress();

        // Deploy SongQuizV2
        quiz = new SongQuizV2(pkp, address(studyProgress));

        // Register song
        quiz.registerSong(SONG_ID, ARTIST_ID, "Skyfall", "Adele");
    }

    // ========================================================================
    // Test: Translation System
    // ========================================================================

    function test_AddQuestionWithTranslations() public {
        // Prepare translations (Vietnamese + Mandarin)
        string[] memory langs = new string[](2);
        langs[0] = "vi";
        langs[1] = "zh-CN";

        string[] memory ciphertexts = new string[](2);
        ciphertexts[0] = "encrypted_vietnamese_question";
        ciphertexts[1] = "encrypted_mandarin_question";

        string[] memory hashes = new string[](2);
        hashes[0] = "hash_vi";
        hashes[1] = "hash_zh";

        // Add question with translations (as PKP)
        vm.prank(pkp);
        quiz.addQuestionWithTranslations(SONG_ID, REFERENT_HASH_1, langs, ciphertexts, hashes);

        // Verify question exists
        SongQuizV2.Question memory q = quiz.getQuestion(SONG_ID, 0);
        assertEq(q.referentHash, REFERENT_HASH_1);
        assertTrue(q.exists);
        assertTrue(q.enabled);

        // Verify Vietnamese translation
        SongQuizV2.QuestionTranslation memory viTrans = quiz.getTranslation(SONG_ID, 0, "vi");
        assertEq(viTrans.ciphertext, "encrypted_vietnamese_question");
        assertEq(viTrans.dataToEncryptHash, "hash_vi");
        assertTrue(viTrans.exists);

        // Verify Mandarin translation
        SongQuizV2.QuestionTranslation memory zhTrans = quiz.getTranslation(SONG_ID, 0, "zh-CN");
        assertEq(zhTrans.ciphertext, "encrypted_mandarin_question");
        assertEq(zhTrans.dataToEncryptHash, "hash_zh");
        assertTrue(zhTrans.exists);

        // Verify available languages
        string[] memory availLangs = quiz.getAvailableLanguages(SONG_ID, 0);
        assertEq(availLangs.length, 2);
        assertEq(availLangs[0], "vi");
        assertEq(availLangs[1], "zh-CN");

        // Verify hasTranslation
        assertTrue(quiz.hasTranslation(SONG_ID, 0, "vi"));
        assertTrue(quiz.hasTranslation(SONG_ID, 0, "zh-CN"));
        assertFalse(quiz.hasTranslation(SONG_ID, 0, "en"));
    }

    function test_AddTranslationLater() public {
        // Add question with initial translations
        string[] memory langs = new string[](2);
        langs[0] = "vi";
        langs[1] = "zh-CN";

        string[] memory ciphertexts = new string[](2);
        ciphertexts[0] = "encrypted_vietnamese";
        ciphertexts[1] = "encrypted_mandarin";

        string[] memory hashes = new string[](2);
        hashes[0] = "hash_vi";
        hashes[1] = "hash_zh";

        vm.prank(pkp);
        quiz.addQuestionWithTranslations(SONG_ID, REFERENT_HASH_1, langs, ciphertexts, hashes);

        // Later: Add Korean translation
        vm.prank(pkp);
        quiz.addTranslation(SONG_ID, 0, "ko", "encrypted_korean", "hash_ko");

        // Verify Korean translation exists
        assertTrue(quiz.hasTranslation(SONG_ID, 0, "ko"));
        SongQuizV2.QuestionTranslation memory koTrans = quiz.getTranslation(SONG_ID, 0, "ko");
        assertEq(koTrans.ciphertext, "encrypted_korean");

        // Verify available languages updated
        string[] memory availLangs = quiz.getAvailableLanguages(SONG_ID, 0);
        assertEq(availLangs.length, 3);
        assertEq(availLangs[2], "ko");
    }

    function test_RevertWhen_NonPKPAddsQuestions() public {
        string[] memory langs = new string[](1);
        langs[0] = "en";
        string[] memory ciphertexts = new string[](1);
        ciphertexts[0] = "encrypted";
        string[] memory hashes = new string[](1);
        hashes[0] = "hash";

        // Alice tries to add question (should fail)
        vm.prank(alice);
        vm.expectRevert("Not trusted quiz master");
        quiz.addQuestionWithTranslations(SONG_ID, REFERENT_HASH_1, langs, ciphertexts, hashes);
    }

    // ========================================================================
    // Test: Access Control - Study Gating
    // ========================================================================

    function test_MustStudyBeforeQuiz() public {
        // Setup: Add question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice hasn't studied
        studyProgress.setStudied(alice, false);

        // Alice tries to complete quiz (should fail)
        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 10;

        vm.prank(pkp);
        vm.expectRevert("Must study before quiz");
        quiz.recordQuizCompletion(
            SONG_ID,
            alice,
            0,
            "vi",
            true,
            submittedAt,
            questionShownAt
        );
    }

    function test_CanQuizAfterStudying() public {
        // Setup: Add question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice studies
        studyProgress.setStudied(alice, true);

        // Alice completes quiz (should succeed)
        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 10;  // 10 seconds later

        vm.prank(pkp);
        quiz.recordQuizCompletion(
            SONG_ID,
            alice,
            0,
            "vi",
            true,
            submittedAt,
            questionShownAt
        );

        // Verify progress
        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.questionsCompleted, 1);
        assertEq(prog.questionsCorrect, 1);
        assertEq(prog.nextQuestionIndex, 1);
    }

    // ========================================================================
    // Test: Access Control - Sequential Unlock
    // ========================================================================

    function test_SequentialUnlock() public {
        // Add 3 questions
        _addQuestionWithViZh(0, REFERENT_HASH_1);
        _addQuestionWithViZh(1, REFERENT_HASH_2);
        _addQuestionWithViZh(2, keccak256("genius:2172632"));

        // Alice studies
        studyProgress.setStudied(alice, true);

        // Alice tries to skip to Q2 without completing Q1 (should fail)
        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 10;

        vm.prank(pkp);
        vm.expectRevert("Must complete questions in order");
        quiz.recordQuizCompletion(
            SONG_ID,
            alice,
            1,  // Q2 (index 1)
            "vi",
            true,
            submittedAt,
            questionShownAt
        );
    }

    function test_SequentialUnlockProgression() public {
        // Add 3 questions
        _addQuestionWithViZh(0, REFERENT_HASH_1);
        _addQuestionWithViZh(1, REFERENT_HASH_2);
        _addQuestionWithViZh(2, keccak256("genius:2172632"));

        // Alice studies
        studyProgress.setStudied(alice, true);

        // Complete Q1 (index 0)
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        // Verify nextQuestionIndex = 1
        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.nextQuestionIndex, 1);

        // Next day: Alice studies again
        vm.warp(block.timestamp + 1 days);
        studyProgress.setStudied(alice, true);

        // Complete Q2 (index 1)
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 1, "vi", true, ts+10, ts);}

        // Verify nextQuestionIndex = 2
        prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.nextQuestionIndex, 2);
    }

    function test_SkipDisabledQuestions() public {
        // Add 3 questions
        _addQuestionWithViZh(0, REFERENT_HASH_1);
        _addQuestionWithViZh(1, REFERENT_HASH_2);
        _addQuestionWithViZh(2, keccak256("genius:2172632"));

        // Disable Q2 (index 1)
        quiz.disableQuestion(SONG_ID, 1);

        // Alice studies and completes Q1
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        // Verify nextQuestionIndex skips Q2 and goes to Q3
        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.nextQuestionIndex, 2);  // Skipped index 1 (disabled)
    }

    // ========================================================================
    // Test: Access Control - Daily Limit
    // ========================================================================

    function test_OnlyOneQuizPerDay() public {
        // Add question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice studies and completes quiz
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        // Verify completed today
        assertTrue(quiz.completedQuizToday(SONG_ID, alice));

        // Alice tries to quiz again same day (should fail)
        vm.prank(pkp);
        vm.expectRevert("Already completed quiz today for this song");
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}
    }

    function test_CanQuizAgainNextDay() public {
        // Add 2 questions
        _addQuestionWithViZh(0, REFERENT_HASH_1);
        _addQuestionWithViZh(1, REFERENT_HASH_2);

        // Day 1: Alice completes Q1
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        // Advance to next day
        vm.warp(block.timestamp + 1 days);

        // Verify not completed today (new day)
        assertFalse(quiz.completedQuizToday(SONG_ID, alice));

        // Day 2: Alice studies and completes Q2
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 1, "vi", true, ts+10, ts);}

        // Verify progress
        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.questionsCompleted, 2);
        assertEq(prog.currentStreak, 2);
    }

    // ========================================================================
    // Test: Access Control - Time Limit
    // ========================================================================

    function test_TimeLimitEnforced() public {
        // Add question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice studies
        studyProgress.setStudied(alice, true);

        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 20;  // 20 seconds (exceeds 15s limit)

        // Alice tries to submit after time limit (should fail)
        vm.prank(pkp);
        vm.expectRevert("Time limit exceeded");
        quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, submittedAt, questionShownAt);
    }

    function test_TimeLimitWithinBounds() public {
        // Add question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice studies
        studyProgress.setStudied(alice, true);

        uint64 questionShownAt = uint64(block.timestamp);
        uint64 submittedAt = questionShownAt + 12;  // 12 seconds (within 15s limit)

        // Alice submits within time limit (should succeed)
        vm.prank(pkp);
        quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, submittedAt, questionShownAt);

        // Verify success
        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.questionsCompleted, 1);
    }

    // ========================================================================
    // Test: Language-Agnostic Leaderboards
    // ========================================================================

    function test_LeaderboardsFairAcrossLanguages() public {
        // Add question with Vietnamese + Mandarin
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice studies and completes in Vietnamese
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        // Bob studies and completes in Mandarin (SAME question)
        studyProgress.setStudied(bob, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, bob, 0, "zh-CN", true, ts+10, ts);}

        // Verify both on leaderboard (same question, fair comparison)
        SongQuizV2.LeaderboardEntry[10] memory board = quiz.getLeaderboard(SONG_ID);

        // Both should be on leaderboard with streak=1
        bool aliceFound = false;
        bool bobFound = false;
        for (uint i = 0; i < 10; i++) {
            if (board[i].user == alice) {
                aliceFound = true;
                assertEq(board[i].streak, 1);
            }
            if (board[i].user == bob) {
                bobFound = true;
                assertEq(board[i].streak, 1);
            }
        }
        assertTrue(aliceFound);
        assertTrue(bobFound);
    }

    function test_PreferredLanguageTracking() public {
        // Add question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice completes in Vietnamese
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        // Verify preferred language stored
        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.preferredLanguage, "vi");

        // Bob completes in Mandarin
        studyProgress.setStudied(bob, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, bob, 0, "zh-CN", true, ts+10, ts);}

        // Verify Bob's preferred language
        prog = quiz.getUserProgress(SONG_ID, bob);
        assertEq(prog.preferredLanguage, "zh-CN");
    }

    // ========================================================================
    // Test: Streak Mechanics
    // ========================================================================

    function test_StreakIncrementsDaily() public {
        // Add 3 questions
        _addQuestionWithViZh(0, REFERENT_HASH_1);
        _addQuestionWithViZh(1, REFERENT_HASH_2);
        _addQuestionWithViZh(2, keccak256("genius:2172632"));

        // Day 1: Alice completes Q1
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.currentStreak, 1);

        // Day 2: Alice completes Q2
        vm.warp(block.timestamp + 1 days);
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 1, "vi", true, ts+10, ts);}

        prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.currentStreak, 2);

        // Day 3: Alice completes Q3
        vm.warp(block.timestamp + 1 days);
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 2, "vi", true, ts+10, ts);}

        prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.currentStreak, 3);
        assertEq(prog.longestStreak, 3);
    }

    function test_StreakBreaksWhenSkipDay() public {
        // Add 3 questions
        _addQuestionWithViZh(0, REFERENT_HASH_1);
        _addQuestionWithViZh(1, REFERENT_HASH_2);
        _addQuestionWithViZh(2, keccak256("genius:2172632"));

        // Day 1: Alice completes Q1 (streak = 1)
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}

        // Day 2: Alice completes Q2 (streak = 2)
        vm.warp(block.timestamp + 1 days);
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 1, "vi", true, ts+10, ts);}

        // Day 3: Alice SKIPS (no quiz)

        // Day 4: Alice completes Q3 (streak resets to 1)
        vm.warp(block.timestamp + 2 days);
        studyProgress.setStudied(alice, true);
        vm.prank(pkp);
        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 2, "vi", true, ts+10, ts);}

        SongQuizV2.SongProgress memory prog = quiz.getUserProgress(SONG_ID, alice);
        assertEq(prog.currentStreak, 1);      // Reset to 1
        assertEq(prog.longestStreak, 2);      // Remembers best streak
    }

    // ========================================================================
    // Test: Events
    // ========================================================================

    function test_QuizCompletedEventEmitted() public {
        // Add question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Alice studies and completes quiz
        studyProgress.setStudied(alice, true);

        vm.prank(pkp);
        vm.expectEmit(true, true, true, false);
        emit QuizCompleted(
            SONG_ID,
            ARTIST_ID,
            alice,
            true,      // correct
            0,         // questionIndex
            "vi",      // displayLanguage
            uint64(block.timestamp),
            1,         // songStreak
            1,         // songTotalCorrect
            1,         // songTotalCompleted
            true,      // isNewRecord
            0          // leaderboardPosition
        );

        {uint64 ts=uint64(block.timestamp); quiz.recordQuizCompletion(SONG_ID, alice, 0, "vi", true, ts+10, ts);}
    }

    function test_TranslationAddedEventEmitted() public {
        // Add initial question
        _addQuestionWithViZh(0, REFERENT_HASH_1);

        // Add Korean translation
        vm.prank(pkp);
        vm.expectEmit(true, true, true, false);
        emit TranslationAdded(SONG_ID, 0, "ko", uint64(block.timestamp));

        quiz.addTranslation(SONG_ID, 0, "ko", "encrypted_korean", "hash_ko");
    }

    // Event definitions for testing
    event QuizCompleted(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        address indexed user,
        bool correct,
        uint32 questionIndex,
        string displayLanguage,
        uint64 timestamp,
        uint32 songStreak,
        uint32 songTotalCorrect,
        uint32 songTotalCompleted,
        bool isNewRecord,
        uint8 leaderboardPosition
    );

    event TranslationAdded(
        uint32 indexed geniusId,
        uint32 questionIndex,
        string language,
        uint64 timestamp
    );

    // ========================================================================
    // Helper Functions
    // ========================================================================

    function _addQuestionWithViZh(uint32 questionIndex, bytes32 referentHash) internal {
        string[] memory langs = new string[](2);
        langs[0] = "vi";
        langs[1] = "zh-CN";

        string[] memory ciphertexts = new string[](2);
        ciphertexts[0] = string(abi.encodePacked("encrypted_vi_", vm.toString(questionIndex)));
        ciphertexts[1] = string(abi.encodePacked("encrypted_zh_", vm.toString(questionIndex)));

        string[] memory hashes = new string[](2);
        hashes[0] = string(abi.encodePacked("hash_vi_", vm.toString(questionIndex)));
        hashes[1] = string(abi.encodePacked("hash_zh_", vm.toString(questionIndex)));

        vm.prank(pkp);
        quiz.addQuestionWithTranslations(SONG_ID, referentHash, langs, ciphertexts, hashes);
    }
}
