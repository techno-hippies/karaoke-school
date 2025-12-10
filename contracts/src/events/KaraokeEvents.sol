// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title KaraokeEvents
 * @notice Event-only contract for karaoke clip lifecycle and associated full-song encryption
 * @dev Emits events for The Graph indexing. No storage is persisted on-chain.
 */
contract KaraokeEvents {
    // ============ State ============

    address public owner;
    address public trustedPKP;
    bool public paused;

    // ============ Errors ============

    error NotOwner();
    error NotTrustedPKP();
    error ContractPaused();
    error InvalidAddress();
    error InvalidScore();
    error InvalidSession();
    error InvalidRating();

    // ============ Constructor ============

    constructor(address _trustedPKP) {
        if (_trustedPKP == address(0)) revert InvalidAddress();
        owner = msg.sender;
        trustedPKP = _trustedPKP;
        paused = false;
    }

    // ============ Modifiers ============

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTrustedPKP() {
        if (msg.sender != trustedPKP) revert NotTrustedPKP();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ============ Lifecycle Events ============
    /**
     * @notice Emitted when a karaoke clip is registered
     * @param clipHash Unique identifier for the clip (keccak256(trackId, clipStartMs))
     * @param spotifyTrackId Spotify track identifier
     * @param iswc International Standard Musical Work Code
     * @param title Song title
     * @param artist Artist name
     * @param artistSlug URL-safe artist slug for routing
     * @param songSlug URL-safe song slug for routing
     * @param coverUri Grove URI for cover image (640x640)
     * @param thumbnailUri Grove URI for thumbnail (300x300)
     * @param clipStartMs Clip start time in milliseconds
     * @param clipEndMs Clip end time in milliseconds
     * @param metadataUri Grove URI containing full clip metadata
     * @param registeredBy Address that registered the clip
     * @param timestamp Block timestamp
     */
    event ClipRegistered(
        bytes32 indexed clipHash,
        string spotifyTrackId,
        string iswc,
        string title,
        string artist,
        string artistSlug,
        string songSlug,
        string coverUri,
        string thumbnailUri,
        uint32 clipStartMs,
        uint32 clipEndMs,
        string metadataUri,
        address indexed registeredBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when clip processing completes with instrumental/alignment assets
     * @param clipHash Unique clip identifier
     * @param instrumentalUri Grove URI for the karaoke instrumental clip
     * @param alignmentUri Grove URI for alignment metadata (word timing)
     * @param translationCount Number of translations published for this clip
     * @param metadataUri Grove URI containing updated metadata with asset references
     * @param timestamp Block timestamp
     */
    event ClipProcessed(
        bytes32 indexed clipHash,
        string instrumentalUri,
        string alignmentUri,
        uint8 translationCount,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when the full-length song is encrypted and linked to the clip
     * @param clipHash Unique clip identifier the full song is associated with
     * @param spotifyTrackId Spotify track identifier
     * @param encryptedFullUri Grove URI for encrypted full-length audio
     * @param encryptedManifestUri Grove URI for Lit ACC manifest (contains access control details)
     * @param metadataUri Grove URI referencing encryption metadata
     * @param timestamp Block timestamp
     */
    event SongEncrypted(
        bytes32 indexed clipHash,
        string spotifyTrackId,
        string encryptedFullUri,
        string encryptedManifestUri,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a clip is enabled or disabled
     * @param clipHash Unique clip identifier
     * @param enabled Whether the clip is enabled
     * @param timestamp Block timestamp
     */
    event ClipToggled(
        bytes32 indexed clipHash,
        bool enabled,
        uint64 timestamp
    );

    /**
     * @notice Emitted when clip localization data is added or updated
     * @param clipHash Unique clip identifier
     * @param localizations JSON object with title_XX and artist_XX keys for each language
     *        Example: {"title_zh":"...","title_es":"...","artist_zh":"...","artist_es":"..."}
     *        Supported languages: zh, vi, id, ja, ko, es, pt, ar, tr, ru, hi, th
     * @param genres Spotify genres array (JSON string)
     * @param timestamp Block timestamp
     */
    event ClipLocalizationUpdated(
        bytes32 indexed clipHash,
        string localizations,
        string genres,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a karaoke session is started for line-by-line grading
     * @param sessionId Deterministic session identifier (e.g., keccak256(performer, clipHash, clientNonce))
     * @param clipHash Clip identifier (keccak256(spotifyTrackId, clipStartMs))
     * @param performer User wallet address
     * @param expectedLineCount Total lines expected in the session (song or clip)
     * @param timestamp Block timestamp
     */
    event KaraokeSessionStarted(
        bytes32 indexed sessionId,
        bytes32 indexed clipHash,
        address indexed performer,
        uint16 expectedLineCount,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a karaoke line is graded within a session
     * @param sessionId Session identifier
     * @param lineIndex Line index (0-based)
     * @param score Levenshtein similarity score in basis points (0-10000)
     * @param rating FSRS-aligned rating (0=Again, 1=Hard, 2=Good, 3=Easy)
     * @param metadataUri Grove URI containing transcript/analysis for the line
     * @param timestamp Block timestamp
     */
    event KaraokeLineGraded(
        bytes32 indexed sessionId,
        uint16 lineIndex,
        uint16 score,
        uint8 rating,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a karaoke session ends (completed or abandoned)
     * @param sessionId Session identifier
     * @param completed True if all expected lines were completed, false if abandoned early
     * @param timestamp Block timestamp
     */
    event KaraokeSessionEnded(
        bytes32 indexed sessionId,
        bool completed,
        uint64 timestamp
    );

    // ============ Performance Events ============

    /**
     * @notice Emitted when a karaoke performance is graded (clip or full song)
     * @param performanceId Unique performance identifier
     * @param clipHash Clip identifier (keccak256(spotifyTrackId, clipStartMs))
     * @param spotifyTrackId Spotify track identifier
     * @param performer User wallet address
     * @param performanceType "CLIP" (40-60s) or "FULL_SONG" (entire track)
     * @param similarityScore Levenshtein similarity score in basis points (0-10000)
     * @param lineCount Number of lines sung (8-19 for clip, 35-72 for full song)
     * @param grade Qualitative grade ("Excellent", "Great", "Good", "OK", "Not great")
     * @param metadataUri Grove URI with full transcript and grading details
     * @param timestamp Block timestamp
     */
    event KaraokePerformanceGraded(
        uint256 indexed performanceId,
        bytes32 indexed clipHash,
        string spotifyTrackId,
        address indexed performer,
        string performanceType,
        uint16 similarityScore,
        uint16 lineCount,
        string grade,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when PKP address is updated
     * @param oldPKP Previous PKP address
     * @param newPKP New PKP address
     */
    event TrustedPKPUpdated(address indexed oldPKP, address indexed newPKP);

    /**
     * @notice Emitted when contract pause state is updated
     * @param paused New pause state
     */
    event PausedUpdated(bool paused);

    function emitClipRegistered(
        bytes32 clipHash,
        string calldata spotifyTrackId,
        string calldata iswc,
        string calldata title,
        string calldata artist,
        string calldata artistSlug,
        string calldata songSlug,
        string calldata coverUri,
        string calldata thumbnailUri,
        uint32 clipStartMs,
        uint32 clipEndMs,
        string calldata metadataUri
    ) external {
        emit ClipRegistered(
            clipHash,
            spotifyTrackId,
            iswc,
            title,
            artist,
            artistSlug,
            songSlug,
            coverUri,
            thumbnailUri,
            clipStartMs,
            clipEndMs,
            metadataUri,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function emitClipProcessed(
        bytes32 clipHash,
        string calldata instrumentalUri,
        string calldata alignmentUri,
        uint8 translationCount,
        string calldata metadataUri
    ) external {
        emit ClipProcessed(
            clipHash,
            instrumentalUri,
            alignmentUri,
            translationCount,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    function emitSongEncrypted(
        bytes32 clipHash,
        string calldata spotifyTrackId,
        string calldata encryptedFullUri,
        string calldata encryptedManifestUri,
        string calldata metadataUri
    ) external {
        emit SongEncrypted(
            clipHash,
            spotifyTrackId,
            encryptedFullUri,
            encryptedManifestUri,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    function emitClipToggled(
        bytes32 clipHash,
        bool enabled
    ) external {
        emit ClipToggled(
            clipHash,
            enabled,
            uint64(block.timestamp)
        );
    }

    function emitClipLocalizationUpdated(
        bytes32 clipHash,
        string calldata localizations,
        string calldata genres
    ) external {
        emit ClipLocalizationUpdated(
            clipHash,
            localizations,
            genres,
            uint64(block.timestamp)
        );
    }

    function getClipHash(string calldata spotifyTrackId, uint32 clipStartMs)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(spotifyTrackId, clipStartMs));
    }

    // ============ Session-Based Line Grading (PKP-gated) ============

    /**
     * @notice Start a karaoke session for line-by-line grading
     * @dev Only callable by trusted PKP (Lit Action)
     * @param sessionId Deterministic session identifier
     * @param clipHash Clip identifier
     * @param performer User wallet address
     * @param expectedLineCount Number of lines expected in the session
     */
    function startKaraokeSession(
        bytes32 sessionId,
        bytes32 clipHash,
        address performer,
        uint16 expectedLineCount
    ) external onlyTrustedPKP whenNotPaused {
        if (sessionId == bytes32(0) || clipHash == bytes32(0)) revert InvalidSession();
        if (performer == address(0)) revert InvalidAddress();
        if (expectedLineCount == 0) revert InvalidScore();

        emit KaraokeSessionStarted(
            sessionId,
            clipHash,
            performer,
            expectedLineCount,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Grade a single karaoke line within a session
     * @dev Only callable by trusted PKP (Lit Action)
     * @param sessionId Session identifier
     * @param lineIndex Line index (0-based)
     * @param score Levenshtein similarity score (0-10000)
     * @param rating FSRS rating (0-3)
     * @param metadataUri Grove URI with transcript/analysis for the line
     */
    function gradeKaraokeLine(
        bytes32 sessionId,
        uint16 lineIndex,
        uint16 score,
        uint8 rating,
        string calldata metadataUri
    ) external onlyTrustedPKP whenNotPaused {
        if (sessionId == bytes32(0)) revert InvalidSession();
        if (score > 10000) revert InvalidScore();
        if (rating > 3) revert InvalidRating();

        emit KaraokeLineGraded(
            sessionId,
            lineIndex,
            score,
            rating,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice End a karaoke session
     * @dev Only callable by trusted PKP (Lit Action)
     * @param sessionId Session identifier
     * @param completed True if all expected lines were graded, false if abandoned early
     */
    function endKaraokeSession(
        bytes32 sessionId,
        bool completed
    ) external onlyTrustedPKP whenNotPaused {
        if (sessionId == bytes32(0)) revert InvalidSession();

        emit KaraokeSessionEnded(
            sessionId,
            completed,
            uint64(block.timestamp)
        );
    }

    // ============ Performance Grading (PKP-gated) ============

    /**
     * @notice Grade a karaoke performance (clip or full song)
     * @dev Only callable by trusted PKP (Lit Action)
     * @param performanceId Unique performance identifier (timestamp or UUID)
     * @param clipHash Clip identifier
     * @param spotifyTrackId Spotify track ID
     * @param performer User wallet address
     * @param performanceType "CLIP" or "FULL_SONG"
     * @param similarityScore Levenshtein similarity (0-10000 basis points)
     * @param lineCount Number of lines sung
     * @param grade Qualitative grade string
     * @param metadataUri Grove URI with transcript/analysis
     */
    function gradeKaraokePerformance(
        uint256 performanceId,
        bytes32 clipHash,
        string calldata spotifyTrackId,
        address performer,
        string calldata performanceType,
        uint16 similarityScore,
        uint16 lineCount,
        string calldata grade,
        string calldata metadataUri
    ) external onlyTrustedPKP whenNotPaused {
        if (performer == address(0)) revert InvalidAddress();
        if (similarityScore > 10000) revert InvalidScore();
        if (lineCount == 0) revert InvalidScore();

        emit KaraokePerformanceGraded(
            performanceId,
            clipHash,
            spotifyTrackId,
            performer,
            performanceType,
            similarityScore,
            lineCount,
            grade,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    // ============ Admin Functions ============

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedUpdated(_paused);
    }

    function setTrustedPKP(address newPKP) external onlyOwner {
        if (newPKP == address(0)) revert InvalidAddress();
        emit TrustedPKPUpdated(trustedPKP, newPKP);
        trustedPKP = newPKP;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidAddress();
        owner = newOwner;
    }
}
