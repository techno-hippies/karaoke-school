// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeScoreboardV4
 * @notice On-chain high scores for karaoke with multi-source content support
 * @dev Tracks scores across multiple content sources (Native, Genius, SoundCloud, Spotify)
 *
 * Architecture:
 * - ContentSource enum for type-safe source tracking
 * - Hash-based storage: keccak256(source, id) for gas efficiency
 * - Segment-level scoring: individual practice units from any source
 * - Track-level scoring: aggregate when all segments complete
 * - Dual leaderboards: per-segment top-10 AND per-track top-10
 * - Human-readable events with source information
 * - Only trusted PKP address can submit scores (prevents cheating)
 *
 * Key Changes from V3:
 * - "Clip" → "Segment" terminology
 * - Formalized ContentSource enum
 * - Hash-based keys for efficient storage
 * - Source field in all events
 *
 * Integration:
 * - PKP submits segment scores via updateScore(source, trackId, segmentId, user, score)
 * - Contract automatically calculates track total when all segments complete
 * - Frontend calls getTopSegmentScorers(source, segmentId) for segment leaderboard
 * - Frontend calls getTopTrackScorers(source, trackId) for track leaderboard
 */
contract KaraokeScoreboardV4 {
    // ========================================================================
    // Types & Structs
    // ========================================================================

    /**
     * @notice Content source enumeration
     * @dev Identifies where content originates from
     */
    enum ContentSource {
        Native,      // 0: Songs from SongRegistryV4 contract
        Genius,      // 1: Songs from Genius.com API
        Soundcloud,  // 2: Songs from SoundCloud
        Spotify      // 3: Songs from Spotify
    }

    struct Score {
        uint96 score;           // 0-100 (using uint96 to pack with timestamp)
        uint64 timestamp;       // Block timestamp
        uint16 attemptCount;    // Total attempts by user for this segment
    }

    struct TrackScore {
        uint96 totalScore;      // Sum of all segment scores (0-100 * numSegments)
        uint64 timestamp;       // When track was completed
        uint16 segmentsCompleted;  // Number of segments scored
        bool isComplete;        // True when all segments scored
    }

    struct LeaderboardEntry {
        address user;           // User's wallet address
        uint96 score;           // High score
        uint64 timestamp;       // When the high score was achieved
    }

    // ========================================================================
    // State
    // ========================================================================

    // Scoring storage (hash-based)
    mapping(bytes32 => mapping(address => Score)) public segmentScores;
    mapping(bytes32 => mapping(address => TrackScore)) public trackScores;
    mapping(bytes32 => LeaderboardEntry[10]) private segmentLeaderboards;
    mapping(bytes32 => LeaderboardEntry[10]) private trackLeaderboards;

    // Track configuration: trackHash => segmentHashes[]
    mapping(bytes32 => bytes32[]) public trackSegments;
    mapping(bytes32 => bool) public trackExists;

    address public trustedScorer;
    address public owner;
    bool public paused;

    // ========================================================================
    // Events
    // ========================================================================

    event SegmentScoreUpdated(
        uint8 indexed source,
        string trackId,
        string segmentId,
        address indexed user,
        uint96 score,
        uint64 timestamp,
        bool isNewHighScore,
        bool enteredTopTen,
        uint8 leaderboardPosition
    );

    event TrackCompleted(
        uint8 indexed source,
        string trackId,
        address indexed user,
        uint96 totalScore,
        uint64 timestamp,
        bool enteredTopTen,
        uint8 leaderboardPosition
    );

    event TrackConfigured(
        uint8 indexed source,
        string trackId,
        bytes32 trackHash,
        bytes32[] segmentHashes,
        uint16 segmentCount
    );

    event TrackSegmentsUpdated(
        uint8 indexed source,
        string trackId,
        bytes32 trackHash,
        bytes32[] newSegmentHashes,
        uint16 segmentCount
    );

    event TrustedScorerUpdated(address indexed oldScorer, address indexed newScorer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ========================================================================
    // Constructor & Modifiers
    // ========================================================================

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

    // ========================================================================
    // Utility Functions
    // ========================================================================

    /**
     * @notice Generate content hash from source + ID
     * @dev Uses keccak256 for deterministic hashing
     * @param source Content source (0=Native, 1=Genius, etc.)
     * @param id Content identifier (e.g., "heat-of-the-night-scarlett-x" or "123456")
     */
    function getContentHash(uint8 source, string calldata id)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(source, id));
    }

    // ========================================================================
    // Track Configuration
    // ========================================================================

    /**
     * @notice Configure a track with its segment IDs (owner only)
     * @dev Must be called before scores can be submitted for a track
     * @param source Content source
     * @param trackId The track identifier
     * @param segmentIds Array of segment IDs that belong to this track
     */
    function configureTrack(
        uint8 source,
        string calldata trackId,
        string[] calldata segmentIds
    ) external onlyOwner {
        require(bytes(trackId).length > 0, "Invalid track ID");
        require(segmentIds.length > 0, "Must have at least one segment");
        require(segmentIds.length <= 100, "Too many segments");

        bytes32 trackHash = getContentHash(source, trackId);
        require(!trackExists[trackHash], "Track already configured");

        // Convert segment IDs to hashes
        bytes32[] memory segmentHashes = new bytes32[](segmentIds.length);
        for (uint256 i = 0; i < segmentIds.length; i++) {
            segmentHashes[i] = getContentHash(source, segmentIds[i]);
        }

        trackSegments[trackHash] = segmentHashes;
        trackExists[trackHash] = true;

        emit TrackConfigured(source, trackId, trackHash, segmentHashes, uint16(segmentIds.length));
    }

    /**
     * @notice Update segment IDs for an existing track (owner only)
     * @dev WARNING: Does not recalculate existing trackScores. Use for fixes/additions only.
     * @param source Content source
     * @param trackId The track identifier
     * @param newSegmentIds Updated array of segment IDs
     */
    function updateTrackSegments(
        uint8 source,
        string calldata trackId,
        string[] calldata newSegmentIds
    ) external onlyOwner {
        bytes32 trackHash = getContentHash(source, trackId);
        require(trackExists[trackHash], "Track does not exist");
        require(newSegmentIds.length > 0, "Must have at least one segment");
        require(newSegmentIds.length <= 100, "Too many segments");

        // Convert segment IDs to hashes
        bytes32[] memory segmentHashes = new bytes32[](newSegmentIds.length);
        for (uint256 i = 0; i < newSegmentIds.length; i++) {
            segmentHashes[i] = getContentHash(source, newSegmentIds[i]);
        }

        trackSegments[trackHash] = segmentHashes;

        emit TrackSegmentsUpdated(source, trackId, trackHash, segmentHashes, uint16(newSegmentIds.length));
    }

    // ========================================================================
    // Score Submission
    // ========================================================================

    /**
     * @notice Update user's score for a segment (only callable by trusted PKP)
     * @dev Updates segment score and checks for track completion
     * @param source Content source
     * @param trackId The track identifier
     * @param segmentId The segment identifier
     * @param user The user's wallet address
     * @param newScore The score from 0-100
     */
    function updateScore(
        uint8 source,
        string calldata trackId,
        string calldata segmentId,
        address user,
        uint96 newScore
    ) external onlyTrustedScorer whenNotPaused {
        require(newScore <= 100, "Invalid score");
        require(user != address(0), "Invalid user");
        require(bytes(segmentId).length > 0, "Invalid segment ID");

        bytes32 trackHash = getContentHash(source, trackId);
        bytes32 segmentHash = getContentHash(source, segmentId);

        require(trackExists[trackHash], "Track not configured");

        Score storage userSegmentScore = segmentScores[segmentHash][user];
        bool isNewHighScore = false;
        bool enteredTopTen = false;
        uint8 leaderboardPosition = 255;

        // Update if first attempt or new high score
        if (userSegmentScore.score == 0 || newScore > userSegmentScore.score) {
            userSegmentScore.score = newScore;
            userSegmentScore.timestamp = uint64(block.timestamp);
            isNewHighScore = true;

            // Update segment leaderboard
            if (newScore > 0) {
                (enteredTopTen, leaderboardPosition) = _updateLeaderboard(
                    segmentLeaderboards[segmentHash],
                    user,
                    newScore,
                    uint64(block.timestamp)
                );
            }
        }

        userSegmentScore.attemptCount++;

        emit SegmentScoreUpdated(
            source,
            trackId,
            segmentId,
            user,
            newScore,
            uint64(block.timestamp),
            isNewHighScore,
            enteredTopTen,
            leaderboardPosition
        );

        // Check for track completion (only if this was a high score)
        if (isNewHighScore) {
            _checkTrackCompletion(source, trackId, trackHash, user);
        }
    }

    /**
     * @notice Check if user has completed all segments in a track and update track score
     * @dev Internal function called after each segment score update
     */
    function _checkTrackCompletion(
        uint8 source,
        string calldata trackId,
        bytes32 trackHash,
        address user
    ) private {
        bytes32[] storage segments = trackSegments[trackHash];
        uint256 segmentCount = segments.length;
        uint96 totalScore = 0;
        uint16 segmentsCompleted = 0;
        uint64 latestTimestamp = 0;

        // Sum up all segment scores for this user
        for (uint256 i = 0; i < segmentCount; i++) {
            Score storage segmentScore = segmentScores[segments[i]][user];
            if (segmentScore.score > 0) {
                totalScore += segmentScore.score;
                segmentsCompleted++;
                if (segmentScore.timestamp > latestTimestamp) {
                    latestTimestamp = segmentScore.timestamp;
                }
            }
        }

        // Update track score
        TrackScore storage userTrackScore = trackScores[trackHash][user];
        bool isNowComplete = (segmentsCompleted == segmentCount);

        userTrackScore.totalScore = totalScore;
        userTrackScore.timestamp = latestTimestamp;
        userTrackScore.segmentsCompleted = segmentsCompleted;
        userTrackScore.isComplete = isNowComplete;

        // If track just completed OR improved while complete, update track leaderboard
        if (isNowComplete && (totalScore > 0)) {
            (bool enteredTopTen, uint8 trackLeaderboardPosition) = _updateLeaderboard(
                trackLeaderboards[trackHash],
                user,
                totalScore,
                latestTimestamp
            );

            emit TrackCompleted(
                source,
                trackId,
                user,
                totalScore,
                latestTimestamp,
                enteredTopTen,
                trackLeaderboardPosition
            );
        }
    }

    /**
     * @notice Update leaderboard (internal, used for both segment and track leaderboards)
     * @dev Maintains sorted order, handles user updates and new entries
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

    // ========================================================================
    // Query Functions
    // ========================================================================

    /**
     * @notice Get user's high score for a segment
     */
    function getSegmentScore(uint8 source, string calldata segmentId, address user)
        external
        view
        returns (uint96 score, uint64 timestamp, uint16 attemptCount)
    {
        bytes32 segmentHash = getContentHash(source, segmentId);
        Score memory s = segmentScores[segmentHash][user];
        return (s.score, s.timestamp, s.attemptCount);
    }

    /**
     * @notice Get user's track score and completion status
     */
    function getTrackScore(uint8 source, string calldata trackId, address user)
        external
        view
        returns (uint96 totalScore, uint64 timestamp, uint16 segmentsCompleted, bool isComplete)
    {
        bytes32 trackHash = getContentHash(source, trackId);
        TrackScore memory ts = trackScores[trackHash][user];
        return (ts.totalScore, ts.timestamp, ts.segmentsCompleted, ts.isComplete);
    }

    /**
     * @notice Get top 10 scorers for a segment
     */
    function getTopSegmentScorers(uint8 source, string calldata segmentId)
        external
        view
        returns (LeaderboardEntry[10] memory entries)
    {
        bytes32 segmentHash = getContentHash(source, segmentId);
        return segmentLeaderboards[segmentHash];
    }

    /**
     * @notice Get top 10 scorers for a track (users who completed ALL segments)
     */
    function getTopTrackScorers(uint8 source, string calldata trackId)
        external
        view
        returns (LeaderboardEntry[10] memory entries)
    {
        bytes32 trackHash = getContentHash(source, trackId);
        return trackLeaderboards[trackHash];
    }

    /**
     * @notice Get segment hashes for a track
     */
    function getTrackSegments(uint8 source, string calldata trackId)
        external
        view
        returns (bytes32[] memory segmentHashes)
    {
        bytes32 trackHash = getContentHash(source, trackId);
        return trackSegments[trackHash];
    }

    /**
     * @notice Get the effective segment leaderboard size
     */
    function getSegmentLeaderboardSize(uint8 source, string calldata segmentId)
        external
        view
        returns (uint8 count)
    {
        bytes32 segmentHash = getContentHash(source, segmentId);
        LeaderboardEntry[10] memory leaderboard = segmentLeaderboards[segmentHash];
        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].user == address(0)) {
                return i;
            }
        }
        return 10;
    }

    /**
     * @notice Get the effective track leaderboard size
     */
    function getTrackLeaderboardSize(uint8 source, string calldata trackId)
        external
        view
        returns (uint8 count)
    {
        bytes32 trackHash = getContentHash(source, trackId);
        LeaderboardEntry[10] memory leaderboard = trackLeaderboards[trackHash];
        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].user == address(0)) {
                return i;
            }
        }
        return 10;
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

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
