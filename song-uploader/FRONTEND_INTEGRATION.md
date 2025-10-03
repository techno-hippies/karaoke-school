# Frontend Integration Guide: SongRegistryV4

## Overview

**SongRegistryV4** replaces the previous clip-only system with a unified registry that stores:
- ✅ **Full song audio** (not just 15-60 second clips)
- ✅ **Complete karaoke metadata** with word+line timestamps for entire song
- ✅ **High-res cover images** + optimized 300x300 thumbnails
- ✅ **Multilingual translations** (Chinese, Vietnamese, etc.)
- ✅ **Optional music video URIs**
- ✅ **References to clips** (for short-form content)

---

## Contract Address

**Lens Chain Testnet:**
```
0xC874eAAf142dB37a9B19202E07757E89da00351B
```

**ABI Location:**
```
song-uploader/contract/zkout/SongRegistryV4.sol/SongRegistryV4.json
```

---

## Key Differences from ClipRegistry

### Before (ClipRegistryV1)
```typescript
interface Clip {
  id: string;              // e.g., "scarlett-x-heat-chorus-1"
  songTitle: string;
  artist: string;
  clipType: string;        // "verse", "chorus", "bridge"
  audioUri: string;        // 15-60 second clip only
  metadataUri: string;     // Partial karaoke (clip timestamps only)
  imageUri: string;        // Single image URI
  languages: string;
  duration: uint32;
}
```

### Now (SongRegistryV4)
```typescript
interface Song {
  id: string;              // e.g., "Scarlett X - Heat of the Night"
  title: string;
  artist: string;
  duration: uint32;        // Full song duration (e.g., 194 seconds)

  // Full song assets (NEW!)
  audioUri: string;        // ENTIRE song audio (lens://)
  metadataUri: string;     // COMPLETE karaoke metadata with all lyrics
  coverUri: string;        // High-res cover (lens://)
  thumbnailUri: string;    // 300x300 optimized thumbnail (lens://)
  musicVideoUri: string;   // Optional music video (lens://)

  // Clip references (links to ClipRegistryV1)
  clipIds: string;         // "verse-1,chorus-1,verse-2,chorus-2"

  // Metadata
  languages: string;       // "en,cn,vi"
  enabled: bool;
  addedAt: uint64;
}
```

---

## Integration Steps

### 1. Copy ABI to Frontend

```bash
# From song-uploader directory
cp contract/zkout/SongRegistryV4.sol/SongRegistryV4.json ../site/src/abi/

# Or wherever your frontend stores ABIs
```

### 2. Initialize Contract Client

```typescript
import { createPublicClient, http } from 'viem';
import { lensTestnet } from '@lens-chain/sdk/viem'; // or your chains config
import SongRegistryV4ABI from './abi/SongRegistryV4.json';

const CONTRACT_ADDRESS = '0xC874eAAf142dB37a9B19202E07757E89da00351B';

const publicClient = createPublicClient({
  chain: lensTestnet,
  transport: http('https://rpc.testnet.lens.xyz')
});

// Helper to read contract
async function readSongRegistry(functionName: string, args?: any[]) {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: SongRegistryV4ABI.abi,
    functionName,
    args
  });
}
```

### 3. Fetch All Songs

```typescript
interface Song {
  id: string;
  title: string;
  artist: string;
  duration: number;
  audioUri: string;
  metadataUri: string;
  coverUri: string;
  thumbnailUri: string;
  musicVideoUri: string;
  clipIds: string;
  languages: string;
  enabled: boolean;
  addedAt: bigint;
}

async function getAllSongs(): Promise<Song[]> {
  const songs = await readSongRegistry('getAllSongs') as any[];
  return songs.map(parseSong);
}

async function getEnabledSongsOnly(): Promise<Song[]> {
  const songs = await readSongRegistry('getEnabledSongs') as any[];
  return songs.map(parseSong);
}

function parseSong(rawSong: any): Song {
  return {
    id: rawSong.id,
    title: rawSong.title,
    artist: rawSong.artist,
    duration: Number(rawSong.duration),
    audioUri: rawSong.audioUri,
    metadataUri: rawSong.metadataUri,
    coverUri: rawSong.coverUri,
    thumbnailUri: rawSong.thumbnailUri,
    musicVideoUri: rawSong.musicVideoUri,
    clipIds: rawSong.clipIds,
    languages: rawSong.languages,
    enabled: rawSong.enabled,
    addedAt: rawSong.addedAt
  };
}
```

### 4. Fetch Full Song Metadata (NEW!)

The `metadataUri` points to a JSON file on Grove with complete karaoke data:

