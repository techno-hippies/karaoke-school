# Decoupling from Genius API - Complete Strategy

## Executive Summary

Your system is **already 90% decoupled** from Genius API. All essential song metadata is stored in `KaraokeCatalogV2` contract and Grove storage. Only 3 specific workflows need updating to achieve full independence.

## Current Dependencies

### ✅ Already Decoupled (No changes needed)
- **Song metadata**: Stored in contract (`title`, `artist`, `duration`, `soundcloudPath`)
- **Media assets**: Stored in Grove (`coverUri`, `thumbnailUri`, `musicVideoUri`)
- **Karaoke data**: Stored in Grove (`sectionsUri`, `alignmentUri`)
- **Translations**: Stored in contract mapping + Grove URIs

### 🔄 Needs Decoupling (3 workflows)

1. **Frontend song display** (song-metadata-v1.js)
2. **Artist profile pages** (useArtistData hook)
3. **Initial cataloging** (match-and-segment-v9.js) - OK to keep Genius

---

## Phase 1: Frontend Song Display (Priority 1)

### Current Flow
```
User visits /song/3352793
  → Calls song-metadata-v1.js Lit Action
    → Fetches from Genius API
      → Returns metadata
```

### New Flow
```
User visits /song/3352793
  → Read from KaraokeCatalogV2.getSongByGeniusId(3352793)
    → Returns ALL metadata from contract
```

### Implementation

#### 1.1 Create Contract Reader Hook

```typescript
// app/src/hooks/useSongFromContract.ts
import { useReadContract } from 'wagmi'
import { KARAOKE_CATALOG_V2_ADDRESS, KARAOKE_CATALOG_V2_ABI } from '@/config/contracts'
import { lensToGroveUrl } from '@/lib/lens/utils'

export interface SongFromContract {
  id: string
  geniusId: number
  title: string
  artist: string
  duration: number
  soundcloudPath: string
  hasFullAudio: boolean
  requiresPayment: boolean
  audioUri: string
  coverUri: string
  thumbnailUri: string
  musicVideoUri: string
  sectionsUri: string
  alignmentUri: string
  enabled: boolean
  addedAt: bigint
}

export function useSongFromContract(geniusId: number | undefined) {
  const { data, isLoading, error } = useReadContract({
    address: KARAOKE_CATALOG_V2_ADDRESS,
    abi: KARAOKE_CATALOG_V2_ABI,
    functionName: 'getSongByGeniusId',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId,
    }
  })

  // Transform contract data to frontend format
  const song = data ? {
    id: data.id,
    geniusId: Number(data.geniusId),
    title: data.title,
    artist: data.artist,
    duration: Number(data.duration),
    soundcloudPath: data.soundcloudPath,
    hasFullAudio: data.hasFullAudio,
    requiresPayment: data.requiresPayment,
    // Convert lens:// URIs to Grove HTTPS URLs
    audioUrl: lensToGroveUrl(data.audioUri),
    coverUrl: lensToGroveUrl(data.coverUri),
    thumbnailUrl: lensToGroveUrl(data.thumbnailUri),
    musicVideoUrl: lensToGroveUrl(data.musicVideoUri),
    sectionsUrl: lensToGroveUrl(data.sectionsUri),
    alignmentUrl: lensToGroveUrl(data.alignmentUri),
    enabled: data.enabled,
    addedAt: Number(data.addedAt),
  } : null

  return {
    song,
    isLoading,
    error
  }
}
```

#### 1.2 Update SongPage Container

```typescript
// app/src/pages/SongPage.tsx (container)
import { useSongFromContract } from '@/hooks/useSongFromContract'

export function SongPageContainer() {
  const { geniusId } = useParams()
  const { song, isLoading } = useSongFromContract(Number(geniusId))

  if (isLoading) return <LoadingSpinner />
  if (!song) return <NotFound />

  return (
    <SongPage
      songTitle={song.title}
      artist={song.artist}
      artworkUrl={song.coverUrl}
      // ... rest of props from contract
    />
  )
}
```

**Benefits**:
- ✅ No Lit Action call (faster)
- ✅ No Genius API dependency
- ✅ Works even if Genius API is down
- ✅ Consistent with contract state

---

## Phase 2: Artist Profile Pages (Priority 2)

### Current Flow
```
User visits /u/ladygaga
  → useArtistData hook
    → Calls Genius API for artist metadata
      → Calls Genius API for top songs
```

### New Flow (Two Options)

#### Option A: Contract + ArtistRegistry (Recommended)

Store artist metadata in `ArtistRegistryV2` + Lens Account Metadata:

```solidity
// ArtistRegistryV2 already has:
struct Artist {
    uint32 geniusArtistId;
    address lensAccountAddress;  // Points to Lens profile
    string lensHandle;
    // ... rest is in Lens Account Metadata
}
```

