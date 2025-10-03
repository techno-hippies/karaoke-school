# Segment-Based Architecture: Native + Genius Integration

**Version**: 1.0
**Date**: 2025-01-03
**Status**: Design Complete - Ready for Implementation

---

## Overview

This document outlines the architectural redesign to support **multiple content sources** (Native songs + Genius.com) within a unified practice/performance system. The core abstraction is the **Segment** - a practice unit that can be either:

1. **Native Segment**: Pre-cut audio clip with word-level timestamps (full karaoke)
2. **Genius Segment**: Annotated lyric referent (text recitation practice, no audio)

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Architectural Decisions](#architectural-decisions)
3. [Data Model](#data-model)
4. [Contract Design](#contract-design)
5. [URL Structure & Routing](#url-structure--routing)
6. [Implementation Plan](#implementation-plan)
7. [Examples](#examples)

---

## Problem Statement

### Current State (Pre-Refactor)

- **Native songs only**: Songs from SongRegistryV4 with audio, clips, and word-level timestamps
- **Clips terminology**: Implies audio/video content
- **State-based navigation**: Data passed via `navigate(path, { state })` - not shareable
- **No external content**: Genius search implemented but results not actionable

### Goals

1. ✅ Support **multiple content sources** (Native, Genius, future: Spotify, SoundCloud)
2. ✅ **Shareable URLs** for viral/social distribution (IPFS-compatible hash routing)
3. ✅ **Unified practice flow** regardless of source
4. ✅ **Type-safe** contract and TypeScript integration
5. ✅ **Scalable** architecture for future sources
6. ✅ **Consistent terminology** across contracts, code, and UI

---

## Architectural Decisions

### 1. Content Source Enumeration

**Decision**: Use formalized `ContentSource` enum in contracts and TypeScript

```solidity
// Contracts
enum ContentSource { Native, Genius, Soundcloud, Spotify }
```

```typescript
// TypeScript
export enum ContentSource {
  Native = 0,
  Genius = 1,
  Soundcloud = 2,
  Spotify = 3
}
```

**Rationale**:
- ✅ Type-safe (compile-time validation)
- ✅ Extensible (add new sources without breaking changes)
- ✅ On-chain queryable (indexed events, source filtering)
- ✅ Gas-efficient (uint8 storage vs string prefixes)

**Rejected Alternatives**:
- ❌ String prefixes ("native:id", "genius:id") - no validation, extra gas
- ❌ Off-chain only - loses source info on-chain, hard to build integrations
- ❌ Numeric namespacing - doesn't scale, limits native songs

---

### 2. Terminology: Clip → Segment

**Decision**: Rename "Clip" to "Segment" throughout the codebase and contracts

| Old Term | New Term | Rationale |
|----------|----------|-----------|
| Clip | **Segment** | "Clip" implies audio/video; Genius has neither |
| ClipRegistry | **SegmentRegistry** | Aligns with new terminology |
| clipScores | **segmentScores** | Consistent contract naming |
| ClipPickerPage | **SegmentPickerPage** | UI component alignment |

**Segment Definition**: A practice unit from any source (native audio clip, genius referent, spotify segment, etc.)

**Scope of Changes**:
- ✅ Contract V2 versions (KaraokeScoreboardV4, SegmentRegistryV1)
- ✅ TypeScript interfaces (`Segment`, `SegmentMetadata`, `SegmentLyrics`)
- ✅ Component filenames and props
- ✅ Variable/function names

---

### 3. ID Strategy

**Decision**: Human-readable, unique IDs enforced on-chain

#### Native Songs
```
Format: "{title-slug}-{artist-slug}"
Example: "heat-of-the-night-scarlett-x"
```

**Generation**:
```typescript
function generateSongId(title: string, artist: string): string {
  return `${title}-${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

**Contract Enforcement**:
```solidity
mapping(string => bool) private songExists;

function addSong(string calldata id, ...) external onlyOwner {
    require(!songExists[id], "Song ID already exists");
    songExists[id] = true;
    // ...
}
```

**Collision Handling**: Manual suffix by uploader
```
down-home-blues-ethel-waters-1927
down-home-blues-ethel-waters-remastered
```

#### Genius Songs
```
Format: "{genius_id}"
Example: "123456"
```

**Rationale**: Genius already provides unique numeric IDs

#### Segment IDs
```
Native: "verse-1", "chorus-1", "bridge-1"
Genius: "referent-5678" (using Genius referent ID)
```

---

### 4. URL Structure & Routing

**Decision**: URL-based data fetching with hash routing (IPFS-compatible)

#### Route Structure
```
/#/create/:source/:songId/segments
/#/create/:source/:songId/segments/:segmentId/mode
/#/create/:source/:songId/segments/:segmentId/recorder
```

#### Examples
```
Native:
/#/create/native/heat-of-the-night-scarlett-x/segments
/#/create/native/heat-of-the-night-scarlett-x/segments/verse-1/recorder

Genius:
/#/create/genius/123456/segments
/#/create/genius/123456/segments/referent-5678/recorder
```

#### IPFS Shareable URLs
```
https://ipfs.io/ipfs/QmXxx.../#/create/native/down-home-blues-ethel-waters/segments/verse-1/recorder
```

**Components Fetch Data from URL Params**:
```typescript
// SegmentPickerPage.tsx
const { source, songId } = useParams<{ source: string; songId: string }>();

useEffect(() => {
  async function loadSongData() {
    const sourceEnum = parseInt(source) as ContentSource;

    if (sourceEnum === ContentSource.Native) {
      const songData = await getSongById(songId);
      const segments = await fetchSegments(songData.segmentIds);
      setSong(songData);
      setSegments(segments);
    } else if (sourceEnum === ContentSource.Genius) {
      const geniusSong = await fetchGeniusSong(songId);
      const referents = await litSearchService.getReferents(songId);
      setSong(geniusSong);
      setSegments(convertReferentsToSegments(referents));
    }
  }

  loadSongData();
}, [source, songId]);
```

**Benefits**:
- ✅ Shareable URLs (viral distribution)
- ✅ Deep linking works
- ✅ Back button works correctly
- ✅ State persists on page reload
- ✅ IPFS-compatible (hash routing maintained)

---

### 5. ModeSelectorPage Conditional Navigation

**Decision**: Skip mode selector for Genius songs (only Practice mode available)

```typescript
// In SegmentPickerPage
const handleSegmentSelect = (segment: Segment) => {
  if (segment.source === ContentSource.Genius) {
    // Skip mode selector, go straight to recorder
    navigate(`/create/${segment.source}/${songId}/segments/${segment.id}/recorder`);
  } else if (segment.source === ContentSource.Native) {
    // Show mode selector (Practice, Perform, Lip Sync)
    navigate(`/create/${segment.source}/${songId}/segments/${segment.id}/mode`);
  }
};
```

**Rationale**: No audio = no lip sync, no perform mode. Only practice (text recitation).

---

## Data Model

### TypeScript Types

**Core Types** (`site/src/types/song.ts`):

```typescript
// Content source enumeration
export enum ContentSource {
  Native = 0,
  Genius = 1,
  Soundcloud = 2,
  Spotify = 3
}

// Content identifier (source + ID)
export interface ContentIdentifier {
  source: ContentSource;
  id: string;
}

// Unified Song interface
export interface Song {
  id: string;                    // "heat-of-the-night-scarlett-x" or "123456"
  source: ContentSource;
  title: string;
  artist: string;
  duration?: number;             // Optional (Genius has none)
  thumbnailUrl?: string;
  audioUrl?: string;             // Only for native

  // Native-specific
  _registryData?: RegistrySong;

  // Genius-specific
  _geniusData?: GeniusSong;
}

// Unified Segment interface (replaces Clip)
export interface Segment {
  id: string;                    // "verse-1" or "referent-5678"
  source: ContentSource;
  title: string;                 // "Verse 1" or "Lines 1-4"
  sectionType: string;           // "Verse", "Chorus", "Referent"
  sectionIndex?: number;         // Optional (native has this)

  // Content
  lyrics: SegmentLyrics;

  // Native-specific (optional)
  duration?: number;
  audioUrl?: string;
  instrumentalUrl?: string;
  difficultyLevel?: number;
  wordsPerSecond?: number;

  // Genius-specific (optional)
  annotations?: any[];
  characterRange?: { start: number; end: number };
}

// Unified lyrics structure
export type SegmentLyrics =
  | TimestampedLyrics    // Native songs
  | UntimestampedLyrics; // Genius songs

export interface TimestampedLyrics {
  type: 'timestamped';
  lines: Array<{
    start: number;
    end: number;
    text: string;
    words: Array<{ text: string; start: number; end: number }>;
    translation?: string;
  }>;
}

export interface UntimestampedLyrics {
  type: 'untimestamped';
  lines: Array<{
    text: string;
    translation?: string;
  }>;
}

// Full metadata (extends Segment)
export interface SegmentMetadata extends Segment {
  totalLines: number;
  languages?: string[];
}
```

**Genius Types** (`site/src/types/genius.ts`):

```typescript
export interface GeniusSong {
  genius_id: number;
  title: string;
  artist: string;
  genius_slug: string;
  url: string;
  artwork_thumbnail: string | null;
  lyrics_state: string;
}

export interface GeniusReferent {
  id: number;
  fragment: string;              // Lyric text
  song_id: number;
  range: { start: number; end: number };  // Character positions
  annotations?: any[];
}
```

**Utility Functions** (`site/src/types/song.ts`):

```typescript
// Convert ContentSource to URL path segment
export function sourceToPath(source: ContentSource): string {
  return ContentSource[source].toLowerCase();
}

// Parse source from URL path
export function pathToSource(path: string): ContentSource {
  return ContentSource[path.charAt(0).toUpperCase() + path.slice(1) as keyof typeof ContentSource];
}

// Format content ID for contract calls
export function formatContentHash(source: ContentSource, id: string): string {
  // For contract v4, will use keccak256(source + id)
  return `${source}:${id}`;
}
```

---

### TinyBase Schema

**Updated Schema** (`site/src/services/database/tinybase.ts`):

```typescript
export interface ExerciseCard {
  card_id: string;            // "${source}:${songId}_seg_${segmentId}_line_${lineIndex}"

  // Content identifiers
  content_source: number;     // ContentSource enum value (0=Native, 1=Genius)
  song_id: string;            // "heat-of-the-night-scarlett-x" or "123456"
  segment_id: string;         // "verse-1" or "referent-5678"
  line_index: number;

  // Content
  fragment: string;
  translation?: string;

  // Metadata
  song_title: string;
  artist: string;

  // FSRS state (unchanged)
  difficulty: number;
  stability: number;
  state: 0 | 1 | 2 | 3;
  reps: number;
  lapses: number;
  due_date: number;
  last_review: number;
  created_at: number;
  liked_at: number;
}
```

**Card ID Format**:
```typescript
function generateCardId(
  source: ContentSource,
  songId: string,
  segmentId: string,
  lineIndex: number
): string {
  return `${source}:${songId}_seg_${segmentId}_line_${lineIndex}`;
}

// Examples
"0:heat-of-the-night-scarlett-x_seg_verse-1_line_0"  // Native
"1:123456_seg_referent-5678_line_2"                   // Genius
```

---

## Contract Design

### KaraokeScoreboardV4 (New Version)

**Key Changes**:
1. Formalized `ContentSource` enum
2. Hash-based scoring keys (gas efficient)
3. Source-aware events

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract KaraokeScoreboardV4 {
    // Content source enumeration
    enum ContentSource { Native, Genius, Soundcloud, Spotify }

    struct Score {
        uint96 score;
        uint64 timestamp;
        uint16 attemptCount;
    }

    struct TrackScore {
        uint96 totalScore;
        uint64 timestamp;
        uint16 segmentsCompleted;
        bool isComplete;
    }

    struct LeaderboardEntry {
        address user;
        uint96 score;
        uint64 timestamp;
    }

    // Scoring storage (hash-based)
    mapping(bytes32 => mapping(address => Score)) public segmentScores;
    mapping(bytes32 => mapping(address => TrackScore)) public trackScores;
    mapping(bytes32 => LeaderboardEntry[10]) private segmentLeaderboards;
    mapping(bytes32 => LeaderboardEntry[10]) private trackLeaderboards;

    // Track configuration
    mapping(bytes32 => bytes32[]) public trackSegments;
    mapping(bytes32 => bool) public trackExists;

    address public trustedScorer;
    address public owner;

    // Events (human-readable)
    event SegmentScoreUpdated(
        uint8 indexed source,
        string trackId,
        string segmentId,
        address indexed user,
        uint96 score,
        uint64 timestamp,
        bool isNewHighScore,
        bool enteredTopTen,
        uint8 leaderboardPosition
    );

    event TrackCompleted(
        uint8 indexed source,
        string trackId,
        address indexed user,
        uint96 totalScore,
        uint64 timestamp,
        bool enteredTopTen,
        uint8 leaderboardPosition
    );

    event TrackConfigured(
        uint8 indexed source,
        string trackId,
        bytes32[] segmentHashes,
        uint16 segmentCount
    );

    constructor(address _trustedScorer) {
        owner = msg.sender;
        trustedScorer = _trustedScorer;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyTrustedScorer() {
        require(msg.sender == trustedScorer, "Not trusted scorer");
        _;
    }

    /**
     * @notice Generate content hash from source + ID
     */
    function getContentHash(uint8 source, string calldata id)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(source, id));
    }

    /**
     * @notice Configure a track with its segment IDs
     */
    function configureTrack(
        uint8 source,
        string calldata trackId,
        string[] calldata segmentIds
    ) external onlyOwner {
        require(segmentIds.length > 0, "Must have at least one segment");
        require(segmentIds.length <= 100, "Too many segments");

        bytes32 trackHash = getContentHash(source, trackId);
        require(!trackExists[trackHash], "Track already configured");

        // Convert segment IDs to hashes
        bytes32[] memory segmentHashes = new bytes32[](segmentIds.length);
        for (uint256 i = 0; i < segmentIds.length; i++) {
            segmentHashes[i] = getContentHash(source, segmentIds[i]);
        }

        trackSegments[trackHash] = segmentHashes;
        trackExists[trackHash] = true;

        emit TrackConfigured(source, trackId, segmentHashes, uint16(segmentIds.length));
    }

    /**
     * @notice Update user's score for a segment
     */
    function updateScore(
        uint8 source,
        string calldata trackId,
        string calldata segmentId,
        address user,
        uint96 newScore
    ) external onlyTrustedScorer {
        require(newScore <= 100, "Invalid score");
        require(user != address(0), "Invalid user");

        bytes32 trackHash = getContentHash(source, trackId);
        bytes32 segmentHash = getContentHash(source, segmentId);

        require(trackExists[trackHash], "Track not configured");

        Score storage userSegmentScore = segmentScores[segmentHash][user];
        bool isNewHighScore = false;
        bool enteredTopTen = false;
        uint8 leaderboardPosition = 255;

        // Update if first attempt or new high score
        if (userSegmentScore.score == 0 || newScore > userSegmentScore.score) {
            userSegmentScore.score = newScore;
            userSegmentScore.timestamp = uint64(block.timestamp);
            isNewHighScore = true;

            // Update leaderboard
            if (newScore > 0) {
                (enteredTopTen, leaderboardPosition) = _updateLeaderboard(
                    segmentLeaderboards[segmentHash],
                    user,
                    newScore,
                    uint64(block.timestamp)
                );
            }
        }

        userSegmentScore.attemptCount++;

        emit SegmentScoreUpdated(
            source,
            trackId,
            segmentId,
            user,
            newScore,
            uint64(block.timestamp),
            isNewHighScore,
            enteredTopTen,
            leaderboardPosition
        );

        // Check for track completion
        if (isNewHighScore) {
            _checkTrackCompletion(source, trackId, trackHash, user);
        }
    }

    /**
     * @notice Check track completion and update track leaderboard
     */
    function _checkTrackCompletion(
        uint8 source,
        string calldata trackId,
        bytes32 trackHash,
        address user
    ) private {
        bytes32[] storage segments = trackSegments[trackHash];
        uint256 segmentCount = segments.length;
        uint96 totalScore = 0;
        uint16 segmentsCompleted = 0;
        uint64 latestTimestamp = 0;

        // Sum all segment scores
        for (uint256 i = 0; i < segmentCount; i++) {
            Score storage segmentScore = segmentScores[segments[i]][user];
            if (segmentScore.score > 0) {
                totalScore += segmentScore.score;
                segmentsCompleted++;
                if (segmentScore.timestamp > latestTimestamp) {
                    latestTimestamp = segmentScore.timestamp;
                }
            }
        }

        // Update track score
        TrackScore storage userTrackScore = trackScores[trackHash][user];
        bool isNowComplete = (segmentsCompleted == segmentCount);

        userTrackScore.totalScore = totalScore;
        userTrackScore.timestamp = latestTimestamp;
        userTrackScore.segmentsCompleted = segmentsCompleted;
        userTrackScore.isComplete = isNowComplete;

        // Update track leaderboard if complete
        if (isNowComplete && totalScore > 0) {
            (bool enteredTopTen, uint8 position) = _updateLeaderboard(
                trackLeaderboards[trackHash],
                user,
                totalScore,
                latestTimestamp
            );

            emit TrackCompleted(
                source,
                trackId,
                user,
                totalScore,
                latestTimestamp,
                enteredTopTen,
                position
            );
        }
    }

    /**
     * @notice Update leaderboard (internal helper)
     */
    function _updateLeaderboard(
        LeaderboardEntry[10] storage leaderboard,
        address user,
        uint96 score,
        uint64 timestamp
    ) private returns (bool enteredTopTen, uint8 position) {
        // ... (same logic as V3)
    }

    /**
     * @notice Get segment score for a user
     */
    function getSegmentScore(uint8 source, string calldata segmentId, address user)
        external
        view
        returns (uint96 score, uint64 timestamp, uint16 attemptCount)
    {
        bytes32 segmentHash = getContentHash(source, segmentId);
        Score memory s = segmentScores[segmentHash][user];
        return (s.score, s.timestamp, s.attemptCount);
    }

    /**
     * @notice Get track score for a user
     */
    function getTrackScore(uint8 source, string calldata trackId, address user)
        external
        view
        returns (uint96 totalScore, uint64 timestamp, uint16 segmentsCompleted, bool isComplete)
    {
        bytes32 trackHash = getContentHash(source, trackId);
        TrackScore memory ts = trackScores[trackHash][user];
        return (ts.totalScore, ts.timestamp, ts.segmentsCompleted, ts.isComplete);
    }

    /**
     * @notice Get top scorers for a segment
     */
    function getTopSegmentScorers(uint8 source, string calldata segmentId)
        external
        view
        returns (LeaderboardEntry[10] memory)
    {
        bytes32 segmentHash = getContentHash(source, segmentId);
        return segmentLeaderboards[segmentHash];
    }

    /**
     * @notice Get top scorers for a track
     */
    function getTopTrackScorers(uint8 source, string calldata trackId)
        external
        view
        returns (LeaderboardEntry[10] memory)
    {
        bytes32 trackHash = getContentHash(source, trackId);
        return trackLeaderboards[trackHash];
    }

    // ... (owner functions: setTrustedScorer, transferOwnership, etc.)
}
```

---

### SegmentRegistryV1 (Replaces ClipRegistry)

**Minimal Contract** (segments stored off-chain on Grove):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SegmentRegistryV1 {
    struct Segment {
        string id;                  // "verse-1", "referent-5678"
        uint8 source;               // ContentSource enum
        string songId;              // Parent song ID
        string metadataUri;         // Grove URI for segment metadata
        uint32 duration;            // Duration in seconds (0 for Genius)
        bool enabled;
    }

    Segment[] private segments;
    mapping(bytes32 => uint256) private segmentHashToIndex;
    address public owner;

    event SegmentAdded(uint8 indexed source, string indexed songId, string segmentId);
    event SegmentUpdated(uint8 indexed source, string segmentId, bool enabled);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function getSegmentHash(uint8 source, string calldata id)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(source, id));
    }

    function addSegment(
        uint8 source,
        string calldata id,
        string calldata songId,
        string calldata metadataUri,
        uint32 duration
    ) external onlyOwner {
        bytes32 segmentHash = getSegmentHash(source, id);
        require(segmentHashToIndex[segmentHash] == 0, "Segment exists");

        segments.push(Segment({
            id: id,
            source: source,
            songId: songId,
            metadataUri: metadataUri,
            duration: duration,
            enabled: true
        }));

        segmentHashToIndex[segmentHash] = segments.length;

        emit SegmentAdded(source, songId, id);
    }

    function getSegment(uint8 source, string calldata id)
        external
        view
        returns (Segment memory)
    {
        bytes32 segmentHash = getSegmentHash(source, id);
        uint256 index = segmentHashToIndex[segmentHash];
        require(index > 0, "Segment not found");
        return segments[index - 1];
    }

    // ... (additional query functions)
}
```

---

## URL Structure & Routing

### Route Definitions

**App.tsx** (using HashRouter for IPFS):

```typescript
import { HashRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Song picker (all sources) */}
        <Route path="/create/song-picker" element={<SongPickerPage />} />

        {/* Segment picker (source-specific) */}
        <Route path="/create/:source/:songId/segments" element={<SegmentPickerPage />} />

        {/* Mode selector (native only) */}
        <Route path="/create/:source/:songId/segments/:segmentId/mode" element={<ModeSelectorPage />} />

        {/* Recorder (all sources) */}
        <Route path="/create/:source/:songId/segments/:segmentId/recorder" element={<RecorderPage />} />

        {/* Other routes... */}
      </Routes>
    </HashRouter>
  );
}
```

### URL Examples

```
Native Song Flow:
1. /#/create/song-picker
2. /#/create/native/heat-of-the-night-scarlett-x/segments
3. /#/create/native/heat-of-the-night-scarlett-x/segments/verse-1/mode
4. /#/create/native/heat-of-the-night-scarlett-x/segments/verse-1/recorder

Genius Song Flow:
1. /#/create/song-picker
2. /#/create/genius/123456/segments
3. /#/create/genius/123456/segments/referent-5678/recorder  (skip mode selector)
```

### Shareable IPFS URLs

```
Native:
https://ipfs.io/ipfs/QmXxx.../#/create/native/down-home-blues-ethel-waters/segments/verse-1/recorder

Genius:
https://ipfs.io/ipfs/QmXxx.../#/create/genius/123456/segments/referent-5678/recorder

Gateway-free:
ipfs://QmXxx.../#/create/native/heat-of-the-night-scarlett-x/segments/chorus-1/recorder
```

---

## Implementation Plan

### Phase 1: Type System Foundation

**Goal**: Establish strict TypeScript types and utilities

**Tasks**:
1. ✅ Create `site/src/types/genius.ts`:
   - `GeniusSong`, `GeniusReferent` interfaces

2. ✅ Update `site/src/types/song.ts`:
   - Add `ContentSource` enum
   - Update `Song` interface with `source` field
   - Create `Segment` interface (replaces `Clip`)
   - Create `SegmentLyrics` union type
   - Add utility functions: `sourceToPath()`, `pathToSource()`, `formatContentHash()`

3. ✅ Create type conversion utilities:
   - `convertGeniusToSong(geniusResult: GeniusSong): Song`
   - `convertReferentsToSegments(referents: GeniusReferent[]): Segment[]`

**Files to Create/Update**:
- `site/src/types/genius.ts` (new)
- `site/src/types/song.ts` (update)
- `site/src/utils/content.ts` (new - conversion utilities)

---

### Phase 2: Contract Deployment

**Goal**: Deploy KaraokeScoreboardV4 and SegmentRegistryV1

**Tasks**:
1. ✅ Create `contracts/src/KaraokeScoreboardV4.sol`
2. ✅ Create `contracts/script/DeployKaraokeScoreboardV4.s.sol`
3. ✅ Create `contracts/src/SegmentRegistryV1.sol` (optional - may not need)
4. ✅ Deploy to Lens testnet
5. ✅ Update ABIs in `site/src/abi/`
6. ✅ Update contract addresses in config

**Commands**:
```bash
# Deploy KaraokeScoreboardV4
cd contracts
FOUNDRY_PROFILE=zksync forge create \
  src/KaraokeScoreboardV4.sol:KaraokeScoreboardV4 \
  --rpc-url https://rpc.testnet.lens.xyz \
  --private-key $PRIVATE_KEY \
  --constructor-args "0x254AA0096C9287a03eE62b97AA5643A2b8003657" \
  --zksync --broadcast

# Generate ABI
forge inspect KaraokeScoreboardV4 abi > ../site/src/abi/KaraokeScoreboardV4.json
```

---

### Phase 3: Genius Referents Lit Action

**Goal**: Implement Lit Action to fetch Genius referents

**Tasks**:
1. ✅ Create `lit-actions/src/search/referents.js`
   - Similar structure to `free.js`
   - Takes `songId` (genius_id) param
   - Calls Genius API: `GET /songs/{songId}/referents`
   - Returns array of referents

2. ✅ Upload to IPFS via Lit

3. ✅ Update `site/src/config/lit-actions.ts`:
   ```typescript
   {
     type: 'search',
     name: 'referents',
     cid: 'QmXxx...',
     version: 'v1'
   }
   ```

4. ✅ Update `site/src/services/LitSearchService.ts`:
   - Add `getReferents(geniusSongId: string, walletClient: WalletClient): Promise<GeniusReferent[]>`

**Referents Lit Action** (`lit-actions/src/search/referents.js`):

```javascript
/**
 * Genius Referents Fetcher
 * Fetches lyric referents (annotated segments) for a song
 *
 * Params:
 * - songId: Genius song ID (number)
 * - userAddress: User's wallet (for analytics)
 */

const go = async () => {
  const { songId, userAddress } = jsParams || {};

  if (!songId) {
    throw new Error('songId parameter is required');
  }

  const geniusApiKey = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';

  // Fetch referents
  const url = `https://api.genius.com/songs/${songId}?text_format=plain`;

  const dataString = await Lit.Actions.runOnce({
    waitForResponse: true,
    name: "geniusReferentsFetch"
  }, async () => {
    const response = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + geniusApiKey
      }
    });

    if (!response.ok) {
      throw new Error(`Genius API error: ${response.status}`);
    }

    return await response.text();
  });

  const data = JSON.parse(dataString);

  // Parse referents from response
  // Note: Actual API structure may vary, adjust accordingly
  const referents = data.response?.song?.description_annotation?.referents || [];

  Lit.Actions.setResponse({
    response: JSON.stringify({
      success: true,
      referents,
      count: referents.length,
      version: 'referents_v1'
    })
  });
};

go();
```

---

### Phase 4: URL-based Routing

**Goal**: Implement URL-based data fetching and shareable links

**Tasks**:
1. ✅ Update route definitions in `App.tsx`
   - Add `:source` and `:songId` params

2. ✅ Refactor `SegmentPickerPage` (rename from `ClipPickerPage`):
   - Extract `source` and `songId` from URL params
   - Fetch data based on source:
     - Native: Call `getSongById()` + fetch segments from contract/Grove
     - Genius: Call `fetchGeniusSong()` + `getReferents()`
   - Remove dependency on `location.state`

3. ✅ Update navigation calls:
   - SongPickerPage: `navigate(/create/${source}/${songId}/segments)`
   - SegmentPickerPage: `navigate(/create/${source}/${songId}/segments/${segmentId}/recorder)` (skip mode for Genius)

4. ✅ Update `RecorderPage` (rename from `CameraRecorderPage`):
   - Extract params from URL
   - Fetch segment data from URL params
   - Remove dependency on `location.state`

**SegmentPickerPage URL Fetching Example**:

```typescript
// SegmentPickerPage.tsx
import { useParams } from 'react-router-dom';

export const SegmentPickerPage: React.FC = () => {
  const { source, songId } = useParams<{ source: string; songId: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const sourceEnum = pathToSource(source || '');

      if (sourceEnum === ContentSource.Native) {
        // Fetch from SongRegistryV4
        const songData = await getSongById(songId);
        setSong(songData);

        // Fetch segments from Grove
        const segmentUris = songData.segmentIds.split(',');
        const segmentData = await Promise.all(
          segmentUris.map(uri => fetch(resolveLensUri(uri)).then(r => r.json()))
        );
        setSegments(segmentData);

      } else if (sourceEnum === ContentSource.Genius) {
        // Fetch from Genius via Lit
        const geniusSong = await fetchGeniusSong(songId);
        setSong(convertGeniusToSong(geniusSong));

        // Fetch referents
        const referents = await litSearchService.getReferents(songId, walletClient);
        setSegments(convertReferentsToSegments(referents));
      }

      setLoading(false);
    }

    loadData();
  }, [source, songId]);

  const handleSegmentClick = (segment: Segment) => {
    if (segment.source === ContentSource.Genius) {
      // Skip mode selector for Genius
      navigate(`/create/${source}/${songId}/segments/${segment.id}/recorder`);
    } else {
      navigate(`/create/${source}/${songId}/segments/${segment.id}/mode`);
    }
  };

  // ... render
};
```

---

### Phase 5: Component Refactoring

**Goal**: Update components to use Segment terminology and handle both sources

**Tasks**:

1. ✅ **Rename Components**:
   - `ClipPickerPage.tsx` → `SegmentPickerPage.tsx`
   - `ClipPickerPageRoute.tsx` → `SegmentPickerPageRoute.tsx` (may be removed)
   - `ClipView.tsx` → `SegmentView.tsx`
   - `ClipPickerSheet.tsx` → `SegmentPickerSheet.tsx`

2. ✅ **Update Props**:
   - `clips: ClipMetadata[]` → `segments: SegmentMetadata[]`
   - `onClipSelect` → `onSegmentSelect`
   - `selectedClip` → `selectedSegment`

3. ✅ **Update RecorderPage**:
   ```typescript
   // RecorderPage.tsx
   const { source, songId, segmentId } = useParams();

   useEffect(() => {
     async function loadSegment() {
       const sourceEnum = pathToSource(source || '');
       const segment = await fetchSegment(sourceEnum, songId, segmentId);

       if (segment.lyrics.type === 'timestamped') {
         // Native: Use existing karaoke flow
         setTimestampedLyrics(segment.lyrics.lines);
         setAudioUrl(segment.instrumentalUrl);
       } else {
         // Genius: Show untimestamped lyrics
         setUntimestampedLyrics(segment.lyrics.lines);
         setAudioUrl(null);  // No audio
       }
     }

     loadSegment();
   }, [source, songId, segmentId]);
   ```

4. ✅ **Update SongPickerPage**:
   - Make Genius results clickable
   - On click: Navigate to `/create/genius/{geniusId}/segments`

5. ✅ **Conditional ModeSelectorPage**:
   - Update to check source and skip for Genius

---

### Phase 6: TinyBase Migration

**Goal**: Update TinyBase schema to support multiple sources

**Tasks**:

1. ✅ Update `ExerciseCard` interface:
   - Add `content_source: number`
   - Add `song_id: string`
   - Add `segment_id: string`
   - Update `card_id` format

2. ✅ Create migration function:
   ```typescript
   function migrateExerciseCards() {
     store.forEachRow('exercise_cards', (rowId) => {
       const card = store.getRow('exercise_cards', rowId);

       // Migrate old cards to Native source
       if (!card.content_source) {
         store.setCell('exercise_cards', rowId, 'content_source', ContentSource.Native);

         // Extract song_id from existing data (if available)
         // Otherwise, mark as 'unknown'
         store.setCell('exercise_cards', rowId, 'song_id', card.song_id || 'unknown');
         store.setCell('exercise_cards', rowId, 'segment_id', 'unknown');
       }
     });
   }
   ```

3. ✅ Update card creation logic:
   ```typescript
   function createExerciseCard(
     source: ContentSource,
     songId: string,
     segmentId: string,
     lineIndex: number,
     fragment: string,
     songTitle: string,
     artist: string
   ): ExerciseCard {
     const cardId = `${source}:${songId}_seg_${segmentId}_line_${lineIndex}`;

     return {
       card_id: cardId,
       content_source: source,
       song_id: songId,
       segment_id: segmentId,
       line_index: lineIndex,
       fragment,
       song_title: songTitle,
       artist,
       // FSRS defaults
       difficulty: 0,
       stability: 0,
       state: 0,
       reps: 0,
       lapses: 0,
       due_date: Date.now(),
       last_review: 0,
       created_at: Date.now(),
       liked_at: Date.now()
     };
   }
   ```

---

### Phase 7: Storybook & Testing

**Goal**: Update Storybook stories and add tests

**Tasks**:

1. ✅ Update story files:
   - `ClipPickerPage.stories.tsx` → `SegmentPickerPage.stories.tsx`
   - Add Genius segment examples

2. ✅ Create mock data:
   - Mock native segments (with timestamps)
   - Mock Genius segments (without timestamps)

3. ✅ Add visual regression tests

---

## Examples

### Example 1: Full Native Song Flow

```typescript
// 1. User browses SongPickerPage
// 2. Selects "Heat of the Night" by Scarlett X
const song: Song = {
  id: 'heat-of-the-night-scarlett-x',
  source: ContentSource.Native,
  title: 'Heat of the Night',
  artist: 'Scarlett X',
  duration: 194,
  thumbnailUrl: 'lens://xxx...',
  audioUrl: 'lens://xxx...',
  _registryData: { /* contract data */ }
};

