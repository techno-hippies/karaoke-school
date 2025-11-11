// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ClipEvents
 * @notice Event-only contract for karaoke clip lifecycle and associated full-song encryption
 * @dev Emits events for The Graph indexing. No storage is persisted on-chain.
 */
contract ClipEvents {
    /**
     * @notice Emitted when a karaoke clip is registered
     * @param clipHash Unique identifier for the clip (keccak256(trackId, clipStartMs))
     * @param grc20WorkId GRC-20 musical work entity UUID
     * @param spotifyTrackId Spotify track identifier
     * @param clipStartMs Clip start time in milliseconds
     * @param clipEndMs Clip end time in milliseconds
     * @param metadataUri Grove URI containing clip metadata
     * @param registeredBy Address that registered the clip
     * @param timestamp Block timestamp
     */
    event ClipRegistered(
        bytes32 indexed clipHash,
        string grc20WorkId,
        string spotifyTrackId,
        uint32 clipStartMs,
        uint32 clipEndMs,
        string metadataUri,
        address indexed registeredBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when clip processing completes with instrumental/alignment assets
     * @param clipHash Unique clip identifier
     * @param instrumentalUri Grove URI for the karaoke instrumental clip
     * @param alignmentUri Grove URI for alignment metadata (word timing)
     * @param translationCount Number of translations published for this clip
     * @param metadataUri Grove URI containing updated metadata with asset references
     * @param timestamp Block timestamp
     */
    event ClipProcessed(
        bytes32 indexed clipHash,
        string instrumentalUri,
        string alignmentUri,
        uint8 translationCount,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when the full-length song is encrypted and linked to the clip
     * @param clipHash Unique clip identifier the full song is associated with
     * @param spotifyTrackId Spotify track identifier
     * @param encryptedFullUri Grove or load.network URI for encrypted full-length audio
     * @param encryptedManifestUri Grove URI for Lit ACC manifest / payload
     * @param unlockLockAddress Unlock Protocol lock governing access
     * @param unlockChainId Chain ID for the Unlock lock
     * @param metadataUri Grove URI referencing encryption metadata
     * @param timestamp Block timestamp
     */
    event SongEncrypted(
        bytes32 indexed clipHash,
        string spotifyTrackId,
        string encryptedFullUri,
        string encryptedManifestUri,
        address unlockLockAddress,
        uint32 unlockChainId,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a clip is enabled or disabled
     * @param clipHash Unique clip identifier
     * @param enabled Whether the clip is enabled
     * @param timestamp Block timestamp
     */
    event ClipToggled(
        bytes32 indexed clipHash,
        bool enabled,
        uint64 timestamp
    );

    function emitClipRegistered(
        bytes32 clipHash,
        string calldata grc20WorkId,
        string calldata spotifyTrackId,
        uint32 clipStartMs,
        uint32 clipEndMs,
        string calldata metadataUri
    ) external {
        emit ClipRegistered(
            clipHash,
            grc20WorkId,
            spotifyTrackId,
            clipStartMs,
            clipEndMs,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function emitClipProcessed(
        bytes32 clipHash,
        string calldata instrumentalUri,
        string calldata alignmentUri,
        uint8 translationCount,
        string calldata metadataUri
    ) external {
        emit ClipProcessed(
            clipHash,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    function emitSongEncrypted(
        bytes32 clipHash,
        string calldata spotifyTrackId,
        string calldata encryptedFullUri,
        string calldata encryptedManifestUri,
        address unlockLockAddress,
        uint32 unlockChainId,
        string calldata metadataUri
    ) external {
        emit SongEncrypted(
            clipHash,
            spotifyTrackId,
            encryptedFullUri,
            encryptedManifestUri,
            unlockLockAddress,
            unlockChainId,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    function emitClipToggled(
        bytes32 clipHash,
        bool enabled
    ) external {
        emit ClipToggled(
            clipHash,
            enabled,
            uint64(block.timestamp)
        );
    }

    function getClipHash(string calldata spotifyTrackId, uint32 clipStartMs)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(spotifyTrackId, clipStartMs));
    }
}
