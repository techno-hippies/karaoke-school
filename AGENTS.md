# Karaoke School v1 - Service Integration Guide

**Essential service integration for AI-powered language learning through music**

---

## 🏗️ Core Services

| Service | Purpose | Status | Port | Network |
|---------|---------|--------|------|---------|
| **app/** | React frontend | ✅ Active | 5173 | Local |
| **karaoke-pipeline/** | Content processing | ✅ Active | 8787 | Local |
| **subgraph/** | Event indexing | ✅ Local | 8000 | Local |
| **contracts/** | Smart contracts | ✅ Deployed | - | Lens Testnet |
| **lit-actions/** | AI scoring | ✅ Active | - | Base Sepolia |

## 🔄 Data Flow

```
TikTok → Pipeline → Database → GRC-20 , Contracts → Subgraph → Grove → App
     ↓         ↓          ↓         ↓         ↓          ↓       ↓      ↓
  8,196    12-Step     2,766    92.3%    5/5 Deployed  Local   IPFS   React
```

## 🔗 Integration Points

### Pipeline API (Port 8787)
- **Base URL**: `http://localhost:8787`
- **Health**: `GET /health`
- **Process**: `POST /trigger?step={1-12}&limit={count}`
- **Status**: `GET /status`

### Subgraph GraphQL (Port 8000)
- **Endpoint**: `http://localhost:8000/subgraphs/name/subgraph-0`
- **Query Format**: POST JSON with GraphQL queries
- **Entities**: Segment, Translation, LineCard, Performance

### App Development (Port 5173)
- **URL**: `http://localhost:5173`
- **Build**: `bun run dev`
- **GraphQL**: Auto-switches local/studio based on environment

## 🏛️ Smart Contracts (Lens Testnet - 37111)

```typescript
const CONTRACTS = {
  ExerciseEvents: "0xcB2b397E02b50A0eeCecb922bb76aBE46DFb7832", // FSRS grading
  SongEvents: "0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6",
  ClipEvents: "0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274", // Clip lifecycle events
  AccountEvents: "0x3709f41cdc9E7852140bc23A21adCe600434d4E8",
  TranslationEvents: "0x5A49E23A5C3a034906eE0274c266A08805770C70"
}
```

### Line-Level FSRS Events
```solidity
// ExerciseEvents.sol
event SayItBackAttemptGraded(
    uint256 attemptId,
    bytes32 lineId,
    bytes32 segmentHash,
    uint16 lineIndex,
    address learner,
    uint16 score,
    uint8 rating,
    string metadataUri
);

event MultipleChoiceAttemptGraded(
    uint256 attemptId,
    bytes32 questionId,
    address learner,
    uint16 score,
    uint8 rating,
    string metadataUri
);
```

## 🛠️ Development Workflow

### Start Services
```bash
# Core services
cd karaoke-pipeline && ./supervisor.sh &      # 8787
cd app && bun run dev &                       # 5173

# Subgraph (GND - requires PostgreSQL 16 in PATH)
cd subgraph && bun run build
PATH="/usr/lib/postgresql/16/bin:$PATH" gnd --ethereum-rpc lens-testnet:https://rpc.testnet.lens.xyz > gnd.log 2>&1 &
# GND auto-deploys from ./build and serves on port 8000
# Monitor: tail -f gnd.log
```

### Environment Variables
```bash
# Required
NEON_DATABASE_URL=postgresql://...
VITE_LENS_ENVIRONMENT=testnet
GROVE_API_KEY=...

# Local development
VITE_SUBGRAPH_URL=http://localhost:8000/subgraphs/name/subgraph-0/
```

## 📊 Database Integration

### ⚠️ DATABASE QUERY RULES - CRITICAL

**ALWAYS use MCP tools for database queries. NEVER use inline scripts or dotenvx.**

✅ **CORRECT - Use MCP:**
```typescript
// Use call_mcp_tool with run_sql or run_sql_transaction
call_mcp_tool("run_sql", {
  params: {
    projectId: "flat-mode-57592166",
    databaseName: "neondb",
    sql: "SELECT * FROM song_pipeline_status LIMIT 10"
  }
})
```

❌ **FORBIDDEN - Never do this:**
```bash
# DO NOT use dotenvx
DOTENV_PRIVATE_KEY=xxx dotenvx run ...

# DO NOT use inline bun scripts with database imports
bun -e "import { query } from './src/db/neon'; ..."

# DO NOT manually call database functions via shell
```

**Why:** MCP tools handle authentication automatically via `.claude/settings.local.json`. Manual imports fail and waste time.

**Available MCP Database Tools:**
- `run_sql` - Execute single SQL statement
- `run_sql_transaction` - Execute multiple statements
- `describe_table_schema` - Get table structure
- `get_database_tables` - List all tables
- `describe_branch` - Get database tree view

### Key Tables

#### Track Ingestion & Sources
```sql
-- Core tracks table (supports TikTok discovery + manual Spotify submission)
-- Migration 017 (2025-11-12) added nullable tiktok_video_id, source_type, metadata
tracks:
  spotify_track_id (TEXT, PK)
  tiktok_video_id (TEXT, nullable) -- TikTok tracks: non-NULL, Manual tracks: NULL
  source_type (TEXT NOT NULL) -- 'tiktok' | 'manual_spotify'
  title, artists JSONB, album_name, release_date, duration_ms, isrc
  primary_artist_id, primary_artist_name -- For enrichment & legitimacy gating
  stage (pending → enriched → audio_ready → aligned → ... → ready)
  metadata (JSONB, nullable) -- Audit trail (manual submission details, timestamps)
  has_iswc, has_lyrics, has_audio (BOOLEAN flags)
  error_message, error_at (TIMESTAMPTZ, for failure tracking)
  created_at, updated_at (TIMESTAMPTZ)
```

#### Audio Processing
```sql
-- Polymorphic task queue (tracks + TikTok videos)
audio_tasks:
  subject_type ('track' | 'tiktok_video') -- Discriminator for polymorphic design
  subject_id (spotify_track_id for tracks, video_id for TikTok videos)
  task_type (download, align, translate, separate, segment, enhance, clip, etc.)
  status (pending, running, completed, failed, skipped)

-- Segments with Grove URLs
karaoke_segments: spotify_track_id, fal_segment_grove_url, alignment_data

-- Line-level FSRS (NEW)
karaoke_lines: line_id (UUID), line_index, spotify_track_id, original_text

-- Word timing (ElevenLabs)
elevenlabs_word_alignments: words JSONB (word-level timing)

-- Translations
lyrics_translations: lines JSONB (line-level with word timing)
```

#### Schema Changes (Migration 017, 2025-11-12)
- **Manual Spotify Ingestion**: Added `source_type` column (`'tiktok'` | `'manual_spotify'`) to distinguish origins
- **Nullable tiktok_video_id**: TikTok tracks have non-NULL values, manual Spotify tracks have `NULL`
- **Metadata JSONB Column**: Stores audit trail (submission timestamp, user notes, etc.)
- **Partial Unique Index**: `idx_tracks_tiktok_not_null` protects TikTok uniqueness while allowing multiple NULLs
- **Query Indexes**: `idx_tracks_source_type`, `idx_tracks_manual_stage` for efficient manual track filtering
- **Polymorphic audio_tasks**: Reuses existing `subject_type` design (no code changes to audio processors)

### Connection (Neon PostgreSQL)
- **Project**: `flat-mode-57592166` (karaoke-pipeline-v2 - US East)
- **Connection**: PostgreSQL via `neondatabase/serverless`

## 🎯 Integration Patterns

### React App
```typescript
// GraphQL client configuration
import { GraphQLClient } from 'graphql-request';
const graphClient = new GraphQLClient(import.meta.env.VITE_SUBGRAPH_URL);

// Line-level query (when available)
const GET_LINE_CARDS = gql`
  query GetLineCards($grc20WorkId: String!) {
    lineCards(where: { segment_: { grc20WorkId: $grc20WorkId } }) {
      id
      lineId
      lineIndex
      segmentHash
      performanceCount
    }
  }
`;
```

### Blockchain Integration
```typescript
// Contract interaction with ExerciseEvents
import { createPublicClient, http } from 'viem';
import { lensTestnet } from './chains';

const client = createPublicClient({
  chain: lensTestnet,
  transport: http(process.env.RPC_URL)
});

// Say It Back grading (PKP signed)
await client.writeContract({
  address: CONTRACTS.ExerciseEvents,
  abi: EXERCISE_EVENTS_ABI,
  functionName: 'gradeSayItBackAttempt',
  args: [attemptId, lineId, segmentHash, lineIndex, learner, score, rating, metadataUri]
});
```

## 🔧 Common Integration

### Authentication
- **PKP (Lit)**: WebAuthn-based authentication
- **Lens Protocol**: Social graph integration
- **Dual-layer**: PKP + Lens for comprehensive identity

### Audio Processing
- **Recording**: Browser MediaRecorder API
- **Grading**: Lit Actions with Voxstral AI
- **Storage**: Grove with `grove://` URIs

### FSRS Integration
- **Daily Limit**: 15 new cards per day
- **Line-Level**: Each lyric line = separate card
- **Scheduling**: Based on user performance scores (0-10000)

## 🚀 Quick Integration Test

### Test Line-Level FSRS
```bash
# 1. Start services
cd app && bun run dev

# 2. Visit study page
# Navigate to: /song/{grc20WorkId}/study

# 3. Check subgraph entities
curl -s -X POST 'http://localhost:8000/subgraphs/name/subgraph-0' \
  -H 'Content-Type: application/json' \
  -d '{"query": "{ lineCards(first: 5) { id lineId lineIndex } }"}'

# 4. Test single practice (emits SayItBackAttemptGraded event)
```

## 📋 Verification Checklist

### ✅ Always Check
- [ ] Service ports: 5173 (app), 8787 (pipeline), 8000 (subgraph)
- [ ] Environment variables configured
- [ ] Database connection using correct Neon project
- [ ] Blockchain network: Lens testnet (37111)

### ✅ Line-Level FSRS
- [ ] `karaoke_lines` table populated (2,766 lines)
- [ ] ExerciseEvents contract with `gradeSayItBackAttempt()`
- [ ] Subgraph indexing LineCard entities
- [ ] App using lineIndex for progression

### ✅ Manual Spotify Ingestion (2025-11-12)
- [ ] `source_type` column exists on tracks table (`'tiktok'` or `'manual_spotify'`)
- [ ] `tiktok_video_id` is nullable for manual tracks
- [ ] Partial unique index `idx_tracks_tiktok_not_null` protects TikTok uniqueness
- [ ] CLI can add single tracks: `bun src/tasks/ingestion/add-track-from-spotify.ts --spotifyId=<ID>`
- [ ] Download tasks auto-seeded and picked up by audio worker
- [ ] Enrichment tasks spawn correctly for manual tracks
- [ ] Manual tracks flow through audio pipeline (download → align → translate → …)

**Monitoring Query**:
```sql
SELECT source_type, stage, COUNT(*)
FROM tracks
GROUP BY source_type, stage
ORDER BY source_type, stage;
```

### ✅ End-to-End Flow
- [ ] TikTok → Pipeline → Database
- [ ] Manual Spotify → Pipeline → Database (new)
- [ ] Database → Grove → Contracts
- [ ] Contracts → Subgraph → App
- [ ] User practice → SayItBackAttemptGraded event

## 🎯 Priority Development

### Immediate (Line-Level FSRS)
1. **Deploy Subgraph** - Local → The Graph Studio
2. **Update useStudyCards** - Query lineCards instead of segments
3. **Test Lit Actions** - Call `gradeSayItBackAttempt()` / `gradeMultipleChoiceAttempt()`
4. **Verify Flow** - 15+ cards per song

### This Week
1. **Story Protocol** - Test single video IP Asset
2. **PKP Creation** - 51 TikTok creators
3. **Production Ready** - Subgraph deployment

---

**Essential integration guide for seamless service communication and development**