**Lens Account Metadata** (stored in Grove):
```json
{
  "lens": {
    "account": {
      "name": "Lady Gaga",
      "bio": "Artist biography...",
      "picture": "lens://avatar_123",
      "coverPicture": "lens://cover_456",
      "attributes": [
        { "key": "genius_artist_id", "value": "1177" },
        { "key": "isni", "value": "0000000121483769" },
        { "key": "ipi", "value": "00501293040" },
        { "key": "spotify_id", "value": "1HY2Jd0NmPuamShAr6KMms" },
        { "key": "apple_music_id", "value": "889327" },
        { "key": "instagram", "value": "ladygaga" },
        { "key": "twitter", "value": "ladygaga" },
        { "key": "verified", "value": "true", "type": "BOOLEAN" }
      ]
    }
  }
}
```

**Top Songs Query**: Read from contract
```typescript
// Get all songs by artist from KaraokeCatalog
const songs = await getAllSongs() // from getRecentSongs or iterate
const artistSongs = songs.filter(s => s.artist === artistName)
```

#### Option B: Grove + GraphQL Index (Advanced)

Create a Grove-stored index of artist data:

```json
// grove://artist-{geniusId}-index.json
{
  "geniusId": 1177,
  "name": "Lady Gaga",
  "bio": "...",
  "avatarUri": "lens://...",
  "coverUri": "lens://...",
  "topSongs": [
    {
      "geniusId": 3352793,
      "title": "Bad Romance",
      "artworkUri": "lens://...",
      "cataloged": true,
      "hasFullAudio": false
    }
  ],
  "updatedAt": 1736543210
}
```

**Update this during pipeline** (pkp-lens-flow):
```bash
# After creating Lens account for artist
bun run update-artist-index --creator @ladygaga
```

---

## Phase 3: Student Tracking System

### Architecture: Contract Events → Grove Index → GraphQL Query

Your contracts already emit perfect events for tracking:

```solidity
// KaraokeCreditsV1.sol
event CreditUsed(
    address indexed user,
    uint8 source,
    string songId,
    string segmentId,
    bytes32 indexed segmentHash,
    uint64 timestamp
);

event SongUnlocked(
    address indexed user,
    uint32 indexed geniusId,
    uint8 segmentCount,
    uint64 timestamp
);
```

### Step 1: Index Builder (Backend Service)

```typescript
// services/student-indexer/index.ts
import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'
import { StorageClient } from '@lens-chain/storage-client'
import { immutable } from '@lens-chain/storage-client'

interface StudentScore {
  userAddress: string
  geniusId: number
  segmentsCompleted: number
  totalSegments: number
  firstUnlockAt: number
  lastUnlockAt: number
  completionPercentage: number
}

interface SongLeaderboard {
  geniusId: number
  songTitle: string
  artist: string
  students: StudentScore[]
  totalStudents: number
  updatedAt: number
}

async function indexStudentProgress() {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http()
  })

  const storageClient = StorageClient.create()

  // Get all SongUnlocked events
  const logs = await client.getLogs({
    address: KARAOKE_CREDITS_ADDRESS,
    event: parseAbiItem('event SongUnlocked(address indexed user, uint32 indexed geniusId, uint8 segmentCount, uint64 timestamp)'),
    fromBlock: 0n,
    toBlock: 'latest'
  })

  // Group by song
  const leaderboards = new Map<number, SongLeaderboard>()

  for (const log of logs) {
    const { user, geniusId, segmentCount, timestamp } = log.args

    if (!leaderboards.has(geniusId)) {
      // Fetch song metadata from contract
      const song = await catalogContract.read.getSongByGeniusId([geniusId])

      leaderboards.set(geniusId, {
        geniusId,
        songTitle: song.title,
        artist: song.artist,
        students: [],
        totalStudents: 0,
        updatedAt: Date.now()
      })
    }

    const board = leaderboards.get(geniusId)!

    board.students.push({
      userAddress: user,
      geniusId,
      segmentsCompleted: segmentCount,
      totalSegments: segmentCount,
      firstUnlockAt: Number(timestamp),
      lastUnlockAt: Number(timestamp),
      completionPercentage: 100
    })

    board.totalStudents++
  }

  // Upload each leaderboard to Grove
  for (const [geniusId, board] of leaderboards) {
    const acl = immutable(37111) // Lens Testnet

    const response = await storageClient.uploadAsJson(board, { acl })

    console.log(`✅ Uploaded leaderboard for ${board.songTitle}: ${response.uri}`)

    // Store mapping in contract or local DB
    // geniusId -> grove URI mapping
  }
}

// Run every 5 minutes
setInterval(indexStudentProgress, 5 * 60 * 1000)
```

