# SongCatalog Contract Schema

Based on the implementation in `match-and-segment-v1.js`, here's the required contract schema.

## Contract Function: `addSong()`

```solidity
function addSong(
    string calldata id,                // Song identifier (slug)
    uint32 geniusId,                   // Genius API song ID
    uint32 geniusArtistId,             // Genius API artist ID
    string calldata title,             // Song title
    string calldata artist,            // Artist name
    uint32 duration,                   // Duration in seconds
    string calldata audioUri,          // Audio stream URL
    string calldata metadataUri,       // Grove/IPFS metadata URI
    string calldata coverUri,          // Cover image URL
    string calldata thumbnailUri,      // Thumbnail image URL
    string calldata musicVideoUri,     // Music video URL (optional)
    string calldata segmentIds,        // Comma-separated segment IDs
    string calldata languages,         // Language code(s)
    bool enabled                       // Is song enabled?
) external;
```

## Parameter Details

### `id` - Song Identifier
**Type**: `string`
**Format**: `{title-slug}-{artist-slug}`
**Example**: `"chandelier-sia"`, `"gucci-gang-lil-pump"`
**Generation**:
```javascript
function generateSongId(artist, title) {
  const normalize = (str) => str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  const artistSlug = normalize(artist);
  const titleSlug = normalize(title);

  return `${titleSlug}-${artistSlug}`;
}
```

### `geniusId` - Genius API Song ID
**Type**: `uint32`
**Example**: `378195` (Sia - Chandelier)
**Source**: Genius API response (`song.id`)

### `geniusArtistId` - Genius API Artist ID
**Type**: `uint32`
**Example**: `571` (Sia)
**Source**: Genius API response (`song.primary_artist.id`)

### `title` - Song Title
**Type**: `string`
**Example**: `"Chandelier"`
**Source**: Genius API response (`song.title`)

### `artist` - Artist Name
**Type**: `string`
**Example**: `"Sia"`
**Source**: Genius API response (`song.primary_artist.name`)

### `duration` - Duration in Seconds
**Type**: `uint32`
**Example**: `216` (3 minutes 36 seconds)
**Source**: LRClib API response (`duration`)
**Note**: Genius API doesn't always have duration, so we use LRClib's value

### `audioUri` - Audio Stream URL
**Type**: `string`
**Format**: `https://sc.maid.zone/_/restream/{soundcloud-permalink}`
**Example**: `"https://sc.maid.zone/_/restream/siamusic/sia-chandelier"`
**Source**: Constructed from Genius SoundCloud link + maid.zone restream endpoint

### `metadataUri` - Grove Metadata URI
**Type**: `string`
**Format**: `lens://{ipfs-hash}`
**Example**: `"lens://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"`
**Source**: Grove API upload response
**Contents**: Full song metadata including lyrics, sections, processing info (see below)

### `coverUri` - Cover Image URL
**Type**: `string`
**Example**: `"https://images.genius.com/abc123/song.jpg"`
**Source**: Genius API response (`song.song_art_image_url`)

### `thumbnailUri` - Thumbnail Image URL
**Type**: `string`
**Example**: `"https://images.genius.com/abc123/song_thumb.jpg"`
**Source**: Genius API response (`song.song_art_image_thumbnail_url`)

### `musicVideoUri` - Music Video URL
**Type**: `string`
**Example**: `""` (empty for now)
**Note**: Not currently populated, reserved for future use

### `segmentIds` - Comma-separated Segment IDs
**Type**: `string`
**Format**: Comma-separated list of section IDs
**Example**: `"verse-1,chorus-1,verse-2,chorus-2,bridge-1,chorus-3"`
**Source**: Generated from Grok-4-fast section chunking
**Purpose**: Enables querying specific sections for karaoke practice

### `languages` - Language Code(s)
**Type**: `string`
**Format**: ISO 639-1 language code (comma-separated for multi-language songs)
**Example**: `"en"`, `"en,es"` (for bilingual songs)
**Source**: Genius API response (`song.language`) or default `"en"`

### `enabled` - Is Song Enabled?
**Type**: `bool`
**Example**: `true`
**Purpose**: Allow soft-deletion of songs without removing from contract

## Metadata Structure (stored in Grove)

The `metadataUri` points to a JSON file with this structure:

```json
{
  "songId": "chandelier-sia",
  "geniusId": 378195,

  "title": "Chandelier",
  "titleWithFeatured": "Chandelier",
  "artist": "Sia",
  "artistId": 571,
  "album": "1000 Forms of Fear",
  "releaseDate": "2014-03-17",
  "duration": 216,
  "language": "en",

  "coverUri": "https://images.genius.com/abc123/song.jpg",
  "thumbnailUri": "https://images.genius.com/abc123/song_thumb.jpg",
  "audioUri": "https://sc.maid.zone/_/restream/siamusic/sia-chandelier",
  "geniusUrl": "https://genius.com/Sia-chandelier-lyrics",

  "lrcLyrics": "[00:04.66]Party girls don't get hurt\n[00:07.00]Can't feel anything...",
  "plainLyrics": "Party girls don't get hurt\nCan't feel anything...",

  "sections": [
    {
      "id": "verse-1",
      "label": "Verse 1",
      "type": "verse",
      "startTime": 4.66,
      "endTime": 27.80,
      "duration": 23.14,
      "lineCount": 8,
      "hasSubstantialLyrics": true,
      "learningValue": "high",
      "reason": "Clear, memorable lyrics with good vocabulary",
      "previewLine": "Party girls don't get hurt"
    },
    {
      "id": "chorus-1",
      "label": "Chorus",
      "type": "chorus",
      "startTime": 27.80,
      "endTime": 48.12,
      "duration": 20.32,
      "lineCount": 6,
      "hasSubstantialLyrics": true,
      "learningValue": "high",
      "reason": "Catchy, repetitive chorus - great for learning",
      "previewLine": "I'm gonna swing from the chandelier"
    }
  ],

  "segmentIds": "verse-1,chorus-1,verse-2,chorus-2,bridge-1,chorus-3",

  "processedAt": "2025-10-07T12:34:56.789Z",
  "processedBy": "match-and-segment-v1",
  "lyricsSource": "lrclib",
  "matchConfidence": "high",
  "matchScore": 0.92,
  "matchReason": "Exact match: same artist, title, album, and duration"
}
```

