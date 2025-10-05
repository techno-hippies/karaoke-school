// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title StudyProgressV1
 * @notice Tracks user study sessions, streaks, and encrypted FSRS data
 * @dev V1: Initial version with Lit Protocol v8 encrypted TS-FSRS
 *
 * Architecture:
 * - ContentSource enum: Native or Genius (matching scoreboard/trending)
 * - Per-user study sessions with timestamps
 * - Streak tracking (UTC-based, client handles timezone display)
 * - Encrypted FSRS state via Lit Protocol v8
 * - Public metadata: session count, last study time, current streak
 * - Only trusted PKP can update
 *
 * FSRS Data Model:
 * - Encrypted per-user per-song/segment using Lit.Actions.encrypt()
 * - Contains: difficulty, stability, retrievability, interval, last review
 * - Decrypted client-side via Lit PKP for practice scheduling
 * - Never exposed on-chain in plaintext
 *
 * Streak Logic:
 * - Day boundaries based on UTC timestamps (block.timestamp)
 * - Consecutive days = streak maintained
 * - Skip 1+ days = streak resets to 1
 * - Multiple sessions same day = streak unchanged
 *
 * Integration:
 * - Lit Action completes exercise → scores performance → updates FSRS
 * - Lit Action encrypts FSRS data → writes to StudyProgressV1
 * - Frontend decrypts FSRS for scheduling next review
 * - Public streak/session data displayed on profile
 * - SongQuizV1 calls studiedToday() to gate quiz access
 */
