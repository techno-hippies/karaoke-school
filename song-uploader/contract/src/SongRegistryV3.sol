// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SongRegistryV3
 * @notice On-chain registry for karaoke songs with Grove URIs
 * @dev Enhanced version with update and remove functionality
 */
contract SongRegistryV3 {
    struct Song {
        string id;              // Unique identifier (e.g., "song-1")
        string title;
        string artist;
        uint32 duration;        // Duration in seconds
        string audioUri;        // Grove URI for audio file
        string timestampsUri;   // Grove URI for metadata/timestamps
        string thumbnailUri;    // Grove URI for thumbnail
        string languages;       // Comma-separated language codes (e.g., "en", "en,ko")
        uint64 addedAt;         // Timestamp when song was added
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
        string languages
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
        string calldata timestampsUri,
        string calldata thumbnailUri,
        string calldata languages
    ) external onlyOwner {
        require(bytes(id).length > 0, "ID cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(timestampsUri).length > 0, "Timestamps URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");
        require(songIdToIndex[id] == 0, "Song ID already exists");

        songs.push(Song({
            id: id,
            title: title,
            artist: artist,
            duration: duration,
            audioUri: audioUri,
            timestampsUri: timestampsUri,
            thumbnailUri: thumbnailUri,
            languages: languages,
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
        string calldata timestampsUri,
        string calldata thumbnailUri,
        string calldata languages
    ) external onlyOwner {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(timestampsUri).length > 0, "Timestamps URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");

        Song storage song = songs[index - 1];
        song.title = title;
        song.artist = artist;
        song.duration = duration;
        song.audioUri = audioUri;
        song.timestampsUri = timestampsUri;
        song.thumbnailUri = thumbnailUri;
        song.languages = languages;

        emit SongUpdated(id, title, artist, languages);
    }

    /**
     * @notice Remove a song from the registry
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
     * @notice Get all songs (use with caution for large registries)
     */
    function getAllSongs() external view returns (Song[] memory) {
        return songs;
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
}