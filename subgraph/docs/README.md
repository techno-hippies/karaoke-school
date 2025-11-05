# Subgraph Documentation

**The Graph indexing for karaoke events and line-level FSRS**

## 🚀 Quick Start

```bash
cd subgraph
npm install
npm run codegen
npm run build
npm run dev
```

**Local Endpoint**: http://localhost:8000/subgraphs/name/subgraph-0

## 📁 Subgraph Structure

```
subgraph/
├── schema.graphql           # Entity definitions
├── src/mappings.ts          # Event handlers
├── subgraph.yaml           # Configuration
└── build/                  # Compiled artifacts
```

## 🎯 Entity Schema

### Line-Level FSRS Entities

#### LineCard
**Purpose**: Individual lyric lines for FSRS scheduling
```graphql
type LineCard @entity {
  id: ID!                     # lineId (UUID)
  lineId: Bytes!              # UUID from karaoke_lines
  lineIndex: Int!             # Position within segment
  segmentHash: Bytes!         # Links to Segment
  segment: Segment!           # Parent segment
  
  # Text content
  originalText: String!       # Lyric text
  
  # Timing (absolute from track start)
  startMs: Int!              # Line start time
  endMs: Int!                # Line end time
  
  # FSRS data
  performanceCount: Int!     # Total practice attempts
  averageScore: BigDecimal   # Average performance score
  lastPracticedAt: BigInt    # Most recent practice
  
  # Relationships
  performances: [LinePerformance!]! @derivedFrom(field: "line")
  
  createdAt: BigInt!
  updatedAt: BigInt!
}
```

#### LinePerformance  
**Purpose**: Individual practice attempts for FSRS
```graphql
type LinePerformance @entity {
  id: ID!                     # performanceId-lineId
  performanceId: BigInt!      # Incremental ID
  line: LineCard!             # Practiced line
  performer: Account!         # User account
  
  # Performance data
  score: Int!                 # 0-10000 (75.43% = 7543)
  metadataUri: String!        # Grove recording URI
  
  # Timing
  gradedAt: BigInt!           # When graded
  practiceDuration: Int       # Recording duration
  
  # FSRS scheduling
  nextReviewAt: BigInt        # When to practice again
  stability: BigDecimal       # FSRS stability parameter
  difficulty: BigDecimal      # FSRS difficulty parameter
}
```

### Segment Entities
```graphql
type Segment @entity {
  id: ID!                     # segmentHash
  segmentHash: Bytes!
  
  # GRC-20 reference
  grc20WorkId: String!        # Links to public work
  
  # Assets
  instrumentalUri: String    # Grove: enhanced audio
  alignmentUri: String       # Grove: word timing
  metadataUri: String        # Grove: segment metadata
  
  # Timing
  segmentStartMs: Int!       # Segment start time
  segmentEndMs: Int!         # Segment end time
  durationMs: Int!           # Segment duration
  
  # Relationships
  lineCards: [LineCard!]!    # Line-level entities
  translations: [Translation!]!
  
  registeredAt: BigInt!
  processedAt: BigInt
}
```

### Translation Entities
```graphql
type Translation @entity {
  id: ID!                     # segmentHash-languageCode
  segment: Segment!           # Parent segment
  languageCode: String!       # ISO 639-1: "zh", "vi", "id"
  translationUri: String!     # Grove: translation JSON
  
  # Metadata
  translationSource: String!  # "gemini-flash-2.5"
  confidenceScore: BigDecimal
  
  addedAt: BigInt!
}
```

## 🏗️ Event Handlers

