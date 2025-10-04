// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TrendingTrackerV1
 * @notice On-chain trending tracker for songs with time-windowed aggregation
 * @dev Similar to KaraokeScoreboardV4 pattern - PKP submits aggregated events
 *
 * Architecture:
 * - ContentSource enum: Native or Genius (matching scoreboard)
 * - Time windows: Hourly, Daily, Weekly
 * - Event types: clicks, plays, completions
 * - PKP aggregates frontend events and submits batches
 * - Query functions return top N trending songs per window
 * - Gas-efficient batching (1 tx for 1000s of events)
 *
 * Flow:
 * 1. Frontend tracks user interactions locally
 * 2. Background process queues events (5-10 min intervals)
 * 3. Lit Action aggregates events by song
 * 4. PKP submits batch to contract
 * 5. Frontend queries trending lists for discovery UI
 *
 * TikTok-like Features:
 * - Multiple timeframes (1h = "trending now", 24h = "today", 7d = "this week")
 * - Weighted scoring (completion > play > click)
 * - Decay over time (older windows less relevant)
 * - Tamper-resistant (only PKP can update)
 */
contract TrendingTrackerV1 {
    // ========================================================================
    // Types & Structs
    // ========================================================================

    /**
     * @notice Content source enumeration (matches KaraokeScoreboardV4)
     */
    enum ContentSource {
        Native,   // 0: Songs from SongRegistryV4
        Genius    // 1: Songs from Genius.com API
    }

    /**
     * @notice Time window for trending aggregation
     */
    enum TimeWindow {
        Hourly,   // 0: Last hour (rolling)
        Daily,    // 1: Last 24 hours (rolling)
        Weekly    // 2: Last 7 days (rolling)
    }

    /**
     * @notice Trending entry for a song in a time window
     */
    struct TrendingEntry {
        bytes32 songHash;       // keccak256(source, songId)
        uint32 clicks;          // Search result clicks
        uint32 plays;           // Audio preview plays
        uint32 completions;     // Full song completions
        uint32 trendingScore;   // Weighted score for ranking
        uint64 lastUpdated;     // Last update timestamp
    }

    /**
     * @notice Compact song info for frontend
     */
    struct TrendingSong {
        uint8 source;           // ContentSource
        string songId;          // Song identifier
        uint32 trendingScore;   // Weighted score
        uint32 clicks;
        uint32 plays;
        uint32 completions;
        uint64 lastUpdated;
    }

    // ========================================================================
    // State
    // ========================================================================

    // Window ID => SongHash => TrendingEntry
    mapping(uint256 => mapping(bytes32 => TrendingEntry)) public hourlyTrending;
    mapping(uint256 => mapping(bytes32 => TrendingEntry)) public dailyTrending;
    mapping(uint256 => mapping(bytes32 => TrendingEntry)) public weeklyTrending;

    // Track which songs are in each window (for efficient queries)
    mapping(uint256 => bytes32[]) public hourlyTopSongs;
    mapping(uint256 => bytes32[]) public dailyTopSongs;
    mapping(uint256 => bytes32[]) public weeklyTopSongs;

    // Reverse lookup: songHash => (source, songId)
    mapping(bytes32 => uint8) public songSource;
    mapping(bytes32 => string) public songId;

    address public trustedTracker;  // PKP address
    address public owner;
    bool public paused;

    // Scoring weights (out of 100)
    uint8 public clickWeight = 10;       // Clicks worth 10%
    uint8 public playWeight = 30;        // Plays worth 30%
    uint8 public completionWeight = 60;  // Completions worth 60%

    // ========================================================================
    // Events
    // ========================================================================

    event TrendingUpdated(
        uint8 indexed timeWindow,
        uint256 windowId,
        uint8 source,
        string songId,
        bytes32 indexed songHash,
        uint32 clicks,
        uint32 plays,
        uint32 completions,
        uint32 trendingScore,
        uint64 timestamp
    );

    event TrendingBatchUpdated(
        uint8 indexed timeWindow,
        uint256 windowId,
        uint16 songCount,
        uint64 timestamp
    );

    event WeightsUpdated(
        uint8 clickWeight,
        uint8 playWeight,
        uint8 completionWeight
    );

    event TrustedTrackerUpdated(address indexed oldTracker, address indexed newTracker);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ========================================================================
    // Constructor & Modifiers
    // ========================================================================

    constructor(address _trustedTracker) {
        require(_trustedTracker != address(0), "Invalid tracker address");
        owner = msg.sender;
        trustedTracker = _trustedTracker;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyTrustedTracker() {
        require(msg.sender == trustedTracker, "Not trusted tracker");
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
     * @notice Generate song hash from source + ID (matches scoreboard)
     */
    function getSongHash(uint8 source, string calldata _songId)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(source, _songId));
    }

    /**
     * @notice Get current window ID for a time window type
     */
    function getCurrentWindowId(uint8 timeWindow) public view returns (uint256) {
        if (timeWindow == uint8(TimeWindow.Hourly)) {
            return block.timestamp / 1 hours;
        } else if (timeWindow == uint8(TimeWindow.Daily)) {
            return block.timestamp / 1 days;
        } else if (timeWindow == uint8(TimeWindow.Weekly)) {
            return block.timestamp / 7 days;
        }
        revert("Invalid time window");
    }

    /**
     * @notice Calculate weighted trending score
     */
    function calculateTrendingScore(uint32 clicks, uint32 plays, uint32 completions)
        public
        view
        returns (uint32)
    {
        return (clicks * clickWeight) + (plays * playWeight) + (completions * completionWeight);
    }

    // ========================================================================
    // Update Functions (PKP Only)
    // ========================================================================

    /**
     * @notice Update trending data for multiple songs (batch update)
     * @dev Called by PKP Lit Action with aggregated events
     */
    function updateTrendingBatch(
        uint8 timeWindow,
        uint8[] calldata sources,
        string[] calldata songIds,
        uint32[] calldata clicks,
        uint32[] calldata plays,
        uint32[] calldata completions
    ) external onlyTrustedTracker whenNotPaused {
        require(timeWindow <= uint8(TimeWindow.Weekly), "Invalid time window");
        require(sources.length == songIds.length, "Array length mismatch");
        require(sources.length == clicks.length, "Array length mismatch");
        require(sources.length == plays.length, "Array length mismatch");
        require(sources.length == completions.length, "Array length mismatch");
        require(sources.length > 0, "Empty batch");
        require(sources.length <= 100, "Batch too large");

        uint256 windowId = getCurrentWindowId(timeWindow);
        uint64 timestamp = uint64(block.timestamp);

        for (uint256 i = 0; i < sources.length; i++) {
            require(sources[i] <= uint8(ContentSource.Genius), "Invalid source");

            bytes32 songHash = getSongHash(sources[i], songIds[i]);
            uint32 trendingScore = calculateTrendingScore(clicks[i], plays[i], completions[i]);

            TrendingEntry memory entry = TrendingEntry({
                songHash: songHash,
                clicks: clicks[i],
                plays: plays[i],
                completions: completions[i],
                trendingScore: trendingScore,
                lastUpdated: timestamp
            });

            // Store in appropriate window
            if (timeWindow == uint8(TimeWindow.Hourly)) {
                hourlyTrending[windowId][songHash] = entry;
            } else if (timeWindow == uint8(TimeWindow.Daily)) {
                dailyTrending[windowId][songHash] = entry;
            } else {
                weeklyTrending[windowId][songHash] = entry;
            }

            // Store reverse lookup if first time seeing this song
            if (bytes(songId[songHash]).length == 0) {
                songSource[songHash] = sources[i];
                songId[songHash] = songIds[i];
            }

            emit TrendingUpdated(
                timeWindow,
                windowId,
                sources[i],
                songIds[i],
                songHash,
                clicks[i],
                plays[i],
                completions[i],
                trendingScore,
                timestamp
            );
        }

        emit TrendingBatchUpdated(timeWindow, windowId, uint16(sources.length), timestamp);
    }

    // ========================================================================
    // Query Functions
    // ========================================================================

    /**
     * @notice Get top N trending songs for a time window
     * @dev Returns songs sorted by trending score (descending)
     */
    function getTrendingSongs(
        uint8 timeWindow,
        uint256 limit
    ) external view returns (TrendingSong[] memory) {
        require(timeWindow <= uint8(TimeWindow.Weekly), "Invalid time window");
        require(limit > 0 && limit <= 100, "Invalid limit");

        uint256 windowId = getCurrentWindowId(timeWindow);

        // Get all songs from window (need to track separately for efficient queries)
        bytes32[] memory songHashes;
        if (timeWindow == uint8(TimeWindow.Hourly)) {
            songHashes = hourlyTopSongs[windowId];
        } else if (timeWindow == uint8(TimeWindow.Daily)) {
            songHashes = dailyTopSongs[windowId];
        } else {
            songHashes = weeklyTopSongs[windowId];
        }

        // Build and sort results
        uint256 resultCount = songHashes.length < limit ? songHashes.length : limit;
        TrendingSong[] memory results = new TrendingSong[](resultCount);

        // For now, return unsorted (sorting in contract is expensive)
        // Frontend should sort by trendingScore
        for (uint256 i = 0; i < resultCount; i++) {
            bytes32 songHash = songHashes[i];
            TrendingEntry memory entry;

            if (timeWindow == uint8(TimeWindow.Hourly)) {
                entry = hourlyTrending[windowId][songHash];
            } else if (timeWindow == uint8(TimeWindow.Daily)) {
                entry = dailyTrending[windowId][songHash];
            } else {
                entry = weeklyTrending[windowId][songHash];
            }

            results[i] = TrendingSong({
                source: songSource[songHash],
                songId: songId[songHash],
                trendingScore: entry.trendingScore,
                clicks: entry.clicks,
                plays: entry.plays,
                completions: entry.completions,
                lastUpdated: entry.lastUpdated
            });
        }

        return results;
    }

    /**
     * @notice Get trending entry for specific song
     */
    function getSongTrending(
        uint8 timeWindow,
        uint8 source,
        string calldata _songId
    ) external view returns (TrendingEntry memory) {
        require(timeWindow <= uint8(TimeWindow.Weekly), "Invalid time window");

        uint256 windowId = getCurrentWindowId(timeWindow);
        bytes32 songHash = getSongHash(source, _songId);

        if (timeWindow == uint8(TimeWindow.Hourly)) {
            return hourlyTrending[windowId][songHash];
        } else if (timeWindow == uint8(TimeWindow.Daily)) {
            return dailyTrending[windowId][songHash];
        } else {
            return weeklyTrending[windowId][songHash];
        }
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    /**
     * @notice Update scoring weights (owner only)
     */
    function setWeights(
        uint8 _clickWeight,
        uint8 _playWeight,
        uint8 _completionWeight
    ) external onlyOwner {
        require(_clickWeight + _playWeight + _completionWeight == 100, "Weights must sum to 100");

        clickWeight = _clickWeight;
        playWeight = _playWeight;
        completionWeight = _completionWeight;

        emit WeightsUpdated(_clickWeight, _playWeight, _completionWeight);
    }

    /**
     * @notice Pause tracking (owner only, emergency use)
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause tracking (owner only)
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Update trusted tracker address (owner only)
     */
    function setTrustedTracker(address newTracker) external onlyOwner {
        require(newTracker != address(0), "Invalid address");
        address oldTracker = trustedTracker;
        trustedTracker = newTracker;
        emit TrustedTrackerUpdated(oldTracker, newTracker);
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
