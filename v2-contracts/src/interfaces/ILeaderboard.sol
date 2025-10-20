// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title ILeaderboard
 * @notice Interface for unified leaderboard tracking
 * @dev Tracks top performers for songs, segments, and artists
 */
interface ILeaderboard {

    // ============ Types ============

    enum LeaderboardType {
        SONG,           // Best overall for a song
        SEGMENT,        // Best for a specific segment
        ARTIST          // Best across all songs by an artist
    }

    struct LeaderEntry {
        address student;         // Student's address
        uint16 bestScore;        // Best score (basis points)
        uint32 totalAttempts;    // Number of attempts
        uint64 lastUpdated;      // Last update timestamp
    }

    // ============ Events ============

    event LeaderboardUpdated(
        LeaderboardType indexed leaderboardType,
        bytes32 indexed identifier,
        address indexed student,
        uint16 newScore
    );

    // ============ Errors ============

    error InvalidScore();
    error InvalidIdentifier();
    error NotOwner();
    error NotAuthorized();

    // ============ Functions ============

    function updateScore(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        address student,
        uint16 score
    ) external;

    function getTopStudents(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        uint32 limit
    ) external view returns (LeaderEntry[] memory);

    function getStudentRank(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        address student
    ) external view returns (uint32 rank, LeaderEntry memory entry);

    function getStudentEntry(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        address student
    ) external view returns (LeaderEntry memory);
}