### Line-Level FSRS Handler
```typescript
// src/mappings.ts
import { LinePerformanceGraded } from '../generated/PerformanceGrader/PerformanceGrader';

export function handleLinePerformanceGraded(event: LinePerformanceGraded): void {
  const performanceId = event.params.performanceId.toString();
  const lineId = event.params.lineId.toHexString();
  const score = event.params.score;
  const timestamp = event.block.timestamp;
  
  // 1. Get or create LineCard
  let lineCard = LineCard.load(lineId);
  if (!lineCard) {
    lineCard = createLineCardFromDatabase(lineId);
  }
  
  // 2. Create LinePerformance entity
  const linePerformanceId = `${performanceId}-${lineId}`;
  const linePerformance = new LinePerformance(linePerformanceId);
  
  linePerformance.performanceId = BigInt.fromString(performanceId);
  linePerformance.line = lineId;
  linePerformance.performer = event.params.performer;
  linePerformance.score = score;
  linePerformance.metadataUri = event.params.metadataUri;
  linePerformance.gradedAt = timestamp;
  
  // 3. Calculate FSRS parameters
  const fsrsResult = calculateFSRS(score, lineCard.averageScore);
  linePerformance.stability = fsrsResult.stability;
  linePerformance.difficulty = fsrsResult.difficulty;
  linePerformance.nextReviewAt = calculateNextReview(fsrsResult, timestamp);
  
  linePerformance.save();
  
  // 4. Update LineCard aggregates
  updateLineCardStats(lineCard, score, timestamp);
}

function calculateFSRS(score: i32, previousAverage: BigDecimal): FSRSResult {
  // Simplified FSRS calculation
  const scoreRatio = score / 10000.0;
  
  // Adjust stability based on performance
  let stability = previousAverage.div(BigDecimal.fromString("100"));
  if (scoreRatio > 0.8) {
    stability = stability.plus(BigDecimal.fromString("0.1"));
  } else if (scoreRatio < 0.5) {
    stability = stability.minus(BigDecimal.fromString("0.2"));
  }
  
  // Calculate next review interval
  const nextInterval = Math.pow(2, stability.toF64());
  
  return {
    stability,
    difficulty: calculateDifficulty(scoreRatio),
    nextInterval
  };
}
```

### Segment Handler
```typescript
export function handleSegmentRegistered(event: SegmentRegistered): void {
  const segment = new Segment(event.params.segmentHash.toHexString());
  
  segment.segmentHash = event.params.segmentHash;
  segment.grc20WorkId = event.params.grc20WorkId;
  segment.instrumentalUri = event.params.instrumentalUri;
  segment.alignmentUri = event.params.alignmentUri;
  segment.segmentStartMs = event.params.segmentStartMs;
  segment.segmentEndMs = event.params.segmentEndMs;
  segment.registeredAt = event.block.timestamp;
  
  segment.save();
}
```

## 🔧 Configuration

### subgraph.yaml
```yaml
specVersion: 0.0.7
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: PerformanceGrader
    network: lens-testnet
    source:
      address: "0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D"
      abi: PerformanceGrader
      startBlock: 4189480
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - LineCard
        - LinePerformance
      abis:
        - name: PerformanceGrader
          file: ./abis/PerformanceGrader.json
      eventHandlers:
        - event: LinePerformanceGraded(uint256,bytes32,bytes32,uint16,address,uint16,string,uint64)
          handler: handleLinePerformanceGraded
      file: ./src/mappings.ts
```

### Network Configuration
```yaml
# Local development
network: local
dataSources:
  - network: local
    source:
      address: null  # Use deployed contracts

# Lens testnet
network: lens-testnet
dataSources:
  - network: lens-testnet
    source:
      address: "0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D"
      startBlock: 4189480
```

## 🚀 Deployment

### Local Development
```bash
# Start local graph node
gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz &

# Create subgraph
graph create subgraph-0 --node http://localhost:8020

# Deploy
graph deploy subgraph-0 \
  --node http://localhost:8020 \
  --ipfs http://localhost:5001

# Access
open http://localhost:8000/subgraphs/name/subgraph-0
```

### The Graph Studio
```bash
# Get deploy key from https://thegraph.com/studio/
graph auth --studio YOUR_DEPLOY_KEY

# Deploy to Studio
graph deploy --studio karaoke-school-v1

# Check status
open https://thegraph.com/studio/subgraph/karaoke-school-v1
```

### Production Configuration
```yaml
# Update for production
specVersion: 0.0.7
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: PerformanceGrader
    network: lens-testnet  # Or mainnet when ready
    source:
      address: "0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D"  # Production address
      abi: PerformanceGrader
      startBlock: 4189480  # Production start block
```

## 🧪 Testing

### GraphQL Queries

#### Test Line-Level FSRS
```graphql
# Get line cards for a song
query GetLineCardsForSong($grc20WorkId: String!) {
  lineCards(
    where: { segment_: { grc20WorkId: $grc20WorkId } }
    orderBy: lineIndex
    orderDirection: asc
  ) {
    id
    lineId
    lineIndex
    originalText
    startMs
    endMs
    performanceCount
    averageScore
    performances(first: 5, orderBy: gradedAt, orderDirection: desc) {
      score
      gradedAt
      performer {
        username
      }
    }
  }
}
```

