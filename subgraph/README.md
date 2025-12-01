# Karaoke School Subgraph

The Graph subgraph for Karaoke School V2 on Lens Chain testnet. Indexes contract events and provides GraphQL API for querying karaoke data.

## Deployment

### Production (The Graph Studio)

**Current Deployment:**
- **Endpoint**: `https://api.studio.thegraph.com/query/1715685/kschool-alpha-1/v0.0.8`
- **Status**: ✅ Deployed and synced
- **Network**: Lens Testnet (Chain ID: 37111)

**Deploy New Version:**
```bash
# Build and deploy
graph codegen && graph build
graph deploy kschool-alpha-1 --node https://api.studio.thegraph.com/deploy/

# Or use npm script
npm run deploy
```

### Local Development (GND)

**Prerequisites:**
- PostgreSQL 16 (binaries in `/usr/lib/postgresql/16/bin/`)
- Graph Node Dev Mode: `gnd` from Graph CLI
- Lens Testnet RPC: https://rpc.testnet.lens.xyz

**Local Endpoint**: `http://localhost:8000/subgraphs/name/subgraph-0`

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

- **KaraokeEvents:** `0x51aA6987130AA7E4654218859E075D8e790f4409` (clip lifecycle + grading)
- **ExerciseEvents:** `0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832` (FSRS study cards)
- **TranslationEvents:** `0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6` (translations)
- **AccountEvents:** `0x3709f41cdc9E7852140bc23A21adCe600434d4E8` (accounts)

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
    alignmentUri
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

## Clip vs Full-Song Lyrics (Grove Integration)

- `Clip.metadataUri` points to a Grove JSON document produced by the pipeline. That document
  contains the assets block the frontend uses today (`assets.alignment`, `translations[].grove_url`,
  `translations[].clip_grove_url`, etc.).
- `Clip.alignmentUri` is a convenience pointer that already resolves to the full-song alignment
  JSON with word-level timestamps.
- Free-tier experiences use the clip-only slices by reading the `clip_grove_url` entries in the
  metadata; paying users fetch the full `grove_url`. No schema changes are required: clients simply
  query the subgraph to discover the Grove URLs and fetch the pre-sliced data directly from Grove.

This is exactly how the existing `MediaPage` in the React app works, so any Lit Action or backend
service can mirror the same flow once this subgraph is deployed to a public Graph endpoint.

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
