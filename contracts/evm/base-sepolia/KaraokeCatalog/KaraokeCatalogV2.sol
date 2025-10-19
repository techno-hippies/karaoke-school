// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title KaraokeCatalogV2
 * @notice Karaoke song catalog with batch processing and query optimization
 *
 * Key Features:
 * - Batch segment processing (processSegmentsBatch)
 * - Recent songs query (getRecentSongs)
 * - Translation support (multi-language lyrics)
 * - Additive metadata updates (sectionsUri + alignmentUri)
 * - Song deletion (testnet utility)
 */
contract KaraokeCatalogV2 {

    // ============ CUSTOM ERRORS ============

    error InvalidProcessorAddress();
    error NotOwner();
    error NotAuthorized();
    error ContractPaused();
    error EmptyID();
    error SongIDExists();
    error GeniusIDExists();
    error GeniusIDRequired();
    error InvalidSongIdentifier();
    error EmptySegmentID();
    error InvalidTimeRange();
    error InvalidCreator();
    error SegmentExists();
    error ParentSongRequired();
    error NoSegmentsProvided();
    error ArrayLengthMismatch();
    error TooManySegments();
    error SegmentNotFound();
    error InvalidSegmentData();
    error SegmentAlreadyProcessed();
    error ParentSongNotFound();
    error SongNotFound();
    error InvalidAddress();
    error AlreadyPaused();
    error NotPaused();

    // ============ STRUCTS ============

    /**
     * @notice Song entry (full song or segment container)
     */
    struct Song {
        // Core Identification
        string id;                  // Unique ID: "heat-of-the-night" or "genius-123456"
        uint32 geniusId;           // 0 = not linked to Genius, >0 = Genius song ID
        uint32 geniusArtistId;     // 0 = not linked to Genius, >0 = Genius artist ID

        // Metadata
        string title;
        string artist;
        uint32 duration;            // Total duration in seconds
        string soundcloudPath;      // SoundCloud path: "artist/track-name"

        // Capabilities
        bool hasFullAudio;          // true = complete song available, false = 30s snippet only
        bool requiresPayment;       // true = costs credits, false = free access

        // Full Song Assets (only if hasFullAudio=true)
        string audioUri;            // grove://full_song.mp3
        string metadataUri;         // grove://word_timestamps.json (DEPRECATED: use sectionsUri + alignmentUri)
        string coverUri;            // grove://cover.jpg
        string thumbnailUri;        // grove://thumb_300x300.jpg
        string musicVideoUri;       // grove://video.mp4 (optional)

        // Decoupled Metadata URIs (V2: Additive writes, no overwrites)
        string sectionsUri;         // grove://sections.json (from match-and-segment)
        string alignmentUri;        // grove://alignment.json (from base-alignment, lines+words)

        // Metadata
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

    // Translation URIs: geniusId => languageCode => grove URI
    mapping(uint32 => mapping(string => string)) public translationUris;
    // Track available languages per song
    mapping(uint32 => string[]) public availableLanguages;

    // Leaderboard Grove URIs: geniusId => grove URI
    mapping(uint32 => string) public leaderboardUris;

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

    event SegmentsBatchProcessed(
        uint256 segmentCount,
        uint64 timestamp
    );

    event SongUpdated(string indexed id, bool enabled);
    event SongDeleted(string indexed id, uint32 indexed geniusId);
    event SectionsUriUpdated(uint32 indexed geniusId, string sectionsUri);
    event AlignmentUriUpdated(uint32 indexed geniusId, string alignmentUri);
    event TranslationAdded(uint32 indexed geniusId, string languageCode, string uri);
    event LeaderboardUriUpdated(uint32 indexed geniusId, string uri);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ProcessorUpdated(address indexed previousProcessor, address indexed newProcessor);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ============ CONSTRUCTOR ============

    constructor(address _trustedProcessor) {
        if (_trustedProcessor == address(0)) revert InvalidProcessorAddress();
        owner = msg.sender;
        trustedProcessor = _trustedProcessor;
        paused = false;
    }

    // ============ MODIFIERS ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOwnerOrProcessor() {
        if (msg.sender != owner && msg.sender != trustedProcessor) revert NotAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
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
        string soundcloudPath;
        bool hasFullAudio;
        bool requiresPayment;
        string audioUri;
        string metadataUri;     // DEPRECATED: use sectionsUri + alignmentUri
        string coverUri;
        string thumbnailUri;
        string musicVideoUri;
        string sectionsUri;     // V2: Sections from match-and-segment
        string alignmentUri;    // V2: Word-level alignment from base-alignment
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

        if (bytes(id).length == 0) revert EmptyID();
        if (songIdToIndex[id] != 0) revert SongIDExists();

        if (geniusId > 0) {
            if (geniusIdToIndex[geniusId] != 0) revert GeniusIDExists();
        }

        songs.push();
        Song storage newSong = songs[songs.length - 1];

        newSong.id = params.id;
        newSong.geniusId = params.geniusId;
        newSong.geniusArtistId = params.geniusArtistId;
        newSong.title = params.title;
        newSong.artist = params.artist;
        newSong.duration = params.duration;
        newSong.soundcloudPath = params.soundcloudPath;
        newSong.hasFullAudio = params.hasFullAudio;
        newSong.requiresPayment = params.requiresPayment;
        newSong.audioUri = params.audioUri;
        newSong.metadataUri = params.metadataUri;
        newSong.coverUri = params.coverUri;
        newSong.thumbnailUri = params.thumbnailUri;
        newSong.musicVideoUri = params.musicVideoUri;
        newSong.sectionsUri = params.sectionsUri;
        newSong.alignmentUri = params.alignmentUri;
        newSong.enabled = true;
        newSong.addedAt = uint64(block.timestamp);

        songIdToIndex[id] = songs.length;
        if (geniusId > 0) {
            geniusIdToIndex[geniusId] = songs.length;
        }

        emit SongAdded(id, geniusId, params.title, params.artist, params.hasFullAudio, params.requiresPayment);
    }

    /**
     * @notice Add a segment-only song entry (copyrighted works)
     * @dev Creates minimal song entry for Genius songs with no full audio
     */
    function addSegmentOnlySong(
        uint32 geniusId,
        uint32 geniusArtistId,
        string calldata id,
        string calldata title,
        string calldata artist,
        uint32 duration
    ) external onlyOwnerOrProcessor whenNotPaused {
        if (geniusId == 0) revert GeniusIDRequired();
        if (geniusIdToIndex[geniusId] != 0) revert GeniusIDExists();

        Song memory newSong;
        newSong.id = id;
        newSong.geniusId = geniusId;
        newSong.geniusArtistId = geniusArtistId;
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

    /**
     * @notice Update song metadata URI (DEPRECATED: use setSectionsUri/setAlignmentUri)
     * @dev Only trustedProcessor can update (prevents unauthorized modifications)
     */
    function updateSongMetadata(uint32 geniusId, string calldata metadataUri)
        external
        onlyOwnerOrProcessor
        whenNotPaused
        returns (bool)
    {
        if (geniusId == 0) revert GeniusIDRequired();

        uint256 index = geniusIdToIndex[geniusId];
        if (index == 0) revert SongNotFound();

        Song storage song = songs[index - 1];
        song.metadataUri = metadataUri;

        return true;
    }

    /**
     * @notice Set sections URI (from match-and-segment Lit Action)
     * @dev Additive operation - does not overwrite other metadata
     */
    function setSectionsUri(uint32 geniusId, string calldata sectionsUri)
        external
        onlyOwnerOrProcessor
        whenNotPaused
        returns (bool)
    {
        if (geniusId == 0) revert GeniusIDRequired();

        uint256 index = geniusIdToIndex[geniusId];
        if (index == 0) revert SongNotFound();

        Song storage song = songs[index - 1];
        song.sectionsUri = sectionsUri;

        emit SectionsUriUpdated(geniusId, sectionsUri);
        return true;
    }

    /**
     * @notice Set alignment URI (from base-alignment Lit Action)
     * @dev Additive operation - does not overwrite sections data
     */
    function setAlignmentUri(uint32 geniusId, string calldata alignmentUri)
        external
        onlyOwnerOrProcessor
        whenNotPaused
        returns (bool)
    {
        if (geniusId == 0) revert GeniusIDRequired();

        uint256 index = geniusIdToIndex[geniusId];
        if (index == 0) revert SongNotFound();

        Song storage song = songs[index - 1];
        song.alignmentUri = alignmentUri;

        emit AlignmentUriUpdated(geniusId, alignmentUri);
        return true;
    }

    // ============ SEGMENT FUNCTIONS ============

    /**
     * @notice Batch process multiple segments (V2 OPTIMIZED - Create + Process in one TX)
     * @dev Creates segments if they don't exist, then fills with audio URIs
     */
    function processSegmentsBatch(
        uint32 geniusId,
        string calldata songId,
        string[] calldata segmentIds,
        string[] calldata sectionTypes,
        string[] calldata vocalsUris,
        string[] calldata drumsUris,
        string[] calldata audioSnippetUris,
        uint32[] calldata startTimes,
        uint32[] calldata endTimes
    ) external onlyOwnerOrProcessor whenNotPaused {
        if (segmentIds.length == 0) revert NoSegmentsProvided();
        if (segmentIds.length != sectionTypes.length || segmentIds.length != vocalsUris.length || segmentIds.length != drumsUris.length || segmentIds.length != audioSnippetUris.length || segmentIds.length != startTimes.length || segmentIds.length != endTimes.length) revert ArrayLengthMismatch();
        if (segmentIds.length > 50) revert TooManySegments();
        if (geniusIdToIndex[geniusId] == 0) revert ParentSongNotFound();

        uint64 timestamp = uint64(block.timestamp);
        Song storage parentSong = songs[geniusIdToIndex[geniusId] - 1];

        for (uint256 i = 0; i < segmentIds.length; i++) {
            if (bytes(vocalsUris[i]).length == 0 || bytes(drumsUris[i]).length == 0 || endTimes[i] <= startTimes[i]) revert InvalidSegmentData();

            bytes32 segmentHash = getSegmentHash(geniusId, "", segmentIds[i]);
            GeneratedSegment storage segment = segments[segmentHash];

            bool isNew = segment.createdAt == 0;
            if (isNew) {
                segment.geniusId = geniusId;
                segment.songId = songId;
                segment.segmentId = segmentIds[i];
                segment.sectionType = sectionTypes[i];
                segment.startTime = startTimes[i];
                segment.endTime = endTimes[i];
                segment.duration = endTimes[i] - startTimes[i];
                segment.requiresPayment = parentSong.requiresPayment;
                segment.createdAt = timestamp;
                segment.createdBy = msg.sender;
                emit SegmentCreated(segmentHash, geniusId, segmentIds[i], sectionTypes[i], startTimes[i], endTimes[i], msg.sender);
            } else {
                if (segment.processed) revert SegmentAlreadyProcessed();
            }

            segment.vocalsUri = vocalsUris[i];
            segment.drumsUri = drumsUris[i];
            segment.audioSnippetUri = audioSnippetUris[i];
            segment.processed = true;
            segment.processedAt = timestamp;

            emit SegmentProcessed(segmentHash, vocalsUris[i], drumsUris[i], audioSnippetUris[i], timestamp);
        }

        emit SegmentsBatchProcessed(segmentIds.length, timestamp);
    }

    // ============ QUERY FUNCTIONS ============

    function getSongById(string memory id) external view returns (Song memory) {
        uint256 index = songIdToIndex[id];
        if (index == 0) revert SongNotFound();
        return songs[index - 1];
    }

    function getSongByGeniusId(uint32 geniusId) external view returns (Song memory) {
        uint256 index = geniusIdToIndex[geniusId];
        if (index == 0) revert SongNotFound();
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
        if (segments[segmentHash].createdAt == 0) revert SegmentNotFound();
        return segments[segmentHash];
    }

    function getTotalSongs() external view returns (uint256) {
        return songs.length;
    }

    /**
     * @notice Get the most recently catalogued songs
     * @param limit Maximum number of songs to return (max 50)
     * @return Array of songs, ordered by addedAt timestamp (newest first)
     */
    function getRecentSongs(uint256 limit) external view returns (Song[] memory) {
        if (limit == 0 || limit > 50) {
            limit = 50;
        }

        uint256 totalSongs = songs.length;
        if (totalSongs == 0) {
            return new Song[](0);
        }

        // Determine actual number of songs to return
        uint256 count = limit > totalSongs ? totalSongs : limit;
        Song[] memory recentSongs = new Song[](count);

        // Iterate backwards from the end (most recent songs)
        uint256 resultIndex = 0;
        for (uint256 i = totalSongs; i > 0 && resultIndex < count; i--) {
            Song storage song = songs[i - 1];
            // Only include enabled songs
            if (song.enabled) {
                recentSongs[resultIndex] = song;
                resultIndex++;
            }
        }

        // If we found fewer enabled songs than requested, resize array
        if (resultIndex < count) {
            Song[] memory trimmedSongs = new Song[](resultIndex);
            for (uint256 i = 0; i < resultIndex; i++) {
                trimmedSongs[i] = recentSongs[i];
            }
            return trimmedSongs;
        }

        return recentSongs;
    }

    // ============ TRANSLATION FUNCTIONS ============

    /**
     * @notice Set translation URI for a specific language
     * @dev Called by Lit Action after uploading language-specific translation file
     */
    function setTranslation(
        uint32 geniusId,
        string calldata languageCode,
        string calldata uri
    ) external onlyOwnerOrProcessor whenNotPaused {
        if (geniusIdToIndex[geniusId] == 0) revert SongNotFound();
        if (bytes(languageCode).length == 0) revert InvalidSongIdentifier();
        if (bytes(uri).length == 0) revert InvalidSongIdentifier();

        // Add to available languages if first time
        if (bytes(translationUris[geniusId][languageCode]).length == 0) {
            availableLanguages[geniusId].push(languageCode);
        }

        translationUris[geniusId][languageCode] = uri;
        emit TranslationAdded(geniusId, languageCode, uri);
    }

    /**
     * @notice Get translation URI for a specific language
     */
    function getTranslation(uint32 geniusId, string calldata languageCode)
        external
        view
        returns (string memory)
    {
        return translationUris[geniusId][languageCode];
    }

    /**
     * @notice Get all available languages for a song
     */
    function getAvailableLanguages(uint32 geniusId)
        external
        view
        returns (string[] memory)
    {
        return availableLanguages[geniusId];
    }

    /**
     * @notice Check if translation exists for a specific language
     */
    function hasTranslation(uint32 geniusId, string calldata languageCode)
        external
        view
        returns (bool)
    {
        return bytes(translationUris[geniusId][languageCode]).length > 0;
    }

    // ============ LEADERBOARD FUNCTIONS ============

    /**
     * @notice Set leaderboard URI for a song
     * @dev Called by indexer service after uploading leaderboard to Grove
     */
    function setLeaderboardUri(uint32 geniusId, string calldata uri)
        external
        onlyOwnerOrProcessor
        whenNotPaused
    {
        if (geniusIdToIndex[geniusId] == 0) revert SongNotFound();
        if (bytes(uri).length == 0) revert InvalidSongIdentifier();

        leaderboardUris[geniusId] = uri;
        emit LeaderboardUriUpdated(geniusId, uri);
    }

    /**
     * @notice Get leaderboard URI for a song
     */
    function getLeaderboardUri(uint32 geniusId)
        external
        view
        returns (string memory)
    {
        return leaderboardUris[geniusId];
    }

    // ============ ADMIN FUNCTIONS ============

    function toggleSong(string memory id, bool enabled) external onlyOwner {
        uint256 index = songIdToIndex[id];
        if (index == 0) revert SongNotFound();
        songs[index - 1].enabled = enabled;
        emit SongUpdated(id, enabled);
    }

    /**
     * @notice Delete a song completely (testnet only - use with caution)
     * @dev Removes all mappings and clears storage
     * @param id Song ID to delete
     */
    function deleteSong(string memory id) external onlyOwner {
        uint256 index = songIdToIndex[id];
        if (index == 0) revert SongNotFound();

        Song storage song = songs[index - 1];
        uint32 geniusId = song.geniusId;

        // Clear mappings
        delete songIdToIndex[id];
        if (geniusId > 0) {
            delete geniusIdToIndex[geniusId];
        }

        // Clear the song data (set to default values)
        delete songs[index - 1];

        emit SongDeleted(id, geniusId);
    }

    function setTrustedProcessor(address newProcessor) external onlyOwner {
        if (newProcessor == address(0)) revert InvalidAddress();
        address oldProcessor = trustedProcessor;
        trustedProcessor = newProcessor;
        emit ProcessorUpdated(oldProcessor, newProcessor);
    }

    function pause() external onlyOwner {
        if (paused) revert AlreadyPaused();
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert NotPaused();
        paused = false;
        emit Unpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
