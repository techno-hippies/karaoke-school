// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title PerformanceGrader
 * @notice PKP-verified performance grading with event emission
 * @dev CRITICAL FOR ANTI-CHEAT: Only trusted PKP can grade performances
 *
 * Purpose:
 * - Emit grading events for leaderboard indexing
 * - Prevent spoofed scores (PKP-signed transactions only)
 * - Replace PerformanceRegistryV1 storage with off-chain Grove data
 *
 * Anti-Cheat Flow:
 * 1. User submits performance video → Grove
 * 2. Lit Action grades video (AI scoring)
 * 3. Lit Action signs transaction with PKP
 * 4. This contract verifies msg.sender == trustedPKP
 * 5. Emits PerformanceGraded event (immutable, indexed by The Graph)
 * 6. Leaderboards built from indexed events
 *
 * Security:
 * - Only trustedPKP can call gradePerformance()
 * - Events are immutable (cannot fake scores)
 * - Lit consensus ensures PKP execution is trustworthy
 *
 * Gas Cost: ~48k (vs ~100k for V1 grading)
 * Savings: ~52%
 */
contract PerformanceGrader {

    // ============ State Variables ============

    /**
     * @notice Contract owner (for emergency controls only)
     */
    address public owner;

    /**
     * @notice Trusted PKP address (only this address can grade performances)
     * @dev This is the PKP used by the grading Lit Action
     */
    address public trustedPKP;

    /**
     * @notice Emergency pause flag
     */
    bool public paused;

    // ============ Events ============

    /**
     * @notice Emitted when a performance is graded (DEPRECATED - use LinePerformanceGraded)
     * @param performanceId Unique performance ID (uint256 or UUID hash)
     * @param segmentHash Segment hash (for leaderboard grouping)
     * @param performer Performer wallet address
     * @param score Performance score in basis points (0-10000, e.g., 8525 = 85.25%)
     * @param metadataUri Grove URI for full performance metadata (lens://...)
     * @param timestamp Block timestamp
     * @dev Indexed by The Graph for leaderboard queries
     */
    event PerformanceGraded(
        uint256 indexed performanceId,
        bytes32 indexed segmentHash,
        address indexed performer,
        uint16 score,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a LINE performance is graded (for FSRS line-level tracking)
     * @param performanceId Unique performance ID
     * @param lineId Line UUID from karaoke_lines table (stable identifier)
     * @param segmentHash Segment hash (for grouping lines to segments)
     * @param lineIndex Line index within segment (0-based, for ordering)
     * @param performer Performer wallet address
     * @param score Performance score in basis points (0-10000)
     * @param metadataUri Grove URI for performance metadata
     * @param timestamp Block timestamp
     * @dev New event for line-level FSRS. Use this instead of PerformanceGraded.
     */
    event LinePerformanceGraded(
        uint256 indexed performanceId,
        bytes32 indexed lineId,           // UUID from DB (converted to bytes32)
        bytes32 indexed segmentHash,
        uint16 lineIndex,
        address performer,
        uint16 score,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a performance is submitted (before grading)
     * @param performanceId Unique performance ID
     * @param segmentHash Segment hash
     * @param performer Performer wallet address
     * @param videoUri Grove URI for performance video
     * @param timestamp Block timestamp
     */
    event PerformanceSubmitted(
        uint256 indexed performanceId,
        bytes32 indexed segmentHash,
        address indexed performer,
        string videoUri,
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

    // ============ Errors ============

    error NotOwner();
    error NotTrustedPKP();
    error ContractPaused();
    error InvalidAddress();
    error InvalidScore();

    // ============ Constructor ============

    /**
     * @param _trustedPKP PKP address authorized to grade performances
     */
    constructor(address _trustedPKP) {
        if (_trustedPKP == address(0)) revert InvalidAddress();

        owner = msg.sender;
        trustedPKP = _trustedPKP;
        paused = false;
    }

    // ============ Modifiers ============

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

    // ============ Core Functions ============

    /**
     * @notice Grade a performance (DEPRECATED - use gradeLinePerformance)
     * @param performanceId Unique performance ID
     * @param segmentHash Segment hash
     * @param performer Performer address
     * @param score Performance score in basis points (0-10000)
     * @param metadataUri Grove URI for full performance metadata (includes grading details)
     * @dev ONLY trustedPKP can call - prevents score spoofing
     */
    function gradePerformance(
        uint256 performanceId,
        bytes32 segmentHash,
        address performer,
        uint16 score,
        string calldata metadataUri
    ) external onlyTrustedPKP whenNotPaused {
        // Validate inputs
        if (performer == address(0)) revert InvalidAddress();
        if (score > 10000) revert InvalidScore();

        // Emit event for leaderboard indexing
        emit PerformanceGraded(
            performanceId,
            segmentHash,
            performer,
            score,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Grade a LINE performance (for FSRS line-level tracking)
     * @param performanceId Unique performance ID
     * @param lineId Line UUID from karaoke_lines table (as bytes32)
     * @param segmentHash Segment hash (for grouping)
     * @param lineIndex Line index within segment (for ordering)
     * @param performer Performer address
     * @param score Performance score in basis points (0-10000)
     * @param metadataUri Grove URI for performance metadata
     * @dev ONLY trustedPKP can call - prevents score spoofing
     */
    function gradeLinePerformance(
        uint256 performanceId,
        bytes32 lineId,
        bytes32 segmentHash,
        uint16 lineIndex,
        address performer,
        uint16 score,
        string calldata metadataUri
    ) external onlyTrustedPKP whenNotPaused {
        // Validate inputs
        if (performer == address(0)) revert InvalidAddress();
        if (score > 10000) revert InvalidScore();
        if (lineId == bytes32(0)) revert InvalidAddress(); // lineId must be set

        // Emit event for line-level FSRS indexing
        emit LinePerformanceGraded(
            performanceId,
            lineId,
            segmentHash,
            lineIndex,
            performer,
            score,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Submit a performance (before grading)
     * @param performanceId Unique performance ID
     * @param segmentHash Segment hash
     * @param performer Performer address
     * @param videoUri Grove URI for performance video
     * @dev Anyone can call - submissions are open
     */
    function submitPerformance(
        uint256 performanceId,
        bytes32 segmentHash,
        address performer,
        string calldata videoUri
    ) external whenNotPaused {
        if (performer == address(0)) revert InvalidAddress();

        emit PerformanceSubmitted(
            performanceId,
            segmentHash,
            performer,
            videoUri,
            uint64(block.timestamp)
        );
    }

    // ============ Admin Functions ============

    /**
     * @notice Update trusted PKP address
     * @param newPKP New PKP address
     * @dev Only owner can update
     */
    function setTrustedPKP(address newPKP) external onlyOwner {
        if (newPKP == address(0)) revert InvalidAddress();

        emit TrustedPKPUpdated(trustedPKP, newPKP);
        trustedPKP = newPKP;
    }

    /**
     * @notice Pause/unpause contract (emergency only)
     * @param _paused Whether to pause
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedUpdated(_paused);
    }

    /**
     * @notice Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
}
