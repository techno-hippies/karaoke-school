# Karaoke School v1 - Agent Integration Guide

**AI-powered language learning through music with blockchain-native copyright tracking**

---

## 🏗️ Service Architecture Overview

### Core Services (Local Development - Production Ready)

| Service | Purpose | Status | Entry Point | Port | Network |
|---------|---------|--------|-------------|------|---------|
| **app/** | React frontend | ✅ Active | `bun run dev` | 5173 | Local |
| **karaoke-pipeline/** | Content processing | ✅ Active | `./supervisor.sh` | 8787 | Local |
| **contracts/** | Smart contracts (compiled) | ✅ Active | `forge build` | - | Lens Testnet |
| **subgraph/** | Event indexing | ✅ Active (Local) | `npm run build` | 8000 | Local (→ Lens Testnet) |

### Supporting Services (Local Development - Production Ready)

| Service | Purpose | Status | Entry Point | Port | Network |
|---------|---------|--------|-------------|------|---------|
| **audio-download-service** | Audio retrieval | ✅ Active | `bun start` | 3001 | Local |
| **quansic-service** | ISWC discovery | ✅ Active | `node server.js` | 3001 | Local |
| **bmi-service** | Broadcast Music Inc. | ✅ Active | `npm start` | 3001 | Local |
| **lit-actions** | AI scoring | ✅ Active | `npm run upload` | - | Base Sepolia |
| **demucs-runpod** | Audio separation | ✅ Active | Serverless | - | RunPod |
| **ffmpeg-service** | Audio processing | ✅ Active | `npm start` | - | Local |
| **sponsorship-api** | Creator monetization | ✅ Active | `npm start` | - | Local |

---

## 🏠 Current Development State (Local First)

**IMPORTANT**: All services are currently running in **local development mode**. This is intentional during the development phase. Deployment to testnet/production will occur once all functionality is validated and working properly.

### Local Development Configuration
- **Subgraph**: Configured for local Graph Node Dev Mode (pointing to Lens Testnet RPC)
- **Database**: Local Neon connection with full data
- **App**: Local React dev server with hot reload
- **Pipeline**: Local HTTP API server with all processing services
- **Contracts**: Compiled and ready (deployed to Lens Testnet, not actively used locally)

### Expected Development Flow
1. **Develop & Test Locally**: All services run locally with hot reload
2. **Validate Functionality**: End-to-end testing with local data
3. **Deploy to Testnet**: Once working, deploy subgraph and update app configuration
4. **Production Deployment**: Final deployment after testnet validation

---

## 🔗 Service Integration Points

### Data Flow Architecture

```
TikTok Content → Karaoke Pipeline → Grove Storage → Smart Contracts → Subgraph → React App
     ↓                    ↓                ↓              ↓             ↓            ↓
  8,196 videos    12-step processing   IPFS assets   Event emission   GraphQL    User Interface
```

### API Endpoints & Contracts

#### Karaoke Pipeline HTTP API
- **Base URL**: `http://localhost:8787`
- **Health Check**: `GET /health`
- **Trigger Pipeline Step**: `POST /trigger?step={1-12}&limit={count}`
- **Status Check**: `GET /status`

### Subgraph GraphQL (Local Development)
- **Base URL**: `http://localhost:8000/subgraphs/name/subgraph-0/`
- **Schema**: See `/subgraph/src/schema.graphql`
- **Key Entities**: Segment, Translation, Performance, Account, GlobalStats, SegmentLeaderboard
- **Configuration**: Graph Node Dev Mode (gnd) pointing to Lens Testnet RPC
- **Current State**: Local development mode with hot reload
- **Network**: Local → Lens Testnet (deployment pending validation)

#### Neon Database
- **Connection**: PostgreSQL via `neondatabase/serverless`
- **Project**: `frosty-smoke-70266868`
- **Key Tables**: `song_pipeline`, `karaoke_segments`, `lyrics_translations`

---

## 🏛️ Blockchain Integration

### Deployed Contracts (Lens Testnet - Chain ID: 37111)

#### Contract Addresses
```typescript
const CONTRACTS = {
  PerformanceGrader: "0x788A245B9AAB4E29D0152424b72bcB8Ac7c1E260",
  SongEvents: "0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6", 
  SegmentEvents: "0x012C266f5c35f7C468Ccc4a179708AFA871e2bb8",
  AccountEvents: "0x3709f41cdc9E7852140bc23A21adCe600434d4E8"
}
```

#### Event Signatures
```solidity
// SegmentEvents.sol
event SegmentRegistered(bytes32 segmentHash, string grc20WorkId, string spotifyTrackId, string metadataUri);
event SegmentProcessed(bytes32 segmentHash, string instrumentalUri, string alignmentUri, uint8 translationCount, string metadataUri);

// TranslationEvents.sol (NEEDS DEPLOYMENT)
event TranslationAdded(bytes32 segmentHash, string languageCode, string translationUri);
```

### GRC-20 v2 Integration
- **Space ID**: `78e6adba-6d19-49e8-8b12-9d1e72ecfd25`
- **Network**: Geo Testnet
- **API**: The Graph GRC-20 endpoint
- **Entities Minted**: 52 artists, 36 works, 39 recordings

---

## 🛠️ Development Workflow

### Local Development Setup

#### 1. Environment Configuration
```bash
# Required environment variables
cp .env.example .env.local

# Key variables
NEON_DATABASE_URL=postgresql://...
VITE_LENS_ENVIRONMENT=testnet
VITE_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/karaoke-school/ksc-1
GROVE_API_KEY=...
```

#### 2. Service Startup Sequence
```bash
# Start core services in parallel
cd karaoke-pipeline && ./supervisor.sh &      # Pipeline server (8787)
cd app && bun run dev &                       # React app (5173)
cd subgraph && npm run codegen && npm run build &  # Subgraph (8000)

# Start supporting services
cd audio-download-service && bun start &      # Audio service (3001)
cd quansic-service && node server.js &        # ISWC service (3001)
```

#### 3. Content Processing Pipeline
```bash
# Process new content through 12-step pipeline
curl -X POST "http://localhost:8787/trigger?step=1&limit=50"  # TikTok scraping
curl -X POST "http://localhost:8787/trigger?step=2&limit=20"  # Spotify resolution
curl -X POST "http://localhost:8787/trigger?step=6&limit=10"  # Audio download
curl -X POST "http://localhost:8787/trigger?step=8&limit=5"   # Demucs separation
curl -X POST "http://localhost:8787/trigger?step=10&limit=3"  # Audio enhancement
curl -X POST "http://localhost:8787/trigger?step=12&limit=1"  # Grove upload + events

# Monitor progress
curl http://localhost:8787/health
```

### Contract Deployment
```bash
cd contracts

# Compile all contracts
forge build

# Deploy to Lens testnet
forge script script/DeployEvents.s.sol \
  --rpc-url https://rpc.testnet.lens.xyz \
  --broadcast

# Verify contracts
forge verify-contract <address> SegmentEvents --chain lens-testnet
forge verify-contract <address> PerformanceGrader --chain lens-testnet
```

### Subgraph Development & Deployment (Current: Local)

#### Current Local Setup
```bash
cd subgraph

# Generate types and build for local development
npm run codegen
npm run build

# Start local Graph Node Dev Mode (gnd)
gnd --ethereum-rpc local:https://rpc.testnet.lens.xyz --watch

# Access local GraphQL endpoint: http://localhost:8000/subgraphs/name/subgraph-0/
```

**Current Configuration**:
- **Network**: Local Graph Node pointing to Lens Testnet RPC
- **Endpoint**: `http://localhost:8000/subgraphs/name/subgraph-0/`
- **Start Block**: 4187060 (first event emission)
- **Hot Reload**: Enabled with `--watch` flag
- **Expected Sync Time**: ~10 minutes initial, then real-time

#### Future Testnet Deployment
**Status**: Pending until local validation is complete

```bash
# Update subgraph.yaml for production
network: lens-testnet  # Change from "local"
update contract addresses to production values

# Generate types and build
npm run codegen
npm run build

# Deploy to The Graph Studio
graph deploy --studio ksc-1

# Update app configuration with new subgraph URL
```

**Requirements for Deployment**:
- All functionality validated locally
- Contract addresses updated to production values
- Network configuration changed from local to lens-testnet
- App configuration updated with production subgraph URL

---

## 📊 Data Schema & Types

### Core Database Tables

#### `karaoke_segments`
```sql
CREATE TABLE karaoke_segments (
  spotify_track_id TEXT PRIMARY KEY,
  fal_segment_start_ms INTEGER,
  fal_segment_end_ms INTEGER,
  fal_segment_duration_ms INTEGER,
  fal_segment_grove_cid TEXT,
  fal_segment_grove_url TEXT,
  tiktok_clip_start_ms INTEGER,
  tiktok_clip_end_ms INTEGER,
  tiktok_clip_grove_cid TEXT,
  tiktok_clip_grove_url TEXT
);
```

#### `elevenlabs_word_alignments`
```sql
CREATE TABLE elevenlabs_word_alignments (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT UNIQUE,
  words JSONB NOT NULL,           -- [{text: "Hello", start: 0.1, end: 0.5}, ...]
  total_words INTEGER NOT NULL,
  alignment_duration_ms INTEGER
);
```

#### `lyrics_translations`
```sql
CREATE TABLE lyrics_translations (
  id SERIAL PRIMARY KEY,
  spotify_track_id TEXT NOT NULL,
  language_code TEXT NOT NULL,    -- ISO 639-1: "zh", "vi", "id"
  lines JSONB NOT NULL,           -- Line-level with word timing
  UNIQUE(spotify_track_id, language_code)
);
```

### GraphQL Schema (Current Local Subgraph)

```graphql
type Segment @entity(immutable: false) {
  id: ID!                          # segmentHash
  segmentHash: Bytes!
  grc20WorkId: String!             # Links to GRC-20
  spotifyTrackId: String!
  segmentStartMs: Int!             # Start time in milliseconds
  segmentEndMs: Int!               # End time in milliseconds
  metadataUri: String!
  registeredBy: Bytes!
  registeredAt: BigInt!
  
  # Set after processing
  instrumentalUri: String          # Grove URI for instrumental
  alignmentUri: String             # Grove URI for word timing (ElevenLabs)
  processedAt: BigInt
  translationCount: Int!
  
  # Relations
  translations: [Translation!]! @derivedFrom(field: "segment")
  performances: [Performance!]! @derivedFrom(field: "segment")
  
  # Computed
  performanceCount: Int!
  averageScore: BigDecimal!
  hasInstrumental: Boolean!
  hasAlignments: Boolean!
}

type Translation @entity(immutable: false) {
  id: ID!                          # segmentHash-languageCode
  segment: Segment!
  segmentHash: Bytes!
  languageCode: String!            # "zh", "vi", "id"
  translationUri: String!          # Grove URI for translation JSON
  translationSource: String!       # "gemini-flash-2.5"
  confidenceScore: Int!            # 0-10000
  validated: Boolean!              # Human-verified
  addedBy: Bytes!
  addedAt: BigInt!
  updatedAt: BigInt
  enabled: Boolean!
  
  # Computed
  confidenceLevel: String!         # HIGH, MEDIUM, LOW
}

type Performance @entity(immutable: true) {
  id: ID!                          # performanceId
  performanceId: BigInt!
  segment: Segment!
  performer: Account!
  performerAddress: Bytes!
  score: Int!                      # 0-10000
  metadataUri: String!             # Grove URI for performance data
  gradedAt: BigInt!
  segmentHash: Bytes!
}

type Account @entity(immutable: false) {
  id: ID!                          # lensAccountAddress
  lensAccountAddress: Bytes!
  pkpAddress: Bytes!
  username: String!
  metadataUri: String!
  createdAt: BigInt!
  updatedAt: BigInt!
  verified: Boolean!
  
  # Relations
  performances: [Performance!]! @derivedFrom(field: "performer")
  
  # Stats
  performanceCount: Int!
  totalScore: BigInt!
  averageScore: BigDecimal!
  bestScore: Int!
}

type GlobalStats @entity(immutable: false) {
  id: ID!                          # "global"
  totalSegments: Int!
  totalPerformances: Int!
  totalAccounts: Int!
  totalTranslations: Int!
  enabledTranslations: Int!
}

type SegmentLeaderboard @entity(immutable: false) {
  id: ID!                          # segmentHash
  segment: Segment!
  totalPerformers: Int!
  averageScore: BigDecimal!
  highestScore: Int!
  lowestScore: Int!
  createdAt: BigInt!
  updatedAt: BigInt!
}
```

### Grove/IPFS Asset Structure

#### Segment Metadata (`grove://...`)
```json
{
  "segmentHash": "0xabc123...",
  "grc20WorkId": "f1d7f4c7-ca47-4ba3-9875-a91720459ab4",
  "spotifyTrackId": "43bCmCI0nSgcT7QdMXY6LV",
  "timing": {
    "fal_segment_start_ms": 45000,
    "fal_segment_end_ms": 235000,
    "duration_ms": 190000
  },
  "assets": {
    "instrumental": "grove://5d85ca354afb...",
    "alignment": "grove://abc123...",
    "translations": {
      "zh": "grove://def456...",
      "vi": "grove://ghi789...",
      "id": "grove://jkl012..."
    }
  }
}
```

#### Word Alignment (`grove://...`)
```json
{
  "spotifyTrackId": "43bCmCI0nSgcT7QdMXY6LV",
  "totalWords": 247,
  "alignmentDurationMs": 190000,
  "words": [
    {
      "text": "Hello",
      "start": 0.099,
      "end": 0.44,
      "loss": 3.57,
      "confidence": 0.96
    }
  ]
}
```

---

## 🔧 Agent Integration Patterns

### React App Integration

#### Authentication Flow
```typescript
// Context: AuthContext.tsx
interface AuthContext {
  user: UserProfile | null;
  isPKPReady: boolean;
  isLensReady: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

// Usage in components
const { user, isPKPReady, login } = useAuth();
```

#### Data Fetching Pattern
```typescript
// Custom hook pattern
function useTrackSegments(trackId: string) {
  return useQuery({
    queryKey: ['segments', trackId],
    queryFn: () => fetchTrackSegments(trackId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Component usage
function KaraokePlayer({ trackId }: { trackId: string }) {
  const { data: segments } = useTrackSegments(trackId);
  
  return (
    <div>
      <AudioPlayer src={segments.instrumentalUrl} />
      <LyricsDisplay words={segments.alignment?.words} />
    </div>
  );
}
```

#### Audio Recording Integration
```typescript
// Pattern for Lit Action grading
async function gradePerformance(audioBlob: Blob, trackId: string) {
  const audioBase64 = await blobToBase64(audioBlob);
  
  const result = await executeLitAction('karaoke-scorer-v4', {
    audioDataBase64: audioBase64,
    trackId,
    userAddress: user.pkpAddress,
  });
  
  return result;
}
```

### Pipeline Integration

#### HTTP API Client
```typescript
// Pattern for triggering pipeline steps
class PipelineClient {
  private baseUrl = 'http://localhost:8787';
  
  async triggerStep(step: number, limit: number = 10) {
    const response = await fetch(`${this.baseUrl}/trigger?step=${step}&limit=${limit}`, {
      method: 'POST'
    });
    return response.json();
  }
  
  async getHealth() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}
```

#### Database Integration
```typescript
// Pattern for Neon database queries
import { neon } from '@neondatabase/serverless';

class DatabaseClient {
  private sql = neon(process.env.DATABASE_URL!);
  
  async getProcessedSegments() {
    return this.sql`
      SELECT ks.*, gw.title, gw.artist_name
      FROM karaoke_segments ks
      JOIN grc20_works gw ON gw.spotify_track_id = ks.spotify_track_id
      WHERE ks.fal_segment_grove_url IS NOT NULL
      LIMIT 10;
    `;
  }
}
```

### Blockchain Integration

#### Contract Interaction
```typescript
// Pattern for contract calls
import { createPublicClient, http } from 'viem';
import { lensTestnet } from './chains';

const client = createPublicClient({
  chain: lensTestnet,
  transport: http(process.env.RPC_URL)
});

async function emitSegmentRegistered(segmentHash: string, metadata: SegmentMetadata) {
  const hash = await client.writeContract({
    address: CONTRACTS.SegmentEvents,
    abi: SEGMENT_EVENTS_ABI,
    functionName: 'emitSegmentRegistered',
    args: [segmentHash, metadata.grc20WorkId, metadata.spotifyTrackId, metadata.metadataUri]
  });
  
  return hash;
}
```

#### Subgraph Query Pattern
```typescript
// Pattern for GraphQL queries
import { gql, request } from 'graphql-request';

const SEGMENT_QUERY = gql`
  query GetSegment($spotifyId: String!) {
    segments(where: { spotifyTrackId: $spotifyId }) {
      id
      grc20WorkId
      instrumentalUri
      alignmentUri
      translations {
        languageCode
        translationUri
      }
    }
  }
`;

async function fetchSegment(spotifyId: string) {
  const data = await request(SUBGRAPH_URL, SEGMENT_QUERY, { spotifyId });
  return data.segments[0];
}
```

---

## 🐛 Common Integration Issues

### Authentication Problems
- **PKP not working**: Check WebAuthn browser support
- **Lens session issues**: Clear storage and re-authenticate
- **Network mismatches**: Verify testnet vs mainnet configuration

### Data Flow Issues
- **Subgraph not updating**: Check contract address configuration
- **Database queries failing**: Verify Neon project connection
- **Grove upload failing**: Check API key and chain ID

### Development Environment
- **Port conflicts**: Ensure services use different ports
- **Environment variables**: Verify all required vars are set
- **TypeScript errors**: Clear cache and reinstall dependencies

---

## 📋 Agent Checklist

### When Working on Karaoke School v1:

#### ✅ Always Check
- [ ] Service ports don't conflict (5173, 8787, 8000, 3001)
- [ ] Environment variables are properly configured
- [ ] Database connection uses correct Neon project
- [ ] Blockchain network matches (Lens testnet: 37111)
- [ ] Subgraph network matches contract deployment

#### ✅ Service Status Verification
- [ ] Pipeline HTTP API responding on port 8787
- [ ] React app building and serving on port 5173
- [ ] Subgraph building and serving GraphQL on port 8000
- [ ] Supporting services (audio, quansic, bmi) running on port 3001

#### ✅ Data Flow Testing
- [ ] TikTok → Pipeline → Database flow working
- [ ] Database → Grove → Contracts flow implemented
- [ ] Contracts → Subgraph → App flow deployed
- [ ] End-to-end user journey functional

#### ✅ Integration Points
- [ ] React components use correct GraphQL queries
- [ ] Audio recording integrates with Lit Actions
- [ ] Authentication flows (PKP + Lens) working
- [ ] Grove assets accessible via grove:// URIs

---

## 🚀 Priority Development Tasks (Current Phase: Local Validation)

### 🔴 HIGH PRIORITY (Local Development)
1. **Local Subgraph Validation**
   - ✅ Graph Node Dev Mode (gnd) setup complete
   - ✅ Local development with hot reload working
   - ✅ Endpoint: `http://localhost:8000/subgraphs/name/subgraph-0/`
   - ⏳ Validate all entities indexing correctly from Lens Testnet events
   - ⏳ Test GraphQL queries with real data
   - ⏳ Ensure all event handlers are processing correctly

2. **End-to-End Local Testing**
   - ✅ App connecting to local subgraph successfully
   - ✅ React components rendering with GraphQL data
   - ⏳ Test complete user journey: browse → select → play → score
   - ⏳ Validate spaced repetition learning flow (ClassPage → StudySessionPage)
   - ⏳ Ensure audio recording and Lit Action integration works

3. **Local Development Workflow Optimization**
   - ✅ Service startup scripts functional
   - ✅ Database queries and data flow working
   - ⏳ Optimize hot reload times across all services
   - ⏳ Ensure consistent local environment setup

### 🟡 MEDIUM PRIORITY (Pre-Deployment)
4. **Production Contract Deployment**
   - **Status**: Ready to deploy when local validation complete
   - Contracts compiled and tested locally
   - TranslationEvents needs deployment to Lens Testnet
   - Update subgraph.yaml with production contract addresses

5. **Subgraph Testnet Deployment**
   - **Status**: Ready for deployment after local validation
   - Update network: local → lens-testnet in subgraph.yaml
   - Update contract addresses to production values
   - Deploy to The Graph Studio
   - Update app configuration with production subgraph URL

6. **Data Pipeline Completion**
   - ✅ Grove upload + event emission script implemented
   - ⏳ Test complete pipeline: database → Grove → contracts → subgraph
   - ⏳ Validate 36 segments emit all required events
   - ⏳ Ensure translations are properly indexed

### 🟢 LOW PRIORITY (Future Features)
7. **Enhanced Audio Processing**
   - Optimize Demucs separation quality
   - Improve fal.ai enhancement parameters
   - Add audio quality metrics

8. **Creator Integration**
   - Create PKPs for 51 TikTok creators
   - Set up Lens Protocol accounts
   - Story Protocol IP Asset registration

9. **Performance Optimization**
   - Implement audio caching
   - Optimize bundle size
   - Add service worker for offline support

---

## 📋 Local Development Checklist

### ✅ Currently Working
- [ ] All services start successfully in local development mode
- [ ] App builds and serves on http://localhost:5173
- [ ] Subgraph indexes events via Graph Node Dev Mode
- [ ] Database queries return expected data
- [ ] Pipeline HTTP API responds to requests
- [ ] Supporting services (audio, quansic, bmi) running on port 3001

### ⏳ Needs Local Validation
- [ ] Complete user journey: browse songs → select → karaoke play → record → score
- [ ] Spaced repetition learning: ClassPage → StudySessionPage → FSRS algorithm
- [ ] Audio recording and Lit Action grading integration
- [ ] GraphQL queries return complete data for all entities
- [ ] Real-time event processing from Lens Testnet contracts

### 🚀 Ready for Deployment (Once Validated)
- [ ] All functionality tested and working locally
- [ ] TranslationEvents contract deployed to Lens Testnet
- [ ] Subgraph network updated to lens-testnet
- [ ] App configuration updated for production subgraph URL
- [ ] End-to-end testing on testnet completed

---

## 📚 Reference Documentation

- **[CLAUDE.md](./CLAUDE.md)**: Complete technical architecture
- **[SYSTEM-OVERVIEW.md](./SYSTEM-OVERVIEW.md)**: Current system state
- **[app/README.md](./app/README.md)**: Frontend application guide
- **[karaoke-pipeline/AGENTS.md](./karaoke-pipeline/AGENTS.md)**: Pipeline documentation
- **[contracts/AGENTS.md](./contracts/AGENTS.md)**: Smart contracts guide
- **[lit-actions/AGENTS.md](./lit-actions/AGENTS.md)**: Lit Actions documentation
- **[subgraph/AGENTS.md](./subgraph/AGENTS.md)**: Subgraph documentation

---

**This guide provides structured, AI-consumable documentation for seamless integration with Karaoke School v1 services and APIs.**