// 3. Navigate to segment picker
navigate('/create/native/heat-of-the-night-scarlett-x/segments');

// 4. SegmentPickerPage fetches segments
const segments: Segment[] = await fetchSegments(song.segmentIds);

// Example segment
const verseSegment: Segment = {
  id: 'verse-1',
  source: ContentSource.Native,
  title: 'Verse 1',
  sectionType: 'Verse',
  sectionIndex: 0,
  duration: 15,
  audioUrl: 'lens://verse-audio...',
  instrumentalUrl: 'lens://verse-instrumental...',
  difficultyLevel: 2,
  wordsPerSecond: 1.8,
  lyrics: {
    type: 'timestamped',
    lines: [
      {
        start: 0.5,
        end: 3.2,
        text: 'Feel the heat rising up',
        words: [
          { text: 'Feel', start: 0.5, end: 0.8 },
          { text: 'the', start: 0.9, end: 1.0 },
          { text: 'heat', start: 1.1, end: 1.5 },
          { text: 'rising', start: 1.6, end: 2.1 },
          { text: 'up', start: 2.2, end: 3.2 }
        ]
      }
      // ... more lines
    ]
  }
};

// 5. User selects segment → navigate to mode selector
navigate('/create/native/heat-of-the-night-scarlett-x/segments/verse-1/mode');

