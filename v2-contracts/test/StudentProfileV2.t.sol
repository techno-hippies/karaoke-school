// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./BaseTest.sol";
import "../src/student/StudentProfileV2.sol";

contract StudentProfileV2Test is BaseTest {

    StudentProfileV2 public profile;

    event StudentRegistered(address indexed student, string lensHandle);

    event StatsUpdated(
        address indexed student,
        uint32 totalPerformances,
        uint32 averageScore
    );

    event StreakUpdated(address indexed student, uint32 newStreak);

    event AchievementUnlocked(
        address indexed student,
        string achievementId,
        uint64 unlockedAt
    );

    function setUp() public override {
        super.setUp();

        vm.startPrank(owner);
        profile = new StudentProfileV2();
        profile.setAuthorized(authorized, true);
        vm.stopPrank();
    }

    // ============ Constructor Tests ============

    function test_Constructor() public {
        assertEq(profile.owner(), owner);
        assertTrue(profile.isAuthorized(owner));
    }

    // ============ Registration Tests ============

    function test_RegisterStudent() public {
        vm.expectEmit(true, false, false, true);
        emit StudentRegistered(user1, LENS_HANDLE_1);

        profile.registerStudent(user1, LENS_HANDLE_1);

        assertTrue(profile.studentExists(user1));

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertGt(stats.joinedAt, 0);
        assertEq(stats.totalPerformances, 0);
        assertEq(stats.totalLinesStudied, 0);
    }

    function test_RegisterStudent_WithoutLensHandle() public {
        profile.registerStudent(user1, "");

        assertTrue(profile.studentExists(user1));
    }

    function test_RevertWhen_InvalidStudent() public {
        vm.expectRevert(IStudentProfile.InvalidStudent.selector);
        profile.registerStudent(address(0), LENS_HANDLE_1);
    }

    function test_RevertWhen_StudentAlreadyExists() public {
        profile.registerStudent(user1, LENS_HANDLE_1);

        vm.expectRevert(
            abi.encodeWithSelector(
                IStudentProfile.StudentAlreadyExists.selector,
                user1
            )
        );
        profile.registerStudent(user1, LENS_HANDLE_1);
    }

    // ============ Performance Stats Tests ============

    function test_UpdatePerformanceStats() public {
        vm.startPrank(authorized);

        // Should auto-register
        profile.updatePerformanceStats(user1, 8500, 180, true);

        vm.stopPrank();

        assertTrue(profile.studentExists(user1));

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.totalPerformances, 1);
        assertEq(stats.gradedPerformances, 1);
        assertEq(stats.averagePerformanceScore, 8500);
        assertEq(stats.bestPerformanceScore, 8500);
        assertEq(stats.totalStudyTime, 180);
        assertGt(stats.lastActivity, 0);
    }

    function test_UpdatePerformanceStats_MultipleGraded() public {
        vm.startPrank(authorized);

        profile.updatePerformanceStats(user1, 8000, 180, true);
        profile.updatePerformanceStats(user1, 9000, 200, true);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.totalPerformances, 2);
        assertEq(stats.gradedPerformances, 2);
        assertEq(stats.averagePerformanceScore, 8500); // (8000 + 9000) / 2
        assertEq(stats.bestPerformanceScore, 9000);
        assertEq(stats.totalStudyTime, 380);
    }

    function test_UpdatePerformanceStats_UngradedPerformances() public {
        vm.startPrank(authorized);

        profile.updatePerformanceStats(user1, 0, 180, false);
        profile.updatePerformanceStats(user1, 8500, 200, true);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.totalPerformances, 2);
        assertEq(stats.gradedPerformances, 1);
        assertEq(stats.averagePerformanceScore, 8500);
        assertEq(stats.totalStudyTime, 380);
    }

    function test_RevertWhen_NotAuthorized_UpdatePerformanceStats() public {
        vm.startPrank(user1);
        vm.expectRevert(IStudentProfile.NotAuthorized.selector);
        profile.updatePerformanceStats(user2, 8500, 180, true);
        vm.stopPrank();
    }

    // ============ Study Stats Tests (FSRS) ============

    function test_UpdateStudyStats() public {
        vm.startPrank(authorized);

        // Should auto-register
        profile.updateStudyStats(user1, 10, 85, 600);

        vm.stopPrank();

        assertTrue(profile.studentExists(user1));

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.totalStudySessions, 1);
        assertEq(stats.totalLinesStudied, 10);
        assertEq(stats.averageLineScore, 85);
        assertEq(stats.totalStudyTime, 600);
        assertGt(stats.lastActivity, 0);
    }

    function test_UpdateStudyStats_MultipleSessions() public {
        vm.startPrank(authorized);

        profile.updateStudyStats(user1, 10, 80, 600);
        profile.updateStudyStats(user1, 5, 90, 300);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.totalStudySessions, 2);
        assertEq(stats.totalLinesStudied, 15);
        // Weighted average: (10*80 + 5*90) / 15 = (800 + 450) / 15 = 83.33 ≈ 83
        assertEq(stats.averageLineScore, 83);
        assertEq(stats.totalStudyTime, 900);
    }

    function test_RevertWhen_NotAuthorized_UpdateStudyStats() public {
        vm.startPrank(user1);
        vm.expectRevert(IStudentProfile.NotAuthorized.selector);
        profile.updateStudyStats(user2, 10, 85, 600);
        vm.stopPrank();
    }

    // ============ Combined Stats Tests ============

    function test_CombinedStudyAndPerformanceStats() public {
        vm.startPrank(authorized);

        // Study session
        profile.updateStudyStats(user1, 10, 85, 600);

        // Performance
        profile.updatePerformanceStats(user1, 8500, 180, true);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);

        // Performance metrics
        assertEq(stats.totalPerformances, 1);
        assertEq(stats.averagePerformanceScore, 8500);

        // Study metrics
        assertEq(stats.totalStudySessions, 1);
        assertEq(stats.totalLinesStudied, 10);
        assertEq(stats.averageLineScore, 85);

        // Combined metrics
        assertEq(stats.totalStudyTime, 780); // 600 + 180
    }

    // ============ Streak Tests ============

    function test_UpdateStreak_FirstDay() public {
        vm.prank(authorized);
        profile.updatePerformanceStats(user1, 8500, 180, true);

        vm.prank(authorized);
        profile.updateStreak(user1);

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.currentStreak, 1);
        assertEq(stats.longestStreak, 1);
    }

    function test_UpdateStreak_Consecutive() public {
        vm.startPrank(authorized);

        // Day 1
        profile.updatePerformanceStats(user1, 8500, 180, true);
        profile.updateStreak(user1);

        // Day 2
        skipDays(1);
        profile.updatePerformanceStats(user1, 9000, 200, true);
        profile.updateStreak(user1);

        // Day 3
        skipDays(1);
        profile.updateStudyStats(user1, 10, 85, 600);
        profile.updateStreak(user1);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.currentStreak, 3);
        assertEq(stats.longestStreak, 3);
    }

    function test_UpdateStreak_Broken() public {
        vm.startPrank(authorized);

        // Day 1
        profile.updatePerformanceStats(user1, 8500, 180, true);
        profile.updateStreak(user1);

        // Day 2
        skipDays(1);
        profile.updatePerformanceStats(user1, 9000, 200, true);
        profile.updateStreak(user1);

        // Skip 2 days (break streak)
        skipDays(3);
        profile.updatePerformanceStats(user1, 8000, 150, true);
        profile.updateStreak(user1);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.currentStreak, 1); // Reset to 1
        assertEq(stats.longestStreak, 2); // Previous streak was 2
    }

    function test_UpdateStreak_SameDay() public {
        vm.startPrank(authorized);

        profile.updatePerformanceStats(user1, 8500, 180, true);
        profile.updateStreak(user1);

        // Multiple activities same day
        profile.updateStudyStats(user1, 10, 85, 600);
        profile.updateStreak(user1);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.currentStreak, 1); // Still 1
    }

    function test_RevertWhen_StudentNotFound_UpdateStreak() public {
        vm.startPrank(authorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStudentProfile.StudentNotFound.selector,
                user1
            )
        );
        profile.updateStreak(user1);
        vm.stopPrank();
    }

    // ============ Cards In Review Tests ============

    function test_UpdateCardsInReview() public {
        vm.prank(authorized);
        profile.registerStudent(user1, LENS_HANDLE_1);

        vm.prank(authorized);
        profile.updateCardsInReview(user1, 25);

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.cardsInReview, 25);
    }

    function test_RevertWhen_StudentNotFound_UpdateCardsInReview() public {
        vm.startPrank(authorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStudentProfile.StudentNotFound.selector,
                user1
            )
        );
        profile.updateCardsInReview(user1, 25);
        vm.stopPrank();
    }

    // ============ Achievement Tests ============

    function test_UnlockAchievement() public {
        vm.prank(authorized);
        profile.registerStudent(user1, LENS_HANDLE_1);

        vm.startPrank(authorized);
        vm.expectEmit(true, false, false, true);
        emit AchievementUnlocked(user1, "first_performance", uint64(block.timestamp));

        profile.unlockAchievement(
            user1,
            "first_performance",
            "First Performance",
            "Complete your first karaoke performance"
        );
        vm.stopPrank();

        assertTrue(profile.hasAchievement(user1, "first_performance"));

        IStudentProfile.Achievement[] memory achievements = profile.getAchievements(user1);
        assertEq(achievements.length, 1);
        assertEq(achievements[0].achievementId, "first_performance");
        assertEq(achievements[0].title, "First Performance");
    }

    function test_UnlockMultipleAchievements() public {
        vm.prank(authorized);
        profile.registerStudent(user1, LENS_HANDLE_1);

        vm.startPrank(authorized);
        profile.unlockAchievement(user1, "first_performance", "First", "First");
        profile.unlockAchievement(user1, "perfect_score", "Perfect", "Perfect");
        vm.stopPrank();

        IStudentProfile.Achievement[] memory achievements = profile.getAchievements(user1);
        assertEq(achievements.length, 2);
    }

    function test_RevertWhen_StudentNotFound_UnlockAchievement() public {
        vm.startPrank(authorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                IStudentProfile.StudentNotFound.selector,
                user1
            )
        );
        profile.unlockAchievement(user1, "first_performance", "First", "First");
        vm.stopPrank();
    }

    function test_RevertWhen_AchievementAlreadyUnlocked() public {
        vm.prank(authorized);
        profile.registerStudent(user1, LENS_HANDLE_1);

        vm.startPrank(authorized);
        profile.unlockAchievement(user1, "first_performance", "First", "First");

        vm.expectRevert(
            abi.encodeWithSelector(
                IStudentProfile.AchievementAlreadyUnlocked.selector,
                "first_performance"
            )
        );
        profile.unlockAchievement(user1, "first_performance", "First", "First");
        vm.stopPrank();
    }

    // ============ Query Tests ============

    function test_GetStats() public {
        vm.prank(authorized);
        profile.registerStudent(user1, LENS_HANDLE_1);

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertGt(stats.joinedAt, 0);
    }

    function test_RevertWhen_StudentNotFound_GetStats() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IStudentProfile.StudentNotFound.selector,
                user1
            )
        );
        profile.getStats(user1);
    }

    function test_StudentExists() public {
        assertFalse(profile.studentExists(user1));

        vm.prank(authorized);
        profile.registerStudent(user1, LENS_HANDLE_1);

        assertTrue(profile.studentExists(user1));
    }

    function test_GetTotalStudents() public {
        assertEq(profile.getTotalStudents(), 0);

        vm.startPrank(authorized);
        profile.registerStudent(user1, LENS_HANDLE_1);
        assertEq(profile.getTotalStudents(), 1);

        profile.registerStudent(user2, "user2");
        assertEq(profile.getTotalStudents(), 2);
        vm.stopPrank();
    }

    // ============ Admin Tests ============

    function test_SetAuthorized() public {
        assertFalse(profile.isAuthorized(user1));

        vm.prank(owner);
        profile.setAuthorized(user1, true);

        assertTrue(profile.isAuthorized(user1));
    }

    function test_TransferOwnership() public {
        assertEq(profile.owner(), owner);

        vm.prank(owner);
        profile.transferOwnership(user1);

        assertEq(profile.owner(), user1);
    }

    // ============ Legacy Compatibility Tests ============

    function test_UpdateStats_LegacyCompatibility() public {
        vm.startPrank(authorized);

        // Legacy function should map to updatePerformanceStats
        profile.updateStats(user1, 8500, 180, true);

        vm.stopPrank();

        IStudentProfile.StudentStats memory stats = profile.getStats(user1);
        assertEq(stats.totalPerformances, 1);
        assertEq(stats.averagePerformanceScore, 8500);
    }

    // ============ Integration Tests ============

    function test_FullStudentLifecycle() public {
        // Register student
        profile.registerStudent(user1, LENS_HANDLE_1);

        vm.startPrank(authorized);

        // Day 1: Study session
        profile.updateStudyStats(user1, 10, 85, 600);
        profile.updateStreak(user1);

        // Day 2: Performance
        skipDays(1);
        profile.updatePerformanceStats(user1, 8500, 180, true);
        profile.updateStreak(user1);

        // Day 3: Another study session
        skipDays(1);
        profile.updateStudyStats(user1, 5, 90, 300);
        profile.updateStreak(user1);

        // Update cards in review
        profile.updateCardsInReview(user1, 15);

        // Unlock achievements
        profile.unlockAchievement(user1, "first_study", "First Study", "Completed first study session");
        profile.unlockAchievement(user1, "first_performance", "First Performance", "Completed first performance");
        profile.unlockAchievement(user1, "three_day_streak", "3-Day Streak", "Maintained 3-day streak");

        vm.stopPrank();

        // Verify complete stats
        IStudentProfile.StudentStats memory stats = profile.getStats(user1);

        // Performance metrics
        assertEq(stats.totalPerformances, 1);
        assertEq(stats.gradedPerformances, 1);
        assertEq(stats.averagePerformanceScore, 8500);
        assertEq(stats.bestPerformanceScore, 8500);

        // Study metrics
        assertEq(stats.totalStudySessions, 2);
        assertEq(stats.totalLinesStudied, 15);
        assertGt(stats.averageLineScore, 0);
        assertEq(stats.cardsInReview, 15);

        // Combined metrics
        assertEq(stats.totalStudyTime, 1080); // 600 + 180 + 300
        assertEq(stats.currentStreak, 3);
        assertEq(stats.longestStreak, 3);

        // Achievements
        IStudentProfile.Achievement[] memory achievements = profile.getAchievements(user1);
        assertEq(achievements.length, 3);
    }
}
