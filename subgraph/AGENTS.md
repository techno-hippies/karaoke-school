# Subgraph - Agent Guide

Quick reference for AI agents working on the karaoke-school subgraph.

## Core Commands

```bash
cd subgraph
npm run codegen      # Generate TypeScript from schema
npm run build        # Compile to WASM
npm run deploy       # Deploy to Graph Studio
```

## Architecture

**Purpose**: Index smart contract events for fast GraphQL queries

**Endpoint**: `https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v6-translation-events`

**Network**: Lens Testnet (37111)

## Contracts Indexed

| Contract | Address | Events |
|----------|---------|--------|
| KaraokeEvents | `0xd942eB51C86c46Db82678627d19Aa44630F901aE` | ClipRegistered, ClipProcessed, SongEncrypted, ClipLocalizationUpdated, KaraokeSessionStarted, KaraokeLineGraded |
| TranslationEvents | `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` | TranslationAdded, TranslationUpdated, TranslationToggled |
| ExerciseEvents | `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` | TranslationQuestionRegistered, TriviaQuestionRegistered, SayItBackAttemptGraded, MultipleChoiceAttemptGraded, QuestionToggled |
| AccountEvents | `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` | AccountCreated, AccountMetadataUpdated, AccountVerified |

## Entity Overview

```
Clip (core)
├── translations: [Translation]
├── performances: [Performance]
├── exerciseCards: [ExerciseCard]
└── karaokeSessions: [KaraokeSession]

Account (user)
├── performances: [Performance]
└── exerciseAttempts: [ExerciseAttempt]

ExerciseCard (FSRS study)
└── attempts: [ExerciseAttempt]

KaraokeSession (real-time grading)
└── lines: [KaraokeLineScore]
```

## Key Entities

### Clip
Main entity for karaoke content. Created by `ClipRegistered`, enriched by `ClipProcessed` and `SongEncrypted`.

```graphql
type Clip @entity {
  id: ID!                    # clipHash hex
  clipHash: Bytes!
  spotifyTrackId: String!
  iswc: String!
  title: String!
  artist: String!
  artistSlug: String!
  songSlug: String!
  coverUri: String!
  thumbnailUri: String!
  clipStartMs: Int!
  clipEndMs: Int!
  metadataUri: String!       # Grove JSON metadata
  registeredBy: Bytes!
  registeredAt: BigInt!

  # After ClipProcessed
  instrumentalUri: String
  alignmentUri: String
  processedAt: BigInt
  translationCount: Int!

  # After SongEncrypted (premium)
  # Note: Access control info now in clip metadata, not on-chain
  encryptedFullUri: String
  encryptedManifestUri: String

  # Relations
  translations: [Translation!]!
  performances: [Performance!]!
  exerciseCards: [ExerciseCard!]!
}
```

### ExerciseCard
FSRS-tracked study cards for spaced repetition.

```graphql
type ExerciseCard @entity {
  id: ID!                    # questionId hex
  questionId: Bytes!
  exerciseType: ExerciseType!  # SAY_IT_BACK, TRANSLATION_MULTIPLE_CHOICE, TRIVIA_MULTIPLE_CHOICE
  spotifyTrackId: String!
  languageCode: String!
  metadataUri: String!
  enabled: Boolean!

  clip: Clip
  line: LineCard
  attempts: [ExerciseAttempt!]!
}
```

### KaraokeSession
Real-time line-by-line grading session.

```graphql
type KaraokeSession @entity {
  id: ID!                    # sessionId hex
  clip: Clip!
  performer: Bytes!
  expectedLineCount: Int!
  completedLineCount: Int!
  aggregateScore: Int!       # 0-10000 basis points
  isCompleted: Boolean!

  lines: [KaraokeLineScore!]!
}
```

## Common Queries

```graphql
# Get all clips with translations
query GetClips {
  clips(first: 20, orderBy: registeredAt, orderDirection: desc) {
    id
    spotifyTrackId
    metadataUri
    translationCount
    translations {
      languageCode
      translationUri
    }
  }
}

# Get exercises for a clip
query GetExercises($clipHash: Bytes!) {
  exerciseCards(where: { clipHash: $clipHash, enabled: true }) {
    id
    exerciseType
    languageCode
    metadataUri
    attemptCount
    averageScore
  }
}

# Get user's performance history
query GetUserPerformances($address: Bytes!) {
  account(id: $address) {
    username
    performanceCount
    averageScore
    performances(first: 10, orderBy: gradedAt, orderDirection: desc) {
      clip { spotifyTrackId }
      score
      gradedAt
    }
  }
}

# Global stats
query GetStats {
  globalStats(id: "global") {
    totalClips
    totalPerformances
    totalAccounts
    totalExerciseCards
    totalKaraokeSessions
  }
}
```

## File Structure

```
subgraph/
├── schema.graphql       # Entity definitions
├── subgraph.yaml        # Contract addresses, event handlers
├── src/
│   ├── mappings.ts      # Event handlers
│   └── entities.ts      # Entity helpers
├── abis/                # Contract ABIs
│   ├── KaraokeEvents.json
│   ├── TranslationEvents.json
│   ├── ExerciseEvents.json
│   └── AccountEvents.json
└── generated/           # Auto-generated (npm run codegen)
```

## Deployment

```bash
# 1. Generate types from schema
npm run codegen

# 2. Build WASM
npm run build

# 3. Deploy (requires GRAPH_ACCESS_TOKEN)
npx graph deploy --studio kschool-alpha-1

# Or with version
npx graph deploy --studio kschool-alpha-1 --version v0.0.9
```

## Debugging

```bash
# Check indexing status
curl -X POST https://api.studio.thegraph.com/index-node/graphql \
  -d '{"query":"{ indexingStatusForCurrentVersion(subgraphName: \"kschool-alpha-1\") { synced health chains { latestBlock { number } } } }"}'

# Query _meta for sync status
query {
  _meta {
    block { number }
    hasIndexingErrors
  }
}
```

## Event → Entity Flow

```
ClipRegistered → Create Clip (basic metadata)
ClipProcessed → Update Clip (add instrumentalUri, alignmentUri)
SongEncrypted → Update Clip (add encryption fields)

TranslationAdded → Create Translation, increment Clip.translationCount
TranslationQuestionRegistered → Create ExerciseCard

KaraokeSessionStarted → Create KaraokeSession
KaraokeLineGraded → Create KaraokeLineScore, update session
KaraokeSessionEnded → Finalize KaraokeSession

SayItBackAttemptGraded → Create ExerciseAttempt
MultipleChoiceAttemptGraded → Create ExerciseAttempt

AccountCreated → Create Account
```