### Step 2: Contract Storage (Optional)

Add Grove URI mapping to `KaraokeCatalogV2`:

```solidity
// contracts/evm/base-sepolia/KaraokeCatalog/KaraokeCatalogV2.sol

// Leaderboard URIs: geniusId => grove URI
mapping(uint32 => string) public leaderboardUris;

function setLeaderboardUri(uint32 geniusId, string calldata uri)
    external
    onlyOwnerOrProcessor
{
    leaderboardUris[geniusId] = uri;
    emit LeaderboardUriUpdated(geniusId, uri);
}

function getLeaderboardUri(uint32 geniusId)
    external
    view
    returns (string memory)
{
    return leaderboardUris[geniusId];
}
```

### Step 3: Frontend Query

```typescript
// app/src/hooks/useStudentLeaderboard.ts
import { useReadContract } from 'wagmi'
import { useQuery } from '@tanstack/react-query'

export function useStudentLeaderboard(geniusId: number) {
  // 1. Get leaderboard URI from contract
  const { data: leaderboardUri } = useReadContract({
    address: KARAOKE_CATALOG_ADDRESS,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'getLeaderboardUri',
    args: [geniusId]
  })

  // 2. Fetch leaderboard data from Grove
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard', geniusId, leaderboardUri],
    queryFn: async () => {
      if (!leaderboardUri) return null

      const groveUrl = lensToGroveUrl(leaderboardUri)
      const response = await fetch(groveUrl)
      return response.json() as SongLeaderboard
    },
    enabled: !!leaderboardUri,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  return {
    leaderboard,
    isLoading
  }
}
```

### Step 4: SongPage Integration

```typescript
// app/src/components/class/SongPage.tsx
const { leaderboard } = useStudentLeaderboard(geniusId)

<Tabs>
  <TabsList>
    <TabsTrigger value="practice">Practice</TabsTrigger>
    <TabsTrigger value="students">
      Students {leaderboard && `(${leaderboard.totalStudents})`}
    </TabsTrigger>
  </TabsList>

  <TabsContent value="students">
    <Leaderboard entries={leaderboard?.students || []} />
  </TabsContent>
</Tabs>
```

---

## Phase 4: Artist Page Student Tracking

Same pattern, but aggregate across ALL songs by artist:

```typescript
// services/student-indexer/artist-stats.ts
interface ArtistStats {
  geniusArtistId: number
  totalStudents: number  // Unique addresses across all songs
  totalSongsStudied: number
  topSongs: {
    geniusId: number
    title: string
    studentCount: number
  }[]
  recentStudents: {
    address: string
    lastActive: number
    songsCompleted: number
  }[]
}

async function buildArtistStats(geniusArtistId: number) {
  // 1. Get all songs by artist from contract
  const allSongs = await catalogContract.read.getRecentSongs([50])
  const artistSongs = allSongs.filter(s =>
    s.artist === artistName || s.geniusId in artistSongIds
  )

  // 2. Aggregate student data across all songs
  const uniqueStudents = new Set<string>()
  const songStats = new Map()

  for (const song of artistSongs) {
    const leaderboard = await fetchLeaderboard(song.geniusId)

    for (const student of leaderboard.students) {
      uniqueStudents.add(student.userAddress)
      // ... aggregate stats
    }
  }

  // 3. Upload to Grove
  const stats: ArtistStats = {
    geniusArtistId,
    totalStudents: uniqueStudents.size,
    // ... rest of stats
  }

  const acl = immutable(37111)
  const response = await storageClient.uploadAsJson(stats, { acl })

  return response.uri
}
```

---

## Lens v3 GraphQL Alternative (Advanced)

Instead of building your own indexer, you can use **Lens GraphQL** to query student activity:

### Option: Use Lens Posts as Activity Log

```typescript
// When student unlocks a song segment, create a Lens Post
import { createPost } from '@lens-protocol/client/actions'

await createPost(lensSession, {
  contentUri: 'lens://student-progress-{hash}',
  // Post metadata
})

// Metadata stored in Grove:
{
  "$schema": "https://json-schemas.lens.dev/posts/text-only/3.0.0.json",
  "lens": {
    "content": "Completed 'Bad Romance' by Lady Gaga",
    "attributes": [
      { "key": "type", "value": "student_progress" },
      { "key": "genius_id", "value": "3352793" },
      { "key": "segments_completed", "value": "8" },
      { "key": "total_segments", "value": "8" },
      { "key": "completion_percentage", "value": "100" }
    ]
  }
}
```

### Query with Lens GraphQL

