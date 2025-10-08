// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeSegmentRegistryV1
 * @notice On-chain registry for generated karaoke segments
 * @dev V1: Base Sepolia deployment with segment metadata and ownership tracking
 *
 * Architecture:
 * - Tracks which songs have been processed (cold start complete)
 * - Stores segment metadata: start/end times, duration, section type
 * - Links to Grove URIs: vocals.zip, drums.zip, audio snippet
 * - Records who generated each segment (attribution)
 * - Integrates with KaraokeCreditsV1 for ownership verification
 *
 * Flow:
 * 1. User triggers cold start → match-and-segment-v2.js (FREE)
 * 2. Segments generated → Lit Action calls addSegments() batch
 * 3. User purchases credit → audio-processor-v1.js generates stems
 * 4. Lit Action calls updateSegmentAssets() with Grove URIs
 * 5. Frontend queries segments for display in SegmentPickerDrawer
 *
 * Segment Lifecycle:
 * - Created: match-and-segment-v2 creates segment metadata
 * - Processed: audio-processor-v1 adds stem URIs
 * - Owned: User unlocks via KaraokeCreditsV1
 */
contract KaraokeSegmentRegistryV1 {
    // ========================================================================
    // Types & Structs
    // ========================================================================

    /**
     * @notice Content source enumeration (matches other contracts)
     */
    enum ContentSource {
        Native,   // 0: Songs from SongCatalogV1
        Genius    // 1: Songs from Genius.com API
    }

    /**
     * @notice Processing status of a segment
     */
    enum SegmentStatus {
        Created,    // 0: Metadata only (from match-and-segment-v2)
        Processed   // 1: Assets uploaded (from audio-processor-v1)
    }

    /**
     * @notice Karaoke segment metadata
     */
    struct Segment {
        // Identification
        string segmentId;           // e.g., "verse-1", "chorus-1"
        string sectionType;         // e.g., "Verse 1", "Chorus", "Bridge"

        // Timing (in seconds)
        uint32 startTime;           // Start time in song
        uint32 endTime;             // End time in song
        uint32 duration;            // Duration (endTime - startTime)

        // Assets (Grove URIs from Lit Actions)
        string vocalsUri;           // vocals.zip (processed stems)
        string drumsUri;            // drums.zip (processed stems)
        string audioSnippetUri;     // 30s audio preview

        // Metadata
        SegmentStatus status;       // Created or Processed
        uint64 createdAt;           // When segment was created
        uint64 processedAt;         // When assets were added (0 = not processed)
        address createdBy;          // Who triggered generation (first user)

        bool exists;                // Segment exists flag
    }

    /**
     * @notice Song-level metadata
     */
    struct SongMetadata {
        uint8 source;               // ContentSource enum
        string songId;              // Song identifier (geniusId for Genius, catalogId for Native)
        string artist;              // Artist name
        string title;               // Song title
        uint32 totalSegments;       // Number of segments
        uint64 generatedAt;         // When segments were first generated
        bool exists;                // Song exists flag
    }

    // ========================================================================
    // State
    // ========================================================================

    // Song metadata: songHash => SongMetadata
    mapping(bytes32 => SongMetadata) public songs;

    // Segments: songHash => segmentId => Segment
    mapping(bytes32 => mapping(string => Segment)) public segments;

    // Song segment IDs: songHash => segmentId[] (for enumeration)
    mapping(bytes32 => string[]) private _songSegmentIds;

    // Access control
    address public owner;
    address public trustedProcessor;  // Lit Action PKP (can add/update segments)

    bool public paused;

    // ========================================================================
    // Events
    // ========================================================================

    event SongRegistered(
        bytes32 indexed songHash,
        uint8 source,
        string songId,
        string artist,
        string title,
        uint32 totalSegments,
        uint64 timestamp
    );

    event SegmentAdded(
        bytes32 indexed songHash,
        string segmentId,
        string sectionType,
        uint32 startTime,
        uint32 endTime,
        uint32 duration,
        address indexed createdBy,
        uint64 timestamp
    );

    event SegmentProcessed(
        bytes32 indexed songHash,
        string segmentId,
        string vocalsUri,
        string drumsUri,
        string audioSnippetUri,
        uint64 timestamp
    );

    event TrustedProcessorUpdated(address indexed oldProcessor, address indexed newProcessor);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ========================================================================
    // Constructor & Modifiers
    // ========================================================================

    constructor(address _trustedProcessor) {
        require(_trustedProcessor != address(0), "Invalid processor address");
        owner = msg.sender;
        trustedProcessor = _trustedProcessor;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyTrustedProcessor() {
        require(msg.sender == trustedProcessor, "Not trusted processor");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ========================================================================
    // Utility Functions
    // ========================================================================

    /**
     * @notice Generate song hash from source + ID
     */
    function getSongHash(uint8 source, string calldata songId)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(source, songId));
    }

    // ========================================================================
    // Segment Registration (Processor Only)
    // ========================================================================

    /**
     * @notice Register song and add segments in batch (called by match-and-segment-v2)
     * @dev Creates song metadata + all segment metadata
     * @param source ContentSource (0=Native, 1=Genius)
     * @param songId Song identifier (e.g., geniusId as string)
     * @param artist Artist name
     * @param title Song title
     * @param segmentIds Array of segment IDs
     * @param sectionTypes Array of section types (e.g., "Verse 1", "Chorus")
     * @param startTimes Array of start times (seconds)
     * @param endTimes Array of end times (seconds)
     * @param createdBy User who triggered generation
     */
    function addSegmentsBatch(
        uint8 source,
        string calldata songId,
        string calldata artist,
        string calldata title,
        string[] calldata segmentIds,
        string[] calldata sectionTypes,
        uint32[] calldata startTimes,
        uint32[] calldata endTimes,
        address createdBy
    ) external onlyTrustedProcessor whenNotPaused {
        require(source <= uint8(ContentSource.Genius), "Invalid source");
        require(bytes(songId).length > 0, "Invalid songId");
        require(segmentIds.length > 0, "No segments provided");
        require(segmentIds.length == sectionTypes.length, "Array length mismatch");
        require(segmentIds.length == startTimes.length, "Array length mismatch");
        require(segmentIds.length == endTimes.length, "Array length mismatch");
        require(segmentIds.length <= 50, "Too many segments");
        require(createdBy != address(0), "Invalid creator");

        bytes32 songHash = getSongHash(source, songId);

        // Register song metadata (if not exists)
        if (!songs[songHash].exists) {
            songs[songHash] = SongMetadata({
                source: source,
                songId: songId,
                artist: artist,
                title: title,
                totalSegments: uint32(segmentIds.length),
                generatedAt: uint64(block.timestamp),
                exists: true
            });

            emit SongRegistered(
                songHash,
                source,
                songId,
                artist,
                title,
                uint32(segmentIds.length),
                uint64(block.timestamp)
            );
        }

        // Add all segments
        uint64 timestamp = uint64(block.timestamp);
        for (uint256 i = 0; i < segmentIds.length; i++) {
            require(bytes(segmentIds[i]).length > 0, "Empty segmentId");
            require(endTimes[i] > startTimes[i], "Invalid time range");

            // Skip if segment already exists
            if (segments[songHash][segmentIds[i]].exists) {
                continue;
            }

            uint32 duration = endTimes[i] - startTimes[i];

            segments[songHash][segmentIds[i]] = Segment({
                segmentId: segmentIds[i],
                sectionType: sectionTypes[i],
                startTime: startTimes[i],
                endTime: endTimes[i],
                duration: duration,
                vocalsUri: "",
                drumsUri: "",
                audioSnippetUri: "",
                status: SegmentStatus.Created,
                createdAt: timestamp,
                processedAt: 0,
                createdBy: createdBy,
                exists: true
            });

            _songSegmentIds[songHash].push(segmentIds[i]);

            emit SegmentAdded(
                songHash,
                segmentIds[i],
                sectionTypes[i],
                startTimes[i],
                endTimes[i],
                duration,
                createdBy,
                timestamp
            );
        }
    }

    /**
     * @notice Update segment with processed assets (called by audio-processor-v1)
     * @dev Adds Grove URIs after stem separation complete
     * @param source ContentSource (0=Native, 1=Genius)
     * @param songId Song identifier
     * @param segmentId Segment identifier
     * @param vocalsUri Grove URI to vocals.zip
     * @param drumsUri Grove URI to drums.zip
     * @param audioSnippetUri Grove URI to audio snippet
     */
    function updateSegmentAssets(
        uint8 source,
        string calldata songId,
        string calldata segmentId,
        string calldata vocalsUri,
        string calldata drumsUri,
        string calldata audioSnippetUri
    ) external onlyTrustedProcessor whenNotPaused {
        require(source <= uint8(ContentSource.Genius), "Invalid source");
        bytes32 songHash = getSongHash(source, songId);
        require(songs[songHash].exists, "Song not registered");
        require(segments[songHash][segmentId].exists, "Segment not found");
        require(bytes(vocalsUri).length > 0, "Invalid vocalsUri");
        require(bytes(drumsUri).length > 0, "Invalid drumsUri");

        Segment storage segment = segments[songHash][segmentId];
        segment.vocalsUri = vocalsUri;
        segment.drumsUri = drumsUri;
        segment.audioSnippetUri = audioSnippetUri;
        segment.status = SegmentStatus.Processed;
        segment.processedAt = uint64(block.timestamp);

        emit SegmentProcessed(
            songHash,
            segmentId,
            vocalsUri,
            drumsUri,
            audioSnippetUri,
            uint64(block.timestamp)
        );
    }

    // ========================================================================
    // Query Functions
    // ========================================================================

    /**
     * @notice Check if song has been processed (segments generated)
     */
    function songExists(uint8 source, string calldata songId)
        external
        view
        returns (bool)
    {
        bytes32 songHash = getSongHash(source, songId);
        return songs[songHash].exists;
    }

    /**
     * @notice Get song metadata
     */
    function getSong(uint8 source, string calldata songId)
        external
        view
        returns (SongMetadata memory)
    {
        bytes32 songHash = getSongHash(source, songId);
        require(songs[songHash].exists, "Song not found");
        return songs[songHash];
    }

    /**
     * @notice Get specific segment
     */
    function getSegment(uint8 source, string calldata songId, string calldata segmentId)
        external
        view
        returns (Segment memory)
    {
        bytes32 songHash = getSongHash(source, songId);
        require(songs[songHash].exists, "Song not found");
        require(segments[songHash][segmentId].exists, "Segment not found");
        return segments[songHash][segmentId];
    }

    /**
     * @notice Get all segment IDs for a song
     */
    function getSongSegmentIds(uint8 source, string calldata songId)
        external
        view
        returns (string[] memory)
    {
        bytes32 songHash = getSongHash(source, songId);
        require(songs[songHash].exists, "Song not found");
        return _songSegmentIds[songHash];
    }

    /**
     * @notice Get all segments for a song
     */
    function getSongSegments(uint8 source, string calldata songId)
        external
        view
        returns (Segment[] memory)
    {
        bytes32 songHash = getSongHash(source, songId);
        require(songs[songHash].exists, "Song not found");

        string[] memory segmentIds = _songSegmentIds[songHash];
        Segment[] memory result = new Segment[](segmentIds.length);

        for (uint256 i = 0; i < segmentIds.length; i++) {
            result[i] = segments[songHash][segmentIds[i]];
        }

        return result;
    }

    /**
     * @notice Check if segment has been processed (assets available)
     */
    function isSegmentProcessed(uint8 source, string calldata songId, string calldata segmentId)
        external
        view
        returns (bool)
    {
        bytes32 songHash = getSongHash(source, songId);
        if (!songs[songHash].exists || !segments[songHash][segmentId].exists) {
            return false;
        }
        return segments[songHash][segmentId].status == SegmentStatus.Processed;
    }

    /**
     * @notice Get total number of registered songs
     */
    function getTotalSongs() external view returns (uint256) {
        // Note: This would require tracking in a separate counter
        // For now, songs are accessed via hash lookup
        return 0; // Placeholder - implement counter if needed
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    /**
     * @notice Update trusted processor address
     */
    function setTrustedProcessor(address _trustedProcessor) external onlyOwner {
        require(_trustedProcessor != address(0), "Invalid address");
        address oldProcessor = trustedProcessor;
        trustedProcessor = _trustedProcessor;
        emit TrustedProcessorUpdated(oldProcessor, _trustedProcessor);
    }

    /**
     * @notice Pause contract (emergency)
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
