# Student Tracking Implementation Guide

## Overview

This guide shows how to implement a student leaderboard system using:
- **Contract events** for student activity
- **Grove storage** for leaderboard data
- **Lens GraphQL** for querying (optional advanced approach)

## Architecture

```
Student unlocks song
  → KaraokeCreditsV1.unlockSong() emits SongUnlocked event
    → Event indexer listens
      → Aggregates students per song
        → Uploads to Grove as JSON
          → Updates contract mapping (geniusId → grove URI)
            → Frontend fetches from Grove
```

---

## Implementation

### Part 1: Contract Update (Add Leaderboard URI Mapping)

```solidity
// contracts/evm/base-sepolia/KaraokeCatalog/KaraokeCatalogV2.sol

// Add after line 115 (after availableLanguages mapping):

// Leaderboard Grove URIs: geniusId => grove URI
mapping(uint32 => string) public leaderboardUris;

event LeaderboardUriUpdated(uint32 indexed geniusId, string uri);

/**
 * @notice Set leaderboard URI for a song
 * @dev Called by indexer service after uploading leaderboard to Grove
 */
function setLeaderboardUri(uint32 geniusId, string calldata uri)
    external
    onlyOwnerOrProcessor
    whenNotPaused
{
    if (geniusIdToIndex[geniusId] == 0) revert SongNotFound();
    if (bytes(uri).length == 0) revert InvalidSongIdentifier();

    leaderboardUris[geniusId] = uri;
    emit LeaderboardUriUpdated(geniusId, uri);
}

/**
 * @notice Get leaderboard URI for a song
 */
function getLeaderboardUri(uint32 geniusId)
    external
    view
    returns (string memory)
{
    return leaderboardUris[geniusId];
}
```

**Deployment**:
```bash
cd contracts/evm/base-sepolia/KaraokeCatalog

# Test
forge test

# Deploy (testnet)
DOTENV_PRIVATE_KEY=4406ead1460a14dd7112d777c30bbfaaa67f72b5f2b2210b1d2dbbd59a1a5a31 \
  dotenvx run -f ../../../.env -- \
  forge script script/DeployKaraokeCatalogV2.s.sol:DeployKaraokeCatalogV2 \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify \
  --etherscan-api-key VTPV1IK2Y79NSGDUWT4R9KCJKZ2DI5MD3A
```

---

### Part 2: Event Indexer Service

Create a new background service that:
1. Listens for `SongUnlocked` events
2. Aggregates student data per song
3. Uploads leaderboards to Grove
4. Updates contract with Grove URIs

```typescript
// services/student-indexer/src/index.ts
import { createPublicClient, createWalletClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import { StorageClient, immutable } from '@lens-chain/storage-client'

// Environment setup
const KARAOKE_CREDITS_ADDRESS = '0x...' // KaraokeCreditsV1
const KARAOKE_CATALOG_ADDRESS = '0x...' // KaraokeCatalogV2
const PRIVATE_KEY = process.env.INDEXER_PRIVATE_KEY!
const RPC_URL = 'https://sepolia.base.org'

// Types
interface StudentScore {
  address: string
  segmentsCompleted: number
  totalSegments: number
  unlockedAt: number
  completionPercentage: number
  // Optional: Lens profile data
  lensUsername?: string
  lensAvatar?: string
}

interface SongLeaderboard {
  geniusId: number
  songTitle: string
  artist: string
  artworkUrl: string
  students: StudentScore[]
  totalStudents: number
  averageCompletion: number
  updatedAt: number
  version: 1
}

// Clients
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL)
})

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`)
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(RPC_URL)
})

const storageClient = StorageClient.create()

// ABIs
const SONG_UNLOCKED_EVENT = parseAbiItem(
  'event SongUnlocked(address indexed user, uint32 indexed geniusId, uint8 segmentCount, uint64 timestamp)'
)