// 6. User selects "Perform" mode → navigate to recorder
navigate('/create/native/heat-of-the-night-scarlett-x/segments/verse-1/recorder');

// 7. RecorderPage loads segment and shows karaoke UI
// 8. User records performance
// 9. PKP scores via STT + timing analysis
// 10. Score submitted to KaraokeScoreboardV4:
await contract.updateScore(
  ContentSource.Native,  // source = 0
  'heat-of-the-night-scarlett-x',  // trackId
  'verse-1',  // segmentId
  userAddress,
  87  // score
);
```

---

### Example 2: Full Genius Song Flow

```typescript
// 1. User searches "Down Home Blues" in SongPickerPage
const searchResults = await litSearchService.searchSongs('Down Home Blues', walletClient);

// Example result
const geniusResult: GeniusSong = {
  genius_id: 123456,
  title: 'Down Home Blues',
  artist: 'Ethel Waters',
  genius_slug: 'ethel-waters-down-home-blues',
  url: 'https://genius.com/...',
  artwork_thumbnail: 'https://...',
  lyrics_state: 'complete'
};

// 2. Convert to Song
const song: Song = convertGeniusToSong(geniusResult);
// Result:
{
  id: '123456',
  source: ContentSource.Genius,
  title: 'Down Home Blues',
  artist: 'Ethel Waters',
  thumbnailUrl: 'https://...',
  _geniusData: geniusResult
}

