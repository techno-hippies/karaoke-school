# Session-Based Karaoke Architecture

**Line-by-line grading for real-time feedback and aggregation**

---

## Overview

Due to Lit Protocol's ~350KB payload limit, full songs cannot be processed in a single action. This architecture grades individual lines within a session, providing:

- Real-time feedback as the user sings
- No Gemini dependency (Levenshtein scoring only)
- Subgraph-based score aggregation
- Deterministic scoring

---

## Contract Interface

### Proposed Events

```solidity
// Session lifecycle
event KaraokeSessionStarted(
    bytes32 indexed sessionId,
    bytes32 indexed clipHash,
    address indexed performer,
    uint16 expectedLineCount,
    uint64 timestamp
);

event KaraokeLineGraded(
    bytes32 indexed sessionId,
    uint16 lineIndex,
    uint16 score,      // 0-10000 basis points
    uint8 rating,      // FSRS 0-3
    string metadataUri,
    uint64 timestamp
);

event KaraokeSessionEnded(
    bytes32 indexed sessionId,
    bool completed,    // true = finished, false = abandoned
    uint64 timestamp
);
```

### Proposed Functions

```solidity
// Called by PKP (line grader can auto-start on first line)
function startKaraokeSession(
    bytes32 sessionId,
    bytes32 clipHash,
    address performer,
    uint16 expectedLineCount
) external;

// Called by PKP for each line (this is what karaoke-line-grader calls)
function gradeKaraokeLine(
    bytes32 sessionId,
    uint16 lineIndex,
    uint16 score,
    uint8 rating,
    string metadataUri
) external;

// Called by PKP (client triggers via Lit Action) to end session
function endKaraokeSession(
    bytes32 sessionId,
    bool completed
) external;
```

---

## Session ID Generation

The sessionId should be deterministic and unique:

```typescript
const sessionId = ethers.utils.keccak256(
  ethers.utils.defaultAbiCoder.encode(
    ['address', 'bytes32', 'uint256'],
    [performer, clipHash, clientNonce]
  )
);
```

Where `clientNonce` is a timestamp or random value to allow multiple sessions per clip.

---

## Data Flow

```
Client                  Lit Action             Contract              Subgraph
  │                        │                      │                     │
  ├──startSession()───────────────────────────────►                     │
  │                                               ├──SessionStarted────►│
  │                                                                     │
  ├──record line 0────►│                                                │
  │                    ├──gradeKaraokeLine()─────►│                     │
  │◄──score, rating────┤                          ├──LineGraded────────►│
  │                                                                     │
  ├──record line 1────►│                                                │
  │                    ├──gradeKaraokeLine()─────►│                     │
  │◄──score, rating────┤                          ├──LineGraded────────►│
  │                                                                     │
  ... (repeat for each line)                                            │
  │                                                                     │
  ├──endSession()─────────────────────────────────►                     │
  │                                               ├──SessionEnded──────►│
  │                                                                     │
  │◄──query aggregate score───────────────────────────────────────────►│
```

---

## Subgraph Aggregation

The subgraph derives aggregate scores from line events:

```graphql
type KaraokeSession @entity {
  id: ID!                    # sessionId
  clipHash: Bytes!
  performer: Bytes!
  expectedLineCount: Int!

  # Derived from events
  lines: [KaraokeLineScore!]! @derivedFrom(field: "session")
  completedLineCount: Int!
  aggregateScore: Int!       # Average of line scores
  isCompleted: Boolean!

  startedAt: BigInt!
  endedAt: BigInt
}

type KaraokeLineScore @entity {
  id: ID!                    # sessionId-lineIndex
  session: KaraokeSession!
  lineIndex: Int!
  score: Int!
  rating: Int!
  metadataUri: String!
  timestamp: BigInt!
}
```

### Aggregation Logic

```typescript
// In subgraph mapping
export function handleKaraokeLineGraded(event: KaraokeLineGraded): void {
  let session = KaraokeSession.load(event.params.sessionId.toHexString());
  if (!session) return;

  // Create line score entity
  let lineId = event.params.sessionId.toHexString() + "-" + event.params.lineIndex.toString();
  let lineScore = new KaraokeLineScore(lineId);
  lineScore.session = session.id;
  lineScore.lineIndex = event.params.lineIndex;
  lineScore.score = event.params.score;
  lineScore.rating = event.params.rating;
  lineScore.metadataUri = event.params.metadataUri;
  lineScore.timestamp = event.block.timestamp;
  lineScore.save();

  // Update session aggregate (best score per lineIndex)
  updateSessionAggregate(session);
  session.save();
}

function updateSessionAggregate(session: KaraokeSession): void {
  // Get all lines for this session
  // Take best score per lineIndex
  // Calculate average
  // This prevents gaming by submitting multiple attempts per line
}
```

---

## Handling Edge Cases

### 1. Duplicate Lines
- Take **best score** per lineIndex
- Prevents gaming by re-recording bad lines
- Subgraph handles deduplication

### 2. Abandoned Sessions
- Client calls `endKaraokeSession(sessionId, false)`
- Subgraph marks session as incomplete
- Partial scores still recorded

### 3. Missing Lines
- Session has `expectedLineCount`
- UI can show which lines are missing
- Aggregate only uses submitted lines

### 4. Late Completion
- No timeout-based auto-completion
- Client must explicitly end session
- Old sessions can remain open indefinitely

---

## Implementation Phases

### Phase 1: Lit Action (Done)
- [x] Create `karaoke-line-grader-v1.js`
- [x] Voxtral STT transcription
- [x] Levenshtein scoring
- [x] PKP transaction signing

### Phase 2: Contract Updates
- [x] Add session events to KaraokeEvents.sol
- [x] Add `gradeKaraokeLine()` function
- [x] Add session start/end functions
- [ ] Deploy to Lens Testnet

### Phase 3: Subgraph Updates
- [ ] Add KaraokeSession entity
- [ ] Add KaraokeLineScore entity
- [ ] Implement aggregation handlers
- [ ] Deploy to The Graph Studio

### Phase 4: Frontend Integration
- [ ] Session management in React
- [ ] Line-by-line recording UI
- [ ] Real-time score display
- [ ] Progress indicators

---

## Migration Strategy

The existing `karaoke-grader-v1.js` remains for short clips (<350KB). New session-based grading is used for:

- Full songs
- Any content >350KB
- Cases requiring real-time feedback

Both systems can coexist since they use different contract functions.

---

## Security Considerations

1. **Score Trust**: All scores come from PKP-signed transactions
2. **Session Ownership**: Only session creator can end it
3. **Aggregation Trust**: Subgraph calculates from on-chain events
4. **Deduplication**: Best score per lineIndex prevents gaming

Note: Session ownership is enforced at the PKP layer (trusted caller); the contract itself is event-only and does not store session state.

---

**Last Updated**: 2025-11-25
