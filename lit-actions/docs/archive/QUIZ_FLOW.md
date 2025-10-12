# Complete Quiz Architecture Flow

## Answer Scrambling (CRITICAL FIX NEEDED)

**Current Issue**: All correct answers show as "A" because the LLM always generates `"correctAnswer": "A"`.

**Root Cause**: The LLM response has the correct answer in choice A, and we're storing it as-is without randomizing.

**Solution**: Add answer randomization in trivia-generator-v1.js BEFORE returning questions:

```javascript
// After parsing LLM response, scramble answers
function scrambleAnswers(questions) {
  return questions.map(q => {
    const choices = Object.entries(q.choices); // [["A", "answer1"], ["B", "answer2"], ...]
    const correctText = q.choices[q.correctAnswer]; // Get the actual correct answer text

    // Shuffle choices
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }

    // Rebuild choices object
    const newChoices = {};
    const letters = ['A', 'B', 'C', 'D'];
    let newCorrectAnswer = '';

    choices.forEach(([oldKey, value], index) => {
      newChoices[letters[index]] = value;
      if (value === correctText) {
        newCorrectAnswer = letters[index];
      }
    });

    return {
      ...q,
      choices: newChoices,
      correctAnswer: newCorrectAnswer
    };
  });
}

// In main execution:
const parsedQuestions = parseQuestions(content);
const scrambledQuestions = scrambleAnswers(parsedQuestions);
Lit.Actions.setResponse({ response: JSON.stringify({
  success: true,
  questions: scrambledQuestions,
  ...
})});
```

## Complete End-to-End Flow

### Phase 1: Question Generation (Admin/Offline)

