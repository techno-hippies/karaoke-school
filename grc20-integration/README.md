# GRC-20 Integration for Karaoke School

**Blockchain-native music knowledge graph powered by The Graph GRC-20.**

---

## Overview

This integration replaces traditional smart contract storage with GRC-20's knowledge graph standard, reducing gas costs by **99%+** while maintaining decentralization and immutability.

### Architecture

```
Neon DB (Postgres)
  ↓ Validation & Enrichment
GRC-20 Knowledge Graph (IPFS + The Graph)
  ↓ GraphQL API
App Frontend (React + Lens SDK)
```

### Key Benefits

| Traditional Contracts | GRC-20 |
|----------------------|--------|
| 28k gas per song | 10k gas per 50 songs |
| Fixed schema | Flexible graph |
| 1000 songs = $500 | 1000 songs = $5 |
| Hard to extend | Easy to add relations |

---

## Data Model

### Entity Types

1. **Musical Work** (composition/song as written)
   - Properties: title, duration, ISWC (optional), Spotify ID
   - Relations: performed by Artist, has Recording

2. **Audio Recording** (specific recorded version)
   - Properties: ISRC, MusicBrainz recording MBID
   - Relations: recording of Work

3. **Karaoke Segment** (processed clip for practice)
   - Properties: start/end time, instrumental URI, alignment URI
   - Relations: segment of Recording

4. **Musical Artist** (performer/composer)
   - Properties: name, ISNI (optional), Lens account
   - Relations: performed Work

5. **Performance** (user karaoke attempt)
   - Properties: score, Lens post URI
   - Relations: performance of Segment, performed by Artist

### Identifier Strategy

- **Primary Key**: GRC-20 entity ID (blockchain-native)
- **Foreign Keys**: ISWC, ISRC, ISNI, MusicBrainz IDs (optional metadata)
- **Lookup Key**: Spotify Track ID (most common query)

---

## Setup

### 1. Install Dependencies

```bash
cd grc20-integration
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env

# Add encrypted secrets with dotenvx
dotenvx set PRIVATE_KEY "0x..." -f .env
dotenvx set DATABASE_URL "postgresql://..." -f .env

# Or edit .env manually and encrypt it:
# - PRIVATE_KEY: Wallet private key
# - DATABASE_URL: Neon connection string
# - GRC20_NETWORK: TESTNET or MAINNET

# IMPORTANT: Ensure DOTENV_PRIVATE_KEY is set in your environment
# (should be configured in .claude/settings.local.json)
```

### 3. Create GRC-20 Space

```bash
# All scripts use dotenvx for secure environment handling
bun run setup
```

This creates a new GRC-20 space called "Songverse" and saves the space ID to `.env`.

**Note**: Scripts automatically use `dotenvx run -f .env` - never pass secrets inline.

### 4. Define Music Types

```bash
bun run define-types
```

Creates all entity types (Work, Recording, Segment, Artist, Performance) and their properties. Saves type IDs to `type-ids.json`.

**Gas Cost**: ~10k gas (one-time)

### 5. Import Musical Works

```bash
bun run import-works
```

Reads validated tracks from Neon DB and creates GRC-20 entities. Batches 50 entities per transaction.

**Gas Cost per batch**: ~10k gas
**Example**: 1000 songs = 20 batches × 10k gas = ~$5-10

### 6. Import Karaoke Segments

```bash
bun run import-segments
```

Creates segment entities linked to parent works. Includes Grove URIs for instrumental and alignment data.

**Gas Cost**: Same as works (~10k per 50 segments)

---

## Querying Data

### From Frontend (TypeScript)

```typescript
import { createClient, getPropertyValue } from '@karaoke-school/grc20-integration/queries';

const client = createClient();

// Get work by Spotify ID
const work = await client.getWorkBySpotifyId('043dDJ9u0PQ3ooAXMgcwOe');
console.log(work.name); // "TEXAS HOLD 'EM"

// Get ISWC (optional field)
const iswc = getPropertyValue(work, 'ISWC');
console.log(iswc); // "T-123.456.789-0" or null

// Get segments for karaoke practice
const segments = await client.getSegmentsByWork(work.id);
for (const segment of segments) {
  const instrumentalUri = getPropertyValue(segment, 'Instrumental Audio URI');
  const alignmentUri = getPropertyValue(segment, 'Word Alignment URI');

  // Play karaoke segment with word-level timing
  playKaraoke(instrumentalUri, alignmentUri);
}
```

### GraphQL Queries

```graphql
# Get work by Spotify ID
query GetWork($spotifyId: String!) {
  entities(
    where: {
      properties_some: {
        property_: { name: "Spotify ID" }
        value: $spotifyId
      }
    }
  ) {
    id
    name
    properties {
      property { name }
      value
    }
    relations {
      property { name }
      target { id, name }
    }
  }
}

# Get segments for a work
query GetSegments($workId: ID!) {
  entity(id: $workId) {
    relations(where: { property_: { name: "Has Segment" } }) {
      target {
        id
        name
        properties {
          property { name }
          value
        }
      }
    }
  }
}
```

---

## Data Flow

### Full Pipeline: TikTok → Neon → GRC-20 → App

