# SongQuiz - Architecture

## Purpose

**Daily Song Quiz Challenges**: Prove you're a superfan through timed quiz questions on specific songs.

Unlike StudyProgress (learning/practice), this is **competitive gamification** where:
- Artists can identify their biggest fans across all their songs
- Fans build song-specific streaks (fair - matches what they studied)
- Right/wrong answers are on-chain (tamper-proof)
- Time pressure prevents AI/cheating

## Architecture Decision: Per-Song Tracking

**Key Design Choice:**
- **Track quizzes PER SONG** (not per artist)
- **Emit artist ID in events** for off-chain aggregation
- **Result**: Fair quizzes + efficient artist leaderboards via The Graph

**Why Per-Song?**
1. **Fairness**: Questions match what user studied (Genius referents are song-specific)
2. **Better UX**: User practices "Heat of the Night" → quizzes "Heat of the Night" (not random artist song)
3. **Scalability**: Direct queries work for small scale, The Graph for large scale
4. **Clean migration**: Events include both `geniusId` + `geniusArtistId` for future indexing

## Dual-Track System

```
┌─────────────────────────────────────────────────────────────┐
│                    Daily User Flow                           │
└─────────────────────────────────────────────────────────────┘

Morning: STUDY TRACK
  ↓
  User does SayItBack exercises for "Heat of the Night"
  → StudyProgressV1 records session + FSRS data
  → General study streak increments

Afternoon: QUIZ TRACK (unlocked after studying)
  ↓
  User requests quiz for "Heat of the Night" (specific song)
  → Check: Did they study today? (StudyProgress.studiedToday())
  → Check: Already quizzed THIS SONG today?
  → Check: Completed previous questions for THIS SONG?
  → If all pass: PKP decrypts next question
  → User has 15 seconds to answer
  → PKP validates + records result
  → Song-specific streak updates
  → Song leaderboard updates
  → Event emitted with artistId (for aggregation)
```

## Anti-Cheat Mechanics

### 1. Study Gating (Must Complete SayItBack First)
- Requires speaking lyrics out loud before quiz access
- **Strong anti-bot defense**: Bots need TTS (expensive/detectable)
- Creates behavioral data (timing, pauses, mistakes) for bot detection
- Economic barrier: TTS costs ($0.10-1.00) >> quiz rewards
- Enforced on-chain: `require(IStudyProgress(studyProgress).studiedToday(user))`

### 2. Time Pressure (15 seconds)
- Network overhead: ~2-3 seconds (PKP round trips)
- Actual thinking time: ~12-13 seconds
- Enough to read question + 4 answers + think
- Too short to: lookup on Genius, ask ChatGPT, Google search
- Enforced by PKP off-chain (timestamps signed by PKP)

### 3. Encrypted Questions
- Questions stored on-chain as ciphertext
- Can't read ahead to prepare
- PKP only decrypts NEXT question
- Sequential unlock enforced

