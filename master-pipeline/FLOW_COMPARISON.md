# Artist Flow vs Creator Flow Comparison

## Visual Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ARTIST FLOW                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Input: Genius Artist ID + TikTok Music Page URL
   │
   ├─── Step 1: Mint PKP ──────────────────────────────────────┐
   │    • genius-id → PKP on Lit Protocol                      │
   │    • Chronicle Yellowstone testnet                        │
   │    • Saves: data/artists/{name}/pkp.json                  │
   │                                                            │
   ├─── Step 2: Create Lens Account ──────────────────────────┤
   │    • PKP → Lens account                                   │
   │    • Metadata: genius-id, ISNI, IPI, MusicBrainz         │
   │    • Saves: data/artists/{name}/lens.json                 │
   │                                                            │
   ├─── Step 3: Register Artist ──────────────────────────────┤
   │    • ArtistRegistryV1.registerArtist()                    │
   │    • Stores: genius-id, PKP, Lens handle                  │
   │    • Saves: data/artists/{name}/manifest.json             │
   │                                                            │
   └────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────┐
   │ SONG PIPELINE (For each song by artist)                   │
   ├────────────────────────────────────────────────────────────┤
   │                                                            │
   ├─── Step 1: Register Song ─────────────────────────────────┤
   │    • Fetch Genius metadata (title, album, cover)          │
   │    • Get Spotify ID and ISRC                              │
   │    • SongRegistryV1.registerSong()                        │
   │    • Saves: data/metadata/{genius-id}.json                │
   │                                                            │
   ├─── Step 2: Fetch MLC Licensing ──────────────────────────┤
   │    • Search MLC by ISRC                                   │
   │    • Get publishers, writers, shares                      │
   │    • Validate Story Protocol eligibility (≥98%)           │
   │    • Updates: data/metadata/{genius-id}.json              │
   │                                                            │
   ├─── Step 3: Build Metadata ───────────────────────────────┤
   │    • Fetch LRCLib lyrics reference (ID only)              │
   │    • Create complete metadata JSON                        │
   │    • Upload to Grove storage                              │
   │    • Updates: data/metadata/{genius-id}.json              │
   │                                                            │
   └────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────┐
   │ SEGMENT PIPELINE (For each TikTok music segment)          │
   ├────────────────────────────────────────────────────────────┤
   │                                                            │
   ├─── Step 1: Match & Process Segment ──────────────────────┤
   │    • Scrape TikTok music page (canonical 60s segment)     │
   │    • Download full song (local/Spotify)                   │
   │    • Match with forced alignment:                         │
   │      - Voxtral STT on TikTok clip                         │
   │      - ElevenLabs alignment on full song                  │
   │      - Gemini matching for timestamps                     │
   │    • Crop to matched segment                              │
   │    • Demucs vocal separation (Modal H200 GPU)             │
   │    • Optional fal.ai enhancement                          │
   │    • Upload to Grove (vocals, instrumental, alignment)    │
   │    • Saves: data/segments/{hash}/manifest.json            │
   │                                                            │
   ├─── Step 2: Register Segment ─────────────────────────────┤
   │    • SegmentRegistryV1.registerSegment()                  │
   │    • SegmentRegistryV1.processSegment() with URIs         │
   │    • Links: genius-id → segment hash → Grove URIs         │
   │    • Updates song metadata with segment reference         │
   │                                                            │
   └────────────────────────────────────────────────────────────┘