```
┌─────────────────────────────────────────────────────────────┐
│ ADMIN: Generate Questions                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Admin runs: bun run test:trivia-gen --song-id 90986 \     │
│                --language vi                                 │
│                                                               │
│ 2. Test script fetches Genius API referents:                 │
│    GET https://api.genius.com/referents?song_id=90986        │
│    → Returns 3-50 referents with annotations                 │
│                                                               │
│ 3. Calls trivia-generator-v1.js Lit Action:                  │
│    jsParams: {                                               │
│      songId: 90986,                                          │
│      referents: [...],  // Max 3 for speed                   │
│      language: 'vi',                                         │
│      openrouterKey: encrypted                                │
│    }                                                          │
│                                                               │
│ 4. Lit Action:                                               │
│    a. Detects annotation language (en/zh/vi)                 │
│    b. Calls OpenRouter (grok-4-fast) with culturally-aware   │
│       prompt for target language                             │
│    c. Scrambles answers (A/B/C/D randomized) ← CRITICAL      │
│    d. Returns unencrypted questions                          │
│                                                               │
│ 5. Output saved to: output/questions-90986-vi.json          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ADMIN: Review Quality                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Admin manually reviews:                                      │
│ - ✓ Questions in target language (Vietnamese)                │
│ - ✓ Cultural context preserved                               │
│ - ✓ Plausible distractors                                    │
│ - ✓ Correct answers scrambled (not all A)                    │
│ - ✓ Explanations reference content, not choice letters       │
│                                                               │
│ If quality is poor:                                          │
│ - Regenerate with different model                            │
│ - Adjust prompt                                              │
│ - Manual fix in JSON file                                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ADMIN: Encrypt & Store On-Chain                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Admin approves questions → runs question-encryptor-v1.js  │
│                                                               │
│ 2. Lit Action (via PKP):                                     │
│    For each question:                                        │
│      a. Encrypt via Lit.Actions.encrypt()                    │
│         - Returns: ciphertext, dataToEncryptHash             │
│      b. Generate referentHash = keccak256(source, refId)     │
│                                                               │
│ 3. PKP signs transaction:                                    │
│    songQuiz.addQuestions(                                    │
│      geniusId: 90986,                                        │
│      ciphertexts: [...],                                     │
│      dataToEncryptHashes: [...],                             │
│      referentHashes: [...]                                   │
│    )                                                          │
│                                                               │
│ 4. Contract stores:                                          │
│    questions[90986][0] = {                                   │
│      ciphertext: "0x...",                                    │
│      dataToEncryptHash: "0x...",                             │
│      referentHash: keccak256(...),                           │
│      addedAt: timestamp,                                     │
│      exists: true,                                           │
│      enabled: true                                           │
│    }                                                          │
│    questionCount[90986] = 3                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: User Quiz Flow (Live/User-Facing)

```
┌─────────────────────────────────────────────────────────────┐
│ USER: Study Session (Prerequisites)                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. User completes SayItBack exercise:                        │
│    - Speak lyrics with TTS feedback                          │
│    - StudyProgress contract: studiedToday[user] = true       │
│                                                               │
│ 2. This is REQUIRED before quiz:                             │
│    - Anti-bot: TTS is expensive/detectable                   │
│    - Economic barrier: TTS cost > quiz rewards               │
│    - Behavioral data for bot detection                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ USER: Request Next Question                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Frontend checks:                                          │
│    progress = songQuiz.getUserProgress(90986, userAddress)   │
│    → nextQuestionIndex = 0                                   │
│                                                               │
│ 2. Frontend calls quiz-validator-v1.js:                      │
│    jsParams: {                                               │
│      action: 'getNextQuestion',                              │
│      geniusId: 90986,                                        │
│      userAddress: '0x...'                                    │
│    }                                                          │
│                                                               │
│ 3. Lit Action (quiz-validator-v1.js):                        │
│    a. Query progress.nextQuestionIndex                       │
│       → Returns: 0 (first question)                          │
│                                                               │
│    b. Check sequential unlock:                               │
│       - User CANNOT request questionIndex=1 without          │
│         completing questionIndex=0 first                     │
│       - Contract enforces: questionIndex == nextQuestionIndex│
│                                                               │
│    c. Skip disabled questions:                               │
│       while (!questions[geniusId][index].enabled) {          │
│         index++                                              │
│       }                                                       │
│                                                               │
│    d. Fetch encrypted question:                              │
│       encQ = songQuiz.getQuestion(90986, 0)                  │
│       → ciphertext, dataToEncryptHash                        │
│                                                               │
│    e. Decrypt via PKP:                                       │
│       decrypted = Lit.Actions.decrypt({                      │
│         ciphertext: encQ.ciphertext,                         │
│         dataToEncryptHash: encQ.dataToEncryptHash,           │
│         ...                                                  │
│       })                                                      │
│                                                               │
│    f. Record timestamp:                                      │
│       questionShownAt = Date.now()                           │
│                                                               │
│    g. Return to user:                                        │
│       {                                                      │
│         question: "Trong bài hát...",                        │
│         choices: {                                           │
│           "A": "Đáp án 1",  ← Scrambled!                     │
│           "B": "Đáp án 2",                                   │
│           "C": "Đáp án 3",                                   │
│           "D": "Đáp án 4"                                    │
│         },                                                    │
│         questionShownAt: 1704123456789,                      │
│         questionIndex: 0                                     │
│       }                                                       │
│                                                               │
│ 4. Frontend displays question + starts 15-second timer       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ USER: Submit Answer                                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. User selects answer (e.g., "C") within 15 seconds         │
│                                                               │
│ 2. Frontend calls quiz-validator-v1.js:                      │
│    jsParams: {                                               │
│      action: 'validateAnswer',                               │
│      geniusId: 90986,                                        │
│      userAddress: '0x...',                                   │
│      questionIndex: 0,                                       │
│      userAnswer: 'C',                                        │
│      submittedAt: 1704123469000,  // 12s later               │
│      questionShownAt: 1704123456789                          │
│    }                                                          │
│                                                               │
│ 3. Lit Action (quiz-validator-v1.js):                        │
│    a. Decrypt question again to get correct answer           │
│    b. Validate time limit:                                   │
│       elapsed = submittedAt - questionShownAt                │
│       if (elapsed > 15000) reject                            │
│       → 12s is OK (includes ~2-3s network overhead)          │
│                                                               │
│    c. Check answer:                                          │
│       correct = (userAnswer === decrypted.correctAnswer)     │
│       → correct = true (if user picked right letter)         │
│                                                               │
│    d. PKP signs transaction:                                 │
│       songQuiz.recordQuizCompletion(                         │
│         geniusId: 90986,                                     │
│         user: '0x...',                                       │
│         questionIndex: 0,                                    │
│         correct: true,                                       │
│         submittedAt: 1704123469000,                          │
│         questionShownAt: 1704123456789                       │
│       )                                                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ CONTRACT: Record Completion & Update Progress                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. Validate (in recordQuizCompletion):                       │
│    ✓ msg.sender == trustedQuizMaster (PKP only)              │
│    ✓ studiedToday(user) == true (study gating)               │
│    ✓ submittedAt - questionShownAt <= 15 (time limit)        │
│    ✓ questionIndex == nextQuestionIndex (sequential)         │
│    ✓ !dailyCompletion[hash] (1 quiz/day/song)                │
│                                                               │
│ 2. Update progress:                                          │
│    progress[90986][user].questionsCompleted = 1              │
│    progress[90986][user].questionsCorrect = 1                │
│    progress[90986][user].nextQuestionIndex = 1 ← INCREMENTED │
│    progress[90986][user].currentStreak = 1                   │
│    progress[90986][user].lastQuizTimestamp = now             │
│                                                               │
│ 3. Mark daily completion:                                    │
│    dailyCompletion[keccak256(90986, user, dayNumber)] = true │
│                                                               │
│ 4. Update leaderboard (if top 10)                            │
│                                                               │
│ 5. Emit QuizCompleted event                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ USER: Next Day - Question 2                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ 1. User completes SayItBack again (new day)                  │
│                                                               │
│ 2. Frontend checks:                                          │
│    progress.nextQuestionIndex = 1  ← Now unlocked Q2         │
│                                                               │
│ 3. User CAN decrypt question 1 because:                      │
│    - questionIndex (1) == nextQuestionIndex (1) ✓            │
│                                                               │
│ 4. User CANNOT decrypt question 2 yet because:               │
│    - questionIndex (2) != nextQuestionIndex (1) ✗            │
│    - Must complete Q1 first                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Sequential Unlocking Mechanism

