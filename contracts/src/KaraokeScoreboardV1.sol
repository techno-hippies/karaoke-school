// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeScoreboardV1
 * @notice On-chain high scores for karaoke clips
 * @dev References clip IDs from ClipRegistryV1 contract
 *
 * Architecture:
 * - Stores user high scores per clip (clipId => user => Score)
 * - Only trusted PKP address can submit scores (prevents cheating)
 * - Gas-optimized with packed structs
 * - Maintains sorted leaderboards per clip
 *
 * Integration:
 * - PKP address is funded with gas tokens
 * - Lit Action computes score from speech-to-text
 * - Lit Action signs and submits transaction via this contract
 * - Frontend queries scores for leaderboards
 */
contract KaraokeScoreboardV1 {
    struct Score {
        uint96 score;           // 0-100 (using uint96 to pack with timestamp)
        uint64 timestamp;       // Block timestamp
        uint16 attemptCount;    // Total attempts by user for this clip
    }

    // State
    mapping(string => mapping(address => Score)) public scores;
    mapping(string => address[]) private leaderboards;

    address public trustedScorer;
    address public owner;

    // Events
    event ScoreUpdated(
        string indexed clipId,
        address indexed user,
        uint96 score,
        uint64 timestamp,
        bool isNewHighScore
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
     * @dev Only updates if new score is higher than current high score
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

        // Update if first attempt or new high score
        if (userScore.score == 0 || newScore > userScore.score) {
            userScore.score = newScore;
            userScore.timestamp = uint64(block.timestamp);
            isNewHighScore = true;

            // Update leaderboard
            _updateLeaderboard(clipId, user);
        }

        userScore.attemptCount++;

        emit ScoreUpdated(clipId, user, newScore, uint64(block.timestamp), isNewHighScore);
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
     * @notice Get top N scores for a clip
     * @param clipId The clip identifier
     * @param limit Maximum number of scores to return
     * @return users Array of user addresses
     * @return topScores Array of corresponding scores
     */
    function getTopScores(string calldata clipId, uint256 limit)
        external
        view
        returns (address[] memory users, uint96[] memory topScores)
    {
        address[] memory leaders = leaderboards[clipId];
        uint256 count = limit < leaders.length ? limit : leaders.length;

        users = new address[](count);
        topScores = new uint96[](count);

        for (uint256 i = 0; i < count; i++) {
            users[i] = leaders[i];
            topScores[i] = scores[clipId][leaders[i]].score;
        }

        return (users, topScores);
    }

    /**
     * @notice Get leaderboard size for a clip
     * @param clipId The clip identifier
     * @return count Number of users who have scores for this clip
     */
    function getLeaderboardSize(string calldata clipId)
        external
        view
        returns (uint256 count)
    {
        return leaderboards[clipId].length;
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

    /**
     * @dev Internal function to maintain sorted leaderboard
     * @notice Simplified implementation - for production, consider more efficient data structure
     * @param clipId The clip identifier
     * @param user The user to add/update in leaderboard
     */
    function _updateLeaderboard(string calldata clipId, address user) private {
        address[] storage leaders = leaderboards[clipId];
        uint96 userScore = scores[clipId][user].score;

        // Check if user already in leaderboard
        bool found = false;
        for (uint256 i = 0; i < leaders.length; i++) {
            if (leaders[i] == user) {
                found = true;
                break;
            }
        }

        if (!found) {
            leaders.push(user);
        }

        // Simple bubble sort (for production, consider off-chain sorting)
        // Limited to prevent excessive gas usage
        uint256 maxSortLength = leaders.length < 100 ? leaders.length : 100;
        for (uint256 i = 0; i < maxSortLength; i++) {
            for (uint256 j = i + 1; j < maxSortLength; j++) {
                if (scores[clipId][leaders[j]].score > scores[clipId][leaders[i]].score) {
                    address temp = leaders[i];
                    leaders[i] = leaders[j];
                    leaders[j] = temp;
                }
            }
        }

        // Cap leaderboard size (top 100 only)
        if (leaders.length > 100) {
            leaders.pop();
        }
    }
}
