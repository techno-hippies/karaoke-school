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
 * - Leaderboards computed off-chain (zkSync limitation)
 *
 * Integration:
 * - PKP address is funded with gas tokens
 * - Lit Action computes score from speech-to-text
 * - Lit Action signs and submits transaction via this contract
 * - Frontend queries all scores and sorts client-side
 */
contract KaraokeScoreboardV1 {
    struct Score {
        uint96 score;           // 0-100 (using uint96 to pack with timestamp)
        uint64 timestamp;       // Block timestamp
        uint16 attemptCount;    // Total attempts by user for this clip
    }

    // State
    mapping(string => mapping(address => Score)) public scores;
    mapping(string => address[]) private usersByClip;

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

        // Track new user for this clip
        if (userScore.score == 0) {
            usersByClip[clipId].push(user);
        }

        // Update if first attempt or new high score
        if (userScore.score == 0 || newScore > userScore.score) {
            userScore.score = newScore;
            userScore.timestamp = uint64(block.timestamp);
            isNewHighScore = true;
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
     * @notice Get all users who have played a clip
     * @dev Frontend should fetch all scores and sort client-side
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
