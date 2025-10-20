// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IFSRSTracker
 * @notice Interface for the FSRS Tracker contract
 * @dev Tracks spaced repetition card states for line-by-line language learning
 */
interface IFSRSTracker {

    // ============ Types ============

    enum CardState {
        New,         // Never studied
        Learning,    // Short-term repetition (< 1 day intervals)
        Review,      // Long-term repetition (days/weeks/months)
        Relearning   // Failed review, back to short intervals
    }

    enum Rating {
        Again,  // 0: Complete failure, restart learning
        Hard,   // 1: Difficult but remembered
        Good,   // 2: Correct with effort
        Easy    // 3: Trivial, increase interval significantly
    }

    struct Card {
        uint40 due;              // Next review timestamp
        uint16 stability;        // FSRS stability * 100
        uint8 difficulty;        // FSRS difficulty * 10
        uint16 elapsedDays;      // Days since last review * 10
        uint16 scheduledDays;    // Days until next review * 10
        uint8 reps;              // Total number of reviews
        uint8 lapses;            // Number of times forgotten
        uint8 state;             // CardState enum value (0-3)
        uint40 lastReview;       // Last review timestamp
    }

    // ============ Events ============

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

    event TrustedPKPUpdated(address indexed oldPKP, address indexed newPKP);
    event PausedUpdated(bool paused);

    // ============ Errors ============

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

    // ============ Functions ============

    function updateCard(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineIndex,
        uint8 rating,
        uint8 score,
        Card calldata newCard
    ) external;

    function updateCardsBatch(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8[] calldata lineIndices,
        uint8[] calldata ratings,
        uint8[] calldata scores,
        Card[] calldata newCards
    ) external;

    function getStudyStats(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineCount
    ) external view returns (
        uint8 newCount,
        uint8 learningCount,
        uint8 dueCount
    );

    function getDueCards(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineCount
    ) external view returns (uint8[] memory dueLines);

    function getCard(
        address user,
        string calldata songId,
        string calldata segmentId,
        uint8 lineIndex
    ) external view returns (Card memory card);

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
    );

    function getDueSongSegments(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (uint8[] memory dueSegmentIndices);

    function isSongMastered(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (
        bool fullyStudied,
        uint8 segmentsCompleted,
        uint8 totalSegments
    );

    function getSongCompletionRate(
        address user,
        string calldata songId,
        string[] calldata segmentIds,
        uint8[] calldata lineCounts
    ) external view returns (
        uint16 studiedLines,
        uint16 totalLines,
        uint8 completionRate
    );

    function trustedPKP() external view returns (address);
    function paused() external view returns (bool);
}
