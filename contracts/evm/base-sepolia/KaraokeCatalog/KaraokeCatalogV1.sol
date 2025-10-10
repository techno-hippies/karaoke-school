// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeCatalogV1
 * @notice Unified registry for all karaoke content (full songs + generated segments)
 * @dev Base Sepolia deployment - combines song catalog + segment registry
 *
 * Content Types:
 * 1. Full Songs (hasFullAudio=true): Complete audio with metadata
 *    - Can be free (public domain, open licenses) or paid
 *    - Stored on Grove/IPFS
 *    - Includes covers, thumbnails, lyrics
 *
 * 2. Segments (hasFullAudio=false): Partial content (30s clips)
 *    - Generated on-demand from copyrighted works via Lit Actions
 *    - Stored as encrypted stems on Grove
 *    - Always requires credits (via KaraokeCreditsV1)
 *
 * Integration:
 * - Works with KaraokeCreditsV1 for payment/ownership tracking
 * - Called by Lit Actions (match-and-segment-v2, audio-processor-v2)
 * - Genius API integration for metadata
 *
 * Architecture:
 * - Unified storage: songs array + index mappings
 * - Flexible identification: custom ID or Genius ID
 * - Boolean flags instead of complex enums
 * - Segment lifecycle: Created → Processed (assets added)
 */
