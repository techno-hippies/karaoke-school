// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeScoreboardV2
 * @notice On-chain high scores for karaoke clips with efficient top-10 leaderboard
 * @dev References clip IDs from ClipRegistryV1 contract
 *
 * Architecture:
 * - Dual storage pattern: individual scores + top-10 leaderboard
 * - Individual scores: clipId => user => Score (all users)
 * - Top-10 leaderboard: clipId => LeaderboardEntry[10] (auto-sorted)
 * - Only trusted PKP address can submit scores (prevents cheating)
 * - Gas-optimized with packed structs
 *
 * Benefits over V1:
 * - O(1) leaderboard queries (single call, already sorted)
 * - No N+1 query problem (no need to fetch all users then all scores)
 * - Contract handles sorting automatically
 * - Fixed gas cost for leaderboard updates (max 10 iterations)
 *
 * Integration:
 * - PKP address is funded with gas tokens
 * - Lit Action computes score from speech-to-text
 * - Lit Action signs and submits transaction via this contract
 * - Frontend calls getTopScorers(clipId) for leaderboard (1 call!)
 * - Frontend calls getScore(clipId, user) for individual lookup
 */
contract KaraokeScoreboardV2 {
    struct Score {
        uint96 score;           // 0-100 (using uint96 to pack with timestamp)
        uint64 timestamp;       // Block timestamp
        uint16 attemptCount;    // Total attempts by user for this clip
    }

    struct LeaderboardEntry {
        address user;           // User's wallet address
        uint96 score;           // High score (0-100)
        uint64 timestamp;       // When the high score was achieved
    }

    // State
    mapping(string => mapping(address => Score)) public scores;
    mapping(string => address[]) private usersByClip; // For analytics
    mapping(string => LeaderboardEntry[10]) private topScorers;

    address public trustedScorer;
    address public owner;

    // Events
    event ScoreUpdated(
        string indexed clipId,
        address indexed user,
        uint96 score,
        uint64 timestamp,
        bool isNewHighScore,
        bool enteredTopTen,
        uint8 leaderboardPosition  // 0-9 if in top 10, 255 if not
    );

    event TrustedScorerUpdated(address indexed oldScorer, address indexed newScorer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor(address _trustedScorer) {
        require(_trustedScorer != address(0), "Invalid scorer address");
        owner = msg.sender;
        trustedScorer = _trustedScorer;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyTrustedScorer() {
        require(msg.sender == trustedScorer, "Not trusted scorer");
        _;
    }

    /**
     * @notice Update user's score for a clip (only callable by trusted PKP)
     * @dev Updates individual score and top-10 leaderboard if applicable
     * @param clipId The clip identifier (matches ClipRegistryV1)
     * @param user The user's wallet address
     * @param newScore The score from 0-100
     */
    function updateScore(
        string calldata clipId,
        address user,
        uint96 newScore
    ) external onlyTrustedScorer {
        require(newScore <= 100, "Invalid score");
        require(user != address(0), "Invalid user");
        require(bytes(clipId).length > 0, "Invalid clip ID");

        Score storage userScore = scores[clipId][user];
        bool isNewHighScore = false;
        bool enteredTopTen = false;
        uint8 leaderboardPosition = 255; // 255 = not in top 10

        // Track new user for this clip
        if (userScore.score == 0) {
            usersByClip[clipId].push(user);
        }

        // Update if first attempt or new high score
        if (userScore.score == 0 || newScore > userScore.score) {
            userScore.score = newScore;
            userScore.timestamp = uint64(block.timestamp);
            isNewHighScore = true;

            // Update top-10 leaderboard if score > 0 (prevents zero-score clutter)
            if (newScore > 0) {
                (enteredTopTen, leaderboardPosition) = _updateLeaderboard(
                    clipId,
                    user,
                    newScore,
                    uint64(block.timestamp)
                );
            }
        }

        userScore.attemptCount++;

        emit ScoreUpdated(
            clipId,
            user,
            newScore,
            uint64(block.timestamp),
            isNewHighScore,
            enteredTopTen,
            leaderboardPosition
        );
    }

    /**
     * @notice Update top-10 leaderboard (internal)
     * @dev Maintains sorted order, handles user updates and new entries
     * @param clipId The clip identifier
     * @param user The user's wallet address
     * @param score The user's new high score
     * @param timestamp When the score was achieved
     * @return enteredTopTen Whether the user entered the top 10
     * @return position The position in leaderboard (0-9) or 255 if not in top 10
     */
    function _updateLeaderboard(
        string calldata clipId,
        address user,
        uint96 score,
        uint64 timestamp
    ) private returns (bool enteredTopTen, uint8 position) {
        LeaderboardEntry[10] storage leaderboard = topScorers[clipId];

        // Find user's existing position (if any) and last filled position
        int8 existingPos = -1;
        uint8 lastFilledPos = 0;

        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].user == user) {
                existingPos = int8(i);
            }
            if (leaderboard[i].user != address(0)) {
                lastFilledPos = i;
            }
        }

        // If user already in top 10, remove old entry
        if (existingPos >= 0) {
            // Shift entries down to remove old position
            for (uint8 i = uint8(existingPos); i < 9; i++) {
                leaderboard[i] = leaderboard[i + 1];
            }
            // Clear last entry
            leaderboard[9] = LeaderboardEntry(address(0), 0, 0);
            // Adjust lastFilledPos if needed
            if (lastFilledPos > 0) lastFilledPos--;
        }

        // Find insertion position (sorted descending by score)
        uint8 insertPos = 10; // Default: doesn't qualify

        for (uint8 i = 0; i <= lastFilledPos && i < 10; i++) {
            // Insert before this position if:
            // 1. Empty slot, OR
            // 2. New score is higher, OR
            // 3. Same score but earlier timestamp (tiebreaker)
            if (
                leaderboard[i].user == address(0) ||
                score > leaderboard[i].score ||
                (score == leaderboard[i].score && timestamp < leaderboard[i].timestamp)
            ) {
                insertPos = i;
                break;
            }
        }

        // If leaderboard not full and score didn't find a position, append to end
        if (insertPos == 10 && lastFilledPos < 9) {
            insertPos = lastFilledPos + 1;
        }

        // Insert if position found
        if (insertPos < 10) {
            // Shift entries down to make room
            for (uint8 i = 9; i > insertPos; i--) {
                leaderboard[i] = leaderboard[i - 1];
            }
            // Insert new entry
            leaderboard[insertPos] = LeaderboardEntry(user, score, timestamp);
            return (true, insertPos);
        }

        return (false, 255);
    }

    /**
     * @notice Get user's high score for a clip
     * @param clipId The clip identifier
     * @param user The user's wallet address
     * @return score The user's high score (0-100)
     * @return timestamp When the high score was achieved
     * @return attemptCount Total number of attempts
     */
    function getScore(string calldata clipId, address user)
        external
        view
        returns (uint96 score, uint64 timestamp, uint16 attemptCount)
    {
        Score memory s = scores[clipId][user];
        return (s.score, s.timestamp, s.attemptCount);
    }

    /**
     * @notice Get top 10 scorers for a clip (SINGLE CALL - NO N+1 QUERIES!)
     * @param clipId The clip identifier
     * @return entries Array of top 10 leaderboard entries (sorted descending)
     */
    function getTopScorers(string calldata clipId)
        external
        view
        returns (LeaderboardEntry[10] memory entries)
    {
        return topScorers[clipId];
    }

    /**
     * @notice Get the effective leaderboard size (number of non-zero entries)
     * @param clipId The clip identifier
     * @return count Number of users actually on the leaderboard (0-10)
     */
    function getLeaderboardSize(string calldata clipId)
        external
        view
        returns (uint8 count)
    {
        LeaderboardEntry[10] memory leaderboard = topScorers[clipId];
        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].user == address(0)) {
                return i;
            }
        }
        return 10;
    }

    /**
     * @notice Get all users who have played a clip
     * @dev For analytics purposes - leaderboards should use getTopScorers()
     * @param clipId The clip identifier
     * @return users Array of user addresses
     */
    function getUsersByClip(string calldata clipId)
        external
        view
        returns (address[] memory users)
    {
        return usersByClip[clipId];
    }

    /**
     * @notice Update trusted scorer address (owner only)
     * @param newScorer The new trusted scorer address (PKP)
     */
    function setTrustedScorer(address newScorer) external onlyOwner {
        require(newScorer != address(0), "Invalid address");
        address oldScorer = trustedScorer;
        trustedScorer = newScorer;
        emit TrustedScorerUpdated(oldScorer, newScorer);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner The new owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
