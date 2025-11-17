# Subgraph - Agent Guide

## Core Commands

• **Generate**: `npm run codegen` (Generate TypeScript bindings from ABIs)
• **Build**: `npm run build` (Compile subgraph schema and mappings)
• **Deploy**: `graph deploy --studio karaoke-school-v1`
• **Local**: `graph init --product hosted-service <endpoint>`

## Service Architecture

**Purpose**: The Graph subgraph for indexing smart contract events and providing fast GraphQL queries for the karaoke app

**Core Dependencies**:
- **Graph CLI**: Subgraph development and deployment
- **TypeScript**: Mapping functions for event processing
- **GraphQL**: Query interface for app data
- **Contract ABIs**: Interface definitions from deployed contracts

## Key Patterns

**Event-Driven Indexing**:
```typescript
// subgraph/src/mappings.ts
import { SegmentRegistered } from '../generated/SegmentEvents/SegmentEvents';
import { Segment as SegmentEntity } from '../generated/schema';

export function handleSegmentRegistered(event: SegmentRegistered): void {
  // Create new Segment entity from contract event
  const segment = new SegmentEntity(event.params.segmentHash);
  segment.grc20WorkId = event.params.grc20WorkId;
  segment.spotifyTrackId = event.params.spotifyTrackId;
  segment.metadataUri = event.params.metadataUri;
  segment.registeredBy = event.params.registeredBy;
  segment.registeredAt = event.block.timestamp;
  segment.save();
}
```

**Entity Relationships**:
```graphql
# schema.graphql
type Segment @entity {
  id: ID!                    # segmentHash (bytes32)
  grc20WorkId: String!       # GRC-20 work UUID
  spotifyTrackId: String!    # Spotify track ID
  instrumentalUri: String    # Grove audio URI
  alignmentUri: String       # Grove alignment JSON
  translations: [Translation!]! @derivedFrom(field: "segment")
  registeredAt: BigInt!      # Event timestamp
  processedAt: BigInt        # Processing completion
}

type Translation @entity {
  id: ID!                    # segmentHash-languageCode
  segment: Segment!          # Parent segment
  languageCode: String!      # ISO 639-1: "es", "zh", "ja"
  translationUri: String!    # Grove translation JSON
  confidenceScore: BigInt!   # 0-10000
  validated: Boolean!        # Human verification
  addedAt: BigInt!           # Event timestamp
}
```

## Development Patterns

**Environment Setup**:
```bash
# Install Graph CLI
npm install -g @graphprotocol/graph-cli

# Configure subgraph
npm run codegen      # Generate TS bindings from ABIs
npm run build        # Compile schema and mappings

# Test locally
graph init --product hosted-service --from-contract <address>
```

**Development Flow**:
1. **Update ABIs**: Copy from deployed contracts
2. **Generate types**: `npm run codegen`
3. **Update mappings**: Handle new events
4. **Test locally**: `graph local create && graph local deploy`
5. **Deploy**: `graph deploy --studio`

## Critical Files

**Schema**: `schema.graphql` - Entity definitions and relationships
**Mappings**: `src/mappings.ts` - Event handlers for contract events
**Config**: `subgraph.yaml` - Contract addresses and ABI paths
**Generated**: `generated/` - TypeScript bindings from ABIs

## Subgraph Schema

### Segment Entity
```graphql
type Segment @entity {
  # Primary key (from contract)
  id: ID!                    # bytes32 segmentHash
  
  # References to other layers
  grc20WorkId: String!       # Links to GRC-20 public metadata
  spotifyTrackId: String!    # For audio matching
  
  # Asset URIs (from Grove/IPFS)
  metadataUri: String!       # Full segment metadata
  instrumentalUri: String    # Enhanced karaoke audio
  alignmentUri: String       # ElevenLabs word timing
  
  # Processing pipeline
  registeredAt: BigInt!      # SegmentRegistered event
  processedAt: BigInt        # SegmentProcessed event
  translationCount: Int!     # Number of translations
  
  # Relations
  translations: [Translation!]! @derivedFrom(field: "segment")
  performances: [Performance!]! @derivedFrom(field: "segment")
  tiktokVideos: [TikTokVideo!]! @derivedFrom(field: "segment")
}
```