```typescript
interface FullSongMetadata {
  version: number;
  id: string;
  title: string;
  artist: string;
  duration: number;
  format: "word-and-line-timestamps";
  lines: LineWithWords[];
  availableLanguages: string[];  // ["en", "cn", "vi"]
  generatedAt: string;
  elevenLabsProcessed: boolean;
  wordCount: number;
  lineCount: number;
  sectionIndex: SectionMarker[];
}

interface LineWithWords {
  lineIndex: number;
  originalText: string;           // English lyrics
  translations?: {                // NEW! Multiple translations
    cn?: string;                  // Chinese
    vi?: string;                  // Vietnamese
    es?: string;                  // Spanish, etc.
  };
  start: number;                  // Line start timestamp
  end: number;                    // Line end timestamp
  words: Array<{
    text: string;
    start: number;                // Word-level timestamp
    end: number;
  }>;
  sectionMarker?: boolean;        // true if line is [Verse], [Chorus], etc.
}

interface SectionMarker {
  type: string;                   // "Verse 1", "Chorus", "Bridge"
  lineIndex: number;
  timestamp: number;              // Jump-to timestamp
}

async function fetchFullSongMetadata(metadataUri: string): Promise<FullSongMetadata> {
  const groveUrl = metadataUri.replace('lens://', 'https://gw.lens.xyz/');
  const response = await fetch(groveUrl);
  return response.json();
}
```

### 5. Display Song List with Thumbnails (NEW!)

```typescript
function SongList() {
  const [songs, setSongs] = useState<Song[]>([]);

  useEffect(() => {
    getEnabledSongsOnly().then(setSongs);
  }, []);

  return (
    <div className="song-grid">
      {songs.map(song => (
        <SongCard key={song.id} song={song} />
      ))}
    </div>
  );
}

function SongCard({ song }: { song: Song }) {
  // Use thumbnailUri for list view (optimized 300x300)
  const thumbnailUrl = song.thumbnailUri.replace('lens://', 'https://gw.lens.xyz/');

  // Use coverUri for detail view (high-res)
  const coverUrl = song.coverUri.replace('lens://', 'https://gw.lens.xyz/');

  return (
    <div className="song-card">
      {/* List view: Use thumbnail for performance */}
      <img src={thumbnailUrl} alt={song.title} />

      <h3>{song.title}</h3>
      <p>{song.artist}</p>
      <p>{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</p>

      {/* Show available languages */}
      <div className="languages">
        {song.languages.split(',').map(lang => (
          <span key={lang} className="lang-badge">{lang.toUpperCase()}</span>
        ))}
      </div>
    </div>
  );
}
```

### 6. Full Song Karaoke Player (NEW!)

```typescript
function FullSongKaraokePlayer({ song }: { song: Song }) {
  const [metadata, setMetadata] = useState<FullSongMetadata | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchFullSongMetadata(song.metadataUri).then(setMetadata);
  }, [song.metadataUri]);

  if (!metadata) return <div>Loading...</div>;

  // Find current line based on playback time
  const currentLineIndex = metadata.lines.findIndex(
    line => currentTime >= line.start && currentTime <= line.end
  );

  // Find current word for highlighting
  const currentLine = metadata.lines[currentLineIndex];
  const currentWordIndex = currentLine?.words.findIndex(
    word => currentTime >= word.start && currentTime <= word.end
  );

  return (
    <div className="karaoke-player">
      {/* High-res cover for detail view */}
      <img
        src={song.coverUri.replace('lens://', 'https://gw.lens.xyz/')}
        alt={song.title}
        className="cover-image"
      />

      {/* Audio player - FULL SONG */}
      <audio
        ref={audioRef}
        src={song.audioUri.replace('lens://', 'https://gw.lens.xyz/')}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        controls
      />

      {/* Language selector - NEW! */}
      <div className="language-selector">
        {metadata.availableLanguages.map(lang => (
          <button
            key={lang}
            onClick={() => setSelectedLanguage(lang)}
            className={selectedLanguage === lang ? 'active' : ''}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Section navigation - NEW! */}
      <div className="section-nav">
        {metadata.sectionIndex.map((section, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (audioRef.current) {
                audioRef.current.currentTime = section.timestamp;
              }
            }}
          >
            {section.type}
          </button>
        ))}
      </div>

      {/* Lyrics display with translations */}
      <div className="lyrics-container">
        {metadata.lines.map((line, lineIdx) => {
          // Skip section markers in display (or style differently)
          if (line.sectionMarker) {
            return (
              <div key={lineIdx} className="section-marker">
                {line.originalText}
              </div>
            );
          }

          const isCurrentLine = lineIdx === currentLineIndex;
          const displayText = selectedLanguage === 'en'
            ? line.originalText
            : line.translations?.[selectedLanguage] || line.originalText;

          return (
            <div
              key={lineIdx}
              className={`lyric-line ${isCurrentLine ? 'active' : ''}`}
            >
              {/* Word-by-word highlighting */}
              {isCurrentLine && selectedLanguage === 'en' ? (
                line.words.map((word, wordIdx) => (
                  <span
                    key={wordIdx}
                    className={wordIdx === currentWordIndex ? 'current-word' : ''}
                  >
                    {word.text}{' '}
                  </span>
                ))
              ) : (
                <span>{displayText}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### 7. Link to Clips (Short-Form Content)

```typescript
function SongDetailPage({ song }: { song: Song }) {
  const clipIds = song.clipIds ? song.clipIds.split(',') : [];

  return (
    <div>
      {/* Full song player */}
      <FullSongKaraokePlayer song={song} />

      {/* Show associated clips for short-form practice */}
      {clipIds.length > 0 && (
        <section className="related-clips">
          <h2>Practice Clips</h2>
          <p>Try these shorter sections to practice:</p>

          {clipIds.map(clipId => (
            <ClipPreview key={clipId} clipId={clipId.trim()} />
          ))}
        </section>
      )}
    </div>
  );
}

