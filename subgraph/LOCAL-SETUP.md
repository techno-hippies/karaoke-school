# Local Subgraph Development Setup

This guide explains how to run a local Graph Node that indexes events from Lens Testnet contracts.

## Prerequisites

- **PostgreSQL** installed and running
- **Graph CLI** with gnd (`graph node install`)
- **Lens Testnet RPC** access (https://rpc.testnet.lens.xyz)

## Step 1: Install Graph Node Dev Mode (gnd)

```bash
# Install gnd via Graph CLI
graph node install

# Verify installation
gnd --version
```

## Step 2: Setup PostgreSQL (if needed)

### Unix/Linux/macOS
gnd automatically creates a temporary Postgres instance in `./build` - no setup needed!

### Windows
```bash
# Launch psql as SUPERUSER
psql -U postgres

# Run these commands:
create user graph with password 'yourpassword';
create database "graph-node" with owner=graph template=template0 encoding='UTF8' locale='C';
\c graph-node
create extension pg_trgm;
create extension btree_gist;
create extension postgres_fdw;
grant usage on foreign data wrapper postgres_fdw to graph;
```

## Step 3: Build the Subgraph

```bash
cd /media/t42/th42/Code/karaoke-school-v1/subgraph

# Generate TypeScript bindings from ABIs
npm run codegen

# Build AssemblyScript mappings
npm run build
```

## Step 4: Start Local Graph Node

### Unix/Linux/macOS (Automatic Postgres)

**IMPORTANT: PostgreSQL must be in PATH.** Run this single command:

```bash
# Add PostgreSQL 16 to PATH and start gnd
export PATH="/usr/lib/postgresql/16/bin:$PATH" && \
  gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz --watch
```

**Key points:**
- Network name must be `lens-testnet:` (matches `subgraph.yaml` network declarations)
- The `--watch` flag auto-redeploys when you make changes
- gnd automatically creates a temporary Postgres instance in `./build` - no manual setup needed
- First run will download blocks (5-10 minutes on initial sync)

### Windows (Manual Postgres URL)

```bash
gnd --ethereum-rpc local:https://rpc.testnet.lens.xyz \
    --postgres-url "postgresql://graph:yourpassword@localhost:5432/graph-node" \
    --watch
```

## Step 5: Verify Indexing

Once gnd starts, you should see:

```
✓ Starting Graph Node...
✓ Connected to Lens Testnet (chain: 37111)
✓ Indexing subgraph: subgraph-0
✓ Started at block: 4187060
✓ GraphQL endpoint: http://localhost:8000/subgraphs/name/subgraph-0/
```

Check indexing status:

```bash
curl http://localhost:8000/subgraphs/name/subgraph-0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ _meta { block { number } } }"}'
```

## Step 6: Test Queries

### Get all segments

```bash
curl -X POST http://localhost:8000/subgraphs/name/subgraph-0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ segments(first: 5) { id spotifyTrackId instrumentalUri translationCount } }"}'
```

### Get segment with translations

```bash
curl -X POST http://localhost:8000/subgraphs/name/subgraph-0/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ segment(id: \"0xabc...\") { id translations { languageCode translationUri } } }"}'
```

## Step 7: Run the App

In a separate terminal:

```bash
cd /media/t42/th42/Code/karaoke-school-v1/app

# Start dev server (will use local subgraph automatically)
bun run dev
```

The app will automatically connect to `http://localhost:8000/subgraphs/name/subgraph-0/` in development mode.

## Expected Indexing Time

- **Initial sync**: ~5-10 minutes (from block 4187060 to latest)
- **Event processing**: ~30 seconds (28 segments + 84 translations)
- **Total**: ~10 minutes until data is queryable

## Monitoring Indexing Progress

Watch the gnd console output:

```
Block #4187060: Processing SegmentRegistered event...
Block #4187064: Processing SegmentProcessed event...
Block #4187066: Processing TranslationAdded event (id)...
Block #4187067: Processing TranslationAdded event (vi)...
Block #4187069: Processing TranslationAdded event (zh)...
...
✓ Synced to block 4187500 (current head)
```

## Troubleshooting

### "Failed to start initdb" / "Is it installed and on your path?"

**Issue**: gnd needs PostgreSQL tools (`initdb`) to create the temp database, but they're not in PATH

**Fix**: Add PostgreSQL 16 to PATH before running gnd:
```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH"
gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz --watch
```

Or as a single command:
```bash
export PATH="/usr/lib/postgresql/16/bin:$PATH" && \
  gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz --watch
```

### "Failed to connect to Ethereum node"

**Issue**: Cannot reach Lens Testnet RPC

**Fix**: Verify RPC is accessible:
```bash
curl https://rpc.testnet.lens.xyz \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### "Database error: relation does not exist"

**Issue**: Postgres schema not initialized

**Fix**:
- Unix: Delete `./build` folder and restart gnd
- Windows: Recreate the database (see Step 2)

### "Subgraph failed: Contract call reverted"

**Issue**: Contract address mismatch or wrong network

**Fix**: Verify contract addresses in `subgraph.yaml`:
- SegmentEvents: `0x4b410DA7e0D87fB0e4116218e3319FF9acAd82c8`
- TranslationEvents: `0x5A49E23A5C3a034906eE0274c266A08805770C70`

### "network not supported by registrar: no network X found"

**Issue**: The `--ethereum-rpc` network name doesn't match what's in `subgraph.yaml`

**Fix**: This subgraph uses `network: lens-testnet` in its data sources, so start gnd with:
```bash
gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz --watch
```

The format is: `--ethereum-rpc [NETWORK_NAME]:[RPC_URL]`

### "No events found"

**Issue**: Start block is after emission blocks

**Fix**: Update `startBlock: 4187060` in `subgraph.yaml` (first emission was at block ~4187060)

## Hot Reloading

With `--watch` flag, gnd automatically redeploys when you:
1. Update mappings (`src/mappings.ts`)
2. Change schema (`schema.graphql`)
3. Rebuild subgraph (`npm run build`)

No need to restart gnd!

## Production Deployment

Once local testing is complete, deploy to The Graph Studio:

```bash
# Authenticate
graph auth --studio <DEPLOY_KEY>

# Deploy
graph deploy --studio karaoke-school-v1
```

Then update `app/src/lib/graphql/client.ts` to use the studio endpoint in production.

## Resources

- [Graph Node Dev Mode Docs](https://thegraph.com/docs/en/developing/creating-a-subgraph/)
- [Lens Testnet Explorer](https://block-explorer.testnet.lens.xyz/)
- [Subgraph Schema Reference](./schema.graphql)
