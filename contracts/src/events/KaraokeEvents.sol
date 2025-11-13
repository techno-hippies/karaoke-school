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
     * @param grc20WorkId GRC-20 musical work entity UUID
     * @param spotifyTrackId Spotify track identifier
     * @param clipStartMs Clip start time in milliseconds
     * @param clipEndMs Clip end time in milliseconds
     * @param metadataUri Grove URI containing clip metadata
     * @param registeredBy Address that registered the clip
     * @param timestamp Block timestamp
     */
    event ClipRegistered(
        bytes32 indexed clipHash,
        string grc20WorkId,
        string spotifyTrackId,
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
     * @param encryptedFullUri Grove or load.network URI for encrypted full-length audio
     * @param encryptedManifestUri Grove URI for Lit ACC manifest / payload
     * @param unlockLockAddress Unlock Protocol lock governing access
     * @param unlockChainId Chain ID for the Unlock lock
     * @param metadataUri Grove URI referencing encryption metadata
     * @param timestamp Block timestamp
     */
    event SongEncrypted(
        bytes32 indexed clipHash,
        string spotifyTrackId,
        string encryptedFullUri,
        string encryptedManifestUri,
        address unlockLockAddress,
        uint32 unlockChainId,
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
        string calldata grc20WorkId,
        string calldata spotifyTrackId,
        uint32 clipStartMs,
        uint32 clipEndMs,
        string calldata metadataUri
    ) external {
        emit ClipRegistered(
            clipHash,
            grc20WorkId,
            spotifyTrackId,
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
        address unlockLockAddress,
        uint32 unlockChainId,
        string calldata metadataUri
    ) external {
        emit SongEncrypted(
            clipHash,
            spotifyTrackId,
            encryptedFullUri,
            encryptedManifestUri,
            unlockLockAddress,
            unlockChainId,
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

    function getClipHash(string calldata spotifyTrackId, uint32 clipStartMs)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(spotifyTrackId, clipStartMs));
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
