// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SongRegistryV1
 * @notice On-chain registry for karaoke songs with Grove URIs
 * @dev Immutable song entries, owner-only writes, public reads
 */
contract SongRegistryV1 is Ownable {
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

    // Events
    event SongAdded(
        string indexed id,
        string title,
        string artist,
        string languages,
        uint64 addedAt
    );

    constructor() {}

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
        require(songIdToIndex[id] == 0, "Song ID already exists");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(timestampsUri).length > 0, "Timestamps URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");

        Song memory newSong = Song({
            id: id,
            title: title,
            artist: artist,
            duration: duration,
            audioUri: audioUri,
            timestampsUri: timestampsUri,
            thumbnailUri: thumbnailUri,
            languages: languages,
            addedAt: uint64(block.timestamp)
        });

        songs.push(newSong);
        songIdToIndex[id] = songs.length; // Store index+1

        emit SongAdded(id, title, artist, languages, newSong.addedAt);
    }

    /**
     * @notice Get a song by its ID
     * @param id The song ID to query
     * @return The song struct
     */
    function getSong(string calldata id) external view returns (Song memory) {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");
        return songs[index - 1];
    }

    /**
     * @notice Get a song by its index in the array
     * @param index The index to query (0-based)
     * @return The song struct
     */
    function getSongByIndex(uint256 index) external view returns (Song memory) {
        require(index < songs.length, "Index out of bounds");
        return songs[index];
    }

    /**
     * @notice Get all songs (use with caution for large registries)
     * @return Array of all songs
     */
    function getAllSongs() external view returns (Song[] memory) {
        return songs;
    }

    /**
     * @notice Get the total number of songs
     * @return The count of songs
     */
    function getSongCount() external view returns (uint256) {
        return songs.length;
    }

    /**
     * @notice Check if a song exists by ID
     * @param id The song ID to check
     * @return True if the song exists
     */
    function songExists(string calldata id) external view returns (bool) {
        return songIdToIndex[id] > 0;
    }

    /**
     * @notice Get multiple songs by their indices (batch query)
     * @param startIndex Starting index (inclusive)
     * @param endIndex Ending index (exclusive)
     * @return Array of songs in the specified range
     */
    function getSongsBatch(uint256 startIndex, uint256 endIndex)
        external
        view
        returns (Song[] memory)
    {
        require(startIndex < endIndex, "Invalid range");
        require(endIndex <= songs.length, "End index out of bounds");

        uint256 batchSize = endIndex - startIndex;
        Song[] memory batch = new Song[](batchSize);

        for (uint256 i = 0; i < batchSize; i++) {
            batch[i] = songs[startIndex + i];
        }

        return batch;
    }
}