// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @notice Interface for StudyProgress contract
 * @dev Used to gate quiz access (must study before quiz)
 */
interface IStudyProgress {
    function studiedToday(address user) external view returns (bool);
}

/**
 * @title SongQuizV2
 * @notice Daily song quiz with multilingual support and strict access control
 * @dev V2: Language-agnostic translation system with sequential unlocking
 *
 * Key Changes from V1:
 * - Questions store base content (language-agnostic)
 * - Translations stored separately (infinitely scalable)
 * - Same question across all languages (fair leaderboards)
 * - Can add new languages without contract updates
 *
 * Access Control (Prevents Answer Leaking):
 * 1. Must study today (SayItBack) before ANY quiz
 * 2. Must complete Q1 before seeing Q2 (sequential unlock)
 * 3. PKP decrypts ONLY next eligible question
 * 4. 1 quiz per day per song (can't grind same question)
 * 5. Time limit enforced (15s including network overhead)
 *
 * Translation Flow:
 * 1. Admin generates questions in multiple languages (same referent)
 * 2. PKP encrypts and stores translations
 * 3. User requests quiz in preferred language
 * 4. PKP checks: studied today? next question unlocked? daily limit?
 * 5. If all checks pass, decrypt translation for user's language
 * 6. User answers, PKP validates and records (language tracked for analytics)
 *
 * Language Management:
 * - Launch with: Vietnamese (vi), Mandarin (zh-CN)
 * - Add later: Spanish (es), Japanese (ja), Korean (ko), etc.
 * - Contract doesn't care about specific languages (just string keys)
 * - Frontend handles language detection and fallbacks
 */
