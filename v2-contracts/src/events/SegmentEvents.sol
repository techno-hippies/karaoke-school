// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title SegmentEvents
 * @notice Minimal event-only contract for segment registration/processing
 * @dev Emits events for The Graph indexing - NO STORAGE
 *
 * Purpose:
 * - Enable subgraph indexing for segment queries
 * - Track segment processing pipeline
 * - Replace SegmentRegistryV1 storage with off-chain Grove data
 *
 * Data Flow:
 * 1. Upload segment metadata to Grove (lens://segment-{hash}.json)
 * 2. Call emitSegmentRegistered() for initial registration
 * 3. After processing, call emitSegmentProcessed() with asset URIs
 * 4. The Graph indexes events for queries
 *
 * Gas Cost: ~30k per event (vs ~180k for V1 registration)
 * Savings: ~83%
 */
contract SegmentEvents {

    // ============ Events ============

    /**
     * @notice Emitted when a segment is registered (before processing)
     * @param segmentHash Unique segment hash (keccak256(geniusId, tiktokSegmentId))
     * @param geniusId Genius song ID
     * @param tiktokSegmentId TikTok music page ID
     * @param metadataUri Grove URI for full metadata (lens://...)
     * @param registeredBy Address that registered the segment
     * @param timestamp Block timestamp
     */
    event SegmentRegistered(
        bytes32 indexed segmentHash,
        uint32 indexed geniusId,
        string tiktokSegmentId,
        string metadataUri,
        address indexed registeredBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when segment processing completes
     * @param segmentHash Unique segment hash
     * @param instrumentalUri Grove URI for instrumental (PRIMARY - users karaoke over this)
     * @param alignmentUri Grove URI for alignment metadata (word-level timing)
     * @param metadataUri Updated Grove URI with asset links
     * @param timestamp Block timestamp
     */
    event SegmentProcessed(
        bytes32 indexed segmentHash,
        string instrumentalUri,
        string alignmentUri,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a segment is enabled/disabled
     * @param segmentHash Unique segment hash
     * @param enabled Whether segment is enabled
     * @param timestamp Block timestamp
     */
    event SegmentToggled(
        bytes32 indexed segmentHash,
        bool enabled,
        uint64 timestamp
    );

    // ============ Functions ============

    /**
     * @notice Emit segment registration event
     * @param segmentHash Unique segment identifier
     * @param geniusId Genius song ID
     * @param tiktokSegmentId TikTok music page ID
     * @param metadataUri Grove URI for metadata
     * @dev Anyone can call - no authorization needed
     */
    function emitSegmentRegistered(
        bytes32 segmentHash,
        uint32 geniusId,
        string calldata tiktokSegmentId,
        string calldata metadataUri
    ) external {
        emit SegmentRegistered(
            segmentHash,
            geniusId,
            tiktokSegmentId,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit segment processing completion event
     * @param segmentHash Unique segment identifier
     * @param instrumentalUri Grove URI for instrumental
     * @param alignmentUri Grove URI for alignment metadata
     * @param metadataUri Updated Grove URI with asset links
     */
    function emitSegmentProcessed(
        bytes32 segmentHash,
        string calldata instrumentalUri,
        string calldata alignmentUri,
        string calldata metadataUri
    ) external {
        emit SegmentProcessed(
            segmentHash,
            instrumentalUri,
            alignmentUri,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit toggle event
     * @param segmentHash Unique segment identifier
     * @param enabled Whether segment is enabled
     */
    function emitSegmentToggled(
        bytes32 segmentHash,
        bool enabled
    ) external {
        emit SegmentToggled(
            segmentHash,
            enabled,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Helper: Generate segment hash (for consistency)
     * @param geniusId Genius song ID
     * @param tiktokSegmentId TikTok segment ID
     * @return Segment hash (keccak256)
     */
    function getSegmentHash(uint32 geniusId, string calldata tiktokSegmentId)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(geniusId, tiktokSegmentId));
    }
}
