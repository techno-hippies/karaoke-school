// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ISongRegistry.sol";
import "../interfaces/IArtistRegistry.sol";

/**
 * @title SongRegistryV1
 * @notice Registry for songs with artist linkage
 * @dev Links songs to artists via geniusArtistId
 *
 * Design Philosophy:
 * - Genius ID as primary identifier (most reliable for music)
 * - Store minimal metadata on-chain
 * - Rich metadata (lyrics, translations, credits) stored in Grove
 * - Link to ArtistRegistry for artist aggregation
 *
 * Version: 1.0.0
 * Author: Karaoke School
 */
contract SongRegistryV1 is ISongRegistry {

    // ============ State Variables ============

    address public owner;
    mapping(address => bool) public isAuthorized;

    IArtistRegistry public immutable artistRegistry;

    // Primary storage
    mapping(uint32 => Song) private songs; // geniusId => Song

    // Indexes
    mapping(uint32 => uint32[]) private artistToSongs; // geniusArtistId => songIds
    uint32[] private allSongIds;

    // Stats
    uint32 public totalSongs;

    // ============ Constructor ============

    constructor(address _artistRegistry) {
        if (_artistRegistry == address(0)) revert InvalidArtistId();

        owner = msg.sender;
        isAuthorized[msg.sender] = true;
        artistRegistry = IArtistRegistry(_artistRegistry);
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
     * @notice Register a new song
     * @param geniusId Genius song ID (primary identifier)
     * @param geniusArtistId Genius artist ID (must exist in ArtistRegistry)
     * @param spotifyId Spotify track ID
     * @param tiktokMusicId TikTok music page ID
     * @param title Song title
     * @param artist Artist name (for display)
     * @param duration Song duration in seconds
     * @param coverUri Grove URI for cover art
     * @param metadataUri Grove URI for full metadata JSON
     * @param copyrightFree Whether song is public domain/copyright-free
     */
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
    ) external onlyAuthorized {
        // Validation
        if (geniusId == 0) revert InvalidGeniusId();
        if (geniusArtistId == 0) revert InvalidArtistId();
        if (bytes(title).length == 0) revert InvalidTitle();
        if (bytes(artist).length == 0) revert InvalidArtist();
        if (duration == 0) revert InvalidDuration();

        // Check song doesn't exist
        if (songs[geniusId].geniusId != 0) {
            revert SongAlreadyExists(geniusId);
        }

        // Verify artist exists
        if (!artistRegistry.artistExists(geniusArtistId)) {
            revert ArtistNotFound(geniusArtistId);
        }

        // Create song record
        songs[geniusId] = Song({
            geniusId: geniusId,
            geniusArtistId: geniusArtistId,
            spotifyId: spotifyId,
            tiktokMusicId: tiktokMusicId,
            title: title,
            artist: artist,
            duration: duration,
            coverUri: coverUri,
            metadataUri: metadataUri,
            copyrightFree: copyrightFree,
            enabled: true,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });

        // Update indexes
        artistToSongs[geniusArtistId].push(geniusId);
        allSongIds.push(geniusId);

        // Update stats
        totalSongs++;

        emit SongRegistered(geniusId, geniusArtistId, title, artist);
    }

    /**
     * @notice Update song metadata URI
     * @param geniusId Genius song ID
     * @param metadataUri New Grove URI for metadata
     */
    function updateSongMetadata(
        uint32 geniusId,
        string calldata metadataUri
    ) external onlyAuthorized {
        Song storage song = songs[geniusId];
        if (song.geniusId == 0) revert SongNotFound(geniusId);

        song.metadataUri = metadataUri;
        song.updatedAt = uint64(block.timestamp);

        emit SongUpdated(geniusId, metadataUri);
    }

    /**
     * @notice Enable/disable song (soft delete)
     * @param geniusId Genius song ID
     * @param enabled Whether song should be enabled
     */
    function toggleSong(uint32 geniusId, bool enabled) external onlyOwner {
        Song storage song = songs[geniusId];
        if (song.geniusId == 0) revert SongNotFound(geniusId);

        song.enabled = enabled;
        song.updatedAt = uint64(block.timestamp);

        emit SongToggled(geniusId, enabled);
    }

    // ============ Query Functions ============

    /**
     * @notice Get song by Genius ID
     */
    function getSong(uint32 geniusId) external view returns (Song memory) {
        Song memory song = songs[geniusId];
        if (song.geniusId == 0) revert SongNotFound(geniusId);
        return song;
    }

    /**
     * @notice Check if song exists
     */
    function songExists(uint32 geniusId) external view returns (bool) {
        return songs[geniusId].geniusId != 0;
    }

    /**
     * @notice Get all songs by an artist
     * @param geniusArtistId Genius artist ID
     * @return Array of Genius song IDs
     */
    function getSongsByArtist(uint32 geniusArtistId)
        external
        view
        returns (uint32[] memory)
    {
        return artistToSongs[geniusArtistId];
    }

    /**
     * @notice Get total number of songs
     */
    function getTotalSongs() external view returns (uint32) {
        return totalSongs;
    }

    /**
     * @notice Get most recently added songs
     * @param limit Maximum number of songs to return
     * @return Array of songs (newest first)
     */
    function getRecentSongs(uint32 limit) external view returns (Song[] memory) {
        if (limit == 0 || limit > 50) {
            limit = 50;
        }

        uint256 totalCount = allSongIds.length;
        if (totalCount == 0) {
            return new Song[](0);
        }

        // Determine actual count
        uint256 count = limit > totalCount ? totalCount : limit;
        Song[] memory recentSongs = new Song[](count);

        // Iterate backwards (most recent first)
        uint256 resultIndex = 0;
        for (uint256 i = totalCount; i > 0 && resultIndex < count; i--) {
            uint32 songId = allSongIds[i - 1];
            Song storage song = songs[songId];

            // Only include enabled songs
            if (song.enabled) {
                recentSongs[resultIndex] = song;
                resultIndex++;
            }
        }

        // Trim if we found fewer enabled songs than requested
        if (resultIndex < count) {
            Song[] memory trimmed = new Song[](resultIndex);
            for (uint256 i = 0; i < resultIndex; i++) {
                trimmed[i] = recentSongs[i];
            }
            return trimmed;
        }

        return recentSongs;
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
        if (newOwner == address(0)) revert InvalidArtistId();
        owner = newOwner;
        isAuthorized[newOwner] = true;
    }
}
