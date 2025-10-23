// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title FSRSTrackerV1
 * @notice Tracks spaced repetition card states for language learning via FSRS algorithm
 * @dev Single shared contract for all users - immutable proof of study progress
 *
 * Architecture:
 * - Ultra-compact storage: 19 bytes per card (fits in 1 slot)
 * - Trusted PKP submits reviews via Lit Action (prevents spoofing)
 * - Nested mapping for efficient segment queries
 * - Events for analytics, leaderboards, and Grove indexing
 * - Gas: ~50k per update (~$0.00005 on Base)
 *
 * Data Flow:
 * 1. User studies line → sends audio to Lit Action
 * 2. Lit Action: transcribes, scores, runs FSRS, signs tx
 * 3. Contract: stores card state, emits event
 * 4. Lit Action: updates Grove (leaderboards, streaks)
 * 5. Browser: reads contract for stats, displays UI
 *
 * Grove Integration:
 * - CardReviewed events → trigger leaderboard updates
 * - Contracts store proofs, Grove stores rankings
 * - Users can't fake progress (PKP-signed only)
 */
contract FSRSTrackerV1 {

    // ============================================================
    // TYPES & ENUMS
    // ============================================================

    /**
     * @notice Card states matching FSRS-4.5 algorithm
     * @dev 0=New, 1=Learning, 2=Review, 3=Relearning
     */
    enum CardState {
        New,         // Never studied
        Learning,    // Short-term repetition (< 1 day intervals)
        Review,      // Long-term repetition (days/weeks/months)
        Relearning   // Failed review, back to short intervals
    }

    /**
     * @notice Review ratings matching FSRS-4.5 algorithm
     * @dev Used in events for analytics
     * Enum values: 0=Again, 1=Hard, 2=Good, 3=Easy
     */
    enum Rating {
        Again,  // 0: Complete failure, restart learning
        Hard,   // 1: Difficult but remembered
        Good,   // 2: Correct with effort
        Easy    // 3: Trivial, increase interval significantly
    }

    /**
     * @notice FSRS card data
     * @dev Packed into 19 bytes total (fits in 1 storage slot = 32 bytes)
     * - due: 5 bytes (uint40) = ~34,000 years
     * - stability: 2 bytes (uint16) * 100 = 0-655.35 days precision
     * - difficulty: 1 byte (uint8) * 10 = 1.0-25.5 scale
     * - elapsedDays: 2 bytes (uint16) * 10 = 0-6553.5 days
     * - scheduledDays: 2 bytes (uint16) * 10 = 0-6553.5 days
     * - reps: 1 byte (uint8) = 0-255 total reviews
     * - lapses: 1 byte (uint8) = 0-255 times forgotten
     * - state: 1 byte (uint8) = CardState enum (0-3)
     * - lastReview: 5 bytes (uint40) = timestamp
     * Total: 20 bytes (1 slot with packing optimization)
     */
    struct Card {
        uint40 due;              // Next review timestamp (seconds since epoch)
        uint16 stability;        // FSRS stability * 100 (e.g., 450 = 4.5 days)
        uint8 difficulty;        // FSRS difficulty * 10 (e.g., 50 = 5.0)
        uint16 elapsedDays;      // Days since last review * 10
        uint16 scheduledDays;    // Days until next review * 10
        uint8 reps;              // Total number of reviews
        uint8 lapses;            // Number of times forgotten (Rating.Again)
        uint8 state;             // CardState enum value (0-3)
        uint40 lastReview;       // Last review timestamp (0 = never reviewed)
    }

    // ============================================================
    // CONSTANTS
    // ============================================================

    /**
     * @notice Maximum lines per segment (prevents DoS on view functions)
     * @dev Segments typically have 4-20 lines, cap at 100 for safety
     */
    uint8 public constant MAX_LINE_COUNT = 100;

    // ============================================================
    // STATE
    // ============================================================

    /**
     * @notice Nested mapping: user → songId → segmentId → lineIndex → Card
     * @dev Allows efficient queries per segment and per user
     * Example: cards[0x1234...][heat-of-the-night][chorus-1][0] = Card{...}
     */
    mapping(address => mapping(string => mapping(string => mapping(uint8 => Card))))
        public cards;

    /**
     * @notice Contract owner (for emergency controls only)
     */
    address public owner;

    /**
     * @notice Trusted PKP address (only this address can update cards)
     * @dev This is the PKP used by the study-scorer-v1.js Lit Action
     */
    address public trustedPKP;

    /**
     * @notice Emergency pause flag
     */
    bool public paused;

    // ============================================================
    // EVENTS
    // ============================================================

    /**
     * @notice Emitted when a card is reviewed
     * @dev Used for:
     * - Analytics dashboards
     * - Leaderboard indexing in Grove
     * - Streak tracking
     * - User progress history
     * @param user User's wallet address
     * @param songId Song identifier (e.g., "heat-of-the-night-scarlett-x")
     * @param segmentId Segment identifier (e.g., "chorus-1-1")
     * @param lineIndex Line index within segment (0-based)
     * @param rating User's rating (enum: 0=Again, 1=Hard, 2=Good, 3=Easy)
     * @param score Pronunciation score (0-100)
     * @param nextDue Next review timestamp
     * @param newState New card state after review
     * @param timestamp Block timestamp
     */
    event CardReviewed(
        address indexed user,
        string indexed songId,
        string segmentId,
        uint8 lineIndex,
        uint8 rating,
        uint8 score,
        uint40 nextDue,
        uint8 newState,
        uint64 timestamp
    );

    /**
     * @notice Emitted when trusted PKP is updated
     */
    event TrustedPKPUpdated(
        address indexed oldPKP,
        address indexed newPKP
    );

    /**
     * @notice Emitted when contract is paused/unpaused
     */
    event PausedUpdated(bool paused);

    // ============================================================
    // ERRORS
    // ============================================================

    error NotOwner();
    error NotTrustedPKP();
    error ContractPaused();
    error InvalidAddress();
    error InvalidSongId();
    error InvalidSegmentId();
    error InvalidRating();
    error InvalidScore();
    error InvalidLineCount();
    error BatchLimitExceeded();

    // ============================================================
    // CONSTRUCTOR
    // ============================================================

    /**
     * @param _trustedPKP PKP address authorized to update cards
     */
    constructor(address _trustedPKP) {
        if (_trustedPKP == address(0)) revert InvalidAddress();

        owner = msg.sender;
        trustedPKP = _trustedPKP;
        paused = false;
    }

    // ============================================================
    // MODIFIERS
    // ============================================================

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTrustedPKP() {
        if (msg.sender != trustedPKP) revert NotTrustedPKP();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ============================================================
    // CORE FUNCTIONS
    // ============================================================

    /**
     * @notice Update card state after review (called by Lit Action via PKP)
     * @dev FSRS algorithm runs in Lit Action, contract just stores result
     * @param user User's address
     * @param songId Song identifier
     * @param segmentId Segment identifier
     * @param lineIndex Line index within segment (0-255)
     * @param rating User's rating (enum: 0=Again, 1=Hard, 2=Good, 3=Easy)
     * @param score Pronunciation score (0-100)
     * @param newCard New card state calculated by FSRS
     */
    function updateCard(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineIndex,
        uint8 rating,
        uint8 score,
        Card calldata newCard
    ) external onlyTrustedPKP whenNotPaused {
        // Validate inputs
        if (user == address(0)) revert InvalidAddress();
        if (bytes(songId).length == 0) revert InvalidSongId();
        if (bytes(segmentId).length == 0) revert InvalidSegmentId();
        if (rating > 3) revert InvalidRating();
        if (score > 100) revert InvalidScore();

        // Store new card state
        cards[user][songId][segmentId][lineIndex] = newCard;

        // Emit event for indexing
        emit CardReviewed(
            user,
            songId,
            segmentId,
            lineIndex,
            rating,
            score,
            newCard.due,
            newCard.state,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Batch update multiple cards in one transaction (gas-efficient)
     * @dev Saves ~30% gas vs individual updates for multi-line study sessions
     * @param user User's address
     * @param songId Song identifier
     * @param segmentId Segment identifier
     * @param lineIndices Array of line indices
     * @param ratings Array of ratings (must match lineIndices length)
     * @param scores Array of scores (must match lineIndices length)
     * @param newCards Array of new card states (must match lineIndices length)
     */
    function updateCardsBatch(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8[] calldata lineIndices,
        uint8[] calldata ratings,
        uint8[] calldata scores,
        Card[] calldata newCards
    ) external onlyTrustedPKP whenNotPaused {
        // Validate batch size
        uint256 length = lineIndices.length;
        if (length == 0 || length > 20) revert BatchLimitExceeded();
        if (ratings.length != length || scores.length != length || newCards.length != length) {
            revert BatchLimitExceeded();
        }

        // Validate user and identifiers once
        if (user == address(0)) revert InvalidAddress();
        if (bytes(songId).length == 0) revert InvalidSongId();
        if (bytes(segmentId).length == 0) revert InvalidSegmentId();

        // Process each card
        for (uint256 i = 0; i < length; i++) {
            uint8 lineIndex = lineIndices[i];
            uint8 rating = ratings[i];
            uint8 score = scores[i];
            Card calldata newCard = newCards[i];

            // Validate per-card inputs
            if (rating > 3) revert InvalidRating();
            if (score > 100) revert InvalidScore();

            // Store new card state
            cards[user][songId][segmentId][lineIndex] = newCard;

            // Emit event for indexing
            emit CardReviewed(
                user,
                songId,
                segmentId,
                lineIndex,
                rating,
                score,
                newCard.due,
                newCard.state,
                uint64(block.timestamp)
            );
        }
    }

    // ============================================================
    // QUERY FUNCTIONS
    // ============================================================

    /**
     * @notice Get study stats for a segment
     * @dev Used by frontend to display StudyStats component
     * @param user User's address
     * @param songId Song identifier
     * @param segmentId Segment identifier
     * @param lineCount Total lines in segment (max 100)
     * @return newCount Number of new cards (never studied)
     * @return learningCount Number of cards in learning/relearning
     * @return dueCount Number of cards due for review
     */
    function getStudyStats(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineCount
    ) external view returns (
        uint8 newCount,
        uint8 learningCount,
        uint8 dueCount
    ) {
        if (lineCount > MAX_LINE_COUNT) revert InvalidLineCount();
        uint40 currentTime = uint40(block.timestamp);

        for (uint8 i = 0; i < lineCount; i++) {
            Card storage card = cards[user][songId][segmentId][i];

            // Count new cards (never reviewed)
            if (card.lastReview == 0) {
                newCount++;
                continue;
            }

            // Count learning/relearning cards
            if (card.state == uint8(CardState.Learning) ||
                card.state == uint8(CardState.Relearning)) {
                learningCount++;
            }

            // Count due cards (exclude never-reviewed cards)
            if (card.due > 0 && card.due <= currentTime) {
                dueCount++;
            }
        }
    }

    /**
     * @notice Get cards due for review in a segment
     * @dev Returns array of line indices that are due
     * @param user User's address
     * @param songId Song identifier
     * @param segmentId Segment identifier
     * @param lineCount Total lines in segment (max 100)
     * @return dueLines Array of line indices that are due (or new)
     */
    function getDueCards(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineCount
    ) external view returns (uint8[] memory dueLines) {
        if (lineCount > MAX_LINE_COUNT) revert InvalidLineCount();
        uint40 currentTime = uint40(block.timestamp);

        // First pass: count due cards
        uint8 dueCount = 0;
        for (uint8 i = 0; i < lineCount; i++) {
            Card storage card = cards[user][songId][segmentId][i];
            // Include new cards (never reviewed) AND cards that are due
            if (card.lastReview == 0 || (card.due > 0 && card.due <= currentTime)) {
                dueCount++;
            }
        }

        // Second pass: build array
        dueLines = new uint8[](dueCount);
        uint8 index = 0;
        for (uint8 i = 0; i < lineCount; i++) {
            Card storage card = cards[user][songId][segmentId][i];
            if (card.lastReview == 0 || (card.due > 0 && card.due <= currentTime)) {
                dueLines[index++] = i;
            }
        }
    }

    /**
     * @notice Get single card state
     * @param user User's address
     * @param songId Song identifier
     * @param segmentId Segment identifier
     * @param lineIndex Line index
     * @return card Card state
     */
    function getCard(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineIndex
    ) external view returns (Card memory card) {
        return cards[user][songId][segmentId][lineIndex];
    }

    // ============================================================
    // SONG-LEVEL QUERY FUNCTIONS
    // ============================================================

    /**
     * @notice Get study stats aggregated across all segments in a song
     * @dev Used for song-level fandom calculations and progress tracking
     * @param user User's address
     * @param songId Song identifier
     * @param segmentIds Array of segment IDs in the song
     * @param lineCounts Array of line counts per segment (must match segmentIds length)
     * @return totalNew Total new cards across all segments
     * @return totalLearning Total learning/relearning cards
     * @return totalDue Total due cards
     * @return segmentsWithDue Number of segments that have at least one due card
     * @return segmentsCompleted Number of segments with no new cards (all studied at least once)
     */
    function getSongStats(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (
        uint16 totalNew,
        uint16 totalLearning,
        uint16 totalDue,
        uint8 segmentsWithDue,
        uint8 segmentsCompleted
    ) {
        uint256 segmentCount = segmentIds.length;
        if (segmentCount == 0 || segmentCount > 50) revert InvalidLineCount();
        if (lineCounts.length != segmentCount) revert BatchLimitExceeded();

        for (uint256 i = 0; i < segmentCount; i++) {
            (uint8 newC, uint8 learningC, uint8 dueC) =
                this.getStudyStats(user, songId, segmentIds[i], lineCounts[i]);

            totalNew += newC;
            totalLearning += learningC;
            totalDue += dueC;

            // Count segments with due cards (for "practice this song" feature)
            if (dueC > 0 || newC > 0) {
                segmentsWithDue++;
            }

            // Count completed segments (all lines studied at least once)
            if (newC == 0) {
                segmentsCompleted++;
            }
        }
    }

    /**
     * @notice Get segments in a song that have due cards (includes new cards)
     * @dev Returns segment indices (not IDs) for segments needing review
     * @param user User's address
     * @param songId Song identifier
     * @param segmentIds Array of segment IDs in the song
     * @param lineCounts Array of line counts per segment
     * @return dueSegmentIndices Array of indices into segmentIds that have due cards OR new cards
     */
    function getDueSongSegments(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (uint8[] memory dueSegmentIndices) {
        uint256 segmentCount = segmentIds.length;
        if (segmentCount == 0 || segmentCount > 50) revert InvalidLineCount();
        if (lineCounts.length != segmentCount) revert BatchLimitExceeded();

        // First pass: count segments with due cards (includes new)
        uint8 dueCount = 0;
        for (uint256 i = 0; i < segmentCount; i++) {
            (uint8 newC, , uint8 dueC) =
                this.getStudyStats(user, songId, segmentIds[i], lineCounts[i]);
            // Include both: new cards (never studied) AND overdue reviews
            if (newC > 0 || dueC > 0) {
                dueCount++;
            }
        }

        // Second pass: build array of due segment indices
        dueSegmentIndices = new uint8[](dueCount);
        uint8 index = 0;
        for (uint256 i = 0; i < segmentCount; i++) {
            (uint8 newC, , uint8 dueC) =
                this.getStudyStats(user, songId, segmentIds[i], lineCounts[i]);
            if (newC > 0 || dueC > 0) {
                dueSegmentIndices[index++] = uint8(i);
            }
        }
    }

    /**
     * @notice Get segments that have ONLY overdue reviews (excludes new cards)
     * @dev Stricter than getDueSongSegments - only returns segments with reviews past due date
     * @param user User's address
     * @param songId Song identifier
     * @param segmentIds Array of segment IDs in the song
     * @param lineCounts Array of line counts per segment
     * @return reviewSegmentIndices Array of indices for segments with overdue reviews
     */
    function getDueReviewSegments(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (uint8[] memory reviewSegmentIndices) {
        uint256 segmentCount = segmentIds.length;
        if (segmentCount == 0 || segmentCount > 50) revert InvalidLineCount();
        if (lineCounts.length != segmentCount) revert BatchLimitExceeded();

        // First pass: count segments with overdue reviews (exclude new)
        uint8 reviewCount = 0;
        for (uint256 i = 0; i < segmentCount; i++) {
            (, , uint8 dueC) =
                this.getStudyStats(user, songId, segmentIds[i], lineCounts[i]);
            if (dueC > 0) {
                reviewCount++;
            }
        }

        // Second pass: build array
        reviewSegmentIndices = new uint8[](reviewCount);
        uint8 index = 0;
        for (uint256 i = 0; i < segmentCount; i++) {
            (, , uint8 dueC) =
                this.getStudyStats(user, songId, segmentIds[i], lineCounts[i]);
            if (dueC > 0) {
                reviewSegmentIndices[index++] = uint8(i);
            }
        }
    }

    /**
     * @notice Check if a song has been fully studied (cheap check using segment stats)
     * @dev Optimized: Uses getStudyStats per segment instead of looping all lines
     * @param user User's address
     * @param songId Song identifier
     * @param segmentIds Array of segment IDs in the song
     * @param lineCounts Array of line counts per segment
     * @return fullyStudied True if every segment has no new cards (all started)
     * @return segmentsCompleted Number of segments with no new cards
     * @return totalSegments Total number of segments
     */
    function isSongMastered(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (
        bool fullyStudied,
        uint8 segmentsCompleted,
        uint8 totalSegments
    ) {
        uint256 segmentCount = segmentIds.length;
        if (segmentCount == 0 || segmentCount > 50) revert InvalidLineCount();
        if (lineCounts.length != segmentCount) revert BatchLimitExceeded();

        totalSegments = uint8(segmentCount);
        segmentsCompleted = 0;

        // Check each segment - if newCount==0, segment is started
        for (uint256 i = 0; i < segmentCount; i++) {
            (uint8 newC, ,) = this.getStudyStats(user, songId, segmentIds[i], lineCounts[i]);
            if (newC == 0) {
                segmentsCompleted++;
            }
        }

        fullyStudied = (segmentsCompleted == totalSegments && totalSegments > 0);
    }

    /**
     * @notice Get precise completion rate by counting studied lines (gas-intensive)
     * @dev WARNING: Expensive for large songs (1k+ lines). Use isSongMastered() for cheap check.
     * @param user User's address
     * @param songId Song identifier
     * @param segmentIds Array of segment IDs in the song
     * @param lineCounts Array of line counts per segment
     * @return studiedLines Number of lines reviewed at least once
     * @return totalLines Total lines in song
     * @return completionRate Percentage (0-100)
     */
    function getSongCompletionRate(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (
        uint16 studiedLines,
        uint16 totalLines,
        uint8 completionRate
    ) {
        uint256 segmentCount = segmentIds.length;
        if (segmentCount == 0 || segmentCount > 50) revert InvalidLineCount();
        if (lineCounts.length != segmentCount) revert BatchLimitExceeded();

        for (uint256 i = 0; i < segmentCount; i++) {
            uint8 lineCount = lineCounts[i];
            totalLines += lineCount;

            // Count lines that have been studied (lastReview > 0)
            for (uint8 j = 0; j < lineCount; j++) {
                Card storage card = cards[user][songId][segmentIds[i]][j];
                if (card.lastReview > 0) {
                    studiedLines++;
                }
            }
        }

        completionRate = totalLines > 0 ? uint8((studiedLines * 100) / totalLines) : 0;
    }

    // ============================================================
    // ADMIN FUNCTIONS
    // ============================================================

    /**
     * @notice Update trusted PKP address
     * @dev Only owner can update
     */
    function setTrustedPKP(address newPKP) external onlyOwner {
        if (newPKP == address(0)) revert InvalidAddress();

        emit TrustedPKPUpdated(trustedPKP, newPKP);
        trustedPKP = newPKP;
    }

    /**
     * @notice Pause/unpause contract (emergency only)
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedUpdated(_paused);
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
}