// Fetch clips from ClipRegistryV1 (if still using)
async function ClipPreview({ clipId }: { clipId: string }) {
  const clip = await readClipRegistry('getClip', [clipId]);

  return (
    <div className="clip-preview">
      <h4>{clip.clipType} - {clip.duration}s</h4>
      <button onClick={() => navigateToClip(clipId)}>
        Practice this section
      </button>
    </div>
  );
}
```

---

## Query Functions Reference

### Get All Songs
```typescript
const songs = await readSongRegistry('getAllSongs');
// Returns: Song[] (includes enabled and disabled)
```

### Get Enabled Songs Only
```typescript
const songs = await readSongRegistry('getEnabledSongs');
// Returns: Song[] (only enabled songs)
```

### Get Specific Song by ID
```typescript
const song = await readSongRegistry('getSong', ['Scarlett X - Heat of the Night']);
// Returns: Song
```

### Get Songs by Artist
```typescript
const songs = await readSongRegistry('getSongsByArtist', ['Ethel Waters']);
// Returns: Song[]
```

### Check if Song Exists
```typescript
const exists = await readSongRegistry('songExists', ['Scarlett X - Heat of the Night']);
// Returns: boolean
```

### Get Song Count
```typescript
const count = await readSongRegistry('getSongCount');
// Returns: bigint (e.g., 2n)
```

---

## Migration Checklist

- [ ] Copy SongRegistryV4 ABI to frontend
- [ ] Update contract address to `0xC874eAAf142dB37a9B19202E07757E89da00351B`
- [ ] Fetch `metadataUri` and load full song karaoke data (not just clips)
- [ ] Use `thumbnailUri` for list views (300x300 optimized)
- [ ] Use `coverUri` for detail views (high-res)
- [ ] Play `audioUri` for full song audio (not just clips)
- [ ] Add language selector using `availableLanguages` from metadata
- [ ] Show translations from `line.translations` object
- [ ] Add section navigation using `metadata.sectionIndex`
- [ ] Optionally link to clips via `song.clipIds` field
- [ ] Handle `musicVideoUri` if present (future feature)

---

## Example: Current Songs in Contract

**Song 1: Scarlett X - Heat of the Night**
```json
{
  "id": "Scarlett X - Heat of the Night",
  "title": "Heat of the Night",
  "artist": "Scarlett X",
  "duration": 194,
  "audioUri": "lens://ed8dea01601928cedc153853d254cdfa680b05add599ffd408a86f258f4452f0",
  "metadataUri": "lens://a5f15f4a5da82467c9fbc1dcf1ff5b815bbd908590e6635d543da8951fbabe9b",
  "coverUri": "lens://d7bc922e3d317e3f37b7d2c80e5e04550cb6bbdad122335aa5bb3f1e3b5538c1",
  "thumbnailUri": "lens://c8c11e0c8a682b0a067cc159c5782894d4fbe28f898224e1923db41d65e7df00",
  "musicVideoUri": "",
  "clipIds": "",
  "languages": "en,cn,vi",
  "enabled": true
}
```

**Song 2: Ethel Waters - Down Home Blues**
```json
{
  "id": "Ethel Waters - Down Home Blues",
  "title": "Down Home Blues",
  "artist": "Ethel Waters",
  "duration": 167,
  "audioUri": "lens://3f82ec362791171b6eaec9063477075c33c2693c55d9f378122bc22da25ab2f1",
  "metadataUri": "lens://467fe5c0ada94120949b50107b23e53da2f0db6f1d490b97526fbc4b9b803272",
  "coverUri": "lens://114a17d5031b65474be95e58c6a2798061822fa1a80b25d603664fbce48c1802",
  "thumbnailUri": "lens://c5ce5a99c70d55dee4f9c6aa57fa5b5b24f6af044324996f6cd8883e24e1727a",
  "musicVideoUri": "",
  "clipIds": "",
  "languages": "en,cn,vi",
  "enabled": true
}
```

---

## Performance Tips

1. **Use thumbnails in lists**: `thumbnailUri` is 10x smaller (~40KB vs ~4MB)
2. **Lazy load metadata**: Only fetch `metadataUri` when user opens song detail
3. **Cache metadata**: Full song metadata is ~40KB, cache it client-side
4. **Preload audio**: Use `<audio preload="metadata">` for faster start
5. **Section navigation**: Use `sectionIndex` for instant jumps (better UX than scrubbing)

---

## Questions?

- Contract source: `song-uploader/contract/src/SongRegistryV4.sol`
- Deployment guide: `song-uploader/SONGREGISTRY_V4_DEPLOYMENT.md`
- Explorer: https://explorer.testnet.lens.xyz/address/0xC874eAAf142dB37a9B19202E07757E89da00351B
