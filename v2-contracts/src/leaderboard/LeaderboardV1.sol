// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ILeaderboard.sol";

/**
 * @title LeaderboardV1
 * @notice Unified leaderboard for songs, segments, and artists
 * @dev Tracks top performers across different dimensions
 *
 * Design Philosophy:
 * - Single contract for all leaderboard types (gas efficient)
 * - Uses composite key: hash(leaderboardType, identifier, student)
 * - Optimized for reads (getTopStudents) over writes
 * - Top N stored in sorted order for fast queries
 *
 * Identifiers:
 * - SONG: bytes32(uint256(geniusId))
 * - SEGMENT: segmentHash (from SegmentRegistry)
 * - ARTIST: bytes32(uint256(geniusArtistId))
 *
 * Version: 1.0.0
 * Author: Karaoke School
 */
contract LeaderboardV1 is ILeaderboard {

    // ============ State Variables ============

    address public owner;
    mapping(address => bool) public isAuthorized;

    // Composite storage: hash(type, identifier) => student => LeaderEntry
    mapping(bytes32 => mapping(address => LeaderEntry)) private entries;

    // Top N tracking: hash(type, identifier) => sorted array of students
    mapping(bytes32 => address[]) private topStudents;

    // Constants
    uint32 private constant MAX_TOP_N = 100;

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

    // ============ Update Functions ============

    /**
     * @notice Update a student's score on a leaderboard
     * @param leaderboardType Type of leaderboard
     * @param identifier Unique identifier (songId, segmentHash, or artistId)
     * @param student Student's address
     * @param score New score (basis points)
     * @dev Only updates if new score is better than existing
     */
    function updateScore(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        address student,
        uint16 score
    ) external onlyAuthorized {
        if (score > 10000) revert InvalidScore();
        if (identifier == bytes32(0)) revert InvalidIdentifier();

        bytes32 leaderboardKey = _getLeaderboardKey(leaderboardType, identifier);
        LeaderEntry storage entry = entries[leaderboardKey][student];

        bool isNewEntry = entry.student == address(0);
        bool isBetterScore = score > entry.bestScore;

        if (isNewEntry) {
            // New entry
            entry.student = student;
            entry.bestScore = score;
            entry.totalAttempts = 1;
            entry.lastUpdated = uint64(block.timestamp);

            // Add to top N
            _addToTopN(leaderboardKey, student, score);
        } else {
            // Update existing entry
            entry.totalAttempts++;
            entry.lastUpdated = uint64(block.timestamp);

            if (isBetterScore) {
                entry.bestScore = score;
                // Update position in top N
                _updateTopN(leaderboardKey, student, score);
            }
        }

        emit LeaderboardUpdated(leaderboardType, identifier, student, score);
    }

    // ============ Query Functions ============

    /**
     * @notice Get top students for a leaderboard
     * @param leaderboardType Type of leaderboard
     * @param identifier Unique identifier
     * @param limit Maximum number of entries to return
     * @return Array of leader entries (sorted by score descending)
     */
    function getTopStudents(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        uint32 limit
    ) external view returns (LeaderEntry[] memory) {
        bytes32 leaderboardKey = _getLeaderboardKey(leaderboardType, identifier);
        address[] memory top = topStudents[leaderboardKey];

        if (top.length == 0) {
            return new LeaderEntry[](0);
        }

        uint256 resultCount = limit < top.length ? limit : top.length;
        LeaderEntry[] memory result = new LeaderEntry[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = entries[leaderboardKey][top[i]];
        }

        return result;
    }

    /**
     * @notice Get a student's rank on a leaderboard
     * @param leaderboardType Type of leaderboard
     * @param identifier Unique identifier
     * @param student Student's address
     * @return rank Student's rank (1-indexed, 0 = not ranked)
     * @return entry Student's leaderboard entry
     */
    function getStudentRank(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        address student
    ) external view returns (uint32 rank, LeaderEntry memory entry) {
        bytes32 leaderboardKey = _getLeaderboardKey(leaderboardType, identifier);
        address[] memory top = topStudents[leaderboardKey];

        entry = entries[leaderboardKey][student];

        // Find rank
        for (uint256 i = 0; i < top.length; i++) {
            if (top[i] == student) {
                return (uint32(i + 1), entry);
            }
        }

        return (0, entry); // Not in top N
    }

    /**
     * @notice Get a student's entry for a leaderboard
     * @param leaderboardType Type of leaderboard
     * @param identifier Unique identifier
     * @param student Student's address
     * @return Student's leaderboard entry
     */
    function getStudentEntry(
        LeaderboardType leaderboardType,
        bytes32 identifier,
        address student
    ) external view returns (LeaderEntry memory) {
        bytes32 leaderboardKey = _getLeaderboardKey(leaderboardType, identifier);
        return entries[leaderboardKey][student];
    }

    // ============ Internal Functions ============

    /**
     * @notice Generate composite key for leaderboard
     */
    function _getLeaderboardKey(LeaderboardType leaderboardType, bytes32 identifier)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(uint8(leaderboardType), identifier));
    }

    /**
     * @notice Add student to top N (insertion sort)
     */
    function _addToTopN(bytes32 leaderboardKey, address student, uint16 score)
        internal
    {
        address[] storage top = topStudents[leaderboardKey];

        // Add to end
        top.push(student);

        // Bubble up to correct position
        uint256 i = top.length - 1;
        while (i > 0) {
            address prevStudent = top[i - 1];
            uint16 prevScore = entries[leaderboardKey][prevStudent].bestScore;

            if (score <= prevScore) break;

            // Swap
            top[i] = prevStudent;
            top[i - 1] = student;
            i--;
        }

        // Trim if exceeded MAX_TOP_N
        if (top.length > MAX_TOP_N) {
            top.pop();
        }
    }

    /**
     * @notice Update student's position in top N (after score improvement)
     */
    function _updateTopN(bytes32 leaderboardKey, address student, uint16 newScore)
        internal
    {
        address[] storage top = topStudents[leaderboardKey];

        // Find current position
        uint256 currentPos = type(uint256).max;
        for (uint256 i = 0; i < top.length; i++) {
            if (top[i] == student) {
                currentPos = i;
                break;
            }
        }

        // Not in top N, try to add
        if (currentPos == type(uint256).max) {
            if (top.length < MAX_TOP_N) {
                _addToTopN(leaderboardKey, student, newScore);
            } else {
                // Check if better than last place
                address lastStudent = top[top.length - 1];
                uint16 lastScore = entries[leaderboardKey][lastStudent].bestScore;
                if (newScore > lastScore) {
                    top[top.length - 1] = student;
                    _bubbleUp(leaderboardKey, top.length - 1);
                }
            }
            return;
        }

        // Already in top N, bubble up to new position
        _bubbleUp(leaderboardKey, currentPos);
    }

    /**
     * @notice Bubble student up to correct position
     */
    function _bubbleUp(bytes32 leaderboardKey, uint256 startPos) internal {
        address[] storage top = topStudents[leaderboardKey];
        address student = top[startPos];
        uint16 score = entries[leaderboardKey][student].bestScore;

        uint256 i = startPos;
        while (i > 0) {
            address prevStudent = top[i - 1];
            uint16 prevScore = entries[leaderboardKey][prevStudent].bestScore;

            if (score <= prevScore) break;

            // Swap
            top[i] = prevStudent;
            top[i - 1] = student;
            i--;
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize/revoke updater
     */
    function setAuthorized(address updater, bool authorized) external onlyOwner {
        isAuthorized[updater] = authorized;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidIdentifier();
        owner = newOwner;
        isAuthorized[newOwner] = true;
    }
}
