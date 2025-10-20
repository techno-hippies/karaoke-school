// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/IStudentProfile.sol";

/**
 * @title StudentProfileV2
 * @notice Student profiles with FSRS study + performance stats
 * @dev Tracks both line-by-line learning (FSRS) and full performance recordings
 *
 * Design Philosophy:
 * - Two modes: STUDY (FSRS line practice) and PERFORM (karaoke recordings)
 * - Stats updated after each activity
 * - Streaks based on ANY activity (study or perform)
 * - Achievements from both systems
 *
 * Version: 2.0.0 (integrated FSRS tracking)
 * Author: Karaoke School
 */
contract StudentProfileV2 is IStudentProfile {

    // ============ State Variables ============

    address public owner;
    mapping(address => bool) public isAuthorized;

    // Primary storage
    mapping(address => StudentStats) private stats;
    mapping(address => string) private lensHandles;
    mapping(address => Achievement[]) private achievements;
    mapping(address => mapping(string => bool)) private hasUnlocked;

    // Stats
    uint32 public totalStudents;

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
        isAuthorized[msg.sender] = true;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!isAuthorized[msg.sender] && msg.sender != owner) {
            revert NotAuthorized();
        }
        _;
    }

    // ============ Registration Functions ============

    /**
     * @notice Register a new student
     */
    function registerStudent(address student, string calldata lensHandle)
        external
    {
        if (student == address(0)) revert InvalidStudent();
        if (stats[student].joinedAt != 0) revert StudentAlreadyExists(student);

        stats[student] = StudentStats({
            totalPerformances: 0,
            gradedPerformances: 0,
            averagePerformanceScore: 0,
            bestPerformanceScore: 0,
            totalLinesStudied: 0,
            totalStudySessions: 0,
            averageLineScore: 0,
            cardsInReview: 0,
            totalStudyTime: 0,
            currentStreak: 0,
            longestStreak: 0,
            lastActivity: 0,
            lastStreakUpdate: 0,
            joinedAt: uint64(block.timestamp)
        });

        if (bytes(lensHandle).length > 0) {
            lensHandles[student] = lensHandle;
        }

        totalStudents++;

        emit StudentRegistered(student, lensHandle);
    }

    // ============ Update Functions ============

    /**
     * @notice Update student stats after a PERFORMANCE
     * @param student Student's address
     * @param newScore Performance score (basis points)
     * @param studyTime Time spent (seconds)
     * @param wasGraded Whether performance was graded
     * @dev Called by PerformanceRegistry or Lit Action
     */
    function updatePerformanceStats(
        address student,
        uint16 newScore,
        uint32 studyTime,
        bool wasGraded
    ) external onlyAuthorized {
        StudentStats storage studentStats = stats[student];

        // Auto-register if not exists
        if (studentStats.joinedAt == 0) {
            studentStats.joinedAt = uint64(block.timestamp);
            totalStudents++;
            emit StudentRegistered(student, "");
        }

        // Update performance counts
        studentStats.totalPerformances++;
        if (wasGraded) {
            studentStats.gradedPerformances++;
        }

        // Update performance scores
        if (wasGraded && newScore > 0) {
            // Update average
            uint256 totalScore = uint256(studentStats.averagePerformanceScore) *
                                 uint256(studentStats.gradedPerformances - 1);
            totalScore += uint256(newScore);
            studentStats.averagePerformanceScore = uint32(totalScore / studentStats.gradedPerformances);

            // Update best score
            if (newScore > studentStats.bestPerformanceScore) {
                studentStats.bestPerformanceScore = newScore;
            }
        }

        // Update study time
        studentStats.totalStudyTime += studyTime;

        // Update last activity
        studentStats.lastActivity = uint64(block.timestamp);

        emit StatsUpdated(
            student,
            studentStats.totalPerformances,
            studentStats.averagePerformanceScore
        );
    }

    /**
     * @notice Update student stats after a STUDY SESSION (FSRS)
     * @param student Student's address
     * @param linesStudied Number of lines reviewed in this session
     * @param averageScore Average pronunciation score across lines (0-100)
     * @param studyTime Time spent (seconds)
     * @dev Called by FSRSTracker or Lit Action after batch review
     */
    function updateStudyStats(
        address student,
        uint8 linesStudied,
        uint8 averageScore,
        uint32 studyTime
    ) external onlyAuthorized {
        StudentStats storage studentStats = stats[student];

        // Auto-register if not exists
        if (studentStats.joinedAt == 0) {
            studentStats.joinedAt = uint64(block.timestamp);
            totalStudents++;
            emit StudentRegistered(student, "");
        }

        // Update study session count
        studentStats.totalStudySessions++;

        // Update total lines studied
        studentStats.totalLinesStudied += linesStudied;

        // Update average line score (weighted by total lines)
        if (linesStudied > 0 && averageScore > 0) {
            uint256 totalScore = uint256(studentStats.averageLineScore) *
                                 uint256(studentStats.totalLinesStudied - linesStudied);
            totalScore += uint256(averageScore) * uint256(linesStudied);
            studentStats.averageLineScore = uint32(totalScore / studentStats.totalLinesStudied);
        }

        // Update study time
        studentStats.totalStudyTime += studyTime;

        // Update last activity
        studentStats.lastActivity = uint64(block.timestamp);

        emit StatsUpdated(
            student,
            studentStats.totalStudySessions,
            studentStats.averageLineScore
        );
    }

    /**
     * @notice Update student's daily streak
     * @dev Checks if student had ANY activity today (study or performance)
     */
    function updateStreak(address student) external onlyAuthorized {
        StudentStats storage studentStats = stats[student];
        if (studentStats.joinedAt == 0) revert StudentNotFound(student);

        uint256 today = block.timestamp / 1 days;
        uint256 lastStreakDay = studentStats.lastStreakUpdate / 1 days;

        if (lastStreakDay == today && studentStats.currentStreak > 0) {
            // Streak already updated today, no change
            return;
        } else if (today > 0 && lastStreakDay == today - 1) {
            // Updated yesterday, increment streak
            studentStats.currentStreak++;
        } else if (studentStats.lastStreakUpdate == 0) {
            // First activity ever
            studentStats.currentStreak = 1;
        } else {
            // Streak broken, reset to 1
            studentStats.currentStreak = 1;
        }

        // Update streak timestamp
        studentStats.lastStreakUpdate = uint64(block.timestamp);

        // Update longest streak
        if (studentStats.currentStreak > studentStats.longestStreak) {
            studentStats.longestStreak = studentStats.currentStreak;
        }

        emit StreakUpdated(student, studentStats.currentStreak);
    }

    /**
     * @notice Update cards in review count (called by indexer/backend)
     * @param student Student's address
     * @param cardsInReview Number of cards in long-term review state
     * @dev This is updated periodically by querying FSRSTracker, not on every review
     */
    function updateCardsInReview(address student, uint16 cardsInReview) external onlyAuthorized {
        StudentStats storage studentStats = stats[student];
        if (studentStats.joinedAt == 0) revert StudentNotFound(student);

        studentStats.cardsInReview = cardsInReview;
    }

    /**
     * @notice Unlock an achievement for a student
     */
    function unlockAchievement(
        address student,
        string calldata achievementId,
        string calldata title,
        string calldata description
    ) external onlyAuthorized {
        if (stats[student].joinedAt == 0) revert StudentNotFound(student);
        if (hasUnlocked[student][achievementId]) {
            revert AchievementAlreadyUnlocked(achievementId);
        }

        Achievement memory achievement = Achievement({
            achievementId: achievementId,
            title: title,
            description: description,
            unlockedAt: uint64(block.timestamp)
        });

        achievements[student].push(achievement);
        hasUnlocked[student][achievementId] = true;

        emit AchievementUnlocked(student, achievementId, uint64(block.timestamp));
    }

    // ============ Query Functions ============

    function getStats(address student)
        external
        view
        returns (StudentStats memory)
    {
        StudentStats memory studentStats = stats[student];
        if (studentStats.joinedAt == 0) revert StudentNotFound(student);
        return studentStats;
    }

    function getAchievements(address student)
        external
        view
        returns (Achievement[] memory)
    {
        return achievements[student];
    }

    function hasAchievement(address student, string calldata achievementId)
        external
        view
        returns (bool)
    {
        return hasUnlocked[student][achievementId];
    }

    function studentExists(address student) external view returns (bool) {
        return stats[student].joinedAt != 0;
    }

    function getTotalStudents() external view returns (uint32) {
        return totalStudents;
    }

    // ============ Admin Functions ============

    function setAuthorized(address updater, bool authorized) external onlyOwner {
        isAuthorized[updater] = authorized;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidStudent();
        owner = newOwner;
        isAuthorized[newOwner] = true;
    }

    // ============ Legacy Compatibility ============

    /**
     * @notice Legacy function for V1 compatibility
     * @dev Maps to updatePerformanceStats for backward compatibility
     */
    function updateStats(
        address student,
        uint16 newScore,
        uint32 studyTime,
        bool wasGraded
    ) external onlyAuthorized {
        StudentStats storage studentStats = stats[student];

        // Auto-register if not exists
        if (studentStats.joinedAt == 0) {
            studentStats.joinedAt = uint64(block.timestamp);
            totalStudents++;
            emit StudentRegistered(student, "");
        }

        // Update performance counts
        studentStats.totalPerformances++;
        if (wasGraded) {
            studentStats.gradedPerformances++;
        }

        // Update performance scores
        if (wasGraded && newScore > 0) {
            // Update average
            uint256 totalScore = uint256(studentStats.averagePerformanceScore) *
                                 uint256(studentStats.gradedPerformances - 1);
            totalScore += uint256(newScore);
            studentStats.averagePerformanceScore = uint32(totalScore / studentStats.gradedPerformances);

            // Update best score
            if (newScore > studentStats.bestPerformanceScore) {
                studentStats.bestPerformanceScore = newScore;
            }
        }

        // Update study time
        studentStats.totalStudyTime += studyTime;

        // Update last activity
        studentStats.lastActivity = uint64(block.timestamp);

        emit StatsUpdated(
            student,
            studentStats.totalPerformances,
            studentStats.averagePerformanceScore
        );
    }
}
