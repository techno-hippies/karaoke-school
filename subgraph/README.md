# Karaoke School Subgraph

The Graph subgraph for Karaoke School V2 on Lens Chain testnet. Indexes contract events and provides GraphQL API for querying karaoke data.

## Prerequisites

- PostgreSQL 16 (binaries in `/usr/lib/postgresql/16/bin/`)
- Graph Node Dev Mode: `gnd` from Graph CLI
- Lens Testnet RPC: https://rpc.testnet.lens.xyz

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Generate TypeScript bindings from ABIs
bun run codegen

# 3. Build the subgraph
bun run build

# 4. Start GND (CRITICAL: do NOT use --watch flag - it crashes)
export PATH="/usr/lib/postgresql/16/bin:$PATH" && \
  gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz > gnd.log 2>&1 &

# 5. Check progress
tail -f gnd.log

# 6. Access GraphQL endpoint
# http://localhost:8000/subgraphs/name/subgraph-0
```

## Installation

### Install gnd (Graph Node Dev)

```bash
# Via Graph CLI
npm install -g @graphprotocol/graph-cli

# Install Graph Node Dev
graph node install

# Verify
gnd --version
```

## Local Development

### Start GND

**CRITICAL: Do NOT use `--watch` flag - it causes file watcher loops that crash GND.**

```bash
# Add PostgreSQL 16 to PATH and start gnd
export PATH="/usr/lib/postgresql/16/bin:$PATH" && \
  gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz > gnd.log 2>&1 &
```

**Key points:**
- Network name must be `lens-testnet:` (matches subgraph.yaml)
- GND auto-deploys from `./build` directory
- First run downloads blocks (~5-10 minutes)
- GraphQL endpoint: `http://localhost:8000/subgraphs/name/subgraph-0`

### Stop GND

```bash
# Graceful shutdown
pkill gnd

# Force kill if stuck
pkill -9 gnd
rm -rf build/pgtemp-*
```

### Why PostgreSQL in PATH

GND needs `initdb` to create a temporary Postgres instance. On Ubuntu/Debian, add it:

```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH"
```

## Deployed Contracts (Lens Testnet)

- **ExerciseEvents:** `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832`
- **ClipEvents:** `0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274`
- **SongEvents:** `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6`
- **AccountEvents:** `0xb31b8abB319Ee6AB6f0706E0086bEa310E25da22`
- **TranslationEvents:** `0x5A49E23A5C3a034906eE0274c266A08805770C70`

> Legacy `PerformanceGrader` data sources remain for historical analytics but are read-only.

## Verify Indexing

Check if GND is running and indexing:

```bash
curl -X POST http://localhost:8000/subgraphs/name/subgraph-0 \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'
```

Expected output:
```json
{"data":{"_meta":{"block":{"number":4187060}}}}
```

## Example Queries

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

## Troubleshooting

### GND crashes with "assignment event stream failed"

**Cause:** Using `--watch` flag causes file watcher loops

**Fix:**
```bash
# Kill GND
pkill -9 gnd
rm -rf build/pgtemp-*

# Restart WITHOUT --watch
export PATH="/usr/lib/postgresql/16/bin:$PATH" && \
  gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz
```

### "Failed to start initdb" error

**Cause:** PostgreSQL tools not in PATH

**Fix:**
```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH" && \
  gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz
```

### "Failed to connect to Ethereum node"

**Cause:** Cannot reach Lens Testnet RPC

**Fix:** Verify RPC accessibility:
```bash
curl https://rpc.testnet.lens.xyz \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### "Database error: relation does not exist"

**Cause:** Postgres schema not initialized

**Fix:**
```bash
pkill -9 gnd
rm -rf build/pgtemp-*
# Restart GND
```

### "network not supported by registrar"

**Cause:** Network name mismatch between CLI and subgraph.yaml

**Fix:** Ensure network name is `lens-testnet`:
```bash
gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz
```

### No events found

**Cause:** Start block is after contract deployment

**Fix:** Update `startBlock` in subgraph.yaml:
```yaml
startBlock: 4187060  # First event block
```

## Production Deployment

### Deploy to The Graph Studio

```bash
# 1. Get deploy key from https://thegraph.com/studio/

# 2. Authenticate
graph auth --studio <DEPLOY_KEY>

# 3. Deploy
graph deploy --studio karaoke-school-v1
```

### Update app configuration

Update `app/src/lib/graphql/client.ts`:
```typescript
const SUBGRAPH_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.studio.thegraph.com/query/.../karaoke-school-v1'
  : 'http://localhost:8000/subgraphs/name/subgraph-0/'
```

## Resources

- [Graph Node Dev Mode Docs](https://thegraph.com/docs/en/developing/creating-a-subgraph/)
- [Lens Testnet Explorer](https://block-explorer.testnet.lens.xyz/)
- [Subgraph Schema](./schema.graphql)
- [AssemblyScript Mappings](./src/mappings.ts)