### Translation Entity
```graphql
type Translation @entity {
  # Composite key: segmentHash-languageCode
  id: ID!
  
  # Parent segment
  segment: Segment!
  
  # Translation metadata
  languageCode: String!      # ISO 639-1: "es", "zh", "ja", "ko"
  translationUri: String!    # Grove JSON with word timing
  translationSource: String! # "gemini-flash-2.5"
  
  # Quality metrics
  confidenceScore: BigInt!   # 0-10000
  validated: Boolean!        # Human review status
  
  # Timestamps
  addedAt: BigInt!           # TranslationAdded event
  updatedAt: BigInt          # TranslationUpdated event
}
```

### TikTok Video Entity
```graphql
type TikTokVideo @entity {
  id: ID!                    # videoId string
  
  # Links
  segment: Segment!          # Referenced karaoke segment
  creator: Creator!          # TikTok creator profile
  
  # Video data
  videoUri: String!          # Grove URI for TikTok clip
  copyrightStatus: String!   # "copyrighted" | "copyright-free"
  
  # Story Protocol integration
  storyIpAssetId: String     # IP Asset ID
  revenueSplitCreator: Int   # 18 for copyrighted
  
  # Platform metrics
  playCount: BigInt
  likeCount: BigInt
  commentCount: BigInt
  
  # Timestamps
  createdAt: BigInt!         # TikTokVideoMinted event
  mintedAt: BigInt!          # Story Protocol registration
}
```

## Contract Integration

**ABI Management**:
```yaml
# subgraph.yaml
specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - name: SegmentEvents
    network: lens-testnet
    source:
      address: "0x..."      # Deployed contract address
      abi: SegmentEvents
      startBlock: 12345678  # Deployment block
  
  - name: TranslationEvents
    network: lens-testnet
    source:
      address: "0x..."      # Deployed contract address
      abi: TranslationEvents
      startBlock: 12345678
  
  - name: TikTokVideoEvents
    network: lens-testnet
    source:
      address: "0x..."      # Deployed contract address
      abi: TikTokVideoEvents
      startBlock: 12345678

templates:
  - name: SegmentTemplate
    kind: ethereum/contract
    network: lens-testnet
    source:
      abi: SegmentEvents
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - Segment
        - Translation
      abis:
        - name: SegmentEvents
          file: ./abis/SegmentEvents.json
      eventHandlers:
        - event: SegmentRegistered(indexed bytes32,indexed string,string,uint32,uint32,string,indexed address,uint64)
          handler: handleSegmentRegistered
        - event: SegmentProcessed(indexed bytes32,string,string,uint8,string,uint64)
          handler: handleSegmentProcessed
```

**Event Handlers**:
```typescript
// src/mappings.ts
import { SegmentRegistered, SegmentProcessed } from '../generated/templates/SegmentTemplate/SegmentTemplate';
import { TranslationAdded } from '../generated/TranslationEvents/TranslationEvents';
import { Segment, Translation, TikTokVideo } from '../generated/schema';

// Handle segment registration
export function handleSegmentRegistered(event: SegmentRegistered): void {
  const segment = new Segment(event.params.segmentHash);
  segment.grc20WorkId = event.params.grc20WorkId;
  segment.spotifyTrackId = event.params.spotifyTrackId;
  segment.metadataUri = event.params.metadataUri;
  segment.registeredBy = event.params.registeredBy;
  segment.registeredAt = event.block.timestamp;
  segment.translationCount = 0;
  segment.save();
}

// Handle segment processing completion
export function handleSegmentProcessed(event: SegmentProcessed): void {
  const segment = Segment.load(event.params.segmentHash);
  if (segment) {
    segment.instrumentalUri = event.params.instrumentalUri;
    segment.alignmentUri = event.params.alignmentUri;
    segment.translationCount = event.params.translationCount;
    segment.processedAt = event.block.timestamp;
    segment.save();
  }
}

// Handle translation addition
export function handleTranslationAdded(event: TranslationAdded): void {
  const translationId = `${event.params.segmentHash}-${event.params.languageCode}`;
  const translation = new Translation(translationId);
  
  translation.segment = event.params.segmentHash;
  translation.languageCode = event.params.languageCode;
  translation.translationUri = event.params.translationUri;
  translation.translationSource = event.params.translationSource;
  translation.confidenceScore = event.params.confidenceScore;
  translation.validated = event.params.validated;
  translation.addedAt = event.block.timestamp;
  translation.save();
  
  // Update parent segment translation count
  const segment = Segment.load(event.params.segmentHash);
  if (segment) {
    segment.translationCount = segment.translationCount + 1;
    segment.save();
  }
}
```

## Deployment

