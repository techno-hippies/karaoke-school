// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title ISongRegistry
 * @notice Interface for the Song Registry contract
 * @dev Stores songs with links to artists
 */
interface ISongRegistry {

    // ============ Types ============

    struct Song {
        uint32 geniusId;             // Genius.com song ID (0 if not on Genius)
        uint32 geniusArtistId;       // Links to ArtistRegistry
        string spotifyId;            // Spotify track ID (e.g., "4JqbGfqhVRWw4X8vXKnYVA")
        string tiktokMusicId;        // TikTok music page ID (e.g., "7153892367888910337")
        string title;                // Song title
        string artist;               // Artist name (for display)
        uint32 duration;             // Full song duration in seconds
        string coverUri;             // grove:// URI for cover art
        string metadataUri;          // grove:// URI for full metadata JSON
        bool copyrightFree;          // true if public domain / copyright-free
        bool enabled;                // Soft delete flag
        uint64 createdAt;            // Registration timestamp
        uint64 updatedAt;            // Last update timestamp
    }

    // ============ Events ============

    event SongRegistered(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        string title,
        string artist
    );

    event SongUpdated(
        uint32 indexed geniusId,
        string metadataUri
    );

    event SongToggled(uint32 indexed geniusId, bool enabled);

    // ============ Errors ============

    error SongAlreadyExists(uint32 geniusId);
    error SongNotFound(uint32 geniusId);
    error ArtistNotFound(uint32 geniusArtistId);
    error InvalidGeniusId();
    error InvalidArtistId();
    error InvalidTitle();
    error InvalidArtist();
    error InvalidDuration();
    error NotOwner();
    error NotAuthorized();

    // ============ Functions ============

    function registerSong(
        uint32 geniusId,
        uint32 geniusArtistId,
        string calldata spotifyId,
        string calldata tiktokMusicId,
        string calldata title,
        string calldata artist,
        uint32 duration,
        string calldata coverUri,
        string calldata metadataUri,
        bool copyrightFree
    ) external;

    function updateSongMetadata(
        uint32 geniusId,
        string calldata metadataUri
    ) external;

    function toggleSong(uint32 geniusId, bool enabled) external;

    function getSong(uint32 geniusId) external view returns (Song memory);

    function songExists(uint32 geniusId) external view returns (bool);

    function getSongsByArtist(uint32 geniusArtistId) external view returns (uint32[] memory);

    function getTotalSongs() external view returns (uint32);

    function getRecentSongs(uint32 limit) external view returns (Song[] memory);
}