## Failure State Tracking

The contract should also track failed songs to avoid retrying them:

```solidity
mapping(uint32 => string) public failedSongs; // geniusId => failureState

function recordFailure(
    uint32 geniusId,
    string calldata failureState
) external;
```

### Failure States

```javascript
const FAILURE_STATES = {
  NO_GENIUS: 'genius_not_found',
  NO_LYRICS: 'lrclib_no_match',
  NO_SOUNDCLOUD: 'no_soundcloud_link_in_genius',
  SNIPPET_ONLY: 'maidzone_30s_snippet',
  NO_AUDIO: 'maidzone_unavailable',
  BAD_MATCH: 'lyrics_mismatch',
  DURATION_MISMATCH: 'duration_diff_too_large',
  NO_SECTIONS: 'no_singable_sections',
  GROVE_ERROR: 'grove_upload_failed',
  CONTRACT_ERROR: 'contract_tx_failed'
};
```

## Example Contract Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SongCatalogV1 {
    struct Song {
        string id;
        uint32 geniusId;
        uint32 geniusArtistId;
        string title;
        string artist;
        uint32 duration;
        string audioUri;
        string metadataUri;
        string coverUri;
        string thumbnailUri;
        string musicVideoUri;
        string segmentIds;
        string languages;
        bool enabled;
        uint64 addedAt;
    }

    mapping(string => Song) public songs;          // id => Song
    mapping(uint32 => string) public geniusToId;   // geniusId => id
    mapping(uint32 => string) public failedSongs;  // geniusId => failureState

    event SongAdded(
        string indexed id,
        uint32 indexed geniusId,
        string title,
        string artist
    );

    event SongFailure(
        uint32 indexed geniusId,
        string failureState
    );

    function addSong(
        string calldata id,
        uint32 geniusId,
        uint32 geniusArtistId,
        string calldata title,
        string calldata artist,
        uint32 duration,
        string calldata audioUri,
        string calldata metadataUri,
        string calldata coverUri,
        string calldata thumbnailUri,
        string calldata musicVideoUri,
        string calldata segmentIds,
        string calldata languages,
        bool enabled
    ) external {
        require(bytes(songs[id].id).length == 0, "Song already exists");
        require(bytes(geniusToId[geniusId]).length == 0, "Genius ID already registered");

        songs[id] = Song({
            id: id,
            geniusId: geniusId,
            geniusArtistId: geniusArtistId,
            title: title,
            artist: artist,
            duration: duration,
            audioUri: audioUri,
            metadataUri: metadataUri,
            coverUri: coverUri,
            thumbnailUri: thumbnailUri,
            musicVideoUri: musicVideoUri,
            segmentIds: segmentIds,
            languages: languages,
            enabled: enabled,
            addedAt: uint64(block.timestamp)
        });

        geniusToId[geniusId] = id;

        emit SongAdded(id, geniusId, title, artist);
    }

    function recordFailure(
        uint32 geniusId,
        string calldata failureState
    ) external {
        failedSongs[geniusId] = failureState;
        emit SongFailure(geniusId, failureState);
    }

    function getSong(string calldata id) external view returns (Song memory) {
        require(bytes(songs[id].id).length > 0, "Song not found");
        return songs[id];
    }

    function getSongByGeniusId(uint32 geniusId) external view returns (Song memory) {
        string memory id = geniusToId[geniusId];
        require(bytes(id).length > 0, "Song not found");
        return songs[id];
    }

    function isFailed(uint32 geniusId) external view returns (bool, string memory) {
        string memory failureState = failedSongs[geniusId];
        return (bytes(failureState).length > 0, failureState);
    }
}
```

## Usage in Lit Action

The Lit Action calls `addSong()` after successful processing:

```javascript
const txData = contract.interface.encodeFunctionData('addSong', [
  metadata.songId,              // "chandelier-sia"
  metadata.geniusId,            // 378195
  metadata.artistId,            // 571
  metadata.title,               // "Chandelier"
  metadata.artist,              // "Sia"
  metadata.duration,            // 216
  metadata.audioUri,            // "https://sc.maid.zone/..."
  metadataUri,                  // "lens://QmXXX..."
  metadata.coverUri,            // "https://images.genius.com/..."
  metadata.thumbnailUri,        // "https://images.genius.com/..."
  '',                           // musicVideoUri (empty)
  metadata.segmentIds,          // "verse-1,chorus-1,..."
  metadata.language,            // "en"
  true                          // enabled
]);
```

If processing fails, it calls `recordFailure()`:

```javascript
const txData = contract.interface.encodeFunctionData('recordFailure', [
  geniusId,        // 378195
  failureState     // "lrclib_no_match"
]);
```

## Next Steps

1. Deploy SongCatalogV1 contract to Lens Testnet
2. Update `SONG_CATALOG_ADDRESS` in match-and-segment-v1.js
3. Test with known good songs (Sia - Chandelier, Lil Pump - Gucci Gang)
4. Verify on-chain data matches metadata in Grove