### 4. Daily Limit
- 1 quiz per day per SONG (not per artist)
- Users can quiz multiple songs/day if they've studied them
- Creates scarcity per song (can't brute force same song)
- Incentivizes daily engagement across artist's catalog

### 5. Owner Question Management
- Owner can disable/enable/replace bad questions
- PKP cannot disable questions (security: prevents malicious removal)
- Sequential unlock automatically skips disabled questions

## Song & Artist Identification

**No More Hashing - Use Direct IDs**:
```solidity
// Songs tracked by Genius ID directly
uint32 geniusId = 12345;  // Song: "Heat of the Night"
uint32 geniusArtistId = 67890;  // Artist: "Scarlett X"

// On-chain mapping
mapping(uint32 => uint32) public songToArtist;  // geniusId => geniusArtistId
mapping(uint32 => uint32[]) private _artistSongs;  // artistId => [songIds...]
```

**Why Direct IDs (not hashing)?**
- Genius referents already use `geniusId` - natural key
- Simpler contract logic (no keccak256 needed)
- Easier to debug (can lookup on Genius directly)
- The Graph can easily join on these IDs

**Artist→Songs Mapping**:
```solidity
// Query all songs by an artist
function getArtistSongs(uint32 geniusArtistId)
    external
    view
    returns (uint32[] memory);

// Frontend then aggregates:
const songs = await contract.getArtistSongs(artistId);
const leaderboards = await Promise.all(
  songs.map(id => contract.getLeaderboard(id))
);
// Aggregate user stats across all songs
```

## Question Generation Flow

### 1. Genius Referent Analysis
```javascript
// In Lit Action: question-generator.js
const song = await fetchGeniusSong(geniusId);
const referents = await fetchReferents(geniusId);

const questions = [];

for (const referent of referents) {
  // Generate question from referent annotation
  const question = {
    question: "What does '{line}' mean?",
    answers: [
      referent.annotation.body,  // Correct
      generateDistractor1(),
      generateDistractor2(),
      generateDistractor3()
    ],
    correctIndex: 0,
    referentId: referent.id
  };

  // Shuffle answers
  shuffleAnswers(question);

  // Encrypt question
  const encrypted = await Lit.Actions.encrypt({
    accessControlConditions: [/* only PKP can decrypt */],
    to_encrypt: JSON.stringify(question)
  });

  questions.push({
    ciphertext: encrypted.ciphertext,
    dataToEncryptHash: encrypted.dataToEncryptHash,
    referentHash: keccak256(abi.encodePacked(ContentSource.Genius, referent.id))
  });
}

// Submit to contract (per song!)
await songQuiz.addQuestions(
  geniusId,  // ← Song ID, not artist!
  questions.map(q => q.ciphertext),
  questions.map(q => q.dataToEncryptHash),
  questions.map(q => q.referentHash)
);
```

### 2. LLM-Enhanced Questions (Future)
```javascript
// Use OpenRouter to generate more sophisticated questions
const question = await openRouter.generateQuestion({
  referent: referent,
  song: song,
  difficulty: "medium",
  type: "multiple-choice"
});
```

## Quiz Flow (Frontend → Lit Action → Contract)

### Step 1: User Requests Quiz

**Frontend**:
```typescript
// Check eligibility
const studiedToday = await studyProgress.studiedToday(userAddress);
const quizzedToday = await songQuiz.completedQuizToday(geniusId, userAddress);
const progress = await songQuiz.getUserProgress(geniusId, userAddress);

if (!studiedToday) {
  return "Complete your SayItBack exercises first!";
}

if (quizzedToday) {
  return "You've already quizzed this artist today. Come back tomorrow!";
}

// Request question from Lit Action
const response = await litClient.executeJs({
  code: quizActionCode,
  authContext: authContext,
  jsParams: {
    geniusId,
    questionIndex: progress.nextQuestionIndex,
    userAddress
  }
});

const { question, answers, questionShownAt } = response.response;

// Start 15 second timer
startTimer(15, () => {
  submitAnswer(null); // Time's up
});
```

### Step 2: User Answers

**Frontend**:
```typescript
const submittedAt = Math.floor(Date.now() / 1000);
const elapsedTime = submittedAt - questionShownAt;

if (elapsedTime > 15) {
  return "Time's up!";
}

// Submit to Lit Action for validation
await litClient.executeJs({
  code: validateAnswerCode,
  authContext: authContext,
  jsParams: {
    geniusId,
    questionIndex,
    selectedAnswer,
    questionShownAt,
    submittedAt
  }
});
```

### Step 3: PKP Validates & Records

**Lit Action**:
```javascript
const _litActionCode = async () => {
  const { geniusId, questionIndex, selectedAnswer, questionShownAt, submittedAt } = jsParams;

  // 1. Decrypt question to check answer
  const encryptedQuestion = await getQuestionFromContract(geniusId, questionIndex);
  const question = await Lit.Actions.decryptAndCombine({
    ciphertext: encryptedQuestion.ciphertext,
    dataToEncryptHash: encryptedQuestion.dataToEncryptHash,
    // ...
  });

  const questionData = JSON.parse(question);
  const correct = (selectedAnswer === questionData.correctIndex);

  // 2. Sign transaction to record result
  const sig = await Lit.Actions.signAndCombineEcdsa({
    toSign: txHash,
    publicKey: pkpPublicKey,
    sigName: "quizResult"
  });

  // 3. Submit to contract
  await songQuiz.recordQuizCompletion(
    geniusId,
    userAddress,
    questionIndex,
    correct,
    submittedAt,
    questionShownAt
  );

  return { correct, newStreak: /* ... */ };
};
```

## Artist Page Integration

### Phase 1: Direct Contract Queries (MVP)
```typescript
// Artist page for "Scarlett X" (geniusArtistId = 67890)
const songs = await songQuiz.getArtistSongs(67890);
// → [12345, 12346, 12347]  // "Heat of the Night", "Summer Nights", etc.

// Fetch leaderboards for each song (parallel)
const leaderboards = await Promise.all(
  songs.map(id => songQuiz.getLeaderboard(id))
);

// Aggregate by user (frontend)
const artistFans = aggregateByUser(leaderboards);
// → [{ user: 0x123, totalStreak: 95, songsCompleted: 8 }, ...]

// Display top 10
```

**Performance**: 1 call for songs + N parallel calls for leaderboards (~100-500ms for 5-10 songs)

### Phase 2: The Graph Indexing (Scale)
```graphql
# Single query for artist fans
query ArtistFans($artistId: BigInt!) {
  artistFanAggregates(
    where: { artistId: $artistId }
    orderBy: totalStreak
    orderDirection: desc
    first: 10
  ) {
    user
    totalStreak
    totalCorrect
    songsCompleted
    lastActive
  }
}
```

**Performance**: 1 GraphQL call (~50ms, pre-aggregated by indexer)

## Contract State

### Per Song (Core Tracking)
```solidity
// Song metadata
mapping(uint32 => string) public songNames;          // geniusId => "Heat of the Night"
mapping(uint32 => uint32) public songToArtist;       // geniusId => geniusArtistId

// Questions per song
mapping(uint32 => mapping(uint32 => EncryptedQuestion)) public questions;
mapping(uint32 => uint32) public questionCount;

// Progress per song per user
mapping(uint32 => mapping(address => SongProgress)) public progress;

// Leaderboards per song
mapping(uint32 => LeaderboardEntry[10]) public leaderboards;
```

### Per Artist (Aggregation Helper)
```solidity
// Artist metadata
mapping(uint32 => string) public artistNames;        // geniusArtistId => "Scarlett X"
mapping(uint32 => uint32[]) private _artistSongs;    // geniusArtistId => [geniusId, ...]

// Enables: getArtistSongs(artistId) → [songIds...]
```

### Daily Completion
```solidity
mapping(bytes32 => bool) public dailyCompletion;
// dailyHash = keccak256(geniusId, user, dayNumber)
// Ensures 1 quiz per song per day
```

## The Graph Integration Strategy

### Events (Graph-Optimized)

**Key Design**: Events include BOTH `geniusId` (song) AND `geniusArtistId` (artist) for efficient indexing

```solidity
event SongRegistered(
    uint32 indexed geniusId,
    uint32 indexed geniusArtistId,  // ← Indexer builds Artist entity
    string songName,
    string artistName,
    uint64 timestamp
);

event QuizCompleted(
    uint32 indexed geniusId,           // Song
    uint32 indexed geniusArtistId,     // Artist (for aggregation!)
    address indexed user,
    bool correct,
    uint32 questionIndex,
    uint64 timestamp,
    uint32 songStreak,                 // Computed value (indexer can use directly)
    uint32 songTotalCorrect,           // Computed value
    uint32 songTotalCompleted,         // Computed value
    bool isNewRecord,
    uint8 leaderboardPosition
);
```

### Migration Path (When Traffic Scales)

**Step 1: Events Already Perfect** ✅
- Contract already emits all data needed
- No contract changes required

**Step 2: Build Subgraph (2-3 hours)**
```bash
graph init --studio kschool-2
# Point to deployed contract
# Set startBlock to deployment block
```

**Step 3: Define Schema**
```graphql
type ArtistFanAggregate @entity {
  id: ID!  # artistId-userAddress
  artistId: BigInt!
  user: Bytes!
  totalStreak: BigInt!          # Sum across all songs
  totalCorrect: BigInt!         # Sum across all songs
  songsCompleted: BigInt!       # Count of songs with progress
  lastActive: BigInt!
}

type SongProgress @entity {
  id: ID!  # songId-userAddress
  songId: BigInt!
  artistId: BigInt!
  user: Bytes!
  questionsCorrect: Int!
  currentStreak: Int!
}
```

**Step 4: Write Mappings (uses event data)**
```typescript
export function handleQuizCompleted(event: QuizCompleted): void {
  // Aggregate artist-level stats
  let aggId = event.params.geniusArtistId.toString() + "-" + event.params.user.toHex();
  let agg = ArtistFanAggregate.load(aggId);
  // ... use event.params.songTotalCorrect directly (already computed!)
}
```

**Step 5: Switch Frontend to GraphQL**
```typescript
// Replace multicall with single GraphQL query
const { data } = useQuery(ARTIST_FANS_QUERY, { artistId });
```

**Total Migration Time: 2-3 hours, zero contract changes**

## Integration with Other Contracts

### StudyProgress (Gating)
```javascript
// In contract (before recording result)
// Note: This check is ON-CHAIN, not in Lit Action
require(IStudyProgress(studyProgress).studiedToday(user), "Must study before quiz");

// Why on-chain?
// - Can't be bypassed (PKP can't skip this check)
// - Tamper-proof (StudyProgress contract is source of truth)
// - Gas-efficient (single storage read)
```

### SongCatalog (Cross-Reference)
```javascript
// Get song metadata from catalog
const song = await songCatalog.getSong(songId);
// song.geniusId and song.geniusArtistId match SongQuiz IDs
```

### TrendingTracker (Discovery)
```javascript
// "Trending Artists This Week" + "Most Active Quiz Takers"
// Could combine trending + quiz leaderboards
```

## Security Considerations

1. **Study Gating**: Must speak lyrics before quiz (expensive/detectable for bots)
2. **Time Validation**: 15 seconds enforced by PKP (~12-13s actual after network overhead)
3. **Encrypted Questions**: Can't precompute answers
4. **Sequential Unlock**: Can't skip ahead (automatically skips disabled questions)
5. **Daily Limit**: 1 quiz per song per day (prevents grinding)
6. **PKP-Only Writes**: Users can't self-report scores (must go through PKP)
7. **Owner Question Management**: Can disable/replace bad questions (PKP cannot)

## Future Enhancements

### V2 Features
- Multiple difficulty levels
- Question categories (lyrics, trivia, music theory)
- Team challenges (compete with other fan groups)
- Seasonal tournaments
- Artist-specific rewards/badges

### Dynamic Questions
- LLM-generated questions from new songs
- Community-submitted questions (curated)
- Cross-artist questions for superfans

## Events for Analytics

```solidity
event QuizCompleted(...) // Track completion rates
event StreakBroken(...)  // Identify churn risk
event QuestionsAdded(...) // Question inventory
```

Artists can analyze:
- Who their most dedicated fans are
- Which songs generate most engagement
- Optimal question difficulty
- Fan retention (streaks)
