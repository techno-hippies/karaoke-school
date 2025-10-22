// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title SongEvents
 * @notice Minimal event-only contract for song registration
 * @dev Emits events for The Graph indexing - NO STORAGE
 *
 * Purpose:
 * - Enable subgraph indexing for song queries
 * - Provide immutable registration log
 * - Replace SongRegistryV1 storage with off-chain Grove data
 *
 * Data Flow:
 * 1. Upload song metadata to Grove (lens://song-{geniusId}.json)
 * 2. Call emitSongRegistered() to create indexable event
 * 3. The Graph indexes event for queries
 * 4. Frontend fetches metadata from Grove URI
 *
 * Gas Cost: ~28k (vs ~200k for full V1 registration)
 * Savings: ~86%
 */
contract SongEvents {

    // ============ Events ============

    /**
     * @notice Emitted when a song is registered
     * @param geniusId Genius song ID (primary identifier)
     * @param metadataUri Grove URI for full metadata (lens://...)
     * @param registeredBy Address that registered the song
     * @param geniusArtistId Optional Genius artist ID (0 if not set)
     * @param timestamp Block timestamp
     */
    event SongRegistered(
        uint32 indexed geniusId,
        string metadataUri,
        address indexed registeredBy,
        uint32 geniusArtistId,
        uint64 timestamp
    );

    /**
     * @notice Emitted when song metadata is updated
     * @param geniusId Genius song ID
     * @param metadataUri New Grove URI
     * @param updatedBy Address that updated the metadata
     * @param timestamp Block timestamp
     */
    event SongMetadataUpdated(
        uint32 indexed geniusId,
        string metadataUri,
        address indexed updatedBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a song is enabled/disabled
     * @param geniusId Genius song ID
     * @param enabled Whether song is enabled
     * @param timestamp Block timestamp
     */
    event SongToggled(
        uint32 indexed geniusId,
        bool enabled,
        uint64 timestamp
    );

    // ============ Functions ============

    /**
     * @notice Emit song registration event
     * @param geniusId Genius song ID
     * @param metadataUri Grove URI for metadata
     * @param geniusArtistId Optional Genius artist ID (0 if none)
     * @dev Anyone can call - no authorization needed (data is in Grove)
     */
    function emitSongRegistered(
        uint32 geniusId,
        string calldata metadataUri,
        uint32 geniusArtistId
    ) external {
        emit SongRegistered(
            geniusId,
            metadataUri,
            msg.sender,
            geniusArtistId,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit metadata update event
     * @param geniusId Genius song ID
     * @param metadataUri New Grove URI
     */
    function emitSongMetadataUpdated(
        uint32 geniusId,
        string calldata metadataUri
    ) external {
        emit SongMetadataUpdated(
            geniusId,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit toggle event
     * @param geniusId Genius song ID
     * @param enabled Whether song is enabled
     */
    function emitSongToggled(
        uint32 geniusId,
        bool enabled
    ) external {
        emit SongToggled(
            geniusId,
            enabled,
            uint64(block.timestamp)
        );
    }
}
