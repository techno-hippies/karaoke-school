// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title LineEvents
 * @notice Event-only contract for line-level karaoke tracking
 * @dev Emits events for The Graph indexing - NO STORAGE
 *
 * Purpose:
 * - Enable line-by-line study cards for FSRS spaced repetition
 * - Track which lines are within segment boundaries (karaoke-worthy)
 * - Store word-level timing metadata in Grove
 * - Support performance tracking per line (not just per segment)
 *
 * Data Flow:
 * 1. Karaoke pipeline processes lyrics_translations → karaoke_lines DB
 * 2. Build line metadata (word timing, translations) → Grove
 * 3. Call emitLineRegistered() for each line in segment
 * 4. The Graph indexes events for app queries
 * 5. Frontend queries subgraph for lines → FSRS study cards
 *
 * Gas Cost: ~40k per line (minimal on-chain footprint)
 * Storage: Grove/IPFS (word-level timing metadata)
 */
contract LineEvents {

    // ============ Events ============

    /**
     * @notice Emitted when a karaoke line is registered
     * @param segmentHash Parent segment this line belongs to
     * @param lineId Stable UUID from karaoke_lines table (never changes even if re-processed)
     * @param spotifyTrackId Spotify track ID (for DB joins)
     * @param lineIndex 0-based position within track (NOT within segment - absolute position)
     * @param startMs Absolute timing from track start (NOT relative to segment)
     * @param endMs Absolute timing from track start
     * @param originalText Full line text (for display)
     * @param wordCount Number of words in line (for difficulty estimation)
     * @param metadataUri Grove URI for word-level timing (grove://...)
     * @param registeredBy Address that registered the line
     * @param timestamp Block timestamp
     */
    event LineRegistered(
        bytes32 indexed segmentHash,
        bytes32 indexed lineId,
        string spotifyTrackId,
        uint16 lineIndex,
        uint32 startMs,
        uint32 endMs,
        string originalText,
        uint8 wordCount,
        string metadataUri,
        address indexed registeredBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a line is updated (re-processed with better timing)
     * @param lineId Stable line UUID
     * @param startMs Updated start time
     * @param endMs Updated end time
     * @param originalText Updated text
     * @param wordCount Updated word count
     * @param metadataUri Updated Grove URI
     * @param timestamp Block timestamp
     */
    event LineUpdated(
        bytes32 indexed lineId,
        uint32 startMs,
        uint32 endMs,
        string originalText,
        uint8 wordCount,
        string metadataUri,
        uint64 timestamp
    );

    // ============ Functions ============

    /**
     * @notice Emit line registration event
     * @param segmentHash Parent segment hash (keccak256(spotifyTrackId, segmentStartMs))
     * @param lineId Stable UUID from karaoke_lines.line_id
     * @param spotifyTrackId Spotify track ID
     * @param lineIndex 0-based line position within full track
     * @param startMs Line start time (absolute, from track start)
     * @param endMs Line end time (absolute, from track start)
     * @param originalText Full line text
     * @param wordCount Number of words
     * @param metadataUri Grove URI for word-level timing JSON
     * @dev Anyone can call - no authorization needed
     */
    function emitLineRegistered(
        bytes32 segmentHash,
        bytes32 lineId,
        string calldata spotifyTrackId,
        uint16 lineIndex,
        uint32 startMs,
        uint32 endMs,
        string calldata originalText,
        uint8 wordCount,
        string calldata metadataUri
    ) external {
        emit LineRegistered(
            segmentHash,
            lineId,
            spotifyTrackId,
            lineIndex,
            startMs,
            endMs,
            originalText,
            wordCount,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit line update event (when re-processing improves timing)
     * @param lineId Stable UUID (doesn't change across updates)
     * @param startMs Updated start time
     * @param endMs Updated end time
     * @param originalText Updated text
     * @param wordCount Updated word count
     * @param metadataUri Updated Grove URI
     */
    function emitLineUpdated(
        bytes32 lineId,
        uint32 startMs,
        uint32 endMs,
        string calldata originalText,
        uint8 wordCount,
        string calldata metadataUri
    ) external {
        emit LineUpdated(
            lineId,
            startMs,
            endMs,
            originalText,
            wordCount,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Helper: Generate line ID from Neon DB UUID
     * @param uuidBytes UUID as bytes32
     * @return Line ID (keccak256 of UUID)
     */
    function getLineId(bytes32 uuidBytes)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(uuidBytes));
    }
}
