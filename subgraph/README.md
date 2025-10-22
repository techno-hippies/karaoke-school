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

## Local Development (Optional)

To run a local Graph Node for development:

### Prerequisites
- Docker and Docker Compose

### Steps

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

## Deployed Contracts

- **SongEvents:** `0x912fA332604d7cA38a87446f2f7c0927EFB5dD3d`
- **SegmentEvents:** `0x4b410DA7e0D87fB0e4116218e3319FF9acAd82c8`
- **PerformanceGrader:** `0x14d17Fe89Ae9ED52243A03A1729F7a2413EAc2a0`
- **AccountEvents:** `0xb31b8abB319Ee6AB6f0706E0086bEa310E25da22`

## Queries

Example queries once deployed:

### Get songs by artist

```graphql
query GetArtistSongs($geniusArtistId: BigInt!) {
  songs(where: { geniusArtistId: $geniusArtistId }) {
    id
    geniusId
    metadataUri
    registeredAt
    segmentCount
    performanceCount
    segments {
      id
      tiktokUrl
      metadataUri
      performanceCount
      averageScore
    }
  }
}
```

### Get trending songs (by performance count)

```graphql
query TrendingSongs($limit: Int!) {
  songs(
    first: $limit
    orderBy: performanceCount
    orderDirection: desc
  ) {
    id
    geniusId
    metadataUri
    performanceCount
    segmentCount
  }
}
```

### Get user performances

```graphql
query GetUserPerformances($address: Bytes!) {
  account(id: $address) {
    address
    lensHandle
    performanceCount
    averageScore
    performances(orderBy: gradedAt, orderDirection: desc) {
      id
      score
      metadataUri
      gradedAt
      segment {
        tiktokUrl
        song {
          geniusId
          metadataUri
        }
      }
    }
  }
}
```

### Global stats

```graphql
query GlobalStats {
  globalStats(id: "global") {
    totalSongs
    totalSegments
    totalPerformances
    totalAccounts
  }
}
```
