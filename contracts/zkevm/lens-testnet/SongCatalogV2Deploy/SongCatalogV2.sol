// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SongCatalogV2
 * @notice Unified registry for all karaoke content (full songs + generated segments)
 * @dev Replaces separate SongCatalog + SegmentRegistry approach
 *
 * Content Types:
 * 1. Full Songs (hasFullAudio=true): Complete audio with metadata
 *    - Can be free (public domain, open licenses) or paid
 *    - Stored on Grove/IPFS
 *    - May link to Story Protocol for licensing
 *
 * 2. Segments (hasFullAudio=false): Partial content (30s clips)
 *    - Generated on-demand from copyrighted works
 *    - Stored as encrypted stems on Grove
 *    - Requires credits (tracked on Base via KaraokeCredits)
 *
 * Key Design:
 * - Simple booleans (hasFullAudio, requiresPayment) instead of enums
 * - Segments can exist for ANY song (including full songs for practice)
 * - Story Protocol integration optional
 * - All content references stored as Grove URIs
 */
contract SongCatalogV2 {

    // ============ STRUCTS ============

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
        string metadataUri;         // grove://word_timestamps.json
        string coverUri;            // grove://cover.jpg
        string thumbnailUri;        // grove://thumb_300x300.jpg
        string musicVideoUri;       // grove://video.mp4 (optional)

        // Story Protocol Integration (optional)
        address storyIpId;          // Story Protocol IP Asset ID (0x0 if not on Story)
        string licenseTerms;        // "open-use", "commercial", etc. (empty if not on Story)

        // Generated Segments
        bytes32[] segmentHashes;    // List of available segment hashes

        // Metadata
        string languages;           // "en,cn,vi"
        bool enabled;               // Soft delete flag
        uint64 addedAt;
    }

    struct GeneratedSegment {
        uint32 geniusId;            // Parent song Genius ID
        string segmentId;           // "verse-1", "chorus", etc.
        uint32 startTime;           // Start time in seconds
        uint32 endTime;             // End time in seconds
        string vocalsUri;           // grove://encrypted_vocals_xyz.zip
        string drumsUri;            // grove://encrypted_drums_xyz.zip
        bool requiresPayment;       // Inherited from parent or set independently
        uint64 createdAt;
        address createdBy;          // PKP or user who generated
    }

    // ============ STORAGE ============

    Song[] private songs;
    mapping(string => uint256) private songIdToIndex;     // id => index+1 (0 = not exists)
    mapping(uint32 => uint256) private geniusIdToIndex;   // geniusId => index+1 (0 = not exists)
    mapping(bytes32 => GeneratedSegment) public segments; // segmentHash => Segment

    address public owner;
    address public trustedPKP;  // Lit Protocol PKP for automated segment generation

    // ============ EVENTS ============

    event SongAdded(
        string indexed id,
        uint32 indexed geniusId,
        string title,
        string artist,
        bool hasFullAudio,
        bool requiresPayment
    );

    event SegmentAdded(
        bytes32 indexed segmentHash,
        uint32 indexed geniusId,
        string segmentId,
        uint32 startTime,
        uint32 endTime,
        address createdBy
    );

    event SongUpdated(string indexed id, bool enabled);
    event SongRemoved(string indexed id);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event PKPUpdated(address indexed previousPKP, address indexed newPKP);

    // ============ CONSTRUCTOR ============

    constructor(address _trustedPKP) {
        owner = msg.sender;
        trustedPKP = _trustedPKP;
    }

    // ============ MODIFIERS ============

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOwnerOrPKP() {
        require(msg.sender == owner || msg.sender == trustedPKP, "Not authorized");
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
        address storyIpId;
        string licenseTerms;
        string languages;
    }

    /**
     * @notice Add a full song to the catalog
     * @dev Used for public domain songs, Story Protocol licensed content, etc.
     */
    function addFullSong(AddFullSongParams calldata params) external onlyOwner {
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
        newSong.storyIpId = params.storyIpId;
        newSong.licenseTerms = params.licenseTerms;
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
        string memory title,
        string memory artist,
        uint32 duration
    ) external onlyOwnerOrPKP {
        require(geniusId > 0, "Genius ID required");
        require(geniusIdToIndex[geniusId] == 0, "Song exists");

        string memory id = string(abi.encodePacked("genius-", _uint2str(geniusId)));

        Song memory newSong = Song({
            id: id,
            geniusId: geniusId,
            geniusArtistId: 0,
            title: title,
            artist: artist,
            duration: duration,
            hasFullAudio: false,
            requiresPayment: true,  // Segments always require payment
            audioUri: "",
            metadataUri: "",
            coverUri: "",
            thumbnailUri: "",
            musicVideoUri: "",
            storyIpId: address(0),
            licenseTerms: "",
            segmentHashes: new bytes32[](0),
            languages: "",
            enabled: true,
            addedAt: uint64(block.timestamp)
        });

        songs.push(newSong);
        songIdToIndex[id] = songs.length;
        geniusIdToIndex[geniusId] = songs.length;

        emit SongAdded(id, geniusId, title, artist, false, true);
    }

    // ============ SEGMENT FUNCTIONS ============

    /**
     * @notice Add a generated segment
     * @dev Called by Lit Action after audio processing
     */
    function addSegment(
        uint32 geniusId,
        string memory segmentId,
        uint32 startTime,
        uint32 endTime,
        string memory vocalsUri,
        string memory drumsUri
    ) external onlyOwnerOrPKP returns (bytes32) {
        bytes32 segmentHash = getSegmentHash(geniusId, segmentId);
        require(segments[segmentHash].createdAt == 0, "Segment exists");

        // Get or create parent song
        uint256 songIndex = geniusIdToIndex[geniusId];
        if (songIndex == 0) {
            // Auto-create segment-only song entry
            // Note: Title/artist should be fetched from Genius by caller
            revert("Parent song must exist first");
        }

        Song storage song = songs[songIndex - 1];
        bool requiresPayment = song.requiresPayment || !song.hasFullAudio;

        segments[segmentHash] = GeneratedSegment({
            geniusId: geniusId,
            segmentId: segmentId,
            startTime: startTime,
            endTime: endTime,
            vocalsUri: vocalsUri,
            drumsUri: drumsUri,
            requiresPayment: requiresPayment,
            createdAt: uint64(block.timestamp),
            createdBy: msg.sender
        });

        song.segmentHashes.push(segmentHash);

        emit SegmentAdded(segmentHash, geniusId, segmentId, startTime, endTime, msg.sender);

        return segmentHash;
    }

    /**
     * @notice Get all segments for a song
     */
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

    function getSegmentHash(uint32 geniusId, string memory segmentId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(geniusId, segmentId));
    }

    function getSegment(bytes32 segmentHash) external view returns (GeneratedSegment memory) {
        require(segments[segmentHash].createdAt > 0, "Segment not found");
        return segments[segmentHash];
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

    function setTrustedPKP(address newPKP) external onlyOwner {
        require(newPKP != address(0), "Invalid PKP address");
        address oldPKP = trustedPKP;
        trustedPKP = newPKP;
        emit PKPUpdated(oldPKP, newPKP);
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
