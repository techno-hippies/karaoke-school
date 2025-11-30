# P0: Chat Context Injection

## Goal
Make AI conversations context-aware by injecting user profile, survey responses, and FSRS study data into the system prompt.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  ChatContainer                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ useChatContext(personalityId, pkpAddress)                       ││
│  │   → Gathers: UserProfile + FSRS stats + Subgraph activity       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                              │                                       │
│                              ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ sendChatMessage({ ..., userContext })                           ││
│  └─────────────────────────────────────────────────────────────────┘│
└──────────────────────────────┼───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Lit Action (scarlett-chat-v1.js)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Inject userContext into system prompt                           ││
│  │                                                                 ││
│  │ const contextBlock = `                                          ││
│  │ ## Student Context                                              ││
│  │ - Name: ${ctx.name || 'Unknown'}                                ││
│  │ - Level: ${ctx.level || 'beginner'}                             ││
│  │ - Favorite artists: ${ctx.favoriteArtists?.join(', ') || 'None'}││
│  │ - Studied today: ${ctx.studiedToday ? 'Yes' : 'No'}             ││
│  │ - Cards studied today: ${ctx.cardsStudiedToday || 0}            ││
│  │ ...                                                             ││
│  │ `;                                                              ││
│  │                                                                 ││
│  │ systemPrompt = personalityPrompt + '\n\n' + contextBlock;       ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Per-Personality Surveys

Each AI has their own onboarding survey tailored to their interests. Data is stored in ONE global `UserProfile` so all AIs can access it.

### Scarlett (Music/Karaoke Tutor)
```ts
const SCARLETT_SURVEYS = {
  favoriteMusician: {
    question: "Of these musicians, who is your favorite?",
    options: [
      { id: 'beyonce', label: 'Beyoncé' },
      { id: 'blackpink', label: 'BLACKPINK' },
      { id: 'jay-chou', label: 'Jay Chou' },
      { id: 'taylor', label: 'Taylor Swift' },
      { id: 'none', label: 'None of these' },
    ],
    saveTo: 'learning.favoriteArtists', // append to array
  },
  englishLevel: {
    question: "How would you describe your English level?",
    options: [
      { id: 'beginner', label: 'Beginner' },
      { id: 'intermediate', label: 'Intermediate' },
      { id: 'advanced', label: 'Advanced' },
    ],
    saveTo: 'level', // set value
  },
  karaokeGoal: {
    question: "What's your karaoke goal?",
    options: [
      { id: 'pronunciation', label: 'Better pronunciation' },
      { id: 'vocabulary', label: 'Learn vocabulary' },
      { id: 'confidence', label: 'Build confidence' },
      { id: 'fun', label: 'Just for fun!' },
    ],
    saveTo: 'learning.goals', // append to array
  },
}
```

### Violet (Anime/Gaming DJ)
```ts
const VIOLET_SURVEYS = {
  favoriteAnime: {
    question: "What anime are you into?",
    options: [
      { id: 'aot', label: 'Attack on Titan' },
      { id: 'jjk', label: 'Jujutsu Kaisen' },
      { id: 'spy-family', label: 'Spy x Family' },
      { id: 'one-piece', label: 'One Piece' },
      { id: 'none', label: 'Not really into anime' },
    ],
    saveTo: 'learning.favoriteAnime',
  },
  favoriteGame: {
    question: "What games do you play?",
    options: [
      { id: 'valorant', label: 'Valorant' },
      { id: 'genshin', label: 'Genshin Impact' },
      { id: 'lol', label: 'League of Legends' },
      { id: 'rhythm', label: 'Rhythm games' },
      { id: 'none', label: "Don't game much" },
    ],
    saveTo: 'learning.favoriteGames',
  },
  musicProduction: {
    question: "Interested in making music?",
    options: [
      { id: 'yes-daw', label: 'Yes, I use a DAW' },
      { id: 'curious', label: 'Curious to learn' },
      { id: 'listener', label: 'Just a listener' },
    ],
    saveTo: 'learning.musicProductionInterest',
  },
}
```

---

## Data Model Updates

