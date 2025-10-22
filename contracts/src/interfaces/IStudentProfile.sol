// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IStudentProfile
 * @notice Interface for the Student Profile contract
 * @dev User profiles, stats, and achievements
 */
interface IStudentProfile {

    // ============ Types ============

    struct StudentStats {
        // Performance metrics (karaoke recordings)
        uint32 totalPerformances;    // Total submissions
        uint32 gradedPerformances;   // Graded submissions
        uint32 averagePerformanceScore; // Average performance score (basis points)
        uint32 bestPerformanceScore;    // Best performance score (basis points)

        // FSRS study metrics (line-by-line learning)
        uint32 totalLinesStudied;    // Total line reviews
        uint32 totalStudySessions;   // Number of study sessions
        uint32 averageLineScore;     // Average pronunciation score (0-100)
        uint16 cardsInReview;        // Cards in long-term review state

        // Combined metrics
        uint32 totalStudyTime;       // Total practice time (seconds)
        uint32 currentStreak;        // Current daily streak (any activity)
        uint32 longestStreak;        // Longest daily streak
        uint64 lastActivity;         // Last activity timestamp (study or performance)
        uint64 lastStreakUpdate;     // Last time streak was updated
        uint64 joinedAt;             // Account creation timestamp
    }

    struct Achievement {
        string achievementId;        // e.g., "first_performance", "perfect_score"
        string title;                // Display title
        string description;          // Achievement description
        uint64 unlockedAt;           // Unlock timestamp
    }

    // ============ Events ============

    event StudentRegistered(address indexed student, string lensHandle);

    event StatsUpdated(
        address indexed student,
        uint32 totalPerformances,
        uint32 averageScore
    );

    event AchievementUnlocked(
        address indexed student,
        string achievementId,
        uint64 unlockedAt
    );

    event StreakUpdated(address indexed student, uint32 newStreak);

    // ============ Errors ============

    error StudentAlreadyExists(address student);
    error StudentNotFound(address student);
    error AchievementAlreadyUnlocked(string achievementId);
    error InvalidStudent();
    error InvalidLensHandle();
    error NotOwner();
    error NotAuthorized();

    // ============ Functions ============

    function registerStudent(address student, string calldata lensHandle) external;

    function updatePerformanceStats(
        address student,
        uint16 newScore,
        uint32 studyTime,
        bool wasGraded
    ) external;

    function updateStudyStats(
        address student,
        uint8 linesStudied,
        uint8 averageScore,
        uint32 studyTime
    ) external;

    function updateStreak(address student) external;

    function unlockAchievement(
        address student,
        string calldata achievementId,
        string calldata title,
        string calldata description
    ) external;

    function getStats(address student) external view returns (StudentStats memory);

    function getAchievements(address student) external view returns (Achievement[] memory);

    function hasAchievement(address student, string calldata achievementId) external view returns (bool);

    function studentExists(address student) external view returns (bool);

    function getTotalStudents() external view returns (uint32);
}