**How it works**:

1. **Contract enforces sequential access** (SongQuizV1.sol:469-476):
   ```solidity
   uint32 expectedIndex = userProgress.nextQuestionIndex;

   // Skip disabled questions
   while (expectedIndex < questionIndex &&
          (!questions[geniusId][expectedIndex].exists ||
           !questions[geniusId][expectedIndex].enabled)) {
       expectedIndex++;
   }

   require(questionIndex == expectedIndex, "Must complete questions in order");
   ```

2. **PKP decryption is permissionless BUT**:
   - PKP can decrypt ANY question (it has the key)
   - BUT contract REJECTS recording results if out of order
   - This means: User can see Q2 early, but CAN'T submit answer

3. **Recommended frontend flow**:
   ```javascript
   // Only request questions user can complete
   const progress = await songQuiz.getUserProgress(geniusId, user);
   const nextIndex = progress.nextQuestionIndex;

   // Only decrypt nextQuestionIndex
   const question = await litClient.executeJs({
     code: quizValidatorCode,
     jsParams: {
       action: 'getNextQuestion',
       questionIndex: nextIndex  // ← Enforced by frontend
     }
   });
   ```

4. **Skip disabled questions automatically**:
   - If admin disables Q1, contract auto-skips to Q2
   - nextQuestionIndex increments past disabled questions
   - User doesn't see disabled questions at all

## Study Gating Implementation

**How it works**:

1. **StudyProgress contract** (separate contract):
   ```solidity
   mapping(address => uint64) public lastStudyTimestamp;

   function studiedToday(address user) external view returns (bool) {
     uint256 lastDay = getDayNumber(lastStudyTimestamp[user]);
     uint256 currentDay = getDayNumber(block.timestamp);
     return lastDay == currentDay;
   }
   ```

2. **SayItBack updates StudyProgress**:
   - User speaks lyrics → karaoke-scorer-v4.js validates
   - PKP calls: `studyProgress.recordStudy(user)`
   - Sets: `lastStudyTimestamp[user] = block.timestamp`

3. **Quiz checks study gating** (SongQuizV1.sol:452):
   ```solidity
   require(
     IStudyProgress(studyProgress).studiedToday(user),
     "Must study before quiz"
   );
   ```

4. **This creates 3-layer anti-bot defense**:
   - Layer 1: Must use TTS (expensive)
   - Layer 2: Must speak correctly (behavioral data)
   - Layer 3: Must wait for quiz unlock (economic barrier)

## Question Regeneration Rules

**Based on annotation count** (reasonable rule of thumb):

