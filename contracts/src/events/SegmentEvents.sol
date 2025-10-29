// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SegmentEvents
 * @notice Minimal event-only contract for segment registration/processing
 * @dev Emits events for The Graph indexing - NO STORAGE
 *
 * Purpose:
 * - Enable subgraph indexing for segment queries
 * - Track segment processing pipeline (karaoke audio + translations)
 * - Reference GRC-20 work entity UUIDs (public music metadata layer)
 * - Store karaoke-specific data (segments, translations) in Grove
 *
 * Data Flow:
 * 1. Query GRC-20 for work entity ID (by ISWC/Spotify ID)
 * 2. Build segment metadata with timing, translations → Grove
 * 3. Call emitSegmentRegistered() with GRC-20 work UUID
 * 4. After processing, call emitSegmentProcessed() with asset URIs
 * 5. The Graph indexes events for app queries
 *
 * Gas Cost: ~35k per event (minimal on-chain footprint)
 * Storage: Grove/IPFS (permanent, queryable via GRC-20 graph)
 */
contract SegmentEvents {

    // ============ Events ============

    /**
     * @notice Emitted when a segment is registered (before processing)
     * @param segmentHash Unique segment hash (keccak256(spotifyTrackId, segmentStartMs))
     * @param grc20WorkId GRC-20 musical work entity UUID (references public metadata layer)
     * @param spotifyTrackId Spotify track ID (for fast lookups + audio matching)
     * @param segmentStartMs Start time in milliseconds (fal segment timing)
     * @param segmentEndMs End time in milliseconds (fal segment timing)
     * @param metadataUri Grove URI for full metadata (grove://...)
     * @param registeredBy Address that registered the segment
     * @param timestamp Block timestamp
     */
    event SegmentRegistered(
        bytes32 indexed segmentHash,
        string indexed grc20WorkId,
        string spotifyTrackId,
        uint32 segmentStartMs,
        uint32 segmentEndMs,
        string metadataUri,
        address indexed registeredBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when segment processing completes
     * @param segmentHash Unique segment hash
     * @param instrumentalUri Grove URI for instrumental (PRIMARY - users karaoke over this)
     * @param alignmentUri Grove URI for alignment metadata (ElevenLabs word-level timing)
     * @param translationCount Number of translations available (es, zh, ja, ko, etc.)
     * @param metadataUri Updated Grove URI with asset links (includes translation URIs)
     * @param timestamp Block timestamp
     */
    event SegmentProcessed(
        bytes32 indexed segmentHash,
        string instrumentalUri,
        string alignmentUri,
        uint8 translationCount,
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
     * @param segmentHash Unique segment identifier (keccak256(spotifyTrackId, segmentStartMs))
     * @param grc20WorkId GRC-20 musical work entity UUID
     * @param spotifyTrackId Spotify track ID
     * @param segmentStartMs Segment start time in milliseconds
     * @param segmentEndMs Segment end time in milliseconds
     * @param metadataUri Grove URI for metadata
     * @dev Anyone can call - no authorization needed
     */
    function emitSegmentRegistered(
        bytes32 segmentHash,
        string calldata grc20WorkId,
        string calldata spotifyTrackId,
        uint32 segmentStartMs,
        uint32 segmentEndMs,
        string calldata metadataUri
    ) external {
        emit SegmentRegistered(
            segmentHash,
            grc20WorkId,
            spotifyTrackId,
            segmentStartMs,
            segmentEndMs,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit segment processing completion event
     * @param segmentHash Unique segment identifier
     * @param instrumentalUri Grove URI for instrumental (enhanced via Fal.ai)
     * @param alignmentUri Grove URI for alignment metadata (ElevenLabs word timing)
     * @param translationCount Number of translations available
     * @param metadataUri Updated Grove URI with asset links (includes translation URIs)
     */
    function emitSegmentProcessed(
        bytes32 segmentHash,
        string calldata instrumentalUri,
        string calldata alignmentUri,
        uint8 translationCount,
        string calldata metadataUri
    ) external {
        emit SegmentProcessed(
            segmentHash,
            instrumentalUri,
            alignmentUri,
            translationCount,
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
     * @param spotifyTrackId Spotify track ID
     * @param segmentStartMs Segment start time in milliseconds
     * @return Segment hash (keccak256)
     */
    function getSegmentHash(string calldata spotifyTrackId, uint32 segmentStartMs)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(spotifyTrackId, segmentStartMs));
    }
}
