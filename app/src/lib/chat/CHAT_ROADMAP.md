# Chat System Roadmap

## Current Status: P0 Complete

### P0 - Context Injection (DONE)
Personalize AI responses with user data.

**Implemented:**
- Per-personality surveys (Scarlett: music, Violet: anime/gaming)
- Survey responses stored in IndexedDB (`UserProfile`)
- `useChatContext` hook gathers: survey responses, FSRS stats, engagement data
- Context injected into system prompt via `userContext` param
- Sequential message flow for survey onboarding

**Files:**
- `app/src/lib/chat/surveys.ts` - Survey configs per personality
- `app/src/lib/chat/useChatContext.ts` - Context gathering hook
- `app/src/lib/chat/types.ts` - UserProfile, UserContext types
- `lit-actions/actions/chat/scarlett-chat-v1.js` - Context injection

**CID:** `QmVfUE8YPViuTHWejGj5Kndxkfhm7YPpRY8252K4xbJZZi`

---

## Future Phases (Paused)

### P1 - Memory Extraction
Extract facts from conversations to remember long-term.

**Concept:**
- After N messages or session end, make extraction LLM call
- Prompt: "Extract key facts about the user from this conversation"
- Store extracted memories in `UserProfile.memories[]`
- Inject memories into future system prompts

**Implementation Options:**
1. Same Lit Action, new mode: `EXTRACT_MEMORIES`
2. Separate extraction Lit Action
3. Client-side extraction (would need local LLM)

**Trigger Heuristics:**
- Every 10 messages
- On session end (app blur/close)
- When conversation exceeds token threshold

---

### P2 - Rolling Summarization
Compress old messages to stay under token limits.

**Concept:**
- When conversation history > 4000 tokens
- Summarize oldest messages into a paragraph
- Keep recent messages verbatim
- Store summary in thread metadata

**Data Model:**
```typescript
interface Thread {
  // ... existing fields
  summary?: string        // Compressed old messages
  summaryUpToId?: string  // Last message ID included in summary
}
```

---

### P3 - Grove Sync
Cross-device persistence for user profile.

**Concept:**
- When user connects wallet, sync UserProfile to Grove
- On new device, fetch profile from Grove
- Merge local + remote profiles

**Implementation:**
- Store profile at `grove://chat-profile/{walletAddress}`
- Sync on: wallet connect, profile update, app load

---

### P4 - Subscription Tiers
Premium features for Unlock NFT holders.

**See:** `SUBSCRIPTION_PLAN.md` (to be created)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ ChatPage    │→ │ ChatContainer│→ │ useChatContext      │    │
│  └─────────────┘  └──────────────┘  │ - surveys           │    │
│                          │          │ - FSRS stats        │    │
│                          ↓          │ - engagement        │    │
│                   ┌──────────────┐  └─────────────────────┘    │
│                   │ chat/service │                              │
│                   │ sendMessage()│                              │
│                   └──────┬───────┘                              │
└──────────────────────────┼──────────────────────────────────────┘
                           │ userContext
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│  Lit Protocol (Decentralized Compute)                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ scarlett-chat-v1.js                                        │ │
│  │                                                            │ │
│  │  1. Decrypt Venice API key                                 │ │
│  │  2. Build system prompt + userContext block                │ │
│  │  3. Call Venice AI (qwen3-4b)                              │ │
│  │  4. Return response                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                           │
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│  IndexedDB (Local Storage)                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ UserProfile │  │ Threads     │  │ Messages                │  │
│  │ - surveys   │  │ - per tutor │  │ - conversation history  │  │
│  │ - memories  │  │ - summary   │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```