// 3. User clicks song → navigate to segments
navigate('/create/genius/123456/segments');

// 4. SegmentPickerPage fetches referents
const referents = await litSearchService.getReferents('123456', walletClient);

// Example referent
const referent: GeniusReferent = {
  id: 5678,
  fragment: 'Down in the dumps, down in the dumps\nI ain\'t blue, I ain\'t blue',
  song_id: 123456,
  range: { start: 0, end: 68 },
  annotations: [/* ... */]
};

// 5. Convert to Segment
const segment: Segment = {
  id: 'referent-5678',
  source: ContentSource.Genius,
  title: 'Lines 1-2',
  sectionType: 'Referent',
  annotations: referent.annotations,
  characterRange: referent.range,
  lyrics: {
    type: 'untimestamped',
    lines: [
      { text: 'Down in the dumps, down in the dumps' },
      { text: 'I ain\'t blue, I ain\'t blue' }
    ]
  }
};

// 6. User selects segment → skip mode selector, go straight to recorder
navigate('/create/genius/123456/segments/referent-5678/recorder');

// 7. RecorderPage shows untimestamped lyrics (no audio)
// 8. User practices reciting the lyrics (a cappella or over their own track)
// 9. PKP scores via STT only (no timing bonus)
// 10. Score submitted to KaraokeScoreboardV4:
await contract.updateScore(
  ContentSource.Genius,  // source = 1
  '123456',  // trackId
  'referent-5678',  // segmentId
  userAddress,
  92  // score (STT accuracy only)
);
```

---

### Example 3: Shareable URL

```
User completes a performance and shares:

URL:
https://ipfs.io/ipfs/QmXxx.../#/create/native/heat-of-the-night-scarlett-x/segments/verse-1/recorder

When friend clicks:
1. Opens at SegmentPickerPage (could redirect directly to recorder)
2. Fetches song "heat-of-the-night-scarlett-x" from SongRegistryV4
3. Fetches segment "verse-1" from Grove
4. Loads recorder with segment pre-selected
5. Friend can practice the same segment
```

---

## Migration Strategy

### No Backward Compatibility Required

Since there are **no users and no data**, we can do a clean break:

1. ✅ Deploy new contracts (V4)
2. ✅ Update all type definitions
3. ✅ Rename all components/files
4. ✅ Update TinyBase schema (fresh start)
5. ✅ Deploy to IPFS with new URL structure

### Testing Checklist

- [ ] Native song: Search → Select → View Segments → Select Mode → Record → Score
- [ ] Genius song: Search → Select → View Referents → Record (Practice) → Score
- [ ] URL sharing: Copy URL → Open in new tab → Verify data loads
- [ ] Leaderboards: Native track, Genius track, mixed sources
- [ ] TinyBase: Create cards from both sources, verify FSRS scheduling
- [ ] Contract: Configure tracks, submit scores, query leaderboards

---

## Next Steps

### Immediate Actions

1. **Create type definitions** (Phase 1)
2. **Deploy KaraokeScoreboardV4** (Phase 2)
3. **Implement Genius referents Lit Action** (Phase 3)
4. **Update routing** (Phase 4)
5. **Refactor components** (Phase 5)

### Follow-up

- Create integration tests
- Update Storybook stories
- Write API documentation
- Deploy to IPFS
- Monitor contract events
- Collect user feedback

---

## Conclusion

This architecture provides:

✅ **Multi-source support** with type safety
✅ **Shareable URLs** for viral growth
✅ **Scalable design** for future sources
✅ **Consistent terminology** across stack
✅ **Clean separation** of native vs external content
✅ **IPFS-compatible** deployment

The unified Segment abstraction allows native clips and Genius referents to coexist in the same practice flow, leaderboards, and TinyBase storage - while preserving their unique characteristics (audio/timing vs text-only).

---

**Ready to implement. Let's build! 🚀**
