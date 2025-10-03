// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeScoreboardV3
 * @notice On-chain high scores for karaoke with both clip-level and track-level leaderboards
 * @dev Tracks individual clip scores AND aggregated track completion scores
 *
 * Architecture:
 * - Clip-level scoring: clipId => user => Score (for individual clips)
 * - Track-level scoring: trackId => user => TrackScore (aggregate when all clips complete)
 * - Dual leaderboards: per-clip top-10 AND per-track top-10
 * - Track completion: Contract verifies all clips scored before creating track score
 * - Only trusted PKP address can submit scores (prevents cheating)
 *
 * Key Features:
 * - Submit individual clip scores (as before)
 * - Automatic track completion detection when user scores all clips
 * - Track leaderboard shows users who completed ALL clips with their total score
 * - Efficient queries: getTopScorers(clipId) OR getTopTrackScorers(trackId)
 *
 * Integration:
 * - PKP submits clip scores via updateScore(trackId, clipId, user, score)
 * - Contract automatically calculates track total when all clips complete
 * - Frontend calls getTopTrackScorers(trackId) for track leaderboard (1 call!)
 * - Frontend calls getTopScorers(clipId) for clip leaderboard (1 call!)
 */
contract KaraokeScoreboardV3 {
    struct Score {
        uint96 score;           // 0-100 (using uint96 to pack with timestamp)
        uint64 timestamp;       // Block timestamp
        uint16 attemptCount;    // Total attempts by user for this clip
    }

    struct TrackScore {
        uint96 totalScore;      // Sum of all clip scores (0-100 * numClips)
        uint64 timestamp;       // When track was completed
        uint16 clipsCompleted;  // Number of clips scored
        bool isComplete;        // True when all clips scored
    }

    struct LeaderboardEntry {
        address user;           // User's wallet address
        uint96 score;           // High score
        uint64 timestamp;       // When the high score was achieved
    }

    // State
    mapping(string => mapping(address => Score)) public clipScores;
    mapping(string => mapping(address => TrackScore)) public trackScores;
    mapping(string => LeaderboardEntry[10]) private clipLeaderboards;
    mapping(string => LeaderboardEntry[10]) private trackLeaderboards;

    // Track configuration: trackId => clipIds[]
    mapping(string => string[]) public trackClips;
    mapping(string => bool) public trackExists;

    address public trustedScorer;
    address public owner;
    bool public paused;

    // Events
    event ClipScoreUpdated(
        string indexed trackId,
        string indexed clipId,
        address indexed user,
        uint96 score,
        uint64 timestamp,
        bool isNewHighScore,
        bool enteredClipTopTen,
        uint8 clipLeaderboardPosition
    );

    event TrackCompleted(
        string indexed trackId,
        address indexed user,
        uint96 totalScore,
        uint64 timestamp,
        bool enteredTrackTopTen,
        uint8 trackLeaderboardPosition
    );

    event TrackConfigured(
        string indexed trackId,
        string[] clipIds,
        uint16 clipCount
    );

    event TrackClipsUpdated(
        string indexed trackId,
        string[] newClipIds,
        uint16 clipCount
    );

    event TrustedScorerUpdated(address indexed oldScorer, address indexed newScorer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

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

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @notice Configure a track with its clip IDs (owner only)
     * @dev Must be called before scores can be submitted for a track
     * @param trackId The track identifier (e.g., "down-home-blues")
     * @param clipIds Array of clip IDs that belong to this track
     */
    function configureTrack(
        string calldata trackId,
        string[] calldata clipIds
    ) external onlyOwner {
        require(bytes(trackId).length > 0, "Invalid track ID");
        require(clipIds.length > 0, "Must have at least one clip");
        require(clipIds.length <= 100, "Too many clips");

        trackClips[trackId] = clipIds;
        trackExists[trackId] = true;

        emit TrackConfigured(trackId, clipIds, uint16(clipIds.length));
    }

    /**
     * @notice Update clip IDs for an existing track (owner only)
     * @dev WARNING: Does not recalculate existing trackScores. Use for fixes/additions only.
     *      Emit event to signal frontends to refresh. Consider deprecating old trackId if major changes.
     * @param trackId The track identifier
     * @param newClipIds Updated array of clip IDs
     */
    function updateTrackClips(
        string calldata trackId,
        string[] calldata newClipIds
    ) external onlyOwner {
        require(trackExists[trackId], "Track does not exist");
        require(newClipIds.length > 0, "Must have at least one clip");
        require(newClipIds.length <= 100, "Too many clips");

        trackClips[trackId] = newClipIds;

        emit TrackClipsUpdated(trackId, newClipIds, uint16(newClipIds.length));
    }

    /**
     * @notice Update user's score for a clip (only callable by trusted PKP)
     * @dev Updates clip score and checks for track completion
     * @param trackId The track identifier (e.g., "down-home-blues")
     * @param clipId The clip identifier (e.g., "down-home-blues-verse")
     * @param user The user's wallet address
     * @param newScore The score from 0-100
     */
    function updateScore(
        string calldata trackId,
        string calldata clipId,
        address user,
        uint96 newScore
    ) external onlyTrustedScorer whenNotPaused {
        require(newScore <= 100, "Invalid score");
        require(user != address(0), "Invalid user");
        require(bytes(clipId).length > 0, "Invalid clip ID");
        require(trackExists[trackId], "Track not configured");

        Score storage userClipScore = clipScores[clipId][user];
        bool isNewHighScore = false;
        bool enteredClipTopTen = false;
        uint8 clipLeaderboardPosition = 255;

        // Update if first attempt or new high score
        if (userClipScore.score == 0 || newScore > userClipScore.score) {
            userClipScore.score = newScore;
            userClipScore.timestamp = uint64(block.timestamp);
            isNewHighScore = true;

            // Update clip leaderboard
            if (newScore > 0) {
                (enteredClipTopTen, clipLeaderboardPosition) = _updateLeaderboard(
                    clipLeaderboards[clipId],
                    user,
                    newScore,
                    uint64(block.timestamp)
                );
            }
        }

        userClipScore.attemptCount++;

        emit ClipScoreUpdated(
            trackId,
            clipId,
            user,
            newScore,
            uint64(block.timestamp),
            isNewHighScore,
            enteredClipTopTen,
            clipLeaderboardPosition
        );

        // Check for track completion (only if this was a high score)
        if (isNewHighScore) {
            _checkTrackCompletion(trackId, user);
        }
    }

    /**
     * @notice Check if user has completed all clips in a track and update track score
     * @dev Internal function called after each clip score update
     * @param trackId The track identifier
     * @param user The user's wallet address
     */
    function _checkTrackCompletion(
        string calldata trackId,
        address user
    ) private {
        string[] storage clips = trackClips[trackId];
        uint256 clipCount = clips.length;
        uint96 totalScore = 0;
        uint16 clipsCompleted = 0;
        uint64 latestTimestamp = 0;

        // Sum up all clip scores for this user
        for (uint256 i = 0; i < clipCount; i++) {
            Score storage clipScore = clipScores[clips[i]][user];
            if (clipScore.score > 0) {
                totalScore += clipScore.score;
                clipsCompleted++;
                if (clipScore.timestamp > latestTimestamp) {
                    latestTimestamp = clipScore.timestamp;
                }
            }
        }

        // Update track score
        TrackScore storage userTrackScore = trackScores[trackId][user];
        bool isNowComplete = (clipsCompleted == clipCount);

        userTrackScore.totalScore = totalScore;
        userTrackScore.timestamp = latestTimestamp;
        userTrackScore.clipsCompleted = clipsCompleted;
        userTrackScore.isComplete = isNowComplete;

        // If track just completed OR improved while complete, update track leaderboard
        if (isNowComplete && (totalScore > 0)) {
            (bool enteredTrackTopTen, uint8 trackLeaderboardPosition) = _updateLeaderboard(
                trackLeaderboards[trackId],
                user,
                totalScore,
                latestTimestamp
            );

            emit TrackCompleted(
                trackId,
                user,
                totalScore,
                latestTimestamp,
                enteredTrackTopTen,
                trackLeaderboardPosition
            );
        }
    }

    /**
     * @notice Update leaderboard (internal, used for both clip and track leaderboards)
     * @dev Maintains sorted order, handles user updates and new entries
     * @param leaderboard Storage reference to the leaderboard array
     * @param user The user's wallet address
     * @param score The user's score
     * @param timestamp When the score was achieved
     * @return enteredTopTen Whether the user entered the top 10
     * @return position The position in leaderboard (0-9) or 255 if not in top 10
     */
    function _updateLeaderboard(
        LeaderboardEntry[10] storage leaderboard,
        address user,
        uint96 score,
        uint64 timestamp
    ) private returns (bool enteredTopTen, uint8 position) {
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
    function getClipScore(string calldata clipId, address user)
        external
        view
        returns (uint96 score, uint64 timestamp, uint16 attemptCount)
    {
        Score memory s = clipScores[clipId][user];
        return (s.score, s.timestamp, s.attemptCount);
    }

    /**
     * @notice Get user's track score and completion status
     * @param trackId The track identifier
     * @param user The user's wallet address
     * @return totalScore Sum of all clip scores
     * @return timestamp When last clip was scored
     * @return clipsCompleted Number of clips scored
     * @return isComplete Whether all clips have been scored
     */
    function getTrackScore(string calldata trackId, address user)
        external
        view
        returns (uint96 totalScore, uint64 timestamp, uint16 clipsCompleted, bool isComplete)
    {
        TrackScore memory ts = trackScores[trackId][user];
        return (ts.totalScore, ts.timestamp, ts.clipsCompleted, ts.isComplete);
    }

    /**
     * @notice Get top 10 scorers for a clip
     * @param clipId The clip identifier
     * @return entries Array of top 10 leaderboard entries (sorted descending)
     */
    function getTopClipScorers(string calldata clipId)
        external
        view
        returns (LeaderboardEntry[10] memory entries)
    {
        return clipLeaderboards[clipId];
    }

    /**
     * @notice Get top 10 scorers for a track (users who completed ALL clips)
     * @param trackId The track identifier
     * @return entries Array of top 10 leaderboard entries (sorted descending)
     */
    function getTopTrackScorers(string calldata trackId)
        external
        view
        returns (LeaderboardEntry[10] memory entries)
    {
        return trackLeaderboards[trackId];
    }

    /**
     * @notice Get clip IDs for a track
     * @param trackId The track identifier
     * @return clipIds Array of clip IDs
     */
    function getTrackClips(string calldata trackId)
        external
        view
        returns (string[] memory clipIds)
    {
        return trackClips[trackId];
    }

    /**
     * @notice Get the effective leaderboard size (number of non-zero entries)
     * @param clipId The clip identifier
     * @return count Number of users actually on the clip leaderboard (0-10)
     */
    function getClipLeaderboardSize(string calldata clipId)
        external
        view
        returns (uint8 count)
    {
        LeaderboardEntry[10] memory leaderboard = clipLeaderboards[clipId];
        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].user == address(0)) {
                return i;
            }
        }
        return 10;
    }

    /**
     * @notice Get the effective track leaderboard size
     * @param trackId The track identifier
     * @return count Number of users actually on the track leaderboard (0-10)
     */
    function getTrackLeaderboardSize(string calldata trackId)
        external
        view
        returns (uint8 count)
    {
        LeaderboardEntry[10] memory leaderboard = trackLeaderboards[trackId];
        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].user == address(0)) {
                return i;
            }
        }
        return 10;
    }

    /**
     * @notice Pause score submissions (owner only, emergency use)
     * @dev Prevents updateScore calls. Does not affect queries.
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause score submissions (owner only)
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
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