```graphql
query StudentProgressForSong($geniusId: String!) {
  posts(
    request: {
      filter: {
        metadata: {
          attributes: [
            { key: "type", value: "student_progress" }
            { key: "genius_id", value: $geniusId }
          ]
        }
      }
    }
  ) {
    items {
      author {
        address
        username { value }
      }
      metadata {
        ... on TextOnlyMetadata {
          attributes {
            key
            value
          }
        }
      }
      createdAt
    }
  }
}
```

**Pros**:
- ✅ No custom indexer needed
- ✅ Lens handles storage + querying
- ✅ Automatic pagination
- ✅ Real-time updates

**Cons**:
- ❌ More complex query logic
- ❌ Relies on Lens API uptime
- ❌ Gas costs for post creation

---

## Recommended Implementation Order

### Week 1: Frontend Decoupling
1. ✅ Create `useSongFromContract` hook
2. ✅ Replace `song-metadata-v1.js` calls
3. ✅ Test on existing songs

### Week 2: Artist Profiles
1. ✅ Update Lens Account Metadata schema
2. ✅ Add artist metadata to pipeline
3. ✅ Create `useArtistFromRegistry` hook

### Week 3: Student Tracking (Basic)
1. ✅ Create event indexer service
2. ✅ Upload leaderboards to Grove
3. ✅ Add `leaderboardUris` mapping to contract

### Week 4: Student Tracking (Advanced)
1. ✅ Build artist-level aggregations
2. ✅ Add real-time updates
3. ✅ Deploy to production

---

## Key Architectural Decisions

### ✅ DO: Contract as Single Source of Truth
- All song metadata in `KaraokeCatalogV2`
- All artist references in `ArtistRegistryV2`
- All student activity logged via events

### ✅ DO: Grove for Rich Metadata
- Leaderboards (frequently updated)
- Artist bios (infrequently updated)
- Karaoke alignment data (write-once)

### ✅ DO: Keep Genius for Initial Cataloging
- match-and-segment-v9.js is fine to keep using Genius
- It runs ONCE per song
- Fetches initial metadata → writes to contract
- After that, contract is source of truth

### ❌ DON'T: Query Genius in Frontend
- Slow (API latency)
- Fragile (rate limits, downtime)
- Redundant (data already in contract)

### ❌ DON'T: Store Student Data Onchain
- Too expensive (frequent updates)
- Grove + events is perfect for this

---

## Testing Independence

### How to verify you're fully decoupled:

```bash
# 1. Block Genius API at network level
sudo iptables -A OUTPUT -d api.genius.com -j DROP

# 2. Navigate to song page
open http://localhost:5173/#/song/3352793

# 3. Should load perfectly (reads from contract)

# 4. Navigate to artist page
open http://localhost:5173/#/u/ladygaga

# 5. Should load perfectly (reads from Lens Account + contract)

# 6. Check leaderboard
# Should show students (reads from Grove)
```

---

## Cost Analysis

### Current (with Genius API)
- Frontend song display: **1 Genius API call** per page load
- Artist pages: **2-3 Genius API calls** per page load
- Risk: Rate limiting, downtime

### After Decoupling
- Frontend song display: **1 contract read** (free, instant)
- Artist pages: **1 Lens GraphQL query** (free, cached)
- Student leaderboards: **1 Grove fetch** (free, CDN-cached)

**Savings**: ~90% reduction in external API calls

---

## Migration Checklist

- [ ] Deploy updated `KaraokeCatalogV2` with `leaderboardUris` mapping
- [ ] Create `useSongFromContract` hook
- [ ] Update all `<SongPage>` components to use contract data
- [ ] Remove `song-metadata-v1.js` Lit Action calls
- [ ] Update Lens Account Metadata schema for artists
- [ ] Modify pipeline to populate artist metadata
- [ ] Build event indexer service
- [ ] Deploy indexer to background worker (Cloudflare Workers / AWS Lambda)
- [ ] Add "Students" tab to SongPage
- [ ] Add "Students" tab to ProfilePage (artist profiles)
- [ ] Test with blocked Genius API
- [ ] Document for team

---

## Questions?

### Q: Do we keep `match-and-segment-v9.js` using Genius?
**A**: Yes! It only runs ONCE per song during initial cataloging. After that, all data is in the contract.

### Q: What if Genius API goes down during cataloging?
**A**: Falls back to SoundCloud search (already implemented in v9). Worst case, manual entry with SoundCloud link.

### Q: How often do leaderboards update?
**A**: Real-time via event indexer (5-minute batches recommended for cost efficiency).

### Q: Can students see their rank across all songs?
**A**: Yes! Build artist-level aggregation in indexer. Query all songs by artist, aggregate student scores.

### Q: What about historical data (songs cataloged before decoupling)?
**A**: Already in contract! Just need to build leaderboard indexes from historical `SongUnlocked` events.

---

**Next Steps**: Start with Phase 1 (useSongFromContract hook) - should take ~2-3 hours and provides immediate benefits.
