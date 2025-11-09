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
  PerformanceGrader: "0xdd231de1016F5BBe56cEB3B617Aa38A5B454610D", // Line-level FSRS
  SongEvents: "0x0A15fFdBD70FC657C3f3E17A7faFEe3cD33DF7B6", 
  SegmentEvents: "0x9958Bd32bf16b5CCa0580DEB6FD29921D0466274",
  AccountEvents: "0x3709f41cdc9E7852140bc23A21adCe600434d4E8",
  TranslationEvents: "0x..." // Deployed
}
```

### Line-Level FSRS Events
```solidity
// PerformanceGrader.sol
event LinePerformanceGraded(
    uint256 performanceId,
    bytes32 lineId,           // UUID from karaoke_lines
    bytes32 segmentHash,
    uint16 lineIndex,
    address performer,
    uint16 score,
    string metadataUri
);
```

## 🛠️ Development Workflow

### Start Services
```bash
# Core services
cd karaoke-pipeline && ./supervisor.sh &      # 8787
cd app && bun run dev &                       # 5173
cd subgraph && npm run dev &                  # 8000
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
    projectId: "frosty-smoke-70266868",
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
```sql
-- Segments with Grove URLs
karaoke_segments: spotify_track_id, fal_segment_grove_url, alignment_data

-- Line-level FSRS (NEW)
karaoke_lines: line_id (UUID), line_index, spotify_track_id, original_text

-- Word timing (ElevenLabs)
elevenlabs_word_alignments: words JSONB (word-level timing)

-- Translations
lyrics_translations: lines JSONB (line-level with word timing)
```

### Connection (Neon PostgreSQL)
- **Project**: `frosty-smoke-70266868` (KS1 - EU)
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
// Contract interaction with line-level support
import { createPublicClient, http } from 'viem';
import { lensTestnet } from './chains';

const client = createPublicClient({
  chain: lensTestnet,
  transport: http(process.env.RPC_URL)
});

// Line-level grading (NEW)
await client.writeContract({
  address: CONTRACTS.PerformanceGrader,
  abi: PERFORMANCE_GRADER_ABI,
  functionName: 'gradeLinePerformance',
  args: [performanceId, lineId, segmentHash, lineIndex, performer, score, metadataUri]
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

# 4. Test single practice (emits LinePerformanceGraded event)
```

## 📋 Verification Checklist

### ✅ Always Check
- [ ] Service ports: 5173 (app), 8787 (pipeline), 8000 (subgraph)
- [ ] Environment variables configured
- [ ] Database connection using correct Neon project
- [ ] Blockchain network: Lens testnet (37111)

### ✅ Line-Level FSRS
- [ ] `karaoke_lines` table populated (2,766 lines)
- [ ] PerformanceGrader contract with `gradeLinePerformance()`
- [ ] Subgraph indexing LineCard entities
- [ ] App using lineIndex for progression

### ✅ End-to-End Flow
- [ ] TikTok → Pipeline → Database
- [ ] Database → Grove → Contracts
- [ ] Contracts → Subgraph → App
- [ ] User practice → LinePerformanceGraded event

## 🎯 Priority Development

### Immediate (Line-Level FSRS)
1. **Deploy Subgraph** - Local → The Graph Studio
2. **Update useStudyCards** - Query lineCards instead of segments
3. **Test Lit Actions** - Call gradeLinePerformance()
4. **Verify Flow** - 15+ cards per song

### This Week
1. **Story Protocol** - Test single video IP Asset
2. **PKP Creation** - 51 TikTok creators
3. **Production Ready** - Subgraph deployment

---

**Essential integration guide for seamless service communication and development**
