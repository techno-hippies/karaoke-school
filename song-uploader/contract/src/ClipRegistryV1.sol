// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ClipRegistryV1
 * @notice On-chain registry for karaoke clips (TikTok-style)
 * @dev Each entry is a standalone clip - supports song sections, sound effects, etc.
 */
contract ClipRegistryV1 {
    struct Clip {
        string id;              // Unique identifier (e.g., "scarlett-verse-1")
        string title;           // Title (e.g., "Scarlett")
        string artist;          // Artist name (e.g., "Heat of the Night")
        string sectionType;     // Section type (e.g., "Verse 1", "Chorus", "Bridge")
        uint16 sectionIndex;    // Index for duplicate types (0 for first chorus, 1 for second)
        uint32 duration;        // Duration in seconds
        string audioUri;        // Grove URI for clip audio (vocals)
        string instrumentalUri; // Grove URI for instrumental backing track
        string timestampsUri;   // Grove URI for clip metadata/lyrics
        string thumbnailUri;    // Grove URI for thumbnail
        string languages;       // Comma-separated language codes (e.g., "en,cn,vi")
        uint8 difficultyLevel;  // Learning difficulty (1=beginner, 5=advanced)
        uint8 wordsPerSecond;   // Speaking pace * 10 (e.g., 21 = 2.1 wps)
        bool enabled;           // Can be shown/hidden without deleting
        uint64 addedAt;         // Timestamp when clip was added
    }

    // Storage
    Clip[] private clips;
    mapping(string => uint256) private clipIdToIndex; // id => index+1 (0 means not exists)
    address public owner;

    // Events
    event ClipAdded(
        string indexed id,
        string title,
        string artist,
        string sectionType,
        string languages,
        uint64 addedAt
    );

    event ClipUpdated(
        string indexed id,
        string title,
        string artist,
        string sectionType,
        string languages,
        bool enabled
    );

    event ClipRemoved(string indexed id);

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
     * @notice Add a new clip to the registry
     * @dev Only owner can call. Clip ID must be unique.
     */
    function addClip(
        string calldata id,
        string calldata title,
        string calldata artist,
        string calldata sectionType,
        uint16 sectionIndex,
        uint32 duration,
        string calldata audioUri,
        string calldata instrumentalUri,
        string calldata timestampsUri,
        string calldata thumbnailUri,
        string calldata languages,
        uint8 difficultyLevel,
        uint8 wordsPerSecond
    ) external onlyOwner {
        require(bytes(id).length > 0, "ID cannot be empty");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(timestampsUri).length > 0, "Timestamps URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");
        require(clipIdToIndex[id] == 0, "Clip ID already exists");
        require(difficultyLevel >= 1 && difficultyLevel <= 5, "Difficulty must be 1-5");
        // instrumentalUri is optional, can be empty string

        clips.push(Clip({
            id: id,
            title: title,
            artist: artist,
            sectionType: sectionType,
            sectionIndex: sectionIndex,
            duration: duration,
            audioUri: audioUri,
            instrumentalUri: instrumentalUri,
            timestampsUri: timestampsUri,
            thumbnailUri: thumbnailUri,
            languages: languages,
            difficultyLevel: difficultyLevel,
            wordsPerSecond: wordsPerSecond,
            enabled: true, // Enabled by default
            addedAt: uint64(block.timestamp)
        }));

        clipIdToIndex[id] = clips.length; // Store index+1

        emit ClipAdded(id, title, artist, sectionType, languages, uint64(block.timestamp));
    }

    /**
     * @notice Update an existing clip's metadata
     * @dev Only owner can call. Clip must exist. Cannot change ID.
     */
    function updateClip(
        string calldata id,
        string calldata title,
        string calldata artist,
        string calldata sectionType,
        uint16 sectionIndex,
        uint32 duration,
        string calldata audioUri,
        string calldata instrumentalUri,
        string calldata timestampsUri,
        string calldata thumbnailUri,
        string calldata languages,
        uint8 difficultyLevel,
        uint8 wordsPerSecond,
        bool enabled
    ) external onlyOwner {
        uint256 index = clipIdToIndex[id];
        require(index > 0, "Clip not found");
        require(bytes(title).length > 0, "Title cannot be empty");
        require(bytes(audioUri).length > 0, "Audio URI cannot be empty");
        require(bytes(timestampsUri).length > 0, "Timestamps URI cannot be empty");
        require(bytes(languages).length > 0, "Languages cannot be empty");
        require(difficultyLevel >= 1 && difficultyLevel <= 5, "Difficulty must be 1-5");
        // instrumentalUri is optional, can be empty string

        Clip storage clip = clips[index - 1];
        clip.title = title;
        clip.artist = artist;
        clip.sectionType = sectionType;
        clip.sectionIndex = sectionIndex;
        clip.duration = duration;
        clip.audioUri = audioUri;
        clip.instrumentalUri = instrumentalUri;
        clip.timestampsUri = timestampsUri;
        clip.thumbnailUri = thumbnailUri;
        clip.languages = languages;
        clip.difficultyLevel = difficultyLevel;
        clip.wordsPerSecond = wordsPerSecond;
        clip.enabled = enabled;

        emit ClipUpdated(id, title, artist, sectionType, languages, enabled);
    }

    /**
     * @notice Toggle clip enabled status (soft delete)
     * @dev Preferred over removeClip for temporary hiding
     */
    function toggleClip(string calldata id, bool enabled) external onlyOwner {
        uint256 index = clipIdToIndex[id];
        require(index > 0, "Clip not found");

        Clip storage clip = clips[index - 1];
        clip.enabled = enabled;

        emit ClipUpdated(id, clip.title, clip.artist, clip.sectionType, clip.languages, enabled);
    }

    /**
     * @notice Remove a clip from the registry (hard delete)
     * @dev Only owner can call. Clip must exist.
     * This swaps the clip with the last one and pops, maintaining array density.
     */
    function removeClip(string calldata id) external onlyOwner {
        uint256 index = clipIdToIndex[id];
        require(index > 0, "Clip not found");

        uint256 arrayIndex = index - 1;
        uint256 lastIndex = clips.length - 1;

        // If not the last element, swap with last
        if (arrayIndex != lastIndex) {
            Clip storage lastClip = clips[lastIndex];
            clips[arrayIndex] = lastClip;
            clipIdToIndex[lastClip.id] = index; // Update swapped clip's index
        }

        // Remove the last element
        clips.pop();
        delete clipIdToIndex[id];

        emit ClipRemoved(id);
    }

    /**
     * @notice Get a clip by its ID
     */
    function getClip(string calldata id) external view returns (Clip memory) {
        uint256 index = clipIdToIndex[id];
        require(index > 0, "Clip not found");
        return clips[index - 1];
    }

    /**
     * @notice Get a clip by array index
     */
    function getClipByIndex(uint256 index) external view returns (Clip memory) {
        require(index < clips.length, "Index out of bounds");
        return clips[index];
    }

    /**
     * @notice Check if a clip exists
     */
    function clipExists(string calldata id) external view returns (bool) {
        return clipIdToIndex[id] > 0;
    }

    /**
     * @notice Get total number of clips
     */
    function getClipCount() external view returns (uint256) {
        return clips.length;
    }

    /**
     * @notice Get total number of enabled clips
     */
    function getEnabledClipCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < clips.length; i++) {
            if (clips[i].enabled) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get all clips (use with caution for large registries)
     */
    function getAllClips() external view returns (Clip[] memory) {
        return clips;
    }

    /**
     * @notice Get only enabled clips
     */
    function getEnabledClips() external view returns (Clip[] memory) {
        uint256 enabledCount = 0;

        // First pass: count enabled clips
        for (uint256 i = 0; i < clips.length; i++) {
            if (clips[i].enabled) {
                enabledCount++;
            }
        }

        // Second pass: populate array
        Clip[] memory enabledClips = new Clip[](enabledCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < clips.length; i++) {
            if (clips[i].enabled) {
                enabledClips[currentIndex] = clips[i];
                currentIndex++;
            }
        }

        return enabledClips;
    }

    /**
     * @notice Get a batch of clips by index range
     * @param startIndex Starting index (inclusive)
     * @param endIndex Ending index (exclusive)
     */
    function getClipsBatch(uint256 startIndex, uint256 endIndex)
        external
        view
        returns (Clip[] memory)
    {
        require(startIndex < endIndex, "Invalid range");
        require(endIndex <= clips.length, "End index out of bounds");

        uint256 length = endIndex - startIndex;
        Clip[] memory batch = new Clip[](length);

        for (uint256 i = 0; i < length; i++) {
            batch[i] = clips[startIndex + i];
        }

        return batch;
    }

    /**
     * @notice Get clips filtered by difficulty level
     * @param minDifficulty Minimum difficulty (1-5)
     * @param maxDifficulty Maximum difficulty (1-5)
     */
    function getClipsByDifficulty(uint8 minDifficulty, uint8 maxDifficulty)
        external
        view
        returns (Clip[] memory)
    {
        require(minDifficulty >= 1 && minDifficulty <= 5, "Min difficulty must be 1-5");
        require(maxDifficulty >= 1 && maxDifficulty <= 5, "Max difficulty must be 1-5");
        require(minDifficulty <= maxDifficulty, "Invalid difficulty range");

        // First pass: count matching clips
        uint256 matchCount = 0;
        for (uint256 i = 0; i < clips.length; i++) {
            if (clips[i].enabled &&
                clips[i].difficultyLevel >= minDifficulty &&
                clips[i].difficultyLevel <= maxDifficulty) {
                matchCount++;
            }
        }

        // Second pass: populate array
        Clip[] memory matchedClips = new Clip[](matchCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < clips.length; i++) {
            if (clips[i].enabled &&
                clips[i].difficultyLevel >= minDifficulty &&
                clips[i].difficultyLevel <= maxDifficulty) {
                matchedClips[currentIndex] = clips[i];
                currentIndex++;
            }
        }

        return matchedClips;
    }

    /**
     * @notice Get clips filtered by words per second range
     * @param minWps Minimum words per second * 10 (e.g., 15 = 1.5 wps)
     * @param maxWps Maximum words per second * 10 (e.g., 35 = 3.5 wps)
     */
    function getClipsByPace(uint8 minWps, uint8 maxWps)
        external
        view
        returns (Clip[] memory)
    {
        require(minWps <= maxWps, "Invalid pace range");

        // First pass: count matching clips
        uint256 matchCount = 0;
        for (uint256 i = 0; i < clips.length; i++) {
            if (clips[i].enabled &&
                clips[i].wordsPerSecond >= minWps &&
                clips[i].wordsPerSecond <= maxWps) {
                matchCount++;
            }
        }

        // Second pass: populate array
        Clip[] memory matchedClips = new Clip[](matchCount);
        uint256 currentIndex = 0;
        for (uint256 i = 0; i < clips.length; i++) {
            if (clips[i].enabled &&
                clips[i].wordsPerSecond >= minWps &&
                clips[i].wordsPerSecond <= maxWps) {
                matchedClips[currentIndex] = clips[i];
                currentIndex++;
            }
        }

        return matchedClips;
    }
}
