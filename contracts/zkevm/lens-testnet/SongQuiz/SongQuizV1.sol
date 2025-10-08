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
 * @title SongQuizV1
 * @notice Daily song quiz challenges with artist-level aggregation
 * @dev V1: Per-song quiz tracking with events optimized for The Graph indexing
 *
 * Architecture Decision:
 * - Tracks quizzes PER SONG (geniusId) for fairness - questions match what user studied
 * - Emits geniusArtistId in events for off-chain aggregation (artist leaderboards)
 * - On-chain artist→songs mapping enables both direct queries AND Graph indexing
 *
 * Mechanics:
 * - 1 quiz per day per SONG (not per artist - users can quiz multiple songs/day)
 * - 15 second time limit (prevents lookup/AI, accounts for network latency ~2-3s)
 * - Sequential unlock (must complete Q1 before Q2 for each song)
 * - Gated by SayItBack completion (must study before quiz - strong anti-bot defense)
 * - Encrypted questions (can't see ahead)
 *
 * Anti-Cheat Design:
 * - Study gating requires TTS (expensive/detectable) - blocks casual bots
 * - Time limit prevents Genius lookup, ChatGPT queries, or Google searches
 * - Daily limit prevents grinding - forces genuine daily engagement
 * - PKP validates answers off-chain (can't forge results without PKP key)
 * - Owner can disable bad questions (PKP cannot - security isolation)
 *
 * Question Flow:
 * 1. Lit Action generates questions from Genius referents for a specific song
 * 2. Encrypts each question via Lit.Actions.encrypt()
 * 3. Stores encrypted questions on-chain (per song)
 * 4. User must complete SayItBack study session (speak lyrics)
 * 5. User requests quiz → PKP decrypts ONLY next question
 * 6. User answers within 15 seconds (includes ~2-3s network overhead)
 * 7. PKP validates answer + time → signs result → records on-chain
 *
 * Integration:
 * - StudyProgress: Checks studiedToday() for gating
 * - The Graph: Events include both geniusId + geniusArtistId for artist aggregation
 * - Frontend: Can query per-song leaderboards OR aggregate across artist's songs
 */
contract SongQuizV1 {
    // ========================================================================
    // Types & Structs
    // ========================================================================

    /**
     * @notice Encrypted quiz question
     */
    struct EncryptedQuestion {
        string ciphertext;          // Lit-encrypted question JSON
        string dataToEncryptHash;   // Verification hash
        bytes32 referentHash;       // keccak256(source, referentId) - tracks origin
        uint64 addedAt;             // When question was added
        bool exists;                // Question exists flag
        bool enabled;               // Question is active (for soft delete)
    }

    /**
     * @notice User progress for a song
     */
    struct SongProgress {
        uint32 questionsCompleted;  // Total questions completed for this song
        uint32 questionsCorrect;    // Total correct answers for this song
        uint32 currentStreak;       // Current daily streak for this song
        uint32 longestStreak;       // Best streak achieved for this song
        uint64 lastQuizTimestamp;   // Last quiz completion (UTC timestamp)
        uint32 nextQuestionIndex;   // Next question to unlock (0-based)
    }

    /**
     * @notice Leaderboard entry (per song)
     */
    struct LeaderboardEntry {
        address user;
        uint32 streak;              // Current streak for this song
        uint32 questionsCorrect;    // Total correct for this song
        uint64 lastActive;          // Last quiz timestamp
    }

    // ========================================================================
    // State
    // ========================================================================

    // Song metadata
    mapping(uint32 => string) public songNames;          // geniusId => song name
    mapping(uint32 => uint32) public songToArtist;       // geniusId => geniusArtistId
    mapping(uint32 => string) public artistNames;        // geniusArtistId => artist name

    // Artist → Songs mapping (enables artist page queries)
    mapping(uint32 => uint32[]) private _artistSongs;    // geniusArtistId => [geniusId, ...]

    // Questions: geniusId => questionIndex => EncryptedQuestion
    mapping(uint32 => mapping(uint32 => EncryptedQuestion)) public questions;
    mapping(uint32 => uint32) public questionCount;      // geniusId => total questions

    // User progress: geniusId => user => SongProgress
    mapping(uint32 => mapping(address => SongProgress)) public progress;

    // Leaderboards: geniusId => LeaderboardEntry[10]
    mapping(uint32 => LeaderboardEntry[10]) public leaderboards;

    // Daily completion tracking: keccak256(geniusId, user, dayNumber) => completed
    mapping(bytes32 => bool) public dailyCompletion;

    // StudyProgress reference (for gating)
    address public studyProgress;

    address public trustedQuizMaster;  // PKP address
    address public owner;
    bool public paused;

    uint8 public constant TIME_LIMIT_SECONDS = 15;  // Answer time limit (accounts for network latency)

    // ========================================================================
    // Events (Graph-Optimized)
    // ========================================================================

    /**
     * @notice Song registered with artist metadata
     * @dev Graph indexer uses this to build Artist and Song entities
     */
    event SongRegistered(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        string songName,
        string artistName,
        uint64 timestamp
    );

    /**
     * @notice Questions added for a song
     * @dev Graph indexer can track question inventory
     */
    event QuestionsAdded(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 startIndex,
        uint32 count,
        uint64 timestamp
    );

    /**
     * @notice Quiz completed for a song
     * @dev Graph indexer uses this to aggregate artist-level stats
     * Includes computed values (songStreak, totalCorrect) for efficient indexing
     */
    event QuizCompleted(
        uint32 indexed geniusId,           // Song ID
        uint32 indexed geniusArtistId,     // Artist ID (for aggregation)
        address indexed user,
        bool correct,
        uint32 questionIndex,
        uint64 timestamp,
        uint32 songStreak,                 // User's current streak for THIS song
        uint32 songTotalCorrect,           // User's total correct for THIS song
        uint32 songTotalCompleted,         // User's total completed for THIS song
        bool isNewRecord,                  // Did user beat their longest streak?
        uint8 leaderboardPosition          // 0-9 if in top 10, 255 if not
    );

    /**
     * @notice Streak broken for a song
     * @dev Graph indexer can track engagement patterns
     */
    event StreakBroken(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        address indexed user,
        uint32 oldStreak,
        uint64 timestamp
    );

    event QuestionDisabled(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 questionIndex,
        uint64 timestamp
    );

    event QuestionEnabled(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 questionIndex,
        uint64 timestamp
    );

    event QuestionReplaced(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        uint32 questionIndex,
        uint64 timestamp
    );

    event UserProgressReset(
        uint32 indexed geniusId,
        uint32 indexed geniusArtistId,
        address indexed user,
        uint64 timestamp
    );

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

    /**
     * @notice Get day number from timestamp (UTC)
     */
    function getDayNumber(uint64 timestamp) public pure returns (uint256) {
        return uint256(timestamp) / 1 days;
    }

    /**
     * @notice Generate daily completion hash
     */
    function getDailyCompletionHash(uint32 geniusId, address user, uint256 dayNumber)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(geniusId, user, dayNumber));
    }

    // ========================================================================
    // Song & Artist Management (Owner Only)
    // ========================================================================

    /**
     * @notice Register a song with artist metadata
     * @dev Creates bidirectional song↔artist mapping for queries and indexing
     * @dev Can be called by owner (native songs) or quiz master (Genius songs)
     * @param geniusId Genius API song ID
     * @param geniusArtistId Genius API artist ID
     * @param songName Display name for song
     * @param artistName Display name for artist
     */
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

        // Update artist name if not set (or first song for this artist)
        if (bytes(artistNames[geniusArtistId]).length == 0) {
            artistNames[geniusArtistId] = artistName;
        }

        // Add song to artist's song list (if not already present)
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

    /**
     * @notice Add encrypted questions for a song (quiz master only)
     * @param geniusId Genius API song ID
     * @param ciphertexts Array of encrypted question JSONs
     * @param dataToEncryptHashes Array of verification hashes
     * @param referentHashes Array of source referent hashes
     */
    function addQuestions(
        uint32 geniusId,
        string[] calldata ciphertexts,
        string[] calldata dataToEncryptHashes,
        bytes32[] calldata referentHashes
    ) external onlyTrustedQuizMaster whenNotPaused {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(ciphertexts.length == dataToEncryptHashes.length, "Array length mismatch");
        require(ciphertexts.length == referentHashes.length, "Array length mismatch");
        require(ciphertexts.length > 0, "Empty questions array");
        require(ciphertexts.length <= 100, "Batch too large");

        uint32 startIndex = questionCount[geniusId];

        for (uint256 i = 0; i < ciphertexts.length; i++) {
            uint32 questionIndex = startIndex + uint32(i);

            questions[geniusId][questionIndex] = EncryptedQuestion({
                ciphertext: ciphertexts[i],
                dataToEncryptHash: dataToEncryptHashes[i],
                referentHash: referentHashes[i],
                addedAt: uint64(block.timestamp),
                exists: true,
                enabled: true
            });
        }

        questionCount[geniusId] = startIndex + uint32(ciphertexts.length);

        uint32 artistId = songToArtist[geniusId];
        emit QuestionsAdded(geniusId, artistId, startIndex, uint32(ciphertexts.length), uint64(block.timestamp));
    }

    /**
     * @notice Disable a question (soft delete, owner only)
     * @dev Sequential unlock will skip disabled questions automatically
     * @dev PKP cannot disable questions (security: prevents malicious question removal)
     * @param geniusId Genius API song ID
     * @param questionIndex Question index to disable
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
     * @param geniusId Genius API song ID
     * @param questionIndex Question index to enable
     */
    function enableQuestion(uint32 geniusId, uint32 questionIndex) external onlyOwner {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(questions[geniusId][questionIndex].exists, "Question does not exist");
        require(!questions[geniusId][questionIndex].enabled, "Question already enabled");

        questions[geniusId][questionIndex].enabled = true;

        uint32 artistId = songToArtist[geniusId];
        emit QuestionEnabled(geniusId, artistId, questionIndex, uint64(block.timestamp));
    }

    /**
     * @notice Replace a bad question with a new one (owner only)
     * @dev Maintains same index and referent hash (for tracking)
     * @dev Use this to fix typos, unclear wording, or incorrect distractors
     * @param geniusId Genius API song ID
     * @param questionIndex Question index to replace
     * @param ciphertext New encrypted question JSON
     * @param dataToEncryptHash New verification hash
     */
    function replaceQuestion(
        uint32 geniusId,
        uint32 questionIndex,
        string calldata ciphertext,
        string calldata dataToEncryptHash
    ) external onlyOwner {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(questions[geniusId][questionIndex].exists, "Question does not exist");

        EncryptedQuestion storage question = questions[geniusId][questionIndex];
        question.ciphertext = ciphertext;
        question.dataToEncryptHash = dataToEncryptHash;
        question.addedAt = uint64(block.timestamp);
        question.enabled = true;

        uint32 artistId = songToArtist[geniusId];
        emit QuestionReplaced(geniusId, artistId, questionIndex, uint64(block.timestamp));
    }

    // ========================================================================
    // Quiz Completion (Quiz Master Only)
    // ========================================================================

    /**
     * @notice Record quiz completion (quiz master only)
     * @dev Called by PKP after validating answer + time limit off-chain
     * @dev Time validation: submittedAt - questionShownAt <= 15 seconds
     * @dev Study gating: User must have completed SayItBack exercises today
     * @param geniusId Genius API song ID
     * @param user User's address
     * @param questionIndex Which question was answered
     * @param correct Whether answer was correct (binary: no partial credit)
     * @param submittedAt When user submitted answer (PKP-signed timestamp)
     * @param questionShownAt When question was shown to user (PKP-signed timestamp)
     */
    function recordQuizCompletion(
        uint32 geniusId,
        address user,
        uint32 questionIndex,
        bool correct,
        uint64 submittedAt,
        uint64 questionShownAt
    ) external onlyTrustedQuizMaster whenNotPaused {
        require(user != address(0), "Invalid user");
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(questions[geniusId][questionIndex].exists, "Question does not exist");
        require(questions[geniusId][questionIndex].enabled, "Question is disabled");

        // ANTI-CHEAT: Study gating (must speak lyrics before quiz)
        // - Requires TTS for bots (expensive/detectable)
        // - Creates behavioral data for bot detection
        // - Economic barrier: TTS costs > quiz rewards
        require(IStudyProgress(studyProgress).studiedToday(user), "Must study before quiz");

        // ANTI-CHEAT: Time limit validation (15s = ~12-13s actual thinking time)
        // - Network overhead: ~2-3 seconds (PKP round trips)
        // - Prevents: Genius lookup, ChatGPT queries, Google searches
        // - Allows: Reading question + 4 answers + thinking
        require(submittedAt >= questionShownAt, "Invalid timestamps");
        require(submittedAt - questionShownAt <= TIME_LIMIT_SECONDS, "Time limit exceeded");

        uint256 currentDay = getDayNumber(uint64(block.timestamp));
        bytes32 dailyHash = getDailyCompletionHash(geniusId, user, currentDay);

        // Check daily limit (1 quiz per song per day)
        require(!dailyCompletion[dailyHash], "Already completed quiz today for this song");

        SongProgress storage userProgress = progress[geniusId][user];

        // Check sequential unlock - skip disabled questions
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
            // First quiz ever for this song
            userProgress.currentStreak = 1;
            userProgress.longestStreak = 1;
        } else if (dayDifference == 0) {
            // Same day (shouldn't happen due to dailyCompletion check, but defensive)
            revert("Already quizzed today");
        } else if (dayDifference == 1) {
            // Next day - increment streak
            userProgress.currentStreak++;
            if (userProgress.currentStreak > userProgress.longestStreak) {
                userProgress.longestStreak = userProgress.currentStreak;
                isNewRecord = true;
            }
        } else {
            // Skipped days - reset streak
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
            uint64(block.timestamp),
            userProgress.currentStreak,        // Song-specific streak
            userProgress.questionsCorrect,     // Song-specific correct count
            userProgress.questionsCompleted,   // Song-specific completed count
            isNewRecord,
            enteredTopTen ? position : 255
        );
    }

    /**
     * @notice Update leaderboard (internal)
     * @dev Sorted by: 1) current streak (desc), 2) total correct (desc), 3) last active (asc)
     */
    function _updateLeaderboard(
        LeaderboardEntry[10] storage leaderboard,
        address user,
        uint32 streak,
        uint32 questionsCorrect,
        uint64 timestamp
    ) private returns (bool enteredTopTen, uint8 position) {
        // Find user's existing position
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

        // Remove old entry if exists
        if (existingPos >= 0) {
            for (uint8 i = uint8(existingPos); i < 9; i++) {
                leaderboard[i] = leaderboard[i + 1];
            }
            leaderboard[9] = LeaderboardEntry(address(0), 0, 0, 0);
            if (lastFilledPos > 0) lastFilledPos--;
        }

        // Find insertion position
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

        // Append to end if not full
        if (insertPos == 10 && lastFilledPos < 9) {
            insertPos = lastFilledPos + 1;
        }

        // Insert if position found
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

    /**
     * @notice Get user's progress for a song
     */
    function getUserProgress(uint32 geniusId, address user)
        external
        view
        returns (SongProgress memory)
    {
        return progress[geniusId][user];
    }

    /**
     * @notice Get encrypted question
     */
    function getQuestion(uint32 geniusId, uint32 questionIndex)
        external
        view
        returns (EncryptedQuestion memory)
    {
        return questions[geniusId][questionIndex];
    }

    /**
     * @notice Get leaderboard for a song
     */
    function getLeaderboard(uint32 geniusId)
        external
        view
        returns (LeaderboardEntry[10] memory)
    {
        return leaderboards[geniusId];
    }

    /**
     * @notice Check if user completed quiz today for this song
     */
    function completedQuizToday(uint32 geniusId, address user)
        external
        view
        returns (bool)
    {
        uint256 currentDay = getDayNumber(uint64(block.timestamp));
        bytes32 dailyHash = getDailyCompletionHash(geniusId, user, currentDay);
        return dailyCompletion[dailyHash];
    }

    /**
     * @notice Get effective leaderboard size for a song
     */
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

    /**
     * @notice Get all songs by an artist
     * @dev Enables artist page queries - fetch all songs, then aggregate stats
     * @param geniusArtistId Genius API artist ID
     * @return Array of Genius song IDs for this artist
     */
    function getArtistSongs(uint32 geniusArtistId)
        external
        view
        returns (uint32[] memory)
    {
        return _artistSongs[geniusArtistId];
    }

    /**
     * @notice Get songs by an artist with pagination
     * @dev For artists with many songs (e.g. 200+), use pagination to avoid gas limits
     * @param geniusArtistId Genius API artist ID
     * @param offset Starting index (0-based)
     * @param limit Max number of songs to return
     * @return songs Array of Genius song IDs
     * @return total Total number of songs for this artist
     */
    function getArtistSongsPaginated(
        uint32 geniusArtistId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint32[] memory songs, uint256 total) {
        uint32[] storage allSongs = _artistSongs[geniusArtistId];
        total = allSongs.length;

        if (offset >= total) {
            return (new uint32[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 resultLength = end - offset;
        songs = new uint32[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            songs[i] = allSongs[offset + i];
        }

        return (songs, total);
    }

    /**
     * @notice Get artist name by ID
     */
    function getArtistName(uint32 geniusArtistId)
        external
        view
        returns (string memory)
    {
        return artistNames[geniusArtistId];
    }

    /**
     * @notice Get song name by ID
     */
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

    /**
     * @notice Update StudyProgress address (owner only)
     */
    function setStudyProgress(address newProgress) external onlyOwner {
        require(newProgress != address(0), "Invalid address");
        address oldProgress = studyProgress;
        studyProgress = newProgress;
        emit StudyProgressUpdated(oldProgress, newProgress);
    }

    /**
     * @notice Update trusted quiz master address (owner only)
     */
    function setTrustedQuizMaster(address newMaster) external onlyOwner {
        require(newMaster != address(0), "Invalid address");
        address oldMaster = trustedQuizMaster;
        trustedQuizMaster = newMaster;
        emit TrustedQuizMasterUpdated(oldMaster, newMaster);
    }

    /**
     * @notice Pause quiz completions (owner only, emergency use)
     */
    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @notice Unpause quiz completions (owner only)
     */
    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @notice Reset user progress for a song (GDPR / testing)
     * @dev Clears all progress but keeps leaderboard entry (for historical record)
     * @param geniusId Genius API song ID
     * @param user User address to reset
     */
    function resetUserProgress(uint32 geniusId, address user) external onlyOwner {
        require(bytes(songNames[geniusId]).length > 0, "Song not registered");
        require(user != address(0), "Invalid user");

        // Reset progress struct
        SongProgress storage userProgress = progress[geniusId][user];
        userProgress.questionsCompleted = 0;
        userProgress.questionsCorrect = 0;
        userProgress.currentStreak = 0;
        userProgress.longestStreak = 0;
        userProgress.lastQuizTimestamp = 0;
        userProgress.nextQuestionIndex = 0;

        uint32 artistId = songToArtist[geniusId];
        emit UserProgressReset(geniusId, artistId, user, uint64(block.timestamp));
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
