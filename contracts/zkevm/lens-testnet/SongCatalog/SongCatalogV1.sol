// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SongCatalogV1
 * @notice Registry for native karaoke songs with full audio and word-level timestamps
 * @dev V1: Initial version with optional Genius IDs for cross-platform compatibility
 *
 * Architecture:
 * - Primary ID: Human-readable slug (e.g., "heat-of-the-night-scarlett-x")
 * - Optional Genius ID: For linking to Genius.com metadata
 * - Optional Genius Artist ID: For canonical artist identification
 * - Full song audio + word-level timestamp metadata
 * - High-res cover + optimized thumbnail
 * - Multilingual support
 * - Soft delete with enable/disable
 *
 * Integration:
 * - StudyProgressV1: Songs from this catalog are "ContentSource.Native" (source=0)
 * - SongQuizV1: Uses geniusId and geniusArtistId for cross-referencing
 * - TrendingTrackerV1: Tracks plays/clicks via contentId
 * - contentId parameter uses the primary "id" field (slug)
 */
contract SongCatalogV1 {
    struct Song {
        // Core Identification
        string id;                  // Primary: human-readable slug (e.g., "heat-of-the-night-scarlett-x")
        uint32 geniusId;           // Optional: Genius API song ID (0 = not linked)
        uint32 geniusArtistId;     // Optional: Genius API artist ID (0 = not linked)

        // Metadata
        string title;               // Song title
        string artist;              // Artist name (display name)
        uint32 duration;            // Duration in seconds

        // Full song assets (all Grove URIs starting with "lens://")
        string audioUri;            // Full song audio
        string metadataUri;         // Word + line level timestamp metadata
        string coverUri;            // High-res cover image
        string thumbnailUri;        // 300x300 thumbnail
        string musicVideoUri;       // Music video (optional, can be empty)

        // Segments/Clips (practice units)
        string segmentIds;          // Comma-separated segment IDs (e.g., "verse-1,chorus-1,verse-2")

        // Additional metadata
        string languages;           // Comma-separated language codes (e.g., "en,cn,vi")
        bool enabled;               // Soft delete flag
        uint64 addedAt;             // Timestamp when added
    }

    // Storage
    Song[] private songs;
    mapping(string => uint256) private songIdToIndex;     // id => index+1 (0 = not exists)
    mapping(uint32 => uint256) private geniusIdToIndex;   // geniusId => index+1 (0 = not exists)

    address public owner;

    // Events
    event SongAdded(
        string indexed id,
        uint32 indexed geniusId,
        string title,
        string artist,
        string languages,
        uint64 addedAt
    );

    event SongUpdated(
        string indexed id,
        uint32 indexed geniusId,
        string title,
        string artist,
        bool enabled
    );

    event SongRemoved(string indexed id, uint32 indexed geniusId);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @notice Transfer ownership to a new address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @notice Add a new song to the catalog
     * @dev Only owner can call. Song ID must be unique. Genius ID is optional (use 0 if not applicable)
     */
    function addSong(
        string calldata id,
        uint32 geniusId,
        uint32 geniusArtistId,
        string calldata title,
        string calldata artist,
        uint32 duration,
        string calldata audioUri,
        string calldata metadataUri,
        string calldata coverUri,
        string calldata thumbnailUri,
        string calldata musicVideoUri,
        string calldata segmentIds,
        string calldata languages
    ) external onlyOwner {
        require(bytes(id).length > 0, "ID cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(metadataUri).length > 0, "Metadata URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");
        require(songIdToIndex[id] == 0, "Song ID already exists");

        // If geniusId provided, ensure it's unique
        if (geniusId > 0) {
            require(geniusIdToIndex[geniusId] == 0, "Genius ID already exists");
        }

        songs.push(Song({
            id: id,
            geniusId: geniusId,
            geniusArtistId: geniusArtistId,
            title: title,
            artist: artist,
            duration: duration,
            audioUri: audioUri,
            metadataUri: metadataUri,
            coverUri: coverUri,
            thumbnailUri: thumbnailUri,
            musicVideoUri: musicVideoUri,
            segmentIds: segmentIds,
            languages: languages,
            enabled: true,
            addedAt: uint64(block.timestamp)
        }));

        uint256 index = songs.length; // index+1
        songIdToIndex[id] = index;
        if (geniusId > 0) {
            geniusIdToIndex[geniusId] = index;
        }

        emit SongAdded(id, geniusId, title, artist, languages, uint64(block.timestamp));
    }

    /**
     * @notice Update an existing song's metadata
     */
    function updateSong(
        string calldata id,
        uint32 geniusId,
        uint32 geniusArtistId,
        string calldata title,
        string calldata artist,
        uint32 duration,
        string calldata audioUri,
        string calldata metadataUri,
        string calldata coverUri,
        string calldata thumbnailUri,
        string calldata musicVideoUri,
        string calldata segmentIds,
        string calldata languages,
        bool enabled
    ) external onlyOwner {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(metadataUri).length > 0, "Metadata URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");

        Song storage song = songs[index - 1];

        // If geniusId changed, update mapping
        if (song.geniusId != geniusId) {
            if (song.geniusId > 0) {
                delete geniusIdToIndex[song.geniusId];
            }
            if (geniusId > 0) {
                require(geniusIdToIndex[geniusId] == 0, "Genius ID already exists");
                geniusIdToIndex[geniusId] = index;
            }
            song.geniusId = geniusId;
        }

        song.geniusArtistId = geniusArtistId;
        song.title = title;
        song.artist = artist;
        song.duration = duration;
        song.audioUri = audioUri;
        song.metadataUri = metadataUri;
        song.coverUri = coverUri;
        song.thumbnailUri = thumbnailUri;
        song.musicVideoUri = musicVideoUri;
        song.segmentIds = segmentIds;
        song.languages = languages;
        song.enabled = enabled;

        emit SongUpdated(id, geniusId, title, artist, enabled);
    }

    /**
     * @notice Toggle song enabled status (soft delete)
     */
    function toggleSong(string calldata id, bool enabled) external onlyOwner {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");

        Song storage song = songs[index - 1];
        song.enabled = enabled;

        emit SongUpdated(id, song.geniusId, song.title, song.artist, enabled);
    }

    /**
     * @notice Remove a song from the catalog (hard delete)
     */
    function removeSong(string calldata id) external onlyOwner {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");

        uint256 arrayIndex = index - 1;
        uint256 lastIndex = songs.length - 1;

        Song storage removedSong = songs[arrayIndex];
        uint32 geniusId = removedSong.geniusId;

        // If not the last element, swap with last
        if (arrayIndex != lastIndex) {
            Song storage lastSong = songs[lastIndex];
            songs[arrayIndex] = lastSong;
            songIdToIndex[lastSong.id] = index;
            if (lastSong.geniusId > 0) {
                geniusIdToIndex[lastSong.geniusId] = index;
            }
        }

        // Remove the last element
        songs.pop();
        delete songIdToIndex[id];
        if (geniusId > 0) {
            delete geniusIdToIndex[geniusId];
        }

        emit SongRemoved(id, geniusId);
    }

    /**
     * @notice Get a song by its primary ID
     */
    function getSong(string calldata id) external view returns (Song memory) {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");
        return songs[index - 1];
    }

    /**
     * @notice Get a song by its Genius ID
     */
    function getSongByGeniusId(uint32 geniusId) external view returns (Song memory) {
        require(geniusId > 0, "Invalid Genius ID");
        uint256 index = geniusIdToIndex[geniusId];
        require(index > 0, "Song not found");
        return songs[index - 1];
    }

    /**
     * @notice Get a song by array index
     */
    function getSongByIndex(uint256 index) external view returns (Song memory) {
        require(index < songs.length, "Index out of bounds");
        return songs[index];
    }

    /**
     * @notice Check if a song exists by primary ID
     */
    function songExists(string calldata id) external view returns (bool) {
        return songIdToIndex[id] > 0;
    }

    /**
     * @notice Check if a song exists by Genius ID
     */
    function songExistsByGeniusId(uint32 geniusId) external view returns (bool) {
        return geniusId > 0 && geniusIdToIndex[geniusId] > 0;
    }

    /**
     * @notice Get total number of songs
     */
    function getSongCount() external view returns (uint256) {
        return songs.length;
    }

    /**
     * @notice Get total number of enabled songs
     */
    function getEnabledSongCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i].enabled) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get all songs
     */
    function getAllSongs() external view returns (Song[] memory) {
        return songs;
    }

    /**
     * @notice Get only enabled songs
     */
    function getEnabledSongs() external view returns (Song[] memory) {
        uint256 enabledCount = 0;

        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i].enabled) {
                enabledCount++;
            }
        }

        Song[] memory enabledSongs = new Song[](enabledCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i].enabled) {
                enabledSongs[currentIndex] = songs[i];
                currentIndex++;
            }
        }

        return enabledSongs;
    }

    /**
     * @notice Get a batch of songs by index range
     */
    function getSongsBatch(uint256 startIndex, uint256 endIndex)
        external
        view
        returns (Song[] memory)
    {
        require(startIndex < endIndex, "Invalid range");
        require(endIndex <= songs.length, "End index out of bounds");

        uint256 length = endIndex - startIndex;
        Song[] memory batch = new Song[](length);

        for (uint256 i = 0; i < length; i++) {
            batch[i] = songs[startIndex + i];
        }

        return batch;
    }

    /**
     * @notice Get songs by artist (substring match)
     */
    function getSongsByArtist(string calldata artistQuery)
        external
        view
        returns (Song[] memory)
    {
        uint256 matchCount = 0;

        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i].enabled && contains(songs[i].artist, artistQuery)) {
                matchCount++;
            }
        }

        Song[] memory matchedSongs = new Song[](matchCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i].enabled && contains(songs[i].artist, artistQuery)) {
                matchedSongs[currentIndex] = songs[i];
                currentIndex++;
            }
        }

        return matchedSongs;
    }

    /**
     * @dev Simple substring check (case-sensitive)
     */
    function contains(string memory str, string memory substr) private pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory substrBytes = bytes(substr);

        if (substrBytes.length > strBytes.length) {
            return false;
        }

        if (substrBytes.length == 0) {
            return true;
        }

        for (uint256 i = 0; i <= strBytes.length - substrBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < substrBytes.length; j++) {
                if (strBytes[i + j] != substrBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return true;
            }
        }

        return false;
    }
}
