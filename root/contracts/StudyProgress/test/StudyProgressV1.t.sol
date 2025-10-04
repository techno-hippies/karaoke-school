// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../StudyProgressV1.sol";

/**
 * @title StudyProgressV1 Test Suite
 * @notice Comprehensive unit tests for StudyProgressV1 contract
 *
 * Coverage:
 * - Study Session Recording
 * - Streak Logic (same day, next day, skip days)
 * - FSRS Encryption Storage
 * - Session History Management
 * - studiedToday() Query
 * - Pause/Unpause
 * - Ownership & Access Control
 */
contract StudyProgressV1Test is Test {
    StudyProgressV1 public progress;

    address public owner;
    address public trustedTracker;
    address public nonTrusted;
    address public user1;
    address public user2;

    // Sample data
    uint8 constant SOURCE_NATIVE = 0;
    uint8 constant SOURCE_GENIUS = 1;
    string constant CONTENT_ID_1 = "heat-of-the-night-scarlett-x";
    string constant CONTENT_ID_2 = "down-home-blues-ethel-waters";
    uint16 constant ITEMS_REVIEWED = 10;
    uint8 constant AVERAGE_SCORE = 85;

    string constant CIPHERTEXT_1 = "encrypted_fsrs_data_1";
    string constant DATA_HASH_1 = "hash_1";

    function setUp() public {
        owner = address(this);
        trustedTracker = address(0x1);
        nonTrusted = address(0x2);
        user1 = address(0x3);
        user2 = address(0x4);

        progress = new StudyProgressV1(trustedTracker);
    }

    // ========================================================================
    // Setup & Configuration Tests
    // ========================================================================

    function test_InitialState() public view {
        assertEq(progress.owner(), owner);
        assertEq(progress.trustedTracker(), trustedTracker);
        assertFalse(progress.paused());

        StudyProgressV1.StudyStats memory stats = progress.getUserStats(user1);
        assertEq(stats.totalSessions, 0);
        assertEq(stats.currentStreak, 0);
        assertEq(stats.longestStreak, 0);
        assertEq(stats.lastStudyTimestamp, 0);
        assertEq(stats.firstStudyTimestamp, 0);
    }

    function test_Constructor_RevertIfInvalidTracker() public {
        vm.expectRevert("Invalid tracker address");
        new StudyProgressV1(address(0));
    }

    function test_TransferOwnership() public {
        address newOwner = address(0x5);
        progress.transferOwnership(newOwner);
        assertEq(progress.owner(), newOwner);
    }

    function test_TransferOwnership_RevertIfNotOwner() public {
        vm.prank(nonTrusted);
        vm.expectRevert("Not owner");
        progress.transferOwnership(nonTrusted);
    }

    function test_TransferOwnership_RevertIfInvalidAddress() public {
        vm.expectRevert("Invalid address");
        progress.transferOwnership(address(0));
    }

    function test_SetTrustedTracker() public {
        address newTracker = address(0x6);
        progress.setTrustedTracker(newTracker);
        assertEq(progress.trustedTracker(), newTracker);
    }

    function test_SetTrustedTracker_RevertIfNotOwner() public {
        vm.prank(nonTrusted);
        vm.expectRevert("Not owner");
        progress.setTrustedTracker(nonTrusted);
    }

    function test_SetTrustedTracker_RevertIfInvalidAddress() public {
        vm.expectRevert("Invalid address");
        progress.setTrustedTracker(address(0));
    }

    function test_Pause() public {
        progress.pause();
        assertTrue(progress.paused());
    }

    function test_Pause_RevertIfAlreadyPaused() public {
        progress.pause();
        vm.expectRevert("Already paused");
        progress.pause();
    }

    function test_Pause_RevertIfNotOwner() public {
        vm.prank(nonTrusted);
        vm.expectRevert("Not owner");
        progress.pause();
    }

    function test_Unpause() public {
        progress.pause();
        progress.unpause();
        assertFalse(progress.paused());
    }

    function test_Unpause_RevertIfNotPaused() public {
        vm.expectRevert("Not paused");
        progress.unpause();
    }

    function test_Unpause_RevertIfNotOwner() public {
        progress.pause();
        vm.prank(nonTrusted);
        vm.expectRevert("Not owner");
        progress.unpause();
    }

    // ========================================================================
    // Utility Function Tests
    // ========================================================================

    function test_GetContentHash() public view {
        bytes32 hash = progress.getContentHash(SOURCE_NATIVE, CONTENT_ID_1);
        bytes32 expected = keccak256(abi.encodePacked(SOURCE_NATIVE, CONTENT_ID_1));
        assertEq(hash, expected);
    }

    function test_GetDayNumber() public view {
        uint64 timestamp = 1704067200; // 2024-01-01 00:00:00 UTC
        uint256 dayNumber = progress.getDayNumber(timestamp);
        assertEq(dayNumber, timestamp / 1 days);
    }

    // ========================================================================
    // Study Session Recording Tests
    // ========================================================================

    function test_RecordStudySession_FirstSession() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(
            user1,
            SOURCE_NATIVE,
            CONTENT_ID_1,
            ITEMS_REVIEWED,
            AVERAGE_SCORE
        );

        StudyProgressV1.StudyStats memory stats = progress.getUserStats(user1);
        assertEq(stats.totalSessions, 1);
        assertEq(stats.currentStreak, 1);
        assertEq(stats.longestStreak, 1);
        assertGt(stats.lastStudyTimestamp, 0);
        assertEq(stats.lastStudyTimestamp, stats.firstStudyTimestamp);
    }

    function test_RecordStudySession_SameDay() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // Second session same day
        vm.warp(block.timestamp + 1 hours);

        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_2, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudyStats memory stats = progress.getUserStats(user1);
        assertEq(stats.totalSessions, 2);
        assertEq(stats.currentStreak, 1); // Streak unchanged
        assertEq(stats.longestStreak, 1);
    }

    function test_RecordStudySession_NextDay() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // Next day
        vm.warp(block.timestamp + 1 days);

        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_2, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudyStats memory stats = progress.getUserStats(user1);
        assertEq(stats.totalSessions, 2);
        assertEq(stats.currentStreak, 2); // Streak incremented
        assertEq(stats.longestStreak, 2);
    }

    function test_RecordStudySession_StreakMultipleDays() public {
        uint64 startTime = uint64(block.timestamp);

        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // Day 2
        vm.warp(startTime + 1 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // Day 3
        vm.warp(startTime + 2 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudyStats memory stats = progress.getUserStats(user1);
        assertEq(stats.totalSessions, 3);
        assertEq(stats.currentStreak, 3);
        assertEq(stats.longestStreak, 3);
    }

    function test_RecordStudySession_SkipOneDayResetsStreak() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // Day 2
        vm.warp(block.timestamp + 1 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudyStats memory statsBeforeSkip = progress.getUserStats(user1);
        assertEq(statsBeforeSkip.currentStreak, 2);

        // Skip day 3, study on day 4
        vm.warp(block.timestamp + 2 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudyStats memory statsAfterSkip = progress.getUserStats(user1);
        assertEq(statsAfterSkip.totalSessions, 3);
        assertEq(statsAfterSkip.currentStreak, 1); // Reset to 1
        assertEq(statsAfterSkip.longestStreak, 2); // Longest unchanged
    }

    function test_RecordStudySession_NewRecordStreak() public {
        // First streak: 2 days
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        vm.warp(block.timestamp + 1 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudyStats memory stats1 = progress.getUserStats(user1);
        assertEq(stats1.longestStreak, 2);

        // Skip a day to reset
        vm.warp(block.timestamp + 2 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // New streak: 3 days (beats record)
        vm.warp(block.timestamp + 1 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        vm.warp(block.timestamp + 1 days);
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudyStats memory stats2 = progress.getUserStats(user1);
        assertEq(stats2.currentStreak, 3);
        assertEq(stats2.longestStreak, 3); // New record
    }

    function test_RecordStudySession_MultipleUsers() public {
        // User 1
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // User 2 at different time
        vm.warp(block.timestamp + 1 hours);
        vm.prank(trustedTracker);
        progress.recordStudySession(user2, SOURCE_GENIUS, CONTENT_ID_2, 5, 90);

        StudyProgressV1.StudyStats memory stats1 = progress.getUserStats(user1);
        assertEq(stats1.totalSessions, 1);

        StudyProgressV1.StudyStats memory stats2 = progress.getUserStats(user2);
        assertEq(stats2.totalSessions, 1);

        // Verify independent (different times)
        assertNotEq(stats1.lastStudyTimestamp, stats2.lastStudyTimestamp);
    }

    function test_RecordStudySession_RevertIfNotTrustedTracker() public {
        vm.prank(nonTrusted);
        vm.expectRevert("Not trusted tracker");
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);
    }

    function test_RecordStudySession_RevertIfPaused() public {
        progress.pause();

        vm.prank(trustedTracker);
        vm.expectRevert("Contract is paused");
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);
    }

    function test_RecordStudySession_RevertIfInvalidUser() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Invalid user");
        progress.recordStudySession(address(0), SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);
    }

    function test_RecordStudySession_RevertIfInvalidSource() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Invalid source");
        progress.recordStudySession(user1, 2, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);
    }

    function test_RecordStudySession_RevertIfZeroItems() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Must review at least 1 item");
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, 0, AVERAGE_SCORE);
    }

    function test_RecordStudySession_RevertIfInvalidScore() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Invalid score");
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, 101);
    }

    // ========================================================================
    // Session History Tests
    // ========================================================================

    function test_SessionHistory_RecordsCorrectly() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudySession[] memory history = progress.getSessionHistory(user1);
        assertEq(history.length, 1);

        bytes32 expectedHash = progress.getContentHash(SOURCE_NATIVE, CONTENT_ID_1);
        assertEq(history[0].contentHash, expectedHash);
        assertEq(history[0].itemsReviewed, ITEMS_REVIEWED);
        assertEq(history[0].averageScore, AVERAGE_SCORE);
    }

    function test_SessionHistory_MultipleEntries() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        vm.warp(block.timestamp + 1 hours);

        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_GENIUS, CONTENT_ID_2, 5, 90);

        StudyProgressV1.StudySession[] memory history = progress.getSessionHistory(user1);
        assertEq(history.length, 2);

        // Verify different content
        bytes32 hash1 = progress.getContentHash(SOURCE_NATIVE, CONTENT_ID_1);
        bytes32 hash2 = progress.getContentHash(SOURCE_GENIUS, CONTENT_ID_2);

        assertEq(history[0].contentHash, hash1);
        assertEq(history[1].contentHash, hash2);
    }

    function test_SessionHistory_MaxHistoryLimit() public {
        // Add 105 sessions (max is 100)
        for (uint256 i = 0; i < 105; i++) {
            vm.warp(block.timestamp + i * 1 hours);
            vm.prank(trustedTracker);
            progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);
        }

        StudyProgressV1.StudySession[] memory history = progress.getSessionHistory(user1);
        assertEq(history.length, progress.MAX_HISTORY()); // Should cap at 100
    }

    function test_GetRecentSessions() public {
        // Add 5 sessions
        for (uint256 i = 0; i < 5; i++) {
            vm.warp(block.timestamp + i * 1 hours);
            vm.prank(trustedTracker);
            progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, uint8(80 + i));
        }

        StudyProgressV1.StudySession[] memory recent = progress.getRecentSessions(user1, 3);
        assertEq(recent.length, 3);

        // Most recent first
        assertEq(recent[0].averageScore, 84); // Last session
        assertEq(recent[1].averageScore, 83);
        assertEq(recent[2].averageScore, 82);
    }

    function test_GetRecentSessions_RequestMoreThanExists() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        StudyProgressV1.StudySession[] memory recent = progress.getRecentSessions(user1, 10);
        assertEq(recent.length, 1); // Should return only what exists
    }

    function test_GetRecentSessions_EmptyHistory() public {
        StudyProgressV1.StudySession[] memory recent = progress.getRecentSessions(user1, 5);
        assertEq(recent.length, 0);
    }

    // ========================================================================
    // FSRS Encryption Tests
    // ========================================================================

    function test_StoreEncryptedFSRS() public {
        vm.prank(trustedTracker);
        progress.storeEncryptedFSRS(
            user1,
            SOURCE_NATIVE,
            CONTENT_ID_1,
            CIPHERTEXT_1,
            DATA_HASH_1
        );

        StudyProgressV1.EncryptedFSRS memory fsrs = progress.getEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1);
        assertEq(fsrs.ciphertext, CIPHERTEXT_1);
        assertEq(fsrs.dataToEncryptHash, DATA_HASH_1);
        assertGt(fsrs.lastUpdated, 0);
    }

    function test_StoreEncryptedFSRS_Update() public {
        vm.prank(trustedTracker);
        progress.storeEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1, CIPHERTEXT_1, DATA_HASH_1);

        vm.warp(block.timestamp + 1 days);

        string memory newCiphertext = "new_encrypted_data";
        string memory newHash = "new_hash";

        vm.prank(trustedTracker);
        progress.storeEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1, newCiphertext, newHash);

        StudyProgressV1.EncryptedFSRS memory fsrs = progress.getEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1);
        assertEq(fsrs.ciphertext, newCiphertext);
        assertEq(fsrs.dataToEncryptHash, newHash);
    }

    function test_StoreEncryptedFSRS_DifferentContent() public {
        vm.prank(trustedTracker);
        progress.storeEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1, CIPHERTEXT_1, DATA_HASH_1);

        vm.prank(trustedTracker);
        progress.storeEncryptedFSRS(user1, SOURCE_GENIUS, CONTENT_ID_2, "cipher2", "hash2");

        StudyProgressV1.EncryptedFSRS memory fsrs1 = progress.getEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1);
        StudyProgressV1.EncryptedFSRS memory fsrs2 = progress.getEncryptedFSRS(user1, SOURCE_GENIUS, CONTENT_ID_2);

        assertEq(fsrs1.ciphertext, CIPHERTEXT_1);
        assertEq(fsrs2.ciphertext, "cipher2");
    }

    function test_StoreEncryptedFSRS_RevertIfNotTrustedTracker() public {
        vm.prank(nonTrusted);
        vm.expectRevert("Not trusted tracker");
        progress.storeEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1, CIPHERTEXT_1, DATA_HASH_1);
    }

    function test_StoreEncryptedFSRS_RevertIfPaused() public {
        progress.pause();

        vm.prank(trustedTracker);
        vm.expectRevert("Contract is paused");
        progress.storeEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1, CIPHERTEXT_1, DATA_HASH_1);
    }

    function test_StoreEncryptedFSRS_RevertIfInvalidUser() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Invalid user");
        progress.storeEncryptedFSRS(address(0), SOURCE_NATIVE, CONTENT_ID_1, CIPHERTEXT_1, DATA_HASH_1);
    }

    function test_StoreEncryptedFSRS_RevertIfInvalidSource() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Invalid source");
        progress.storeEncryptedFSRS(user1, 2, CONTENT_ID_1, CIPHERTEXT_1, DATA_HASH_1);
    }

    function test_StoreEncryptedFSRS_RevertIfEmptyCiphertext() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Empty ciphertext");
        progress.storeEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1, "", DATA_HASH_1);
    }

    function test_StoreEncryptedFSRS_RevertIfEmptyHash() public {
        vm.prank(trustedTracker);
        vm.expectRevert("Empty hash");
        progress.storeEncryptedFSRS(user1, SOURCE_NATIVE, CONTENT_ID_1, CIPHERTEXT_1, "");
    }

    // ========================================================================
    // studiedToday() Tests
    // ========================================================================

    function test_StudiedToday_NoSessions() public view {
        assertFalse(progress.studiedToday(user1));
    }

    function test_StudiedToday_TodaySession() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        assertTrue(progress.studiedToday(user1));
    }

    function test_StudiedToday_YesterdaySession() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        // Move to next day
        vm.warp(block.timestamp + 1 days);

        assertFalse(progress.studiedToday(user1));
    }

    function test_StudiedToday_MultipleTodaySessions() public {
        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        vm.warp(block.timestamp + 1 hours);

        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_2, ITEMS_REVIEWED, AVERAGE_SCORE);

        assertTrue(progress.studiedToday(user1));
    }

    function test_StudiedToday_EdgeOfDay() public {
        // Study at 23:59 UTC
        uint64 dayEnd = uint64((block.timestamp / 1 days + 1) * 1 days - 1);
        vm.warp(dayEnd);

        vm.prank(trustedTracker);
        progress.recordStudySession(user1, SOURCE_NATIVE, CONTENT_ID_1, ITEMS_REVIEWED, AVERAGE_SCORE);

        assertTrue(progress.studiedToday(user1));

        // Move to next day (00:00 UTC)
        vm.warp(dayEnd + 1);

        assertFalse(progress.studiedToday(user1));
    }
}