const CATALOG_ABI = [
  {
    inputs: [{ name: 'geniusId', type: 'uint32' }],
    name: 'getSongByGeniusId',
    outputs: [{
      components: [
        { name: 'id', type: 'string' },
        { name: 'geniusId', type: 'uint32' },
        { name: 'title', type: 'string' },
        { name: 'artist', type: 'string' },
        { name: 'duration', type: 'uint32' },
        { name: 'soundcloudPath', type: 'string' },
        { name: 'hasFullAudio', type: 'bool' },
        { name: 'requiresPayment', type: 'bool' },
        { name: 'audioUri', type: 'string' },
        { name: 'metadataUri', type: 'string' },
        { name: 'coverUri', type: 'string' },
        { name: 'thumbnailUri', type: 'string' },
        { name: 'musicVideoUri', type: 'string' },
        { name: 'sectionsUri', type: 'string' },
        { name: 'alignmentUri', type: 'string' },
        { name: 'enabled', type: 'bool' },
        { name: 'addedAt', type: 'uint64' }
      ],
      type: 'tuple'
    }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'geniusId', type: 'uint32' },
      { name: 'uri', type: 'string' }
    ],
    name: 'setLeaderboardUri',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const

// Main indexer function
async function indexSongLeaderboards(fromBlock: bigint = 0n) {
  console.log(`[Indexer] Starting from block ${fromBlock}...`)

  // 1. Fetch all SongUnlocked events
  const logs = await publicClient.getLogs({
    address: KARAOKE_CREDITS_ADDRESS as `0x${string}`,
    event: SONG_UNLOCKED_EVENT,
    fromBlock,
    toBlock: 'latest'
  })

  console.log(`[Indexer] Found ${logs.length} SongUnlocked events`)

  // 2. Group by geniusId
  const songStudents = new Map<number, StudentScore[]>()

  for (const log of logs) {
    const { user, geniusId, segmentCount, timestamp } = log.args as {
      user: string
      geniusId: number
      segmentCount: number
      timestamp: bigint
    }

    if (!songStudents.has(geniusId)) {
      songStudents.set(geniusId, [])
    }

    songStudents.get(geniusId)!.push({
      address: user,
      segmentsCompleted: segmentCount,
      totalSegments: segmentCount,
      unlockedAt: Number(timestamp),
      completionPercentage: 100
    })
  }

  console.log(`[Indexer] Processing ${songStudents.size} unique songs...`)

  // 3. For each song, build leaderboard and upload to Grove
  for (const [geniusId, students] of songStudents) {
    try {
      await buildAndUploadLeaderboard(geniusId, students)
    } catch (error) {
      console.error(`[Indexer] Failed to process song ${geniusId}:`, error)
    }
  }

  console.log('[Indexer] ✅ Indexing complete')
}

async function buildAndUploadLeaderboard(
  geniusId: number,
  students: StudentScore[]
) {
  console.log(`[Leaderboard] Processing song ${geniusId} with ${students.length} students...`)

  // 1. Fetch song metadata from contract
  const songData = await publicClient.readContract({
    address: KARAOKE_CATALOG_ADDRESS as `0x${string}`,
    abi: CATALOG_ABI,
    functionName: 'getSongByGeniusId',
    args: [geniusId]
  })

  // 2. Sort students by completion date (earliest first = top rank)
  const sortedStudents = students
    .sort((a, b) => a.unlockedAt - b.unlockedAt)

  // 3. Calculate stats
  const totalStudents = sortedStudents.length
  const averageCompletion = sortedStudents.reduce(
    (sum, s) => sum + s.completionPercentage, 0
  ) / totalStudents

  // 4. Build leaderboard object
  const leaderboard: SongLeaderboard = {
    geniusId,
    songTitle: songData.title,
    artist: songData.artist,
    artworkUrl: lensUriToHttps(songData.thumbnailUri),
    students: sortedStudents,
    totalStudents,
    averageCompletion: Math.round(averageCompletion),
    updatedAt: Date.now(),
    version: 1
  }

  // 5. Upload to Grove
  const acl = immutable(84532) // Base Sepolia
  const response = await storageClient.uploadAsJson(leaderboard, { acl })

  console.log(`[Grove] ✅ Uploaded: ${response.uri}`)

  // 6. Update contract with Grove URI
  const hash = await walletClient.writeContract({
    address: KARAOKE_CATALOG_ADDRESS as `0x${string}`,
    abi: CATALOG_ABI,
    functionName: 'setLeaderboardUri',
    args: [geniusId, response.uri]
  })

  console.log(`[Contract] ✅ Updated mapping: ${hash}`)

  return response.uri
}

// Helper: Convert lens:// to https://
function lensUriToHttps(uri: string): string {
  if (!uri) return ''
  if (uri.startsWith('lens://')) {
    return `https://api.grove.storage/${uri.replace('lens://', '')}`
  }
  return uri
}

// Run indexer
const FROM_BLOCK = BigInt(process.env.FROM_BLOCK || '0')
indexSongLeaderboards(FROM_BLOCK)
  .then(() => {
    console.log('[Indexer] Done')
    process.exit(0)
  })
  .catch(error => {
    console.error('[Indexer] Fatal error:', error)
    process.exit(1)
  })
```

**Setup**:
```bash
# Create service
mkdir -p services/student-indexer
cd services/student-indexer
bun init -y

# Install deps
bun add viem @lens-chain/storage-client

# Create .env
cat > .env <<EOF
INDEXER_PRIVATE_KEY=0x...
FROM_BLOCK=0
EOF

# Run
bun run src/index.ts
```

**Deployment** (Cloudflare Workers cron job):
```typescript
// wrangler.toml
name = "student-indexer"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[triggers]
crons = ["*/5 * * * *"] # Every 5 minutes

[vars]
FROM_BLOCK = "0"

[[kv_namespaces]]
binding = "INDEXER_STATE"
id = "..."

[env.production.vars]
FROM_BLOCK = "18000000"
```

```typescript
// src/worker.ts
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Get last processed block from KV
    const lastBlock = await env.INDEXER_STATE.get('last_block')
    const fromBlock = BigInt(lastBlock || env.FROM_BLOCK || '0')

    // Run indexer
    const toBlock = await indexSongLeaderboards(fromBlock)

    // Save last processed block
    await env.INDEXER_STATE.put('last_block', toBlock.toString())
  }
}
```

---

### Part 3: Frontend Integration

#### 3.1 Hook to Fetch Leaderboard

```typescript
// app/src/hooks/useStudentLeaderboard.ts
import { useReadContract, usePublicClient } from 'wagmi'
import { useQuery } from '@tanstack/react-query'
import { KARAOKE_CATALOG_ADDRESS, KARAOKE_CATALOG_ABI } from '@/config/contracts'
import { lensToGroveUrl } from '@/lib/lens/utils'

