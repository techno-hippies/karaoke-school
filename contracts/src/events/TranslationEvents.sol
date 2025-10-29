// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TranslationEvents
 * @notice Event-only contract for karaoke translation tracking
 * @dev Emits events for The Graph indexing - NO STORAGE
 *
 * Purpose:
 * - Track multi-language translations for karaoke segments
 * - Enable queries for available translation languages
 * - Link translations to segments via segmentHash
 * - Store full translation JSON (line-level with word timing) in Grove
 *
 * Translation Pipeline:
 * 1. Segment registered with instrumental + alignment
 * 2. Gemini translates lyrics line-by-line (es, zh, ja, ko)
 * 3. Word timing preserved from ElevenLabs alignment
 * 4. Translation JSON uploaded to Grove
 * 5. Event emitted with Grove URI + metadata
 * 6. Subgraph indexes for language queries
 *
 * Translation Quality:
 * - confidenceScore: 0-10000 (Gemini's confidence × 10000)
 * - validated: Human-verified translations marked true
 * - translationSource: Model used (e.g., "gemini-flash-2.5")
 *
 * Gas Cost: ~25k per event
 */
contract TranslationEvents {

    // ============ Events ============

    /**
     * @notice Emitted when a translation is added to a segment
     * @param segmentHash Unique segment identifier (references SegmentEvents)
     * @param languageCode ISO 639-1 language code (e.g., "es", "zh", "ja", "ko")
     * @param translationUri Grove URI for translation JSON (line-level + word timing)
     * @param translationSource AI model used for translation (e.g., "gemini-flash-2.5")
     * @param confidenceScore Translation confidence (0-10000, from model)
     * @param validated Human-verified translation (true if reviewed)
     * @param addedBy Address that added the translation
     * @param timestamp Block timestamp
     */
    event TranslationAdded(
        bytes32 indexed segmentHash,
        string indexed languageCode,
        string translationUri,
        string translationSource,
        uint16 confidenceScore,
        bool validated,
        address indexed addedBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a translation is updated (e.g., human validation)
     * @param segmentHash Unique segment identifier
     * @param languageCode ISO 639-1 language code
     * @param translationUri Updated Grove URI
     * @param validated New validation status
     * @param updatedBy Address that updated the translation
     * @param timestamp Block timestamp
     */
    event TranslationUpdated(
        bytes32 indexed segmentHash,
        string indexed languageCode,
        string translationUri,
        bool validated,
        address indexed updatedBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a translation is enabled/disabled
     * @param segmentHash Unique segment identifier
     * @param languageCode ISO 639-1 language code
     * @param enabled Whether translation is enabled
     * @param timestamp Block timestamp
     */
    event TranslationToggled(
        bytes32 indexed segmentHash,
        string indexed languageCode,
        bool enabled,
        uint64 timestamp
    );

    // ============ Functions ============

    /**
     * @notice Emit translation added event
     * @param segmentHash Unique segment identifier
     * @param languageCode ISO 639-1 language code (2 letters)
     * @param translationUri Grove URI for translation JSON
     * @param translationSource AI model identifier
     * @param confidenceScore Translation confidence (0-10000)
     * @param validated Human-verified flag
     * @dev Anyone can call - no authorization needed
     */
    function emitTranslationAdded(
        bytes32 segmentHash,
        string calldata languageCode,
        string calldata translationUri,
        string calldata translationSource,
        uint16 confidenceScore,
        bool validated
    ) external {
        emit TranslationAdded(
            segmentHash,
            languageCode,
            translationUri,
            translationSource,
            confidenceScore,
            validated,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit translation updated event
     * @param segmentHash Unique segment identifier
     * @param languageCode ISO 639-1 language code
     * @param translationUri Updated Grove URI
     * @param validated New validation status
     */
    function emitTranslationUpdated(
        bytes32 segmentHash,
        string calldata languageCode,
        string calldata translationUri,
        bool validated
    ) external {
        emit TranslationUpdated(
            segmentHash,
            languageCode,
            translationUri,
            validated,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Emit translation toggle event
     * @param segmentHash Unique segment identifier
     * @param languageCode ISO 639-1 language code
     * @param enabled Whether translation is enabled
     */
    function emitTranslationToggled(
        bytes32 segmentHash,
        string calldata languageCode,
        bool enabled
    ) external {
        emit TranslationToggled(
            segmentHash,
            languageCode,
            enabled,
            uint64(block.timestamp)
        );
    }
}