```javascript
// Suggested rule: 1 question per 3-5 annotations
const maxQuestions = Math.floor(annotationCount / 3);

// Examples:
// Song with 15 annotations → 5 questions max
// Song with 30 annotations → 10 questions max
// Song with 9 annotations → 3 questions max
```

**When to generate more questions**:

1. **User completed all questions**:
   ```javascript
   if (progress.nextQuestionIndex >= questionCount[geniusId]) {
     // User finished all questions
     // Check if more annotations available:
     const referents = await genius.getReferents(geniusId);
     const unused = referents.filter(ref =>
       !usedReferentHashes.includes(keccak256(ref.id))
     );

     if (unused.length >= 3) {
       // Generate 3 more questions from unused annotations
     }
   }
   ```

2. **Admin replaces bad question**:
   ```javascript
   // Don't increment questionCount
   // Just replace existing question at same index
   songQuiz.replaceQuestion(geniusId, index, newCiphertext, newHash);
   ```

3. **Admin disables bad question**:
   ```javascript
   // Don't decrement questionCount
   // Just mark enabled=false
   songQuiz.disableQuestion(geniusId, index);
   // Sequential unlock will skip it automatically
   ```

**Preventing question exhaustion**:

```solidity
// Contract could track referent usage
mapping(uint32 => mapping(bytes32 => bool)) public usedReferents;

// When adding questions:
for (uint i = 0; i < referentHashes.length; i++) {
  require(!usedReferents[geniusId][referentHashes[i]], "Referent already used");
  usedReferents[geniusId][referentHashes[i]] = true;
}
```

## Language Management

**Current approach** (IMPLICIT - NOT STORED ON-CHAIN):

1. **Questions DO NOT store language on-chain**
2. **Language is determined by**:
   - Frontend knows: "This song is Vietnamese"
   - Frontend requests questions in Vietnamese
   - Questions are generated in Vietnamese
   - Encrypted questions don't include language metadata

**Problem with current approach**:
- Frontend must maintain song→language mapping
- No way to query "What language is this quiz?"
- Can't mix languages per song

**Recommended improvement** (ADD TO CONTRACT):

```solidity
struct EncryptedQuestion {
  string ciphertext;
  string dataToEncryptHash;
  bytes32 referentHash;
  uint64 addedAt;
  bool exists;
  bool enabled;
  string language;  // ← ADD THIS: "en", "zh-CN", "vi"
}

function addQuestions(
  uint32 geniusId,
  string[] calldata ciphertexts,
  string[] calldata dataToEncryptHashes,
  bytes32[] calldata referentHashes,
  string[] calldata languages  // ← ADD THIS
) external onlyTrustedQuizMaster whenNotPaused {
  // ...
  questions[geniusId][questionIndex] = EncryptedQuestion({
    ciphertext: ciphertexts[i],
    dataToEncryptHash: dataToEncryptHashes[i],
    referentHash: referentHashes[i],
    addedAt: uint64(block.timestamp),
    exists: true,
    enabled: true,
    language: languages[i]  // ← STORE LANGUAGE
  });
}
```

**Benefits**:
1. Frontend can query: `getQuestion(90986, 0).language` → "vi"
2. Can support multilingual quizzes (3 Vietnamese + 3 English)
3. Can filter questions by language
4. Better UX: "This question is in Vietnamese"

**Alternative approach** (SONG-LEVEL LANGUAGE):

```solidity
mapping(uint32 => string) public songLanguages;  // geniusId → "vi"

function registerSong(
  uint32 geniusId,
  uint32 geniusArtistId,
  string calldata songName,
  string calldata artistName,
  string calldata language  // ← ADD THIS
) external onlyOwnerOrQuizMaster {
  songLanguages[geniusId] = language;
  // ...
}
```

This assumes: All questions for a song are in the same language.

## Critical Issues to Fix

1. **✅ DONE**: Generate high-quality questions from real Genius data
2. **❌ TODO**: Scramble answers (all showing as "A")
3. **❌ TODO**: Add language storage to contract
4. **❌ TODO**: Implement question-encryptor-v1.js
5. **❌ TODO**: Implement quiz-validator-v1.js
6. **❌ TODO**: Add referent tracking to prevent duplication
7. **❌ TODO**: Define question regeneration limits per song
