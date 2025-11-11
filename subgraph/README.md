# Karaoke School Subgraph

The Graph subgraph for Karaoke School V2 on Lens Chain testnet.

## Setup

```bash
# Install dependencies
bun install

# Generate types from GraphQL schema
bun run codegen

# Build the subgraph
bun run build
```

## Deployment to The Graph Studio

### 1. Authenticate

Get your deploy key from The Graph Studio: https://thegraph.com/studio/

```bash
bun run auth
# Paste your deploy key when prompted
```

### 2. Deploy

```bash
bun run deploy
```

## Local Development with GND (Recommended)

**Use GND (Graph Node Dev) for local development - simpler than Docker.**

### Quick Start

```bash
# Build the subgraph first
bun run build

# Start GND (requires PostgreSQL 16 binaries in PATH)
PATH="/usr/lib/postgresql/16/bin:$PATH" gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz > gnd.log 2>&1 &

# GND automatically deploys from ./build directory
# Check progress: tail -f gnd.log

# Access GraphQL endpoint
# http://localhost:8000/subgraphs/name/subgraph-0

# Stop GND when done
pkill gnd
```

### Why PATH is needed

GND requires PostgreSQL's `initdb` command to initialize its embedded database. On Ubuntu/Debian systems, PostgreSQL binaries are in `/usr/lib/postgresql/16/bin/` and not in the default PATH.

### Alternative: Docker (Not Recommended)

If you prefer Docker:

1. Clone graph-node:
```bash
git clone https://github.com/graphprotocol/graph-node.git
cd graph-node/docker
```

2. Update `docker-compose.yml`:
```yaml
ethereum: 'lens-testnet:https://rpc.testnet.lens.xyz'
```

3. Start services:
```bash
docker-compose up
```

4. Deploy to local node:
```bash
bun run create-local
bun run deploy-local
```

## Deployed Contracts (Lens Testnet)

- **ExerciseEvents:** `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832`
- **ClipEvents:** `0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274`
- **SongEvents:** `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6`
- **AccountEvents:** `0xb31b8abB319Ee6AB6f0706E0086bEa310E25da22`

> Legacy `PerformanceGrader` data sources remain in the manifest for historical
> analytics but are considered read-only. All new grading events come from
> `ExerciseEvents`.

## Queries

Example queries once deployed:

### Fetch clip details

```graphql
query GetClip($clipHash: ID!) {
  clip(id: $clipHash) {
    clipHash
    spotifyTrackId
    clipStartMs
    clipEndMs
    metadataUri
    translationCount
    performances(orderBy: gradedAt, orderDirection: desc, first: 5) {
      id
      performerAddress
      score
      metadataUri
      gradedAt
    }
    translations {
      languageCode
      translationUri
      confidenceScore
      validated
    }
  }
}
```

### Get learner performance history

```graphql
query GetLearnerHistory($account: ID!) {
  account(id: $account) {
    lensAccountAddress
    performanceCount
    averageScore
    performances(orderBy: gradedAt, orderDirection: desc, first: 10) {
      id
      clip {
        clipHash
        spotifyTrackId
      }
      score
      gradedAt
    }
    exerciseAttempts(orderBy: gradedAt, orderDirection: desc, first: 10) {
      id
      questionId
      score
      rating
      gradedAt
    }
  }
}
```

### Global stats

```graphql
query GlobalStats {
  globalStats(id: "global") {
    totalClips
    totalTranslations
    totalPerformances
    totalExerciseCards
  }
}
```
