// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title ISegmentRegistry
 * @notice Interface for the Segment Registry contract
 * @dev Stores ~30s song segments (from TikTok) that users practice
 */
interface ISegmentRegistry {

    // ============ Types ============

    struct Segment {
        uint32 geniusId;             // Links to SongRegistry
        string tiktokSegmentId;      // TikTok's segment/music ID
        uint32 startTime;            // Start time in song (seconds)
        uint32 endTime;              // End time in song (seconds)
        uint32 duration;             // Segment duration (~30s)
        string vocalsUri;            // grove:// URI for vocals (encrypted original)
        string instrumentalUri;      // grove:// URI for instrumental (audio2audio derivative)
        string alignmentUri;         // grove:// URI for forced alignment JSON (word timestamps)
        string coverUri;             // grove:// URI for cover art
        bool processed;              // Audio processing complete
        bool enabled;                // Soft delete flag
        uint64 createdAt;            // Registration timestamp
        uint64 processedAt;          // Audio processing completion timestamp
    }

    // ============ Events ============

    event SegmentRegistered(
        bytes32 indexed segmentHash,
        uint32 indexed geniusId,
        string tiktokSegmentId,
        uint32 startTime,
        uint32 endTime
    );

    event SegmentProcessed(
        bytes32 indexed segmentHash,
        string vocalsUri,
        string instrumentalUri,
        string alignmentUri
    );

    event SegmentToggled(bytes32 indexed segmentHash, bool enabled);

    // ============ Errors ============

    error SegmentAlreadyExists(bytes32 segmentHash);
    error SegmentNotFound(bytes32 segmentHash);
    error SongNotFound(uint32 geniusId);
    error InvalidGeniusId();
    error InvalidTiktokSegmentId();
    error InvalidTimeRange();
    error InvalidDuration();
    error SegmentNotProcessed();
    error NotOwner();
    error NotAuthorized();

    // ============ Functions ============

    function registerSegment(
        uint32 geniusId,
        string calldata tiktokSegmentId,
        uint32 startTime,
        uint32 endTime,
        string calldata coverUri
    ) external returns (bytes32 segmentHash);

    function processSegment(
        bytes32 segmentHash,
        string calldata vocalsUri,
        string calldata instrumentalUri,
        string calldata alignmentUri
    ) external;

    function toggleSegment(bytes32 segmentHash, bool enabled) external;

    function getSegment(bytes32 segmentHash) external view returns (Segment memory);

    function segmentExists(bytes32 segmentHash) external view returns (bool);

    function getSegmentsBySong(uint32 geniusId) external view returns (bytes32[] memory);

    function getSegmentHash(uint32 geniusId, string calldata tiktokSegmentId) external pure returns (bytes32);

    function getTotalSegments() external view returns (uint32);
}