contract KaraokeCatalogV1 {

    // ============ STRUCTS ============

    /**
     * @notice Song entry (full song or segment container)
     */
    struct Song {
        // Core Identification
        string id;                  // Unique ID: "heat-of-the-night" or "genius-123456"
        uint32 geniusId;           // 0 = not linked to Genius, >0 = Genius song ID
        uint32 geniusArtistId;     // 0 = not linked, >0 = Genius artist ID

        // Metadata
        string title;
        string artist;
        uint32 duration;            // Total duration in seconds

        // Capabilities
        bool hasFullAudio;          // true = complete song available, false = segments only
        bool requiresPayment;       // true = costs credits, false = free access

        // Full Song Assets (only if hasFullAudio=true)
        string audioUri;            // grove://full_song.mp3
        string metadataUri;         // grove://word_timestamps.json (lyrics with timing)
        string coverUri;            // grove://cover.jpg
        string thumbnailUri;        // grove://thumb_300x300.jpg
        string musicVideoUri;       // grove://video.mp4 (optional)

        // Generated Segments
        bytes32[] segmentHashes;    // List of available segment hashes

        // Metadata
        string languages;           // "en,cn,vi"
        bool enabled;               // Soft delete flag
        uint64 addedAt;             // When song was added
    }

    /**
     * @notice Generated segment metadata
     */
    struct GeneratedSegment {
        uint32 geniusId;            // Parent song Genius ID (0 if custom song)
        string songId;              // Parent song ID (for non-Genius songs)
        string segmentId;           // "verse-1", "chorus-1", etc.
        string sectionType;         // "Verse 1", "Chorus", "Bridge"

        uint32 startTime;           // Start time in seconds
        uint32 endTime;             // End time in seconds
        uint32 duration;            // Duration (calculated)

        string vocalsUri;           // grove://encrypted_vocals_xyz.zip
        string drumsUri;            // grove://encrypted_drums_xyz.zip
        string audioSnippetUri;     // grove://snippet_30s.mp3 (preview)

        bool processed;             // false = metadata only, true = stems uploaded
        bool requiresPayment;       // Inherited from parent or set independently
        uint64 createdAt;           // When segment was created
        uint64 processedAt;         // When stems were uploaded (0 = not processed)
        address createdBy;          // PKP or user who generated
    }

    // ============ STORAGE ============

    Song[] private songs;
    mapping(string => uint256) private songIdToIndex;     // id => index+1 (0 = not exists)
    mapping(uint32 => uint256) private geniusIdToIndex;   // geniusId => index+1 (0 = not exists)
    mapping(bytes32 => GeneratedSegment) public segments; // segmentHash => Segment

    address public owner;
    address public trustedProcessor;  // Lit Protocol PKP for automated operations
    bool public paused;

    // ============ EVENTS ============

    event SongAdded(
        string indexed id,
        uint32 indexed geniusId,
        string title,
        string artist,
        bool hasFullAudio,
        bool requiresPayment
    );

    event SegmentCreated(
        bytes32 indexed segmentHash,
        uint32 indexed geniusId,
        string segmentId,
        string sectionType,
        uint32 startTime,
        uint32 endTime,
        address createdBy
    );

    event SegmentProcessed(
        bytes32 indexed segmentHash,
        string vocalsUri,
        string drumsUri,
        string audioSnippetUri,
        uint64 timestamp
    );

    event SongUpdated(string indexed id, bool enabled);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProcessorUpdated(address indexed previousProcessor, address indexed newProcessor);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ============ CONSTRUCTOR ============

    constructor(address _trustedProcessor) {
        require(_trustedProcessor != address(0), "Invalid processor address");
        owner = msg.sender;
        trustedProcessor = _trustedProcessor;
        paused = false;
    }

    // ============ MODIFIERS ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOwnerOrProcessor() {
        require(msg.sender == owner || msg.sender == trustedProcessor, "Not authorized");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ============ FULL SONG FUNCTIONS ============

    struct AddFullSongParams {
        string id;
        uint32 geniusId;
        uint32 geniusArtistId;
        string title;
        string artist;
        uint32 duration;
        bool requiresPayment;
        string audioUri;
        string metadataUri;
        string coverUri;
        string thumbnailUri;
        string musicVideoUri;
        string languages;
    }

    /**
     * @notice Add a full song to the catalog
     * @dev Used for public domain songs, licensed content, etc.
     */
    function addFullSong(AddFullSongParams calldata params)
        external
        onlyOwnerOrProcessor
        whenNotPaused
    {
        string memory id = params.id;
        uint32 geniusId = params.geniusId;

        require(bytes(id).length > 0, "Empty ID");
        require(songIdToIndex[id] == 0, "Song ID exists");

        if (geniusId > 0) {
            require(geniusIdToIndex[geniusId] == 0, "Genius ID exists");
        }

        songs.push();
        Song storage newSong = songs[songs.length - 1];

        newSong.id = params.id;
        newSong.geniusId = params.geniusId;
        newSong.geniusArtistId = params.geniusArtistId;
        newSong.title = params.title;
        newSong.artist = params.artist;
        newSong.duration = params.duration;
        newSong.hasFullAudio = true;
        newSong.requiresPayment = params.requiresPayment;
        newSong.audioUri = params.audioUri;
        newSong.metadataUri = params.metadataUri;
        newSong.coverUri = params.coverUri;
        newSong.thumbnailUri = params.thumbnailUri;
        newSong.musicVideoUri = params.musicVideoUri;
        newSong.languages = params.languages;
        newSong.enabled = true;
        newSong.addedAt = uint64(block.timestamp);

        songIdToIndex[id] = songs.length;
        if (geniusId > 0) {
            geniusIdToIndex[geniusId] = songs.length;
        }

        emit SongAdded(id, geniusId, params.title, params.artist, true, params.requiresPayment);
    }

    /**
     * @notice Add a segment-only song entry (copyrighted works)
     * @dev Creates minimal song entry for Genius songs with no full audio
     */
    function addSegmentOnlySong(
        uint32 geniusId,
        string calldata title,
        string calldata artist,
        uint32 duration
    ) external onlyOwnerOrProcessor whenNotPaused {
        require(geniusId > 0, "Genius ID required");
        require(geniusIdToIndex[geniusId] == 0, "Song exists");

        string memory id = string(abi.encodePacked("genius-", _uint2str(geniusId)));

        Song memory newSong;
        newSong.id = id;
        newSong.geniusId = geniusId;
        newSong.geniusArtistId = 0;
        newSong.title = title;
        newSong.artist = artist;
        newSong.duration = duration;
        newSong.hasFullAudio = false;
        newSong.requiresPayment = true;  // Segments always require payment
        newSong.enabled = true;
        newSong.addedAt = uint64(block.timestamp);

        songs.push(newSong);
        songIdToIndex[id] = songs.length;
        geniusIdToIndex[geniusId] = songs.length;

        emit SongAdded(id, geniusId, title, artist, false, true);
    }

    // ============ SEGMENT FUNCTIONS ============

    /**
     * @notice Create segment metadata (Phase 1: match-and-segment-v2)
     * @dev Called by Lit Action after segment matching
     */
    function createSegment(
        uint32 geniusId,
        string calldata songId,
        string calldata segmentId,
        string calldata sectionType,
        uint32 startTime,
        uint32 endTime,
        address createdBy
    ) external onlyOwnerOrProcessor whenNotPaused returns (bytes32) {
        require(geniusId > 0 || bytes(songId).length > 0, "Invalid song identifier");
        require(bytes(segmentId).length > 0, "Empty segmentId");
        require(endTime > startTime, "Invalid time range");
        require(createdBy != address(0), "Invalid creator");

        bytes32 segmentHash = getSegmentHash(geniusId, songId, segmentId);
        require(segments[segmentHash].createdAt == 0, "Segment exists");

        // Get or create parent song
        if (geniusId > 0) {
            uint256 songIndex = geniusIdToIndex[geniusId];
            if (songIndex == 0) {
                revert("Parent song must exist first");
            }
        }

        uint32 duration = endTime - startTime;
        bool requiresPayment = true; // Default for segments

        segments[segmentHash] = GeneratedSegment({
            geniusId: geniusId,
            songId: songId,
            segmentId: segmentId,
            sectionType: sectionType,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            vocalsUri: "",
            drumsUri: "",
            audioSnippetUri: "",
            processed: false,
            requiresPayment: requiresPayment,
            createdAt: uint64(block.timestamp),
            processedAt: 0,
            createdBy: createdBy
        });

        // Add to parent song's segment list
        if (geniusId > 0) {
            uint256 songIndex = geniusIdToIndex[geniusId];
            Song storage song = songs[songIndex - 1];
            song.segmentHashes.push(segmentHash);
        }

        emit SegmentCreated(
            segmentHash,
            geniusId,
            segmentId,
            sectionType,
            startTime,
            endTime,
            createdBy
        );

        return segmentHash;
    }

    /**
     * @notice Batch create segments (optimized for multiple segments)
     * @dev Called by match-and-segment-v2 for full song segmentation
     */
    function createSegmentsBatch(
        uint32 geniusId,
        string calldata songId,
        string calldata title,
        string calldata artist,
        uint32 duration,
        string[] calldata segmentIds,
        string[] calldata sectionTypes,
        uint32[] calldata startTimes,
        uint32[] calldata endTimes,
        address createdBy
    ) external onlyOwnerOrProcessor whenNotPaused {
        require(geniusId > 0 || bytes(songId).length > 0, "Invalid song identifier");
        require(segmentIds.length > 0, "No segments provided");
        require(segmentIds.length == sectionTypes.length, "Array length mismatch");
        require(segmentIds.length == startTimes.length, "Array length mismatch");
        require(segmentIds.length == endTimes.length, "Array length mismatch");
        require(segmentIds.length <= 50, "Too many segments");
        require(createdBy != address(0), "Invalid creator");

        // Create parent song if doesn't exist (Genius only)
        if (geniusId > 0 && geniusIdToIndex[geniusId] == 0) {
            string memory id = string(abi.encodePacked("genius-", _uint2str(geniusId)));

            Song memory newSong;
            newSong.id = id;
            newSong.geniusId = geniusId;
            newSong.title = title;
            newSong.artist = artist;
            newSong.duration = duration;
            newSong.hasFullAudio = false;
            newSong.requiresPayment = true;
            newSong.enabled = true;
            newSong.addedAt = uint64(block.timestamp);

            songs.push(newSong);
            songIdToIndex[id] = songs.length;
            geniusIdToIndex[geniusId] = songs.length;

            emit SongAdded(id, geniusId, title, artist, false, true);
        }

        uint256 songIndex = geniusId > 0 ? geniusIdToIndex[geniusId] : 0;
        Song storage parentSong = songIndex > 0 ? songs[songIndex - 1] : songs[0];

        uint64 timestamp = uint64(block.timestamp);

        for (uint256 i = 0; i < segmentIds.length; i++) {
            require(bytes(segmentIds[i]).length > 0, "Empty segmentId");
            require(endTimes[i] > startTimes[i], "Invalid time range");

            bytes32 segmentHash = getSegmentHash(geniusId, songId, segmentIds[i]);

            // Skip if exists
            if (segments[segmentHash].createdAt > 0) {
                continue;
            }

            uint32 segDuration = endTimes[i] - startTimes[i];

            segments[segmentHash] = GeneratedSegment({
                geniusId: geniusId,
                songId: songId,
                segmentId: segmentIds[i],
                sectionType: sectionTypes[i],
                startTime: startTimes[i],
                endTime: endTimes[i],
                duration: segDuration,
                vocalsUri: "",
                drumsUri: "",
                audioSnippetUri: "",
                processed: false,
                requiresPayment: true,
                createdAt: timestamp,
                processedAt: 0,
                createdBy: createdBy
            });

            if (songIndex > 0) {
                parentSong.segmentHashes.push(segmentHash);
            }

            emit SegmentCreated(
                segmentHash,
                geniusId,
                segmentIds[i],
                sectionTypes[i],
                startTimes[i],
                endTimes[i],
                createdBy
            );
        }
    }

    /**
     * @notice Update segment with processed assets (Phase 2: audio-processor-v2)
     * @dev Called by Lit Action after stem separation complete
     */
    function processSegment(
        bytes32 segmentHash,
        string calldata vocalsUri,
        string calldata drumsUri,
        string calldata audioSnippetUri
    ) external onlyOwnerOrProcessor whenNotPaused {
        require(segments[segmentHash].createdAt > 0, "Segment not found");
        require(bytes(vocalsUri).length > 0, "Invalid vocalsUri");
        require(bytes(drumsUri).length > 0, "Invalid drumsUri");

        GeneratedSegment storage segment = segments[segmentHash];
        segment.vocalsUri = vocalsUri;
        segment.drumsUri = drumsUri;
        segment.audioSnippetUri = audioSnippetUri;
        segment.processed = true;
        segment.processedAt = uint64(block.timestamp);

        emit SegmentProcessed(
            segmentHash,
            vocalsUri,
            drumsUri,
            audioSnippetUri,
            uint64(block.timestamp)
        );
    }

    // ============ QUERY FUNCTIONS ============

    function getSongById(string memory id) external view returns (Song memory) {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");
        return songs[index - 1];
    }

    function getSongByGeniusId(uint32 geniusId) external view returns (Song memory) {
        uint256 index = geniusIdToIndex[geniusId];
        require(index > 0, "Song not found");
        return songs[index - 1];
    }

    function songExistsById(string memory id) external view returns (bool) {
        return songIdToIndex[id] > 0;
    }

    function songExistsByGeniusId(uint32 geniusId) external view returns (bool) {
        return geniusIdToIndex[geniusId] > 0;
    }

    function getSegmentHash(uint32 geniusId, string memory songId, string memory segmentId)
        public
        pure
        returns (bytes32)
    {
        if (geniusId > 0) {
            return keccak256(abi.encodePacked(geniusId, segmentId));
        }
        return keccak256(abi.encodePacked(songId, segmentId));
    }

    function getSegment(bytes32 segmentHash) external view returns (GeneratedSegment memory) {
        require(segments[segmentHash].createdAt > 0, "Segment not found");
        return segments[segmentHash];
    }

    function getSegmentsForSong(uint32 geniusId) external view returns (GeneratedSegment[] memory) {
        uint256 songIndex = geniusIdToIndex[geniusId];
        require(songIndex > 0, "Song not found");

        Song storage song = songs[songIndex - 1];
        GeneratedSegment[] memory result = new GeneratedSegment[](song.segmentHashes.length);

        for (uint i = 0; i < song.segmentHashes.length; i++) {
            result[i] = segments[song.segmentHashes[i]];
        }

        return result;
    }

    function getAllSongs() external view returns (Song[] memory) {
        return songs;
    }

    function getTotalSongs() external view returns (uint256) {
        return songs.length;
    }

    // ============ ADMIN FUNCTIONS ============

    function toggleSong(string memory id, bool enabled) external onlyOwner {
        uint256 index = songIdToIndex[id];
        require(index > 0, "Song not found");
        songs[index - 1].enabled = enabled;
        emit SongUpdated(id, enabled);
    }

    function setTrustedProcessor(address newProcessor) external onlyOwner {
        require(newProcessor != address(0), "Invalid processor address");
        address oldProcessor = trustedProcessor;
        trustedProcessor = newProcessor;
        emit ProcessorUpdated(oldProcessor, newProcessor);
    }

    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    // ============ UTILS ============

    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