contract StudyProgressV1 {
    // ========================================================================
    // Types & Structs
    // ========================================================================

    /**
     * @notice Content source enumeration (matches other contracts)
     */
    enum ContentSource {
        Native,   // 0: Songs from SongCatalog
        Genius    // 1: Songs from Genius.com API
    }

    /**
     * @notice Study session record
     */
    struct StudySession {
        bytes32 contentHash;        // keccak256(source, songId/segmentId)
        uint64 timestamp;           // When session occurred
        uint16 itemsReviewed;       // Number of items in session
        uint8 averageScore;         // Average score 0-100
    }

    /**
     * @notice User study stats (public)
     */
    struct StudyStats {
        uint32 totalSessions;       // Total study sessions
        uint32 currentStreak;       // Current consecutive days
        uint32 longestStreak;       // Historical best streak
        uint64 lastStudyTimestamp;  // Most recent session
        uint64 firstStudyTimestamp; // First ever session
    }

    /**
     * @notice Encrypted FSRS state
     */
    struct EncryptedFSRS {
        string ciphertext;          // Lit-encrypted FSRS JSON
        string dataToEncryptHash;   // Hash for verification
        uint64 lastUpdated;         // When encrypted data was written
    }

    // ========================================================================
    // State
    // ========================================================================

    // User => StudyStats
    mapping(address => StudyStats) public userStats;

    // User => contentHash => EncryptedFSRS
    mapping(address => mapping(bytes32 => EncryptedFSRS)) public encryptedFSRS;

    // User => session history (limited to last 100 for gas efficiency)
    mapping(address => StudySession[]) private sessionHistory;
    uint8 public constant MAX_HISTORY = 100;

    address public trustedTracker;  // PKP address
    address public owner;
    bool public paused;

    // ========================================================================
    // Events
    // ========================================================================

    event StudySessionRecorded(
        address indexed user,
        uint8 source,
        string contentId,
        bytes32 indexed contentHash,
        uint16 itemsReviewed,
        uint8 averageScore,
        uint64 timestamp
    );

    event StreakUpdated(
        address indexed user,
        uint32 newStreak,
        uint32 longestStreak,
        bool isNewRecord
    );

    event FSRSDataEncrypted(
        address indexed user,
        bytes32 indexed contentHash,
        uint64 timestamp
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
     * @notice Generate content hash (matches scoreboard/trending)
     */
    function getContentHash(uint8 source, string calldata id)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(source, id));
    }

    /**
     * @notice Get day number from timestamp (UTC)
     */
    function getDayNumber(uint64 timestamp) public pure returns (uint256) {
        return uint256(timestamp) / 1 days;
    }

    // ========================================================================
    // Study Session Recording (PKP Only)
    // ========================================================================

    /**
     * @notice Record a study session and update streak
     * @dev Called by PKP Lit Action after exercise completion
     */
    function recordStudySession(
        address user,
        uint8 source,
        string calldata contentId,
        uint16 itemsReviewed,
        uint8 averageScore
    ) external onlyTrustedTracker whenNotPaused {
        require(user != address(0), "Invalid user");
        require(source <= uint8(ContentSource.Genius), "Invalid source");
        require(itemsReviewed > 0, "Must review at least 1 item");
        require(averageScore <= 100, "Invalid score");

        bytes32 contentHash = getContentHash(source, contentId);
        uint64 timestamp = uint64(block.timestamp);

        StudyStats storage stats = userStats[user];

        // Initialize first study
        if (stats.totalSessions == 0) {
            stats.firstStudyTimestamp = timestamp;
            stats.currentStreak = 1;
            stats.longestStreak = 1;
        } else {
            // Calculate streak
            uint256 lastStudyDay = getDayNumber(stats.lastStudyTimestamp);
            uint256 currentDay = getDayNumber(timestamp);
            uint256 dayDifference = currentDay - lastStudyDay;

            if (dayDifference == 0) {
                // Same day - no streak change
            } else if (dayDifference == 1) {
                // Next day - increment streak
                stats.currentStreak++;
                if (stats.currentStreak > stats.longestStreak) {
                    stats.longestStreak = stats.currentStreak;
                    emit StreakUpdated(user, stats.currentStreak, stats.longestStreak, true);
                } else {
                    emit StreakUpdated(user, stats.currentStreak, stats.longestStreak, false);
                }
            } else {
                // Skipped days - reset streak
                uint32 oldStreak = stats.currentStreak;
                stats.currentStreak = 1;
                emit StreakUpdated(user, stats.currentStreak, stats.longestStreak, false);
            }
        }

        // Update stats
        stats.totalSessions++;
        stats.lastStudyTimestamp = timestamp;

        // Add to session history (limited)
        StudySession[] storage history = sessionHistory[user];
        if (history.length >= MAX_HISTORY) {
            // Shift array left (remove oldest)
            for (uint256 i = 0; i < MAX_HISTORY - 1; i++) {
                history[i] = history[i + 1];
            }
            history[MAX_HISTORY - 1] = StudySession({
                contentHash: contentHash,
                timestamp: timestamp,
                itemsReviewed: itemsReviewed,
                averageScore: averageScore
            });
        } else {
            history.push(StudySession({
                contentHash: contentHash,
                timestamp: timestamp,
                itemsReviewed: itemsReviewed,
                averageScore: averageScore
            }));
        }

        emit StudySessionRecorded(
            user,
            source,
            contentId,
            contentHash,
            itemsReviewed,
            averageScore,
            timestamp
        );
    }

    /**
     * @notice Store encrypted FSRS data
     * @dev Called by PKP Lit Action with Lit.Actions.encrypt() output
     */
    function storeEncryptedFSRS(
        address user,
        uint8 source,
        string calldata contentId,
        string calldata ciphertext,
        string calldata dataToEncryptHash
    ) external onlyTrustedTracker whenNotPaused {
        require(user != address(0), "Invalid user");
        require(source <= uint8(ContentSource.Genius), "Invalid source");
        require(bytes(ciphertext).length > 0, "Empty ciphertext");
        require(bytes(dataToEncryptHash).length > 0, "Empty hash");

        bytes32 contentHash = getContentHash(source, contentId);

        encryptedFSRS[user][contentHash] = EncryptedFSRS({
            ciphertext: ciphertext,
            dataToEncryptHash: dataToEncryptHash,
            lastUpdated: uint64(block.timestamp)
        });

        emit FSRSDataEncrypted(user, contentHash, uint64(block.timestamp));
    }

    // ========================================================================
    // Query Functions
    // ========================================================================

    /**
     * @notice Get user study stats
     */
    function getUserStats(address user) external view returns (StudyStats memory) {
        return userStats[user];
    }

    /**
     * @notice Get encrypted FSRS data for content
     */
    function getEncryptedFSRS(address user, uint8 source, string calldata contentId)
        external
        view
        returns (EncryptedFSRS memory)
    {
        bytes32 contentHash = getContentHash(source, contentId);
        return encryptedFSRS[user][contentHash];
    }

    /**
     * @notice Get user session history
     */
    function getSessionHistory(address user) external view returns (StudySession[] memory) {
        return sessionHistory[user];
    }

    /**
     * @notice Get recent sessions (last N)
     */
    function getRecentSessions(address user, uint8 count)
        external
        view
        returns (StudySession[] memory)
    {
        StudySession[] storage history = sessionHistory[user];
        uint256 totalSessions = history.length;

        if (totalSessions == 0) {
            return new StudySession[](0);
        }

        uint256 returnCount = count > totalSessions ? totalSessions : count;
        StudySession[] memory recent = new StudySession[](returnCount);

        // Return most recent first
        for (uint256 i = 0; i < returnCount; i++) {
            recent[i] = history[totalSessions - 1 - i];
        }

        return recent;
    }

    /**
     * @notice Check if user studied today (UTC)
     */
    function studiedToday(address user) external view returns (bool) {
        StudyStats memory stats = userStats[user];
        if (stats.totalSessions == 0) {
            return false;
        }

        uint256 lastStudyDay = getDayNumber(stats.lastStudyTimestamp);
        uint256 currentDay = getDayNumber(uint64(block.timestamp));

        return lastStudyDay == currentDay;
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    /**
     * @notice Pause session recording (owner only, emergency use)
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause session recording (owner only)
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
