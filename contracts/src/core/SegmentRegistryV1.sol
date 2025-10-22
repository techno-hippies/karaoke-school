// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ISegmentRegistry.sol";
import "../interfaces/ISongRegistry.sol";

/**
 * @title SegmentRegistryV1
 * @notice Registry for song segments (~30s TikTok portions)
 * @dev Stores segments with audio assets (vocals, instrumental, alignment)
 *
 * Design Philosophy:
 * - Segment = The canonical ~30s audio portion users practice
 * - Identified by hash(geniusId, tiktokSegmentId)
 * - Two-phase: register() creates metadata, processSegment() adds audio assets
 * - Links to SongRegistry for song metadata
 *
 * Key Distinction:
 * - This is NOT for TikTok videos (those are just references)
 * - This is for the audio segment itself (what users karaoke)
 * - TikTok videos may be shorter clips of this segment
 *
 * Version: 1.0.0
 * Author: Karaoke School
 */
contract SegmentRegistryV1 is ISegmentRegistry {

    // ============ State Variables ============

    address public owner;
    mapping(address => bool) public isAuthorized;

    ISongRegistry public immutable songRegistry;

    // Primary storage
    mapping(bytes32 => Segment) private segments; // segmentHash => Segment

    // Indexes
    mapping(uint32 => bytes32[]) private songToSegments; // geniusId => segmentHashes

    // Stats
    uint32 public totalSegments;

    // ============ Constructor ============

    constructor(address _songRegistry) {
        if (_songRegistry == address(0)) revert InvalidGeniusId();

        owner = msg.sender;
        isAuthorized[msg.sender] = true;
        songRegistry = ISongRegistry(_songRegistry);
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

    // ============ Registration Functions ============

    /**
     * @notice Register a new segment (Phase 1: metadata only)
     * @param geniusId Genius song ID (must exist in SongRegistry)
     * @param tiktokSegmentId TikTok music page ID
     * @param startTime Start time in song (seconds)
     * @param endTime End time in song (seconds)
     * @param coverUri Grove URI for cover art
     * @return segmentHash Unique identifier for this segment
     * @dev Audio assets added later via processSegment()
     */
    function registerSegment(
        uint32 geniusId,
        string calldata tiktokSegmentId,
        uint32 startTime,
        uint32 endTime,
        string calldata coverUri
    ) external onlyAuthorized returns (bytes32 segmentHash) {
        // Validation
        if (geniusId == 0) revert InvalidGeniusId();
        if (bytes(tiktokSegmentId).length == 0) revert InvalidTiktokSegmentId();
        if (endTime <= startTime) revert InvalidTimeRange();

        uint32 duration = endTime - startTime;
        if (duration == 0 || duration > 60) revert InvalidDuration(); // Max 60s

        // Verify song exists
        if (!songRegistry.songExists(geniusId)) {
            revert SongNotFound(geniusId);
        }

        // Generate segment hash
        segmentHash = getSegmentHash(geniusId, tiktokSegmentId);

        // Check segment doesn't exist
        if (segments[segmentHash].geniusId != 0) {
            revert SegmentAlreadyExists(segmentHash);
        }

        // Create segment record (without audio assets)
        segments[segmentHash] = Segment({
            geniusId: geniusId,
            tiktokSegmentId: tiktokSegmentId,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            vocalsUri: "",
            instrumentalUri: "",
            alignmentUri: "",
            coverUri: coverUri,
            processed: false,
            enabled: true,
            createdAt: uint64(block.timestamp),
            processedAt: 0
        });

        // Update indexes
        songToSegments[geniusId].push(segmentHash);

        // Update stats
        totalSegments++;

        emit SegmentRegistered(
            segmentHash,
            geniusId,
            tiktokSegmentId,
            startTime,
            endTime
        );

        return segmentHash;
    }

    /**
     * @notice Add audio assets to segment (Phase 2: processing complete)
     * @param segmentHash Unique segment identifier
     * @param vocalsUri Grove URI for vocals (encrypted original)
     * @param instrumentalUri Grove URI for instrumental (audio2audio derivative)
     * @param alignmentUri Grove URI for forced alignment JSON
     * @dev Called after audio-matching + demucs + audio2audio pipeline
     */
    function processSegment(
        bytes32 segmentHash,
        string calldata vocalsUri,
        string calldata instrumentalUri,
        string calldata alignmentUri
    ) external onlyAuthorized {
        Segment storage segment = segments[segmentHash];
        if (segment.geniusId == 0) revert SegmentNotFound(segmentHash);

        // Update audio assets
        segment.vocalsUri = vocalsUri;
        segment.instrumentalUri = instrumentalUri;
        segment.alignmentUri = alignmentUri;
        segment.processed = true;
        segment.processedAt = uint64(block.timestamp);

        emit SegmentProcessed(
            segmentHash,
            vocalsUri,
            instrumentalUri,
            alignmentUri
        );
    }

    /**
     * @notice Enable/disable segment (soft delete)
     */
    function toggleSegment(bytes32 segmentHash, bool enabled) external onlyOwner {
        Segment storage segment = segments[segmentHash];
        if (segment.geniusId == 0) revert SegmentNotFound(segmentHash);

        segment.enabled = enabled;

        emit SegmentToggled(segmentHash, enabled);
    }

    // ============ Query Functions ============

    /**
     * @notice Get segment by hash
     */
    function getSegment(bytes32 segmentHash)
        external
        view
        returns (Segment memory)
    {
        Segment memory segment = segments[segmentHash];
        if (segment.geniusId == 0) revert SegmentNotFound(segmentHash);
        return segment;
    }

    /**
     * @notice Check if segment exists
     */
    function segmentExists(bytes32 segmentHash) external view returns (bool) {
        return segments[segmentHash].geniusId != 0;
    }

    /**
     * @notice Get all segments for a song
     * @param geniusId Genius song ID
     * @return Array of segment hashes
     */
    function getSegmentsBySong(uint32 geniusId)
        external
        view
        returns (bytes32[] memory)
    {
        return songToSegments[geniusId];
    }

    /**
     * @notice Calculate segment hash (deterministic identifier)
     * @param geniusId Genius song ID
     * @param tiktokSegmentId TikTok segment ID
     * @return Unique hash for this segment
     */
    function getSegmentHash(uint32 geniusId, string calldata tiktokSegmentId)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(geniusId, tiktokSegmentId));
    }

    /**
     * @notice Get total number of segments
     */
    function getTotalSegments() external view returns (uint32) {
        return totalSegments;
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize/revoke registrar
     */
    function setAuthorized(address registrar, bool authorized) external onlyOwner {
        isAuthorized[registrar] = authorized;
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidGeniusId();
        owner = newOwner;
        isAuthorized[newOwner] = true;
    }
}