#### Test FSRS Scheduling
```graphql
# Get due cards for user
query GetDueCards($performer: String!) {
  linePerformances(
    where: { 
      performer: $performer,
      nextReviewAt_lte: ${Math.floor(Date.now() / 1000)}
    },
    orderBy: nextReviewAt,
    orderDirection: asc
  ) {
    id
    line {
      id
      originalText
      segment {
        instrumentalUri
      }
    }
    score
    nextReviewAt
  }
}
```

### Manual Testing
```bash
# Test local endpoint
curl -s -X POST 'http://localhost:8000/subgraphs/name/subgraph-0' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ lineCards(first: 5) { id lineId lineIndex } }"}'

# Test with variables
curl -s -X POST 'http://localhost:8000/subgraphs/name/subgraph-0' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "query($workId: String!) { lineCards(where: { segment_: { grc20WorkId: $workId } }) { id lineIndex } }",
    "variables": {"workId": "f1d7f4c7-ca47-4ba3-9875-a91720459ab4"}
  }'
```

## 📊 Monitoring

### Indexing Status
```graphql
# Check indexing progress
query {
  _meta {
    block {
      number
      timestamp
    }
    deployment
  }
  
  # Count entities
  lineCards(first: 0) {
    meta {
      count
    }
  }
  
  linePerformances(first: 0) {
    meta {
      count  
    }
  }
}
```

### Entity Relationships
```graphql
# Verify relationships
query CheckRelationships {
  lineCards(first: 1) {
    id
    lineIndex
    segment {
      id
      grc20WorkId
    }
    performances(first: 1) {
      id
      performer {
        id
      }
    }
  }
}
```

## 🎯 FSRS Integration

### Daily Limits
```typescript
// Implement daily new card limits
const DAILY_NEW_CARD_LIMIT = 15;

function getAvailableCards(userId: string, date: Date): LineCard[] {
  const alreadyReviewed = getReviewedCardsToday(userId, date);
  const newCards = getNewCards(userId);
  
  return newCards
    .filter(card => !alreadyReviewed.includes(card.id))
    .slice(0, DAILY_NEW_CARD_LIMIT);
}
```

### Spaced Repetition
```typescript
// Calculate next review based on FSRS
function calculateNextReview(
  score: number,
  previousStability: number,
  previousDifficulty: number
): Date {
  const difficulty = adjustDifficulty(previousDifficulty, score);
  const stability = adjustStability(previousStability, score, difficulty);
  
  // Exponential decay based on difficulty
  const interval = Math.pow(2, stability);
  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);
  
  return nextReview;
}
```

## 🔗 Frontend Integration

### React Query Hook
```typescript
// app/src/hooks/useStudyCards.ts
import { gql, useQuery } from '@apollo/client';

const GET_LINE_CARDS = gql`
  query GetLineCards($grc20WorkId: String!, $performer: String!) {
    lineCards(
      where: { segment_: { grc20WorkId: $grc20WorkId } }
      orderBy: lineIndex
      orderDirection: asc
    ) {
      id
      lineId
      lineIndex
      originalText
      startMs
      endMs
      performanceCount
      averageScore
      segment {
        instrumentalUri
        alignmentUri
        translations {
          languageCode
          translationUri
        }
      }
      performances(where: { performer: $performer }) {
        score
        gradedAt
        nextReviewAt
      }
    }
  }
`;

export function useStudyCards(songId: string, userAddress: string) {
  return useQuery(GET_LINE_CARDS, {
    variables: { grc20WorkId: songId, performer: userAddress.toLowerCase() },
    pollInterval: 30000, // Refresh every 30 seconds
  });
}
```

### Real-time Updates
```typescript
// Subscribe to new performances
const SUBSCRIBE_PERFORMANCES = gql`
  subscription OnLinePerformanceAdded($lineId: ID!) {
    linePerformanceAdded(lineId: $lineId) {
      id
      score
      gradedAt
      performer {
        username
      }
    }
  }
`;

function useRealtimePerformances(lineId: string) {
  const { data } = useSubscription(SUBSCRIBE_PERFORMANCES, {
    variables: { lineId }
  });
  
  return data?.linePerformanceAdded;
}
```

## 📚 Additional Documentation

- **[Story Protocol Integration](./story-protocol.md)** - IP Asset creation
- **[AGENTS.md](../../AGENTS.md)** - Service integration guide
- **[README.md](../../README.md)** - Project overview
