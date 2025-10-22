// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IPerformanceRegistry
 * @notice Interface for the Performance Registry contract
 * @dev Stores user karaoke performances of segments
 */
interface IPerformanceRegistry {

    // ============ Types ============

    struct Performance {
        uint256 performanceId;       // Unique performance ID
        bytes32 segmentHash;         // Links to SegmentRegistry
        address student;             // Student who performed
        string videoUri;             // grove:// URI for performance video
        string audioUri;             // grove:// URI for performance audio
        uint16 score;                // 0-10000 (basis points, e.g., 8525 = 85.25%)
        string gradeUri;             // grove:// URI for detailed grading JSON
        bool graded;                 // Whether grading is complete
        uint64 createdAt;            // Performance submission timestamp
        uint64 gradedAt;             // Grading completion timestamp
    }

    // ============ Events ============

    event PerformanceSubmitted(
        uint256 indexed performanceId,
        bytes32 indexed segmentHash,
        address indexed student,
        string videoUri
    );

    event PerformanceGraded(
        uint256 indexed performanceId,
        uint16 score,
        string gradeUri
    );

    // ============ Errors ============

    error SegmentNotFound(bytes32 segmentHash);
    error PerformanceNotFound(uint256 performanceId);
    error InvalidStudent();
    error InvalidVideoUri();
    error InvalidScore();
    error AlreadyGraded();
    error NotGraded();
    error NotOwner();
    error NotAuthorized();

    // ============ Functions ============

    function submitPerformance(
        bytes32 segmentHash,
        address student,
        string calldata videoUri,
        string calldata audioUri
    ) external returns (uint256 performanceId);

    function gradePerformance(
        uint256 performanceId,
        uint16 score,
        string calldata gradeUri
    ) external;

    function getPerformance(uint256 performanceId) external view returns (Performance memory);

    function performanceExists(uint256 performanceId) external view returns (bool);

    function getPerformancesByStudent(address student) external view returns (uint256[] memory);

    function getPerformancesBySegment(bytes32 segmentHash) external view returns (uint256[] memory);

    function getTopPerformancesBySegment(bytes32 segmentHash, uint32 limit) external view returns (Performance[] memory);

    function getTotalPerformances() external view returns (uint256);
}
