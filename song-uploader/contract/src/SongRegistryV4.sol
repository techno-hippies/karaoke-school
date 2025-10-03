// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SongRegistryV4
 * @notice On-chain registry for complete karaoke songs with clips
 * @dev Stores full song metadata + references to associated clips
 *
 * Key Features:
 * - Full song audio + karaoke metadata (word-level timestamps)
 * - High-res cover + optimized thumbnail (300x300)
 * - Optional music video URI
 * - Array of clip IDs (references to ClipRegistryV1)
 * - Multilingual support
 * - Enable/disable toggle (soft delete)
 *
 * zkSync Compatibility:
 * - Solidity 0.8.19 (avoids PUSH0 opcode)
 * - No OpenZeppelin dependencies
 * - Gas-optimized for zkSync
 */
contract SongRegistryV4 {
    struct Song {
        string id;                  // Unique identifier (e.g., "ethel-waters-down-home-blues")
        string title;               // Song title
        string artist;              // Artist name
        uint32 duration;            // Duration in seconds

        // Full song assets
        string audioUri;            // Grove URI for full song audio
        string metadataUri;         // Grove URI for full karaoke metadata (word+line timestamps)
        string coverUri;            // Grove URI for high-res cover image
        string thumbnailUri;        // Grove URI for 300x300 thumbnail
        string musicVideoUri;       // Grove URI for music video (optional, can be empty)

        // Clip references
        string clipIds;             // Comma-separated clip IDs (e.g., "verse-1,chorus-1,verse-2")

        // Metadata
        string languages;           // Comma-separated language codes (e.g., "en,cn,vi")
        bool enabled;               // Can be shown/hidden without deleting
        uint64 addedAt;             // Timestamp when song was added
    }

    // Storage
    Song[] private songs;
    mapping(string => uint256) private songIdToIndex; // id => index+1 (0 means not exists)
    address public owner;

    // Events
    event SongAdded(
        string indexed id,
        string title,
        string artist,
        string languages,
        uint64 addedAt
    );

    event SongUpdated(
        string indexed id,
        string title,
        string artist,
        string languages,
        bool enabled
    );

    event SongRemoved(string indexed id);

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
     * @notice Add a new song to the registry
     * @dev Only owner can call. Song ID must be unique.
     */
    function addSong(
        string calldata id,
        string calldata title,
        string calldata artist,
        uint32 duration,
        string calldata audioUri,
        string calldata metadataUri,
        string calldata coverUri,
        string calldata thumbnailUri,
        string calldata musicVideoUri,
        string calldata clipIds,
        string calldata languages
    ) external onlyOwner {
        require(bytes(id).length > 0, "ID cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(metadataUri).length > 0, "Metadata URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");
        require(songIdToIndex[id] == 0, "Song ID already exists");
        // coverUri, thumbnailUri, musicVideoUri, clipIds are optional (can be empty strings)

        songs.push(Song({
            id: id,
            title: title,
            artist: artist,
            duration: duration,
            audioUri: audioUri,
            metadataUri: metadataUri,
            coverUri: coverUri,
            thumbnailUri: thumbnailUri,
            musicVideoUri: musicVideoUri,
            clipIds: clipIds,
            languages: languages,
            enabled: true, // Enabled by default
            addedAt: uint64(block.timestamp)
        }));

        songIdToIndex[id] = songs.length; // Store index+1

        emit SongAdded(id, title, artist, languages, uint64(block.timestamp));
    }

    /**
     * @notice Update an existing song's metadata
     * @dev Only owner can call. Song must exist. Cannot change ID.
     */
    function updateSong(
        string calldata id,
        string calldata title,
        string calldata artist,
        uint32 duration,
        string calldata audioUri,
        string calldata metadataUri,
        string calldata coverUri,
        string calldata thumbnailUri,
        string calldata musicVideoUri,
        string calldata clipIds,
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
        song.title = title;
        song.artist = artist;
        song.duration = duration;
        song.audioUri = audioUri;
        song.metadataUri = metadataUri;
        song.coverUri = coverUri;
        song.thumbnailUri = thumbnailUri;
        song.musicVideoUri = musicVideoUri;
        song.clipIds = clipIds;
        song.languages = languages;
        song.enabled = enabled;

        emit SongUpdated(id, title, artist, languages, enabled);
    }

    /**
     * @notice Toggle song enabled status (soft delete)
     * @dev Preferred over removeSong for temporary hiding
     */
    function toggleSong(string calldata id, bool enabled) external onlyOwner {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");

        Song storage song = songs[index - 1];
        song.enabled = enabled;

        emit SongUpdated(id, song.title, song.artist, song.languages, enabled);
    }

    /**
     * @notice Remove a song from the registry (hard delete)
     * @dev Only owner can call. Song must exist.
     * This swaps the song with the last one and pops, maintaining array density.
     */
    function removeSong(string calldata id) external onlyOwner {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");

        uint256 arrayIndex = index - 1;
        uint256 lastIndex = songs.length - 1;

        // If not the last element, swap with last
        if (arrayIndex != lastIndex) {
            Song storage lastSong = songs[lastIndex];
            songs[arrayIndex] = lastSong;
            songIdToIndex[lastSong.id] = index; // Update swapped song's index
        }

        // Remove the last element
        songs.pop();
        delete songIdToIndex[id];

        emit SongRemoved(id);
    }

    /**
     * @notice Get a song by its ID
     */
    function getSong(string calldata id) external view returns (Song memory) {
        uint256 index = songIdToIndex[id];
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
     * @notice Check if a song exists
     */
    function songExists(string calldata id) external view returns (bool) {
        return songIdToIndex[id] > 0;
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
     * @notice Get all songs (use with caution for large registries)
     */
    function getAllSongs() external view returns (Song[] memory) {
        return songs;
    }

    /**
     * @notice Get only enabled songs
     */
    function getEnabledSongs() external view returns (Song[] memory) {
        uint256 enabledCount = 0;

        // First pass: count enabled songs
        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i].enabled) {
                enabledCount++;
            }
        }

        // Second pass: populate array
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
     * @param startIndex Starting index (inclusive)
     * @param endIndex Ending index (exclusive)
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
     * @dev Simple case-sensitive substring check - not gas optimized for large datasets
     */
    function getSongsByArtist(string calldata artistQuery)
        external
        view
        returns (Song[] memory)
    {
        uint256 matchCount = 0;

        // First pass: count matches
        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i].enabled && contains(songs[i].artist, artistQuery)) {
                matchCount++;
            }
        }

        // Second pass: populate array
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
     * Not gas-optimized but sufficient for small-medium registries
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