contract SongQuizV2 {
    // ========================================================================
    // Types & Structs
    // ========================================================================

    /**
     * @notice Base question (language-agnostic content)
     */
    struct Question {
        bytes32 referentHash;       // keccak256(source, referentId) - identifies content
        uint64 addedAt;             // When question was added
        bool exists;                // Question exists flag
        bool enabled;               // Question is active (for soft delete)
    }

    /**
     * @notice Translation of a question in a specific language
     */
    struct QuestionTranslation {
        string ciphertext;          // Lit-encrypted question JSON
        string dataToEncryptHash;   // Verification hash
        bool exists;                // Translation exists flag
    }

    /**
     * @notice User progress for a song (language-agnostic)
     */
    struct SongProgress {
        uint32 questionsCompleted;  // Total questions completed
        uint32 questionsCorrect;    // Total correct answers
        uint32 currentStreak;       // Current daily streak
        uint32 longestStreak;       // Best streak achieved
        uint64 lastQuizTimestamp;   // Last quiz completion (UTC timestamp)
        uint32 nextQuestionIndex;   // Next question to unlock (0-based)
        string preferredLanguage;   // User's preferred display language
    }

    /**
     * @notice Leaderboard entry (per song)
     */
    struct LeaderboardEntry {
        address user;
        uint32 streak;              // Current streak
        uint32 questionsCorrect;    // Total correct
        uint64 lastActive;          // Last quiz timestamp
    }

    // ========================================================================
    // State
    // ========================================================================

    // Song metadata
    mapping(uint32 => string) public songNames;          // geniusId => song name
    mapping(uint32 => uint32) public songToArtist;       // geniusId => geniusArtistId
    mapping(uint32 => string) public artistNames;        // geniusArtistId => artist name
    mapping(uint32 => uint32[]) private _artistSongs;    // geniusArtistId => [geniusId, ...]

    // Questions: geniusId => questionIndex => Question
    mapping(uint32 => mapping(uint32 => Question)) public questions;
    mapping(uint32 => uint32) public questionCount;      // geniusId => total questions

    // Translations: geniusId => questionIndex => languageCode => Translation
    mapping(uint32 => mapping(uint32 => mapping(string => QuestionTranslation))) public translations;

    // Available languages per question: geniusId => questionIndex => [languageCode, ...]
    mapping(uint32 => mapping(uint32 => string[])) private _availableLanguages;

    // User progress: geniusId => user => SongProgress
    mapping(uint32 => mapping(address => SongProgress)) public progress;

    // Leaderboards: geniusId => LeaderboardEntry[10]
    mapping(uint32 => LeaderboardEntry[10]) public leaderboards;

    // Daily completion: keccak256(geniusId, user, dayNumber) => completed
    mapping(bytes32 => bool) public dailyCompletion;

    // StudyProgress reference (for gating)
    address public studyProgress;

    address public trustedQuizMaster;  // PKP address
    address public owner;
    bool public paused;

    uint8 public constant TIME_LIMIT_SECONDS = 15;

    // ========================================================================
    // Events
    // ========================================================================

    event SongRegistered(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        string songName,
        string artistName,
        uint64 timestamp
    );

    event QuestionAdded(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 questionIndex,
        bytes32 referentHash,
        uint64 timestamp
    );

    event TranslationAdded(
        uint32 indexed geniusId,
        uint32 questionIndex,
        string language,
        uint64 timestamp
    );

    event TranslationsAdded(
        uint32 indexed geniusId,
        uint32 questionIndex,
        string[] languages,
        uint64 timestamp
    );

    event QuizCompleted(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        address indexed user,
        bool correct,
        uint32 questionIndex,
        string displayLanguage,       // Which translation user saw
        uint64 timestamp,
        uint32 songStreak,
        uint32 songTotalCorrect,
        uint32 songTotalCompleted,
        bool isNewRecord,
        uint8 leaderboardPosition
    );

    event StreakBroken(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        address indexed user,
        uint32 oldStreak,
        uint64 timestamp
    );

    event QuestionDisabled(uint32 indexed geniusId, uint32 indexed geniusArtistId, uint32 questionIndex, uint64 timestamp);
    event QuestionEnabled(uint32 indexed geniusId, uint32 indexed geniusArtistId, uint32 questionIndex, uint64 timestamp);
    event UserProgressReset(uint32 indexed geniusId, uint32 indexed geniusArtistId, address indexed user, uint64 timestamp);
    event StudyProgressUpdated(address indexed oldProgress, address indexed newProgress);
    event TrustedQuizMasterUpdated(address indexed oldMaster, address indexed newMaster);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    // ========================================================================
    // Constructor & Modifiers
    // ========================================================================

    constructor(address _trustedQuizMaster, address _studyProgress) {
        require(_trustedQuizMaster != address(0), "Invalid quiz master address");
        require(_studyProgress != address(0), "Invalid study progress address");
        owner = msg.sender;
        trustedQuizMaster = _trustedQuizMaster;
        studyProgress = _studyProgress;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOwnerOrQuizMaster() {
        require(msg.sender == owner || msg.sender == trustedQuizMaster, "Not authorized");
        _;
    }

    modifier onlyTrustedQuizMaster() {
        require(msg.sender == trustedQuizMaster, "Not trusted quiz master");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    // ========================================================================
    // Utility Functions
    // ========================================================================

    function getDayNumber(uint64 timestamp) public pure returns (uint256) {
        return uint256(timestamp) / 1 days;
    }

    function getDailyCompletionHash(uint32 geniusId, address user, uint256 dayNumber)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(geniusId, user, dayNumber));
    }

    // ========================================================================
    // Song & Artist Management
    // ========================================================================

    function registerSong(
        uint32 geniusId,
        uint32 geniusArtistId,
        string calldata songName,
        string calldata artistName
    ) external onlyOwnerOrQuizMaster {
        require(bytes(songNames[geniusId]).length == 0, "Song already registered");
        require(geniusId > 0, "Invalid song ID");
        require(geniusArtistId > 0, "Invalid artist ID");

        songNames[geniusId] = songName;
        songToArtist[geniusId] = geniusArtistId;

        if (bytes(artistNames[geniusArtistId]).length == 0) {
            artistNames[geniusArtistId] = artistName;
        }

        uint32[] storage songs = _artistSongs[geniusArtistId];
        bool found = false;
        for (uint256 i = 0; i < songs.length; i++) {
            if (songs[i] == geniusId) {
                found = true;
                break;
            }
        }
        if (!found) {
            songs.push(geniusId);
        }

        emit SongRegistered(geniusId, geniusArtistId, songName, artistName, uint64(block.timestamp));
    }

    // ========================================================================
    // Question & Translation Management (Quiz Master Only)
    // ========================================================================

    /**
     * @notice Add question with translations (batch operation)
     * @dev Creates question and all translations in one transaction
     * @param geniusId Genius API song ID
     * @param referentHash keccak256(source, referentId)
     * @param languageCodes Array of language codes (e.g., ["en", "vi", "zh-CN"])
     * @param ciphertexts Array of encrypted question JSONs
     * @param dataToEncryptHashes Array of verification hashes
     */
    function addQuestionWithTranslations(
        uint32 geniusId,
        bytes32 referentHash,
        string[] calldata languageCodes,
        string[] calldata ciphertexts,
        string[] calldata dataToEncryptHashes
    ) external onlyTrustedQuizMaster whenNotPaused {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(languageCodes.length == ciphertexts.length, "Array length mismatch");
        require(languageCodes.length == dataToEncryptHashes.length, "Array length mismatch");
        require(languageCodes.length > 0, "No translations provided");
        require(languageCodes.length <= 20, "Too many translations");

        uint32 questionIndex = questionCount[geniusId];

        // Create base question
        questions[geniusId][questionIndex] = Question({
            referentHash: referentHash,
            addedAt: uint64(block.timestamp),
            exists: true,
            enabled: true
        });

        // Add all translations
        for (uint256 i = 0; i < languageCodes.length; i++) {
            require(!translations[geniusId][questionIndex][languageCodes[i]].exists, "Translation already exists");

            translations[geniusId][questionIndex][languageCodes[i]] = QuestionTranslation({
                ciphertext: ciphertexts[i],
                dataToEncryptHash: dataToEncryptHashes[i],
                exists: true
            });

            _availableLanguages[geniusId][questionIndex].push(languageCodes[i]);
        }

        questionCount[geniusId]++;

        uint32 artistId = songToArtist[geniusId];
        emit QuestionAdded(geniusId, artistId, questionIndex, referentHash, uint64(block.timestamp));
        emit TranslationsAdded(geniusId, questionIndex, languageCodes, uint64(block.timestamp));
    }

    /**
     * @notice Add single translation to existing question
     * @dev Allows adding new languages to existing questions over time
     * @param geniusId Genius API song ID
     * @param questionIndex Question index
     * @param languageCode Language code (e.g., "ko", "ja", "es")
     * @param ciphertext Encrypted question JSON
     * @param dataToEncryptHash Verification hash
     */
    function addTranslation(
        uint32 geniusId,
        uint32 questionIndex,
        string calldata languageCode,
        string calldata ciphertext,
        string calldata dataToEncryptHash
    ) external onlyTrustedQuizMaster whenNotPaused {
        require(questions[geniusId][questionIndex].exists, "Question does not exist");
        require(!translations[geniusId][questionIndex][languageCode].exists, "Translation already exists");

        translations[geniusId][questionIndex][languageCode] = QuestionTranslation({
            ciphertext: ciphertext,
            dataToEncryptHash: dataToEncryptHash,
            exists: true
        });

        _availableLanguages[geniusId][questionIndex].push(languageCode);

        emit TranslationAdded(geniusId, questionIndex, languageCode, uint64(block.timestamp));
    }

    /**
     * @notice Disable question (soft delete, owner only)
     * @dev Sequential unlock will skip disabled questions automatically
     */
    function disableQuestion(uint32 geniusId, uint32 questionIndex) external onlyOwner {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(questions[geniusId][questionIndex].exists, "Question does not exist");
        require(questions[geniusId][questionIndex].enabled, "Question already disabled");

        questions[geniusId][questionIndex].enabled = false;

        uint32 artistId = songToArtist[geniusId];
        emit QuestionDisabled(geniusId, artistId, questionIndex, uint64(block.timestamp));
    }

    /**
     * @notice Re-enable a disabled question
     */
    function enableQuestion(uint32 geniusId, uint32 questionIndex) external onlyOwner {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(questions[geniusId][questionIndex].exists, "Question does not exist");
        require(!questions[geniusId][questionIndex].enabled, "Question already enabled");

        questions[geniusId][questionIndex].enabled = true;

        uint32 artistId = songToArtist[geniusId];
        emit QuestionEnabled(geniusId, artistId, questionIndex, uint64(block.timestamp));
    }

    // ========================================================================
    // Quiz Completion (Quiz Master Only)
    // ========================================================================

    /**
     * @notice Record quiz completion (quiz master only)
     * @dev Called by PKP after validating answer + time limit off-chain
     * @dev CRITICAL ACCESS CONTROL:
     *      1. Study gating: User must have studied today
     *      2. Sequential unlock: User must answer questions in order
     *      3. Daily limit: 1 quiz per day per song
     *      4. Time limit: submittedAt - questionShownAt <= 15 seconds
     * @param geniusId Genius API song ID
     * @param user User's address
     * @param questionIndex Which question was answered
     * @param displayLanguage Which language translation user saw (for analytics)
     * @param correct Whether answer was correct
     * @param submittedAt When user submitted answer (PKP-signed timestamp)
     * @param questionShownAt When question was shown (PKP-signed timestamp)
     */
    function recordQuizCompletion(
        uint32 geniusId,
        address user,
        uint32 questionIndex,
        string calldata displayLanguage,
        bool correct,
        uint64 submittedAt,
        uint64 questionShownAt
    ) external onlyTrustedQuizMaster whenNotPaused {
        require(user != address(0), "Invalid user");
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(questions[geniusId][questionIndex].exists, "Question does not exist");
        require(questions[geniusId][questionIndex].enabled, "Question is disabled");
        require(translations[geniusId][questionIndex][displayLanguage].exists, "Translation does not exist");

        // ACCESS CONTROL 1: Study gating (must speak lyrics before quiz)
        require(IStudyProgress(studyProgress).studiedToday(user), "Must study before quiz");

        // ACCESS CONTROL 2: Time limit validation
        require(submittedAt >= questionShownAt, "Invalid timestamps");
        require(submittedAt - questionShownAt <= TIME_LIMIT_SECONDS, "Time limit exceeded");

        uint256 currentDay = getDayNumber(uint64(block.timestamp));
        bytes32 dailyHash = getDailyCompletionHash(geniusId, user, currentDay);

        // ACCESS CONTROL 3: Daily limit (1 quiz per song per day)
        require(!dailyCompletion[dailyHash], "Already completed quiz today for this song");

        SongProgress storage userProgress = progress[geniusId][user];

        // ACCESS CONTROL 4: Sequential unlock - skip disabled questions
        uint32 expectedIndex = userProgress.nextQuestionIndex;
        while (expectedIndex < questionIndex &&
               (!questions[geniusId][expectedIndex].exists ||
                !questions[geniusId][expectedIndex].enabled)) {
            expectedIndex++;
        }
        require(questionIndex == expectedIndex, "Must complete questions in order");

        // Mark daily completion
        dailyCompletion[dailyHash] = true;

        // Update progress
        userProgress.questionsCompleted++;
        if (correct) {
            userProgress.questionsCorrect++;
        }

        // Store user's preferred language (for future sessions)
        if (bytes(userProgress.preferredLanguage).length == 0) {
            userProgress.preferredLanguage = displayLanguage;
        }

        // Increment to next enabled question (skip disabled ones)
        uint32 nextIndex = questionIndex + 1;
        while (nextIndex < questionCount[geniusId] &&
               questions[geniusId][nextIndex].exists &&
               !questions[geniusId][nextIndex].enabled) {
            nextIndex++;
        }
        userProgress.nextQuestionIndex = nextIndex;

        // Update streak
        uint256 lastQuizDay = getDayNumber(userProgress.lastQuizTimestamp);
        uint256 dayDifference = currentDay - lastQuizDay;
        bool isNewRecord = false;

        if (userProgress.questionsCompleted == 1) {
            userProgress.currentStreak = 1;
            userProgress.longestStreak = 1;
        } else if (dayDifference == 0) {
            revert("Already quizzed today");
        } else if (dayDifference == 1) {
            userProgress.currentStreak++;
            if (userProgress.currentStreak > userProgress.longestStreak) {
                userProgress.longestStreak = userProgress.currentStreak;
                isNewRecord = true;
            }
        } else {
            uint32 oldStreak = userProgress.currentStreak;
            userProgress.currentStreak = 1;
            emit StreakBroken(geniusId, songToArtist[geniusId], user, oldStreak, uint64(block.timestamp));
        }

        userProgress.lastQuizTimestamp = uint64(block.timestamp);

        // Update leaderboard
        (bool enteredTopTen, uint8 position) = _updateLeaderboard(
            leaderboards[geniusId],
            user,
            userProgress.currentStreak,
            userProgress.questionsCorrect,
            uint64(block.timestamp)
        );

        uint32 artistId = songToArtist[geniusId];
        emit QuizCompleted(
            geniusId,
            artistId,
            user,
            correct,
            questionIndex,
            displayLanguage,
            uint64(block.timestamp),
            userProgress.currentStreak,
            userProgress.questionsCorrect,
            userProgress.questionsCompleted,
            isNewRecord,
            enteredTopTen ? position : 255
        );
    }

    function _updateLeaderboard(
        LeaderboardEntry[10] storage leaderboard,
        address user,
        uint32 streak,
        uint32 questionsCorrect,
        uint64 timestamp
    ) private returns (bool enteredTopTen, uint8 position) {
        int8 existingPos = -1;
        uint8 lastFilledPos = 0;

        for (uint8 i = 0; i < 10; i++) {
            if (leaderboard[i].user == user) {
                existingPos = int8(i);
            }
            if (leaderboard[i].user != address(0)) {
                lastFilledPos = i;
            }
        }

        if (existingPos >= 0) {
            for (uint8 i = uint8(existingPos); i < 9; i++) {
                leaderboard[i] = leaderboard[i + 1];
            }
            leaderboard[9] = LeaderboardEntry(address(0), 0, 0, 0);
            if (lastFilledPos > 0) lastFilledPos--;
        }

        uint8 insertPos = 10;

        for (uint8 i = 0; i <= lastFilledPos && i < 10; i++) {
            if (
                leaderboard[i].user == address(0) ||
                streak > leaderboard[i].streak ||
                (streak == leaderboard[i].streak && questionsCorrect > leaderboard[i].questionsCorrect) ||
                (streak == leaderboard[i].streak && questionsCorrect == leaderboard[i].questionsCorrect && timestamp < leaderboard[i].lastActive)
            ) {
                insertPos = i;
                break;
            }
        }

        if (insertPos == 10 && lastFilledPos < 9) {
            insertPos = lastFilledPos + 1;
        }

        if (insertPos < 10) {
            for (uint8 i = 9; i > insertPos; i--) {
                leaderboard[i] = leaderboard[i - 1];
            }
            leaderboard[insertPos] = LeaderboardEntry(user, streak, questionsCorrect, timestamp);
            return (true, insertPos);
        }

        return (false, 255);
    }

    // ========================================================================
    // Query Functions
    // ========================================================================

    function getUserProgress(uint32 geniusId, address user)
        external
        view
        returns (SongProgress memory)
    {
        return progress[geniusId][user];
    }

    function getQuestion(uint32 geniusId, uint32 questionIndex)
        external
        view
        returns (Question memory)
    {
        return questions[geniusId][questionIndex];
    }

    function getTranslation(uint32 geniusId, uint32 questionIndex, string calldata languageCode)
        external
        view
        returns (QuestionTranslation memory)
    {
        return translations[geniusId][questionIndex][languageCode];
    }

    function getAvailableLanguages(uint32 geniusId, uint32 questionIndex)
        external
        view
        returns (string[] memory)
    {
        return _availableLanguages[geniusId][questionIndex];
    }

    function hasTranslation(uint32 geniusId, uint32 questionIndex, string calldata languageCode)
        external
        view
        returns (bool)
    {
        return translations[geniusId][questionIndex][languageCode].exists;
    }

    function getLeaderboard(uint32 geniusId)
        external
        view
        returns (LeaderboardEntry[10] memory)
    {
        return leaderboards[geniusId];
    }

    function completedQuizToday(uint32 geniusId, address user)
        external
        view
        returns (bool)
    {
        uint256 currentDay = getDayNumber(uint64(block.timestamp));
        bytes32 dailyHash = getDailyCompletionHash(geniusId, user, currentDay);
        return dailyCompletion[dailyHash];
    }

    function getLeaderboardSize(uint32 geniusId)
        external
        view
        returns (uint8 count)
    {
        LeaderboardEntry[10] memory board = leaderboards[geniusId];
        for (uint8 i = 0; i < 10; i++) {
            if (board[i].user == address(0)) {
                return i;
            }
        }
        return 10;
    }

    function getArtistSongs(uint32 geniusArtistId)
        external
        view
        returns (uint32[] memory)
    {
        return _artistSongs[geniusArtistId];
    }

    function getArtistName(uint32 geniusArtistId)
        external
        view
        returns (string memory)
    {
        return artistNames[geniusArtistId];
    }

    function getSongName(uint32 geniusId)
        external
        view
        returns (string memory)
    {
        return songNames[geniusId];
    }

    // ========================================================================
    // Admin Functions
    // ========================================================================

    function setStudyProgress(address newProgress) external onlyOwner {
        require(newProgress != address(0), "Invalid address");
        address oldProgress = studyProgress;
        studyProgress = newProgress;
        emit StudyProgressUpdated(oldProgress, newProgress);
    }

    function setTrustedQuizMaster(address newMaster) external onlyOwner {
        require(newMaster != address(0), "Invalid address");
        address oldMaster = trustedQuizMaster;
        trustedQuizMaster = newMaster;
        emit TrustedQuizMasterUpdated(oldMaster, newMaster);
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

    function resetUserProgress(uint32 geniusId, address user) external onlyOwner {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(user != address(0), "Invalid user");

        SongProgress storage userProgress = progress[geniusId][user];
        userProgress.questionsCompleted = 0;
        userProgress.questionsCorrect = 0;
        userProgress.currentStreak = 0;
        userProgress.longestStreak = 0;
        userProgress.lastQuizTimestamp = 0;
        userProgress.nextQuestionIndex = 0;
        userProgress.preferredLanguage = "";

        uint32 artistId = songToArtist[geniusId];
        emit UserProgressReset(geniusId, artistId, user, uint64(block.timestamp));
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}