export interface StudentScore {
  address: string
  segmentsCompleted: number
  totalSegments: number
  unlockedAt: number
  completionPercentage: number
  lensUsername?: string
  lensAvatar?: string
}

export interface SongLeaderboard {
  geniusId: number
  songTitle: string
  artist: string
  artworkUrl: string
  students: StudentScore[]
  totalStudents: number
  averageCompletion: number
  updatedAt: number
}

export function useStudentLeaderboard(geniusId: number | undefined) {
  // 1. Get leaderboard URI from contract
  const { data: leaderboardUri } = useReadContract({
    address: KARAOKE_CATALOG_ADDRESS,
    abi: KARAOKE_CATALOG_ABI,
    functionName: 'getLeaderboardUri',
    args: geniusId ? [geniusId] : undefined,
    query: {
      enabled: !!geniusId,
    }
  })

  // 2. Fetch leaderboard JSON from Grove
  const { data: leaderboard, isLoading, error, refetch } = useQuery({
    queryKey: ['leaderboard', geniusId, leaderboardUri],
    queryFn: async (): Promise<SongLeaderboard | null> => {
      if (!leaderboardUri || leaderboardUri === '') {
        return null
      }

      const groveUrl = lensToGroveUrl(leaderboardUri)
      console.log('[Leaderboard] Fetching from Grove:', groveUrl)

      const response = await fetch(groveUrl)

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.status}`)
      }

      const data = await response.json()
      console.log('[Leaderboard] Loaded:', data)

      return data as SongLeaderboard
    },
    enabled: !!leaderboardUri && leaderboardUri !== '',
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 3,
  })

  return {
    leaderboard,
    isLoading,
    error,
    refetch,
    hasLeaderboard: !!leaderboardUri && leaderboardUri !== ''
  }
}
```

#### 3.2 Leaderboard Component

```typescript
// app/src/components/class/StudentLeaderboard.tsx
import { Trophy, Medal } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import type { StudentScore } from '@/hooks/useStudentLeaderboard'

interface StudentLeaderboardProps {
  students: StudentScore[]
  currentUserAddress?: string
  className?: string
}

export function StudentLeaderboard({
  students,
  currentUserAddress,
  className
}: StudentLeaderboardProps) {
  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy size={24} weight="fill" className="text-yellow-500" />
    if (index === 1) return <Medal size={24} weight="fill" className="text-gray-400" />
    if (index === 2) return <Medal size={24} weight="fill" className="text-orange-600" />
    return null
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className={cn('space-y-2', className)}>
      {students.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg">No students yet</p>
          <p className="text-sm">Be the first to complete this song!</p>
        </div>
      ) : (
        students.map((student, index) => {
          const isCurrentUser = currentUserAddress?.toLowerCase() === student.address.toLowerCase()
          const rankIcon = getRankIcon(index)

          return (
            <div
              key={student.address}
              className={cn(
                'flex items-center gap-4 p-4 rounded-lg border',
                isCurrentUser && 'bg-primary/5 border-primary'
              )}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-12 text-center">
                {rankIcon || (
                  <span className="text-lg font-bold text-muted-foreground">
                    #{index + 1}
                  </span>
                )}
              </div>

              {/* Avatar */}
              <img
                src={
                  student.lensAvatar ||
                  `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.address}`
                }
                alt={student.lensUsername || student.address}
                className="w-10 h-10 rounded-full"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {student.lensUsername ? `@${student.lensUsername}` : student.address.slice(0, 8)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Completed {formatDate(student.unlockedAt)}
                </p>
              </div>

              {/* Stats */}
              <div className="flex-shrink-0 text-right">
                <p className="text-lg font-bold">{student.completionPercentage}%</p>
                <p className="text-xs text-muted-foreground">
                  {student.segmentsCompleted}/{student.totalSegments} segments
                </p>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
```

#### 3.3 Update SongPage

```typescript
// app/src/components/class/SongPage.tsx
import { StudentLeaderboard } from './StudentLeaderboard'
import { useStudentLeaderboard } from '@/hooks/useStudentLeaderboard'

export function SongPage({ geniusId, ...props }: SongPageProps) {
  const { leaderboard, isLoading, hasLeaderboard } = useStudentLeaderboard(geniusId)
  const { pkpAddress } = useAuth()

  return (
    <div>
      {/* ... existing header ... */}

      <Tabs defaultValue="practice">
        <TabsList>
          <TabsTrigger value="practice">Practice</TabsTrigger>
          <TabsTrigger value="students">
            Students {leaderboard && `(${leaderboard.totalStudents})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="practice">
          {/* ... existing practice content ... */}
        </TabsContent>

        <TabsContent value="students">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : !hasLeaderboard ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No leaderboard data yet</p>
              <p className="text-sm">Complete this song to create the leaderboard!</p>
            </div>
          ) : (
            <StudentLeaderboard
              students={leaderboard.students}
              currentUserAddress={pkpAddress}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

---

### Part 4: Artist Profile Aggregation

Build artist-level student stats:

```typescript
// services/student-indexer/src/artist-stats.ts
interface ArtistStats {
  geniusArtistId: number
  artistName: string
  avatarUrl: string
  totalStudents: number // Unique addresses
  totalSongsWithStudents: number
  totalCompletions: number
  topSongs: {
    geniusId: number
    title: string
    studentCount: number
    artworkUrl: string
  }[]
  recentActivity: {
    address: string
    geniusId: number
    songTitle: string
    completedAt: number
  }[]
  updatedAt: number
}

async function buildArtistStats(geniusArtistId: number) {
  console.log(`[Artist Stats] Processing artist ${geniusArtistId}...`)

  // 1. Get artist data from ArtistRegistry
  const artist = await artistRegistryContract.read.getArtist([geniusArtistId])

  // 2. Get all songs by this artist from KaraokeCatalog
  const allSongs = await catalogContract.read.getRecentSongs([50])
  const artistSongs = allSongs.filter(song =>
    // Match by artist name (since catalog doesn't have geniusArtistId)
    song.artist.toLowerCase() === artist.lensHandle.toLowerCase() ||
    song.artist.toLowerCase().includes(artist.lensHandle.toLowerCase())
  )

  console.log(`[Artist Stats] Found ${artistSongs.length} songs`)

  // 3. Aggregate student data across all songs
  const uniqueStudents = new Set<string>()
  const songStats = new Map<number, { studentCount: number, title: string, artworkUrl: string }>()
  const recentActivity: ArtistStats['recentActivity'] = []

  for (const song of artistSongs) {
    const leaderboardUri = await catalogContract.read.getLeaderboardUri([song.geniusId])

    if (!leaderboardUri || leaderboardUri === '') continue

    const groveUrl = lensUriToHttps(leaderboardUri)
    const response = await fetch(groveUrl)
    const leaderboard = await response.json()

    // Track unique students
    for (const student of leaderboard.students) {
      uniqueStudents.add(student.address)

      // Recent activity (last 10)
      if (recentActivity.length < 10) {
        recentActivity.push({
          address: student.address,
          geniusId: song.geniusId,
          songTitle: song.title,
          completedAt: student.unlockedAt
        })
      }
    }

    // Song stats
    songStats.set(song.geniusId, {
      studentCount: leaderboard.totalStudents,
      title: song.title,
      artworkUrl: lensUriToHttps(song.thumbnailUri)
    })
  }

  // 4. Sort songs by student count
  const topSongs = Array.from(songStats.entries())
    .sort((a, b) => b[1].studentCount - a[1].studentCount)
    .slice(0, 10)
    .map(([geniusId, stats]) => ({
      geniusId,
      ...stats
    }))

  // 5. Sort recent activity by date
  recentActivity.sort((a, b) => b.completedAt - a.completedAt)

  // 6. Build stats object
  const stats: ArtistStats = {
    geniusArtistId,
    artistName: artist.lensHandle,
    avatarUrl: '', // TODO: Get from Lens Account Metadata
    totalStudents: uniqueStudents.size,
    totalSongsWithStudents: songStats.size,
    totalCompletions: Array.from(songStats.values()).reduce(
      (sum, s) => sum + s.studentCount, 0
    ),
    topSongs,
    recentActivity: recentActivity.slice(0, 10),
    updatedAt: Date.now()
  }

  // 7. Upload to Grove
  const acl = immutable(84532) // Base Sepolia
  const response = await storageClient.uploadAsJson(stats, { acl })

  console.log(`[Grove] ✅ Uploaded artist stats: ${response.uri}`)

  return response.uri
}
```

---

## Testing

### 1. Unlock a song
```bash
# Via frontend or contract
cast send $KARAOKE_CREDITS_CONTRACT \
  "unlockSong(uint32,uint8)" \
  3352793 8 \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

### 2. Run indexer
```bash
cd services/student-indexer
bun run src/index.ts
```

### 3. Check contract
```bash
cast call $KARAOKE_CATALOG_CONTRACT \
  "getLeaderboardUri(uint32)" \
  3352793 \
  --rpc-url https://sepolia.base.org
```

### 4. Fetch from Grove
```bash
curl https://api.grove.storage/{storage_key}
```

### 5. View in frontend
```
http://localhost:5173/#/song/3352793
→ Click "Students" tab
→ Should show leaderboard
```

---

## Monitoring & Maintenance

### Cron Job (Every 5 minutes)
```bash
*/5 * * * * cd /services/student-indexer && bun run src/index.ts >> logs/indexer.log 2>&1
```

### Cloudflare Workers (Recommended)
- Auto-scaling
- Global edge deployment
- Built-in monitoring
- KV storage for state

### Logs
```bash
tail -f logs/indexer.log
```

### Alerts
Set up alerts for:
- Failed Grove uploads
- Failed contract writes
- No events in 24h (might indicate issue)

---

## Cost Estimate

### Per Song Leaderboard
- Event indexing: **Free** (read-only RPC calls)
- Grove upload: **Free** (testnet)
- Contract write: **~$0.01** (Base Sepolia gas)

### 100 Songs with Leaderboards
- Total: **~$1.00** one-time setup
- Updates: **Free** (just re-upload to Grove, contract URI stays same)

### Ongoing Costs
- Cloudflare Workers cron: **Free** (100k requests/day)
- RPC calls: **Free** (public endpoints)
- Grove storage: **Free** (testnet), **~$0.10/month** (mainnet)

**Total: ~$0.10/month for 100+ songs**

---

## FAQ

### Q: How do I backfill historical data?
```bash
# Run indexer from genesis block
FROM_BLOCK=0 bun run src/index.ts
```

### Q: What if a student unlocks a song twice?
Contract prevents this - `unlockSong()` reverts if already owned.

### Q: How do I add Lens usernames to leaderboard?
Enhance indexer to query Lens GraphQL for each student address.

### Q: Can I show real-time updates?
Yes! Use contract event subscriptions:
```typescript
publicClient.watchContractEvent({
  address: KARAOKE_CREDITS_ADDRESS,
  event: SONG_UNLOCKED_EVENT,
  onLogs: (logs) => {
    // Trigger reindex for affected songs
  }
})
```

---

## Next Steps

1. ✅ Deploy updated contract with `setLeaderboardUri`
2. ✅ Create and test indexer service
3. ✅ Add frontend hooks and UI
4. ✅ Set up Cloudflare Workers cron
5. ✅ Backfill historical data
6. ✅ Add Lens profile enrichment
7. ✅ Deploy to production

**Estimated time: 1 day of development + testing**