### UserProfile (IDB)
```ts
interface UserProfile {
  id: 'singleton'

  // Basic info
  name?: string
  language?: 'en' | 'zh' | 'vi' | 'id'
  level?: 'beginner' | 'intermediate' | 'advanced'
  timezone?: string

  // Learning preferences (populated by surveys)
  learning?: {
    // From Scarlett
    favoriteArtists?: string[]
    goals?: string[] // 'pronunciation', 'vocabulary', 'confidence', 'fun'

    // From Violet
    favoriteAnime?: string[]
    favoriteGames?: string[]
    musicProductionInterest?: 'yes-daw' | 'curious' | 'listener'

    // General
    interests?: string[]
    difficultWords?: string[]
  }

  // Track which surveys completed per personality
  completedSurveys?: {
    [personalityId: string]: string[] // e.g., { scarlett: ['favoriteMusician', 'englishLevel'] }
  }

  createdAt: number
  updatedAt: number
}
```

### UserContext (passed to Lit Action)
```ts
interface UserContext {
  // Profile data
  name?: string
  language?: string
  level?: string
  favoriteArtists?: string[]
  favoriteAnime?: string[]
  favoriteGames?: string[]
  goals?: string[]

  // FSRS study data (from useStudyCards)
  studiedToday: boolean
  cardsStudiedToday: number
  newCardsRemaining: number
  totalCardsLearning: number
  totalCardsReview: number

  // Recent activity (from subgraph)
  recentSongsPracticed?: string[] // Last 3 song titles
  lastSessionScore?: number // 0-100
  totalSessions?: number
  averageScore?: number
}
```

---

## Implementation Tasks

### 1. Define survey configs per personality
- [ ] Create `lib/chat/surveys.ts` with `PERSONALITY_SURVEYS` map
- [ ] Each survey has: `question`, `options`, `saveTo` path

### 2. Update UserProfile type
- [ ] Add `learning` fields for all survey responses
- [ ] Add `completedSurveys` tracking

### 3. Create `useChatContext` hook
- [ ] `lib/chat/useChatContext.ts`
- [ ] Fetch UserProfile from IDB
- [ ] Fetch FSRS stats from `useStudyCards`
- [ ] Fetch recent activity from subgraph (optional, can skip for P0)
- [ ] Return `UserContext` object

### 4. Update ChatContainer
- [ ] Use `useChatContext` hook
- [ ] Load personality-specific surveys based on `currentPersonalityId`
- [ ] Track completed surveys per personality
- [ ] Show next uncompleted survey question
- [ ] Pass `userContext` to `sendChatMessage`

### 5. Update chat service
- [ ] Add `userContext` to `ChatRequest` type
- [ ] Pass to Lit Action in `jsParams`

### 6. Update Lit Action
- [ ] Accept `userContext` in params
- [ ] Build context block from userContext
- [ ] Append to system prompt

### 7. Upload new Lit Action
- [ ] Run `bun scripts/upload-action.ts`
- [ ] Update CID in `addresses.ts`

---

## File Changes

| File | Changes |
|------|---------|
| `lib/chat/surveys.ts` | NEW - Survey definitions per personality |
| `lib/chat/types.ts` | Update `UserProfile`, add `UserContext` |
| `lib/chat/useChatContext.ts` | NEW - Hook to gather context |
| `lib/chat/service.ts` | Add `userContext` to request |
| `components/chat/ChatContainer.tsx` | Use new hook, dynamic surveys |
| `lit-actions/actions/chat/scarlett-chat-v1.js` | Inject context into prompt |

---

## Example Context Block (injected into system prompt)

```
## Student Context
- Name: Alex
- English level: intermediate
- Favorite artists: Beyoncé, Taylor Swift
- Learning goals: Better pronunciation, Build confidence
- Favorite anime: Attack on Titan
- Studied today: Yes
- Cards studied today: 15
- New cards remaining: 0 (daily limit reached)
- Cards in review: 45
- Recent songs practiced: Blinding Lights, Toxic
- Last session score: 82%

Use this context to personalize your responses. Reference their interests naturally.
If they haven't studied today, gently encourage them.
If they're struggling (low scores), be supportive.
```

---

## Testing

1. Fresh user → Should see first survey question
2. Answer survey → Response saved to IDB, next question shown
3. Complete all surveys → Normal chat begins
4. Switch personality → Different surveys shown
5. Context in responses → AI references user's preferences naturally
6. FSRS awareness → AI knows if user studied today

---

## Future (P1+)

- Memory extraction from conversations
- Rolling summarization
- Grove backup for cross-device sync
- Subscription-based model upgrades