```
1. TikTok Video
   ↓ Download (freyr-service)

2. Audio Processing
   ↓ Demucs separation (vocals + instrumental)
   ↓ Gemini segmentation (find ~190s karaoke-worthy clip)
   ↓ fal.ai enhancement (190s high-quality instrumental)
   ↓ FFmpeg cropping (50s TikTok clip)
   ↓ Grove upload (get CIDs)
   ↓ ElevenLabs alignment (word-level timing)

3. Neon DB Validation
   ↓ Check MusicBrainz for ISRC/ISWC/ISNI
   ↓ Verify Grove URLs accessible
   ↓ Mark as ready for minting

4. GRC-20 Minting (this integration)
   ↓ Batch 50 entities per edit
   ↓ Post IPFS CID on-chain (~10k gas)
   ↓ The Graph indexes entities

5. App Frontend
   ↓ Query via GraphQL
   ↓ Fetch Grove assets
   ↓ Display karaoke UI with word timing
   ↓ Record user performance

6. Performance Grading
   ↓ Submit to Lit Action (off-chain compute)
   ↓ Grade pronunciation/timing
   ↓ Post score on-chain (PerformanceGrader contract)
   ↓ Create Performance entity in GRC-20
```

---

## Integration with Existing Systems

### With Master-Pipeline (PKP/Lens Accounts)

```typescript
// After creating PKP + Lens account (master-pipeline/lib/pkp.ts)
import { Graph, Ipfs } from '@graphprotocol/grc-20';

// Create artist entity in GRC-20
const { id: artistId, ops } = Graph.createEntity({
  name: artistName,
  types: [types.musicalArtist],
  values: [
    { property: properties.lensAccount, value: lensAccountAddress },
    { property: properties.pkpAddress, value: pkpAddress },
    { property: properties.isni, value: isni || '' },
    { property: properties.mbid, value: artistMbid || '' },
  ],
});

// Link works to artist
const { ops: linkOps } = Graph.updateEntity(workId, {
  relations: {
    [properties.performedBy]: {
      toEntity: artistId,
    },
  },
});

// Publish to IPFS + on-chain
await publishEdit([...ops, ...linkOps], 'Create artist + link works');
```

### With Performance Grader (Lit Actions)

```typescript
// After Lit Action grades performance
import { Graph } from '@graphprotocol/grc-20';

// Create performance entity
const { ops } = Graph.createEntity({
  name: `Performance by ${username}`,
  types: [types.performance],
  values: [
    { property: properties.performanceScore, value: Graph.serializeNumber(score) },
    { property: properties.lensPostUri, value: lensPostId },
  ],
  relations: {
    [properties.hasPerformance]: { toEntity: segmentId },
    [properties.performedBy]: { toEntity: userAccountId },
  },
});

await publishEdit(ops, 'Record performance');
```

### With Sponsorship API (Wallet Scoring)

Query user's performance history via GRC-20:

```typescript
// Get user's performances
const user = await client.getEntityById(userAccountId);
const performances = getRelatedEntities(user, 'Has Performance');

// Calculate stats for sponsorship eligibility
const totalPerformances = performances.length;
const avgScore = performances.reduce((sum, p) => {
  return sum + parseInt(getPropertyValue(p, 'Performance Score') || '0');
}, 0) / totalPerformances;

// Sponsor if avgScore > 7000 (70%)
if (avgScore > 7000) {
  sponsorUser(userAddress);
}
```

---

## Comparison: Old vs New Architecture

### Old: Contract-Based

```solidity
// SongEvents.sol
event SongRegistered(
  uint32 geniusId,  // ❌ Locked into Genius namespace
  string metadataUri,
  address registeredBy
);

// Cost: 28k gas per song
// Flexibility: Low (fixed schema)
// Queries: Via subgraph (custom schema)
```

### New: GRC-20

```typescript
// Musical Work entity
Graph.createEntity({
  name: 'TEXAS HOLD \'EM',
  types: ['Musical Work'],
  values: [
    { property: 'Spotify ID', value: '...' },
    { property: 'ISWC', value: '...' },  // ✅ Optional
    { property: 'MBID', value: '...' },  // ✅ Optional
  ],
});

// Cost: 10k gas per 50 songs (99% cheaper)
// Flexibility: High (add properties/relations anytime)
// Queries: Via The Graph (standardized GRC-20 schema)
```

---

## Gas Cost Breakdown

### 1,000 Songs + 1,000 Segments

| Operation | Old (Contracts) | New (GRC-20) | Savings |
|-----------|----------------|--------------|---------|
| Song registration | 1000 × 28k = 28M gas | 20 batches × 10k = 200k gas | **99.3%** |
| Segment registration | 1000 × 30k = 30M gas | 20 batches × 10k = 200k gas | **99.3%** |
| Total | 58M gas (~$580) | 400k gas (~$4) | **99.3%** |

### 10,000 Songs Catalog

| Old | New | Savings |
|-----|-----|---------|
| ~$5,800 | ~$40 | **99.3%** |

---

## Troubleshooting

### "Space not found"

Run `bun run setup` to create a space first.

### "Type IDs not found"

Run `bun run define-types` before importing data.

### "Entity map not found"

Run `bun run import-works` before `import-segments`.

### "Transaction failed"

Check wallet has testnet ETH:
- Lens Testnet: https://faucet.lens.dev
- Check balance: `bun run scripts/check-balance.ts`

### "IPFS upload failed"

Ensure Irys gateway is accessible. Check network:
```bash
curl -I https://gateway.irys.xyz
```

---

## Roadmap

- [ ] Artist entity import (with ISNI lookup)
- [ ] Performance entity creation (after Lit Action grading)
- [ ] Translation entities (line-level + word timing)
- [ ] Batch MusicBrainz ID updates (as data improves)
- [ ] ISWC acquisition flow (for indie artists)
- [ ] Royalty distribution (ISRC → payment address)

---

## Resources

- **The Graph GRC-20**: https://github.com/graphprotocol/grc-20
- **Geo Genesis Browser**: https://www.geobrowser.io
- **GRC-20 Spec**: https://thegraph.com/blog/grc-20-knowledge-graph-standard
- **MusicBrainz API**: https://musicbrainz.org/doc/MusicBrainz_API

---

## Support

Questions? Open an issue or ask in The Graph Discord.

**Built with ❤️ for karaoke learners worldwide**
