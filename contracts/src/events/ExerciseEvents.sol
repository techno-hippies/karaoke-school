// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ExerciseEvents
 * @notice Event-only contract for FSRS-tracked language learning exercises
 * @dev Separates learner exercises from showcase performances (PerformanceGrader)
 *
 * Exercise taxonomy:
 * - Say It Back (audio pronunciation, line-level)
 * - Translation multiple choice (line-level comprehension)
 * - Trivia multiple choice (song-level cultural context)
 *
 * Design goals:
 * - Permissionless content registration (pipeline emits question metadata)
 * - PKP-gated grading (prevents spoofed scores)
 * - Single metadata URI per question/attempt (Grove JSON payload)
 * - Minimal on-chain footprint (events only, no storage beyond config)
 */
contract ExerciseEvents {
    // ============ State ============

    address public owner;
    address public trustedPKP;
    bool public paused;

    // ============ Events ============

    /**
     * @notice Emitted when a translation multiple choice question is registered
     * @param questionId Stable question identifier (UUID -> bytes32 hash)
     * @param lineId Line UUID (karaoke_lines.line_id -> bytes32)
     * @param segmentHash Parent segment hash (keccak256(spotifyTrackId, startMs))
     * @param lineIndex Line index within segment (0-based)
     * @param spotifyTrackId Spotify track ID (per-song grouping)
     * @param languageCode Target language ISO 639-1 code (e.g., "zh")
     * @param metadataUri Grove URI holding prompt/correct answer/distractor pool
     * @param distractorPoolSize Total available distractors (>= displayed choices)
     * @param registeredBy Address that registered the question
     * @param timestamp Block timestamp
     */
    event TranslationQuestionRegistered(
        bytes32 indexed questionId,
        bytes32 indexed lineId,
        bytes32 indexed segmentHash,
        string spotifyTrackId,
        uint16 lineIndex,
        string languageCode,
        string metadataUri,
        uint16 distractorPoolSize,
        address registeredBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a trivia multiple choice question is registered
     * @param questionId Stable question identifier (UUID -> bytes32 hash)
     * @param spotifyTrackId Spotify track ID (song-level anchor)
     * @param languageCode Question language (ISO 639-1 code)
     * @param metadataUri Grove URI holding trivia prompt/answers/explanation
     * @param distractorPoolSize Total available distractors (>= displayed choices)
     * @param registeredBy Address that registered the question
     * @param timestamp Block timestamp
     */
    event TriviaQuestionRegistered(
        bytes32 indexed questionId,
        string spotifyTrackId,
        string languageCode,
        string metadataUri,
        uint16 distractorPoolSize,
        address indexed registeredBy,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a Say It Back attempt is graded
     * @param attemptId Unique attempt identifier (uint256)
     * @param lineId Line UUID (bytes32)
     * @param segmentHash Parent segment hash
     * @param lineIndex Line index within segment (0-based)
     * @param learner Learner wallet address (Lens account)
     * @param score Score in basis points (0-10000)
     * @param rating FSRS rating (0=Again, 1=Hard, 2=Good, 3=Easy)
     * @param metadataUri Grove URI with STT transcript/audio analysis JSON
     * @param timestamp Block timestamp
     */
    event SayItBackAttemptGraded(
        uint256 indexed attemptId,
        bytes32 indexed lineId,
        bytes32 indexed segmentHash,
        uint16 lineIndex,
        address learner,
        uint16 score,
        uint8 rating,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a multiple choice exercise attempt is graded
     * @param attemptId Unique attempt identifier (uint256)
     * @param questionId Question identifier (bytes32)
     * @param learner Learner wallet address (Lens account)
     * @param score Score in basis points (0-10000; 10000 = correct)
     * @param rating FSRS rating (0=Again, 1=Hard, 2=Good, 3=Easy)
     * @param metadataUri Grove URI with presented options, learner answer, rationale
     * @param timestamp Block timestamp
     */
    event MultipleChoiceAttemptGraded(
        uint256 indexed attemptId,
        bytes32 indexed questionId,
        address indexed learner,
        uint16 score,
        uint8 rating,
        string metadataUri,
        uint64 timestamp
    );

    /**
     * @notice Emitted when a question is enabled or disabled
     * @param questionId Question identifier (bytes32)
     * @param enabled New availability flag
     * @param timestamp Block timestamp
     */
    event QuestionToggled(
        bytes32 indexed questionId,
        bool enabled,
        address indexed toggledBy,
        uint64 timestamp
    );

    /**
     * @notice Trusted PKP address updated
     * @param oldPKP Previous PKP address
     * @param newPKP New PKP address
     */
    event TrustedPKPUpdated(address indexed oldPKP, address indexed newPKP);

    /**
     * @notice Contract pause state updated
     * @param paused New pause flag
     */
    event PausedUpdated(bool paused);

    // ============ Errors ============

    error NotOwner();
    error NotTrustedPKP();
    error ContractPaused();
    error InvalidAddress();
    error InvalidQuestionId();
    error InvalidDistractorPool();
    error InvalidScore();
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

    // ============ Content Registration ============

    /**
     * @notice Register a translation multiple choice question
     * @dev Permissionless (pipeline emits after Grove upload)
     */
    function emitTranslationQuestionRegistered(
        bytes32 questionId,
        bytes32 lineId,
        bytes32 segmentHash,
        string calldata spotifyTrackId,
        uint16 lineIndex,
        string calldata languageCode,
        string calldata metadataUri,
        uint16 distractorPoolSize
    ) external whenNotPaused {
        if (questionId == bytes32(0)) revert InvalidQuestionId();
        if (lineId == bytes32(0)) revert InvalidQuestionId();
        if (bytes(languageCode).length == 0) revert InvalidQuestionId();
        if (distractorPoolSize < 3) revert InvalidDistractorPool();

        emit TranslationQuestionRegistered(
            questionId,
            lineId,
            segmentHash,
            spotifyTrackId,
            lineIndex,
            languageCode,
            metadataUri,
            distractorPoolSize,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Register a trivia multiple choice question (song-level)
     * @dev Permissionless (pipeline emits after Grove upload)
     */
    function emitTriviaQuestionRegistered(
        bytes32 questionId,
        string calldata spotifyTrackId,
        string calldata languageCode,
        string calldata metadataUri,
        uint16 distractorPoolSize
    ) external whenNotPaused {
        if (questionId == bytes32(0)) revert InvalidQuestionId();
        if (bytes(languageCode).length == 0) revert InvalidQuestionId();
        if (distractorPoolSize < 3) revert InvalidDistractorPool();

        emit TriviaQuestionRegistered(
            questionId,
            spotifyTrackId,
            languageCode,
            metadataUri,
            distractorPoolSize,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    // ============ Grading (PKP only) ============

    /**
     * @notice Grade a Say It Back attempt (audio pronunciation)
     * @dev Only the trusted PKP (Lit Action) can emit
     */
    function gradeSayItBackAttempt(
        uint256 attemptId,
        bytes32 lineId,
        bytes32 segmentHash,
        uint16 lineIndex,
        address learner,
        uint16 score,
        uint8 rating,
        string calldata metadataUri
    ) external onlyTrustedPKP whenNotPaused {
        if (attemptId == 0) revert InvalidQuestionId();
        if (lineId == bytes32(0)) revert InvalidQuestionId();
        if (learner == address(0)) revert InvalidAddress();
        if (score > 10000) revert InvalidScore();
        if (rating > 3) revert InvalidRating();

        emit SayItBackAttemptGraded(
            attemptId,
            lineId,
            segmentHash,
            lineIndex,
            learner,
            score,
            rating,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Grade a multiple choice attempt (translation/trivia)
     * @dev Only the trusted PKP (Lit Action) can emit
     */
    function gradeMultipleChoiceAttempt(
        uint256 attemptId,
        bytes32 questionId,
        address learner,
        uint16 score,
        uint8 rating,
        string calldata metadataUri
    ) external onlyTrustedPKP whenNotPaused {
        if (attemptId == 0) revert InvalidQuestionId();
        if (questionId == bytes32(0)) revert InvalidQuestionId();
        if (learner == address(0)) revert InvalidAddress();
        if (score > 10000) revert InvalidScore();
        if (rating > 3) revert InvalidRating();

        emit MultipleChoiceAttemptGraded(
            attemptId,
            questionId,
            learner,
            score,
            rating,
            metadataUri,
            uint64(block.timestamp)
        );
    }

    // ============ Moderation (owner) ============

    /**
     * @notice Enable or disable a question (content moderation)
     */
    function toggleQuestion(bytes32 questionId, bool enabled) external onlyOwner {
        if (questionId == bytes32(0)) revert InvalidQuestionId();

        emit QuestionToggled(questionId, enabled, msg.sender, uint64(block.timestamp));
    }

    // ============ Admin ============

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