Output:
   • Artist manifest: data/artists/{name}/manifest.json
   • Song metadata: data/metadata/{genius-id}.json
   • Segment data: data/segments/{hash}/manifest.json
   • Blockchain: ArtistRegistry, SongRegistry, SegmentRegistry
   • Storage: Grove (lens:// URIs)


┌─────────────────────────────────────────────────────────────────────────────┐
│                          CREATOR FLOW                                       │
└─────────────────────────────────────────────────────────────────────────────┘

Input: TikTok Handle + Creator's Video URLs
   │
   ├─── Step 1: Mint PKP ──────────────────────────────────────┐
   │    • tiktok-handle → PKP on Lit Protocol                  │
   │    • Chronicle Yellowstone testnet                        │
   │    • Saves: data/creators/{handle}/pkp.json               │
   │                                                            │
   ├─── Step 2: Create Lens Account ──────────────────────────┤
   │    • PKP → Lens account                                   │
   │    • Metadata: tiktok-handle, Instagram, YouTube          │
   │    • Lens handle = TikTok handle                          │
   │    • Saves: data/creators/{handle}/lens.json              │
   │                                                            │
   ├─── Step 3: Scrape TikTok Videos ─────────────────────────┤
   │    • Fetch user's video feed (hrequests)                  │
   │    • Filter karaoke/cover videos                          │
   │    • Extract video IDs and music metadata                 │
   │    • Saves: data/creators/{handle}/manifest.json          │
   │                                                            │
   └────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────┐
   │ VIDEO PIPELINE (For each creator video)                   │
   ├────────────────────────────────────────────────────────────┤
   │                                                            │
   ├─── Step 4: Identify Song ────────────────────────────────┤
   │    • Extract TikTok music metadata from video             │
   │    • Search Spotify by title + artist                     │
   │    • Fetch ISRC from Spotify track                        │
   │    • Optional: Find in Genius for lyrics                  │
   │    • Search MLC by ISRC (reuse artist logic)              │
   │    • Check Story Protocol eligibility                     │
   │    • Saves: data/creators/{handle}/videos/{hash}/song.json│
   │                                                            │
   ├─── Step 5: Process Video ────────────────────────────────┤
   │    • Download creator's TikTok video                      │
   │    • Download full song (local/Spotify)                   │
   │    • Match with forced alignment:                         │
   │      - Voxtral STT on creator video                       │
   │      - ElevenLabs alignment on full song                  │
   │      - Gemini matching for timestamps                     │
   │    • Crop to matched segment                              │
   │    • Demucs vocal separation (Modal H200 GPU)             │
   │    • Optional fal.ai enhancement                          │
   │    • Upload to Grove (vocals, instrumental, alignment)    │
   │    • Saves: data/creators/{handle}/videos/{hash}/manifest.json│
   │                                                            │
   ├─── Step 6: Mint on Story Protocol ───────────────────────┤
   │    • Check if original song is on Story Protocol          │
   │    • Create IP metadata with licensing attribution        │
   │    • Register as derivative work:                         │
   │      - If parent IP exists: registerDerivative()          │
   │      - If not: registerIP() with off-chain reference      │
   │    • Updates: data/creators/{handle}/videos/{hash}/manifest.json│
   │                                                            │
   ├─── Step 7: Post to Lens ─────────────────────────────────┤
   │    • Create Lens post with video metadata                 │
   │    • Include licensing attribution to original song       │
   │    • Link to Story Protocol IP                            │
   │    • Updates: data/creators/{handle}/videos/{hash}/manifest.json│
   │                                                            │
   └────────────────────────────────────────────────────────────┘

Output:
   • Creator manifest: data/creators/{handle}/manifest.json
   • Video manifests: data/creators/{handle}/videos/{hash}/manifest.json
   • Story Protocol: Derivative IP registrations
   • Storage: Grove (lens:// URIs)
   • Lens: Published posts with attribution


┌─────────────────────────────────────────────────────────────────────────────┐
│                          KEY DIFFERENCES                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┬─────────────────────────┬─────────────────────────┐
│ Aspect           │ Artist Flow             │ Creator Flow            │
├──────────────────┼─────────────────────────┼─────────────────────────┤
│ Primary ID       │ Genius Artist ID        │ TikTok Handle           │
│ Content Source   │ TikTok Music Pages      │ TikTok User Videos      │
│ IP Role          │ Original Rights Holder  │ Derivative Creator      │
│ Smart Contracts  │ Artist/Song/Segment     │ Segment + Story IP      │
│ Licensing        │ MLC Publisher Shares    │ Reference to Original   │
│ Story Protocol   │ Optional (if eligible)  │ Required (derivatives)  │
│ Lens Metadata    │ Artist identifiers      │ Creator social handles  │
│ Content Type     │ Canonical segments      │ Karaoke performances    │
│ Genius Integration│ Required               │ Optional                │
└──────────────────┴─────────────────────────┴─────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────┐
│                       SHARED COMPONENTS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Both flows share:

1. PKP Minting Logic
   • lib/pkp.ts → mintPKP()
   • Chronicle Yellowstone testnet

2. Lens Account Creation
   • lib/lens.ts → createLensAccount(), createLensUsername()
   • Lens testnet

3. Audio Processing Pipeline
   • services/voxtral.ts → STT transcription
   • services/elevenlabs.ts → Forced alignment
   • services/openrouter.ts → Gemini matching
   • services/demucs-modal.ts → Vocal separation
   • services/fal-audio.ts → Enhancement
   • services/audio-matching.ts → Complete pipeline

4. MLC Licensing Fetch
   • modules/songs/02-fetch-mlc-data.ts logic
   • ISRC-based search with pagination
   • Manual song code override

5. Grove Storage
   • services/grove.ts → upload()
   • Lens Network storage

6. TikTok Scraping
   • lib/tiktok_music_scraper.py (music pages)
   • lib/tiktok_video_scraper.py (user videos) ← NEW


┌─────────────────────────────────────────────────────────────────────────────┐
│                     NEW COMPONENTS FOR CREATORS                             │
└─────────────────────────────────────────────────────────────────────────────┘

1. TikTok Video Scraper
   • lib/tiktok_video_scraper.py
   • Scrapes user video feeds
   • Filters karaoke videos
   • Downloads with metadata

2. Song Identification Service
   • services/song-identification.ts
   • Spotify search by title + artist
   • ISRC extraction
   • Optional Genius lookup
   • MLC licensing fetch

3. Story Protocol Service
   • services/story-protocol.ts
   • Original song IP lookup
   • Derivative work registration
   • IP metadata creation
   • License terms management

4. Creator Modules
   • modules/creators/01-mint-pkp.ts
   • modules/creators/02-create-lens.ts
   • modules/creators/03-scrape-videos.ts
   • modules/creators/04-identify-songs.ts
   • modules/creators/05-process-video.ts
   • modules/creators/06-mint-derivative.ts
   • modules/creators/07-post-lens.ts