**Studio Deployment**:
```bash
# Deploy to Graph Studio
graph deploy --studio kschool-alpha-1

# With authentication
graph deploy --studio \
  --access-token $GRAPH_ACCESS_TOKEN \
  kschool-alpha-1

# Deploy specific version
graph deploy --studio \
  --version v0.0.2 \
  kschool-alpha-1
```

**Hosted Service** (legacy):
```bash
# Deploy to hosted service
graph deploy \
  --product hosted-service \
  --node https://api.thegraph.com/deploy/ \
  --access-token $GRAPH_ACCESS_TOKEN \
  <GITHUB_USER>/<SUBGRAPH_NAME>
```

**Local Development**:
```bash
# Initialize local subgraph
graph init --product local-node

# Create and deploy locally
graph create karaoke-school-v1 --node http://localhost:8020/
graph deploy karaoke-school-v1 --ipfs http://localhost:5001 --node http://localhost:8020/

# Query locally
curl -X POST http://localhost:8000/subgraphs/name/karaoke-school-v1 \
  -H "Content-Type: application/json" \
  -d '{"query":"{ segments(first: 5) { id spotifyTrackId instrumentalUri } }"}'
```

## GraphQL Queries

**Basic Segment Queries**:
```graphql
# Get all segments for a Spotify track
query GetTrackSegments($spotifyId: String!) {
  segments(where: { spotifyTrackId: $spotifyId }) {
    id
    grc20WorkId
    instrumentalUri
    alignmentUri
    translationCount
    registeredAt
    processedAt
  }
}

# Get segments with Spanish translations
query GetSpanishSegments {
  translations(where: { languageCode: "es" }) {
    segment {
      id
      spotifyTrackId
      instrumentalUri
    }
    translationUri
    confidenceScore
    validated
  }
}
```

**Complex Queries**:
```graphql
# Get complete segment data with all translations
query GetCompleteSegment($segmentId: ID!) {
  segment(id: $segmentId) {
    id
    grc20WorkId
    spotifyTrackId
    instrumentalUri
    alignmentUri
    translations {
      languageCode
      translationUri
      confidenceScore
      validated
    }
    performances {
      performer
      score
      gradedAt
    }
    tiktokVideos {
      videoId
      videoUri
      copyrightStatus
      creator {
        handle
        name
      }
    }
  }
}

# Search segments by language availability
query SearchByLanguages($languages: [String!]!) {
  segments(where: { translationCount_gt: 0 }) {
    id
    spotifyTrackId
    translations(where: { 
      languageCode_in: $languages
    }) {
      languageCode
      translationUri
    }
  }
}
```

## App Integration

**Frontend Queries**:
```typescript
// React component using The Graph
import { useQuery, gql } from '@apollo/client';

const GET_SEGMENT = gql`
  query GetSegment($segmentId: ID!) {
    segment(id: $segmentId) {
      id
      grc20WorkId
      spotifyTrackId
      instrumentalUri
      alignmentUri
      translations {
        languageCode
        translationUri
        confidenceScore
        validated
      }
    }
  }
`;

function KaraokePlayer({ segmentId }: { segmentId: string }) {
  const { data, loading, error } = useQuery(GET_SEGMENT, {
    variables: { segmentId }
  });

  if (loading) return <div>Loading karaoke data...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <audio src={data.segment.instrumentalUri} />
      <LyricsDisplay 
        alignment={data.segment.alignmentUri}
        translation={data.segment.translations.find(t => t.languageCode === 'es')}
      />
    </div>
  );
}
```

**Subgraph URL Configuration**:
```typescript
// config/subgraph.ts
export const GRAPH_ENDPOINTS = {
  // Mainnet
  mainnet: 'https://api.thegraph.com/subgraphs/name/karaoke-school-v1',
  // Testnet (Lens)
  testnet: 'https://api.thegraph.com/subgraphs/name/karaoke-school-v1-testnet',
  // Local development
  local: 'http://localhost:8000/subgraphs/name/karaoke-school-v1'
};

export const getSubgraphEndpoint = (network: string): string => {
  return GRAPH_ENDPOINTS[network as keyof typeof GRAPH_ENDPOINTS] || GRAPH_ENDPOINTS.testnet;
};
```

## Performance Optimization

