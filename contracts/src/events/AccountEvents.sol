// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title AccountEvents
 * @notice Optional event-only contract for account creation tracking
 * @dev Emits events for The Graph indexing - NO STORAGE
 *
 * Purpose:
 * - Enable subgraph indexing for account queries (optional)
 * - Track unified account creation (no artist/user split)
 * - Provide analytics on account growth
 *
 * Note: This contract is OPTIONAL. Lens accounts already exist on Lens chain,
 * so events here are purely for convenience (e.g., filtering by creation date).
 *
 * Data Flow:
 * 1. Create Lens account + upload metadata to Grove
 * 2. Optionally call emitAccountCreated() for indexing
 * 3. The Graph can query accounts by creation date, username, etc.
 *
 * Gas Cost: ~25k (very minimal)
 */
contract AccountEvents {

    // ============ Events ============

    /**
     * @notice Emitted when an account is created
     * @param lensAccountAddress Lens Account contract address
     * @param pkpAddress Lit Protocol PKP address (account controller)
     * @param username Lens username (without @)
     * @param metadataUri Grove URI for account metadata (lens://...)
     * @param geniusArtistId Optional Genius artist ID (0 if not an artist)
     * @param timestamp Block timestamp
     */
    event AccountCreated(
        address indexed lensAccountAddress,
        address indexed pkpAddress,
        string username,
        string metadataUri,
        uint32 geniusArtistId,
        uint64 timestamp
    );

    /**
     * @notice Emitted when account metadata is updated
     * @param lensAccountAddress Lens Account contract address
     * @param metadataUri New Grove URI
     * @param updatedBy Address that updated the metadata
     * @param timestamp Block timestamp
     */
    event AccountMetadataUpdated(
        address indexed lensAccountAddress,
        string metadataUri,
        address indexed updatedBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when an account is verified
     * @param lensAccountAddress Lens Account contract address
     * @param verified Whether account is verified
     * @param verifiedBy Address that verified the account
     * @param timestamp Block timestamp
     */
    event AccountVerified(
        address indexed lensAccountAddress,
        bool verified,
        address indexed verifiedBy,
        uint64 timestamp
    );

    // ============ Functions ============

    /**
     * @notice Emit account creation event
     * @param lensAccountAddress Lens Account contract address
     * @param pkpAddress PKP address
     * @param username Lens username
     * @param metadataUri Grove URI for metadata
     * @param geniusArtistId Optional Genius artist ID (0 if none)
     * @dev Anyone can call - typically called by account creation script
     */
    function emitAccountCreated(
        address lensAccountAddress,
        address pkpAddress,
        string calldata username,
        string calldata metadataUri,
        uint32 geniusArtistId
    ) external {
        emit AccountCreated(
            lensAccountAddress,
            pkpAddress,
            username,
            metadataUri,
            geniusArtistId,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit metadata update event
     * @param lensAccountAddress Lens Account contract address
     * @param metadataUri New Grove URI
     */
    function emitAccountMetadataUpdated(
        address lensAccountAddress,
        string calldata metadataUri
    ) external {
        emit AccountMetadataUpdated(
            lensAccountAddress,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit verification event
     * @param lensAccountAddress Lens Account contract address
     * @param verified Whether account is verified
     */
    function emitAccountVerified(
        address lensAccountAddress,
        bool verified
    ) external {
        emit AccountVerified(
            lensAccountAddress,
            verified,
            msg.sender,
            uint64(block.timestamp)
        );
    }
}
