// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/IPerformanceRegistry.sol";
import "../interfaces/ISegmentRegistry.sol";

/**
 * @title PerformanceRegistryV1
 * @notice Registry for user karaoke performances
 * @dev Stores performances with grading (scored by Lit Actions)
 *
 * Design Philosophy:
 * - Performance = User's karaoke recording of a full segment
 * - Two-phase: submit() creates record, grade() adds score
 * - Scores in basis points (0-10000) for precision
 * - Links to SegmentRegistry for segment metadata
 *
 * Grading Flow:
 * 1. User submits performance → video uploaded to Grove
 * 2. Lit Action grades performance (pronunciation, timing, etc.)
 * 3. Lit Action calls gradePerformance() with score
 * 4. Performance appears on leaderboards
 *
 * Version: 1.0.0
 * Author: Karaoke School
 */
contract PerformanceRegistryV1 is IPerformanceRegistry {

    // ============ State Variables ============

    address public owner;
    mapping(address => bool) public isAuthorized; // Lit Actions for grading

    ISegmentRegistry public immutable segmentRegistry;

    // Primary storage
    mapping(uint256 => Performance) private performances; // performanceId => Performance

    // Indexes
    mapping(address => uint256[]) private studentToPerformances; // student => performanceIds
    mapping(bytes32 => uint256[]) private segmentToPerformances; // segmentHash => performanceIds

    // Stats
    uint256 public totalPerformances;
    uint256 private nextPerformanceId = 1;

    // ============ Constructor ============

    constructor(address _segmentRegistry) {
        if (_segmentRegistry == address(0)) revert InvalidStudent();

        owner = msg.sender;
        isAuthorized[msg.sender] = true;
        segmentRegistry = ISegmentRegistry(_segmentRegistry);
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!isAuthorized[msg.sender] && msg.sender != owner) {
            revert NotAuthorized();
        }
        _;
    }

    // ============ Performance Functions ============

    /**
     * @notice Submit a new performance (Phase 1: before grading)
     * @param segmentHash Segment identifier (from SegmentRegistry)
     * @param student Student's address
     * @param videoUri Grove URI for performance video
     * @param audioUri Grove URI for performance audio (optional)
     * @return performanceId Unique performance identifier
     * @dev Anyone can submit, but typically called by frontend or Lit Action
     */
    function submitPerformance(
        bytes32 segmentHash,
        address student,
        string calldata videoUri,
        string calldata audioUri
    ) external returns (uint256 performanceId) {
        // Validation
        if (student == address(0)) revert InvalidStudent();
        if (bytes(videoUri).length == 0) revert InvalidVideoUri();

        // Verify segment exists
        if (!segmentRegistry.segmentExists(segmentHash)) {
            revert SegmentNotFound(segmentHash);
        }

        // Create performance record
        performanceId = nextPerformanceId++;

        performances[performanceId] = Performance({
            performanceId: performanceId,
            segmentHash: segmentHash,
            student: student,
            videoUri: videoUri,
            audioUri: audioUri,
            score: 0,
            gradeUri: "",
            graded: false,
            createdAt: uint64(block.timestamp),
            gradedAt: 0
        });

        // Update indexes
        studentToPerformances[student].push(performanceId);
        segmentToPerformances[segmentHash].push(performanceId);

        // Update stats
        totalPerformances++;

        emit PerformanceSubmitted(
            performanceId,
            segmentHash,
            student,
            videoUri
        );

        return performanceId;
    }

    /**
     * @notice Grade a performance (Phase 2: Lit Action scoring)
     * @param performanceId Performance identifier
     * @param score Score in basis points (0-10000, e.g., 8525 = 85.25%)
     * @param gradeUri Grove URI for detailed grading JSON
     * @dev Only authorized addresses (Lit Actions) can grade
     */
    function gradePerformance(
        uint256 performanceId,
        uint16 score,
        string calldata gradeUri
    ) external onlyAuthorized {
        Performance storage performance = performances[performanceId];
        if (performance.performanceId == 0) revert PerformanceNotFound(performanceId);
        if (performance.graded) revert AlreadyGraded();
        if (score > 10000) revert InvalidScore();

        // Update performance
        performance.score = score;
        performance.gradeUri = gradeUri;
        performance.graded = true;
        performance.gradedAt = uint64(block.timestamp);

        emit PerformanceGraded(performanceId, score, gradeUri);
    }

    // ============ Query Functions ============

    /**
     * @notice Get performance by ID
     */
    function getPerformance(uint256 performanceId)
        external
        view
        returns (Performance memory)
    {
        Performance memory performance = performances[performanceId];
        if (performance.performanceId == 0) revert PerformanceNotFound(performanceId);
        return performance;
    }

    /**
     * @notice Check if performance exists
     */
    function performanceExists(uint256 performanceId) external view returns (bool) {
        return performances[performanceId].performanceId != 0;
    }

    /**
     * @notice Get all performances by a student
     * @param student Student's address
     * @return Array of performance IDs
     */
    function getPerformancesByStudent(address student)
        external
        view
        returns (uint256[] memory)
    {
        return studentToPerformances[student];
    }

    /**
     * @notice Get all performances for a segment
     * @param segmentHash Segment identifier
     * @return Array of performance IDs
     */
    function getPerformancesBySegment(bytes32 segmentHash)
        external
        view
        returns (uint256[] memory)
    {
        return segmentToPerformances[segmentHash];
    }

    /**
     * @notice Get top-scoring performances for a segment
     * @param segmentHash Segment identifier
     * @param limit Maximum number of performances to return
     * @return Array of performances (highest scores first)
     * @dev Returns only graded performances, sorted by score descending
     */
    function getTopPerformancesBySegment(bytes32 segmentHash, uint32 limit)
        external
        view
        returns (Performance[] memory)
    {
        uint256[] memory performanceIds = segmentToPerformances[segmentHash];

        if (performanceIds.length == 0) {
            return new Performance[](0);
        }

        // Count graded performances
        uint256 gradedCount = 0;
        for (uint256 i = 0; i < performanceIds.length; i++) {
            if (performances[performanceIds[i]].graded) {
                gradedCount++;
            }
        }

        if (gradedCount == 0) {
            return new Performance[](0);
        }

        // Collect graded performances
        Performance[] memory graded = new Performance[](gradedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < performanceIds.length; i++) {
            Performance storage perf = performances[performanceIds[i]];
            if (perf.graded) {
                graded[index] = perf;
                index++;
            }
        }

        // Simple bubble sort (good enough for small arrays)
        // TODO: Optimize for production with better sorting or off-chain indexing
        for (uint256 i = 0; i < graded.length; i++) {
            for (uint256 j = i + 1; j < graded.length; j++) {
                if (graded[j].score > graded[i].score) {
                    Performance memory temp = graded[i];
                    graded[i] = graded[j];
                    graded[j] = temp;
                }
            }
        }

        // Return top N
        uint256 resultCount = limit > gradedCount ? gradedCount : limit;
        Performance[] memory result = new Performance[](resultCount);
        for (uint256 i = 0; i < resultCount; i++) {
            result[i] = graded[i];
        }

        return result;
    }

    /**
     * @notice Get total number of performances
     */
    function getTotalPerformances() external view returns (uint256) {
        return totalPerformances;
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize/revoke grader (typically Lit Actions)
     */
    function setAuthorized(address grader, bool authorized) external onlyOwner {
        isAuthorized[grader] = authorized;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidStudent();
        owner = newOwner;
        isAuthorized[newOwner] = true;
    }
}