**Indexing Strategy**:
```graphql
# Schema with indexes
type Segment @entity {
  id: ID!                    # @primary
  spotifyTrackId: String!    # @index (for track lookups)
  grc20WorkId: String!       # @index (for GRC-20 queries)
  processedAt: BigInt        # @index (for recent segments)
}

type Translation @entity {
  id: ID!                    # @primary
  segment: Segment!          # @derivedFrom
  languageCode: String!      # @index (for language queries)
  confidenceScore: BigInt    # @index (for quality filtering)
}
```

**Query Performance**:
```graphql
# Efficient queries with limits
query GetRecentSegments($limit: Int!, $offset: Int!) {
  segments(
    first: $limit
    skip: $offset
    orderBy: registeredAt
    orderDirection: desc
    where: { processedAt_not: null }
  ) {
    id
    spotifyTrackId
    instrumentalUri
    translationCount
  }
}

# Batch loading with fragments
query GetSegmentBatch($ids: [ID!]!) {
  segments(where: { id_in: $ids }) {
    ...SegmentInfo
    translations(first: 5) {
      ...TranslationInfo
    }
  }
}

fragment SegmentInfo on Segment {
  id
  spotifyTrackId
  instrumentalUri
  alignmentUri
}

fragment TranslationInfo on Translation {
  languageCode
  translationUri
  confidenceScore
}
```

## Monitoring & Analytics

**Query Analytics**:
```typescript
// Track query performance
const queryWithMetrics = async (query: string, variables?: any) => {
  const start = performance.now();
  const result = await graphClient.query({ query, variables });
  const duration = performance.now() - start;
  
  console.log(`Query completed in ${duration.toFixed(2)}ms`);
  
  // Alert if slow
  if (duration > 1000) {
    console.warn(`Slow query detected: ${duration}ms`);
  }
  
  return result;
};
```

**Subgraph Health**:
```bash
# Check subgraph status
curl -X POST https://api.thegraph.com/index-node/graphql \
  -d '{"query":"{ indexingStatusForCurrentVersion(subgraphName: \"karoke-school-v1\") { synced health { id url code message } } }"}'

# Get indexing progress
curl -X POST https://api.thegraph.com/index-node/graphql \
  -d '{"query":"{ block(number: 12345678) { hash timestamp } }"}'
```

## Troubleshooting

**Indexing Issues**:
```bash
# Check if subgraph is syncing
query {
  _meta {
    block {
      number
      hash
    }
  }
}

# Debug mapping errors
# Check subgraph logs in Graph Studio
# Look for runtime errors in mappings
```

**Query Errors**:
```typescript
// Validate query syntax
const validateQuery = (query: string) => {
  try {
    gql(query); // Parse query
    return true;
  } catch (error) {
    console.error('Invalid GraphQL query:', error);
    return false;
  }
};

// Handle network errors
const handleGraphQLError = (error: ApolloError) => {
  if (error.networkError) {
    console.error('Network error:', error.networkError);
    // Retry logic
  }
  if (error.graphQLErrors.length > 0) {
    error.graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`GraphQL error: ${message}`, locations, path);
    });
  }
};
```

**Performance Issues**:
```graphql
# Add query complexity analysis
query {
  __schema {
    types {
      name
      fields {
        name
        args {
          name
        }
      }
    }
  }
}

# Use query cost analysis
# https://graphql.org/graphql-js/utilities/
```

## Migration & Versioning

**Schema Changes**:
```bash
# Create new version
graph deploy --studio --version v0.0.2 karaoke-school-v1

# Migration script for data changes
# Update existing entities when schema changes
export function handleSchemaMigration(): void {
  const segments = Segment.loadAll();
  for (const segment of segments) {
    // Apply schema changes
    if (!segment.translationCount) {
      segment.translationCount = 0;
      segment.save();
    }
  }
}
```

**Zero-Downtime Deployments**:
```bash
# Deploy to staging first
graph deploy --studio karaoke-school-v1-staging

# Test queries against staging
# Switch production to staging version
graph deploy --studio --version v0.0.2 karaoke-school-v1
```

## Future Enhancements

**Cross-Chain Indexing**:
```graphql
# Support multiple chains
type Segment @entity {
  id: ID!
  chainId: BigInt!           # Support L1, L2, sidechains
  contractAddress: Bytes!    # Chain-specific address
}
```

**Real-Time Updates**:
```typescript
// WebSocket subscriptions for live data
const SUBSCRIBE_SEGMENTS = gql`
  subscription OnSegmentRegistered {
    segmentRegistered {
      id
      spotifyTrackId
      instrumentalUri
    }
  }
`;
```
