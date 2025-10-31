# Wikidata Integration - Complete Summary

## Overview

Integrated Wikidata API as a peer enrichment source alongside Genius, MusicBrainz, and Quansic. Wikidata provides **40+ high-value identifiers** across multiple categories, with special focus on:

1. **International library IDs** (PRIMARY FOCUS)
2. **Lyrics/translation sources** (CRITICAL for karaoke)
3. **Concert/ticketing platforms** (AI ticket buying)
4. **Asian market platforms** (global reach)

---

## Architecture

### Data Flow
```
Wikidata API
  ↓ (rate limited: 1 req/sec)
src/services/wikidata.ts (fetch & parse)
  ↓
src/db/wikidata.ts (database helpers)
  ↓
wikidata_artists table (PostgreSQL)
  ↓
scripts/migration/populate-grc20-artists.ts (merge with other sources)
  ↓
grc20_artists table (final aggregation)
```

### Merge Priority
```
Manual Override > Genius > MusicBrainz > Wikidata
```

---

## Identifiers Captured

### 🏛️ International Library IDs (Dedicated Columns)

**Why Important**: Immutable global identifiers used by libraries, copyright orgs, and academic institutions.

- **VIAF** (P214) - Virtual International Authority File
- **GND** (P227) - German National Library
- **BNF** (P5361) - French National Library
- **LOC** (P244) - Library of Congress
- **SBN** (P396) - Italian National Library
- **BNMM** (P1015) - Spanish National Library
- **SELIBR** (P906) - Swedish National Library

**Storage**: Dedicated columns in `wikidata_artists` table
**Use Case**: Authoritative artist identification, academic research, copyright verification

---

### 🎤 Lyrics/Translation Platforms (VERY HIGH VALUE)

**Why Important**: Core functionality for karaoke - word-level timing and multilingual translations.

- **Musixmatch** (P2033) - Lyrics database with translations
  - **Value**: Synced lyrics, 40+ languages
  - **ID Format**: `Billie-Eilish-2`

- **LyricsTranslate** (P7704) - Community translations
  - **Value**: User-contributed translations, cultural context
  - **ID Format**: `billie-elish-lyrics.html`

- **SongMeanings** (P6190) - Lyrics + meanings/annotations
  - **Value**: Song context, user interpretations
  - **ID Format**: `137439070407`

**Storage**: JSONB `identifiers` column
**Use Case**: Alternative lyrics sources, cross-validation, multilingual support

---

### 🎫 Concert/Ticketing (AI Integration Ready)

**Why Important**: Enable AI agents to find nearby concerts and purchase tickets.

- **Songkick** (P1004) - Live concert database
  - **Value**: Tour dates, venue info, ticket alerts
  - **ID Format**: `8913479`

- **Setlist.fm** (P3222) - Historical setlists
  - **Value**: Song selection patterns, tour history
  - **ID Format**: `1bc3b540`

- **Bandsintown** (P3545) - Tour dates + ticketing
  - **Value**: Direct ticket links, RSVP functionality
  - **ID Format**: `12895856`

**Storage**: JSONB `identifiers` column
**Use Case**: AI ticket buying, concert recommendations, tour tracking

---

### 🌏 Asian Market Platforms

**Why Important**: Global reach, especially East Asian markets (Korea, Japan, China, Thailand).

- **Naver VIBE** (P8407) - Korean streaming platform
  - **Market**: South Korea
  - **ID Format**: `1465252`

- **Line Music** (P8513) - Japanese/Thai streaming
  - **Market**: Japan, Thailand, Taiwan
  - **ID Format**: `mi000000000adf86f3`

- **Namuwiki** (P9673) - Korean wiki encyclopedia
  - **Market**: South Korea (like Korean Wikipedia)
  - **ID Format**: `빌리 아일리시`

- **Douban** (P5828, P4529) - Chinese social/music platform
  - **Market**: China
  - **ID Format**: `134813`, `34968611`

**Storage**: JSONB `identifiers` column
**Use Case**: Asian market expansion, localized streaming links, cultural context

---

### 📰 Music Journalism/Context

**Why Important**: Reviews, artist stories, song trivia - adds context to karaoke experience.

- **Pitchfork** (P1989) - Influential music journalism
  - **Value**: Critical reviews, artist profiles
  - **ID Format**: `billie-eilish`

- **NME** (P3953) - UK music journalism
  - **Value**: News, interviews, UK perspective
  - **ID Format**: `billie-eilish`

- **Songfacts** (P6571) - Song stories and trivia
  - **Value**: Background context, fun facts
  - **ID Format**: `billie-eilish`

**Storage**: JSONB `identifiers` column
**Use Case**: Artist bios, song stories, cultural context for karaoke segments

---

### 🎵 Music Industry Databases

- **MusicBrainz** (P434)
- **Discogs** (P1953)
- **AllMusic** (P1728)
- **WhoSampled** (P5830)
- **Rate Your Music** (P10600)

**Storage**: JSONB `identifiers` column
**Use Case**: Cross-referencing, metadata validation, genre classification

---

### 📱 Social Media (Merged with Genius/MusicBrainz)

- **Twitter** (P2002)
- **Instagram** (P2003)
- **Facebook** (P4003)
- **YouTube** (P2397)
- **TikTok** (P7085)
- **SoundCloud** (P3040)
- **Weibo** (P2850)
- **VK** (P3267)
- **Reddit/Subreddit** (P3984)

**Storage**: Dedicated columns in `grc20_artists` (merged from all sources)
**Use Case**: Social media links, follower counts, community engagement

---

### ⚖️ Copyright/Rights

- **IPI Number** (P1330) - International Performer Identifier
  - **Value**: Copyright tracking, licensing, royalties
  - **Format**: Can have multiple (array)
  - **ID Example**: `00792187700`, `00792187898`

**Storage**: JSONB `identifiers` column
**Use Case**: Story Protocol integration, copyright verification, royalty splits

---

### 🌐 Universal Identifiers

- **Google Knowledge Graph** (P2671) - Google's entity ID
  - **Value**: SEO, Google services integration
  - **ID Format**: `/g/11c75ypgws`

- **Billboard** (P3314) - Music industry charts
  - **Value**: Chart history, industry recognition
  - **ID Format**: `billie-eilish`

- **Encyclopædia Britannica** (P1417) - Authoritative encyclopedia
  - **Value**: Biography reference, authority signal
  - **ID Format**: `biography/Billie-Eilish`

**Storage**: JSONB `identifiers` column
**Use Case**: SEO, authority validation, industry metrics

---

## Database Schema

### `wikidata_artists` Table

```sql
CREATE TABLE wikidata_artists (
  wikidata_id TEXT PRIMARY KEY,
  spotify_artist_id TEXT REFERENCES spotify_artists(spotify_artist_id),

  -- International Library IDs (dedicated columns)
  viaf_id TEXT,
  gnd_id TEXT,
  bnf_id TEXT,
  loc_id TEXT,
  sbn_id TEXT,
  bnmm_id TEXT,
  selibr_id TEXT,

  -- Labels (multi-language names)
  labels JSONB,

  -- Aliases (alternate names by language)
  aliases JSONB,

  -- Other identifiers (JSONB for flexibility)
  identifiers JSONB,

  -- Sitelinks (Wikipedia pages)
  sitelinks JSONB,

  enriched_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `grc20_artists` Additions

```sql
ALTER TABLE grc20_artists ADD COLUMN viaf_id TEXT;
ALTER TABLE grc20_artists ADD COLUMN gnd_id TEXT;
ALTER TABLE grc20_artists ADD COLUMN bnf_id TEXT;
ALTER TABLE grc20_artists ADD COLUMN loc_id TEXT;
ALTER TABLE grc20_artists ADD COLUMN sbn_id TEXT;
ALTER TABLE grc20_artists ADD COLUMN bnmm_id TEXT;
ALTER TABLE grc20_artists ADD COLUMN selibr_id TEXT;
ALTER TABLE grc20_artists ADD COLUMN subreddit_handle TEXT;
```

---

## Usage

### Step 1: Enrich Artists with Wikidata

```bash
cd karaoke-pipeline

# Run Wikidata enrichment processor
bun src/processors/05-enrich-wikidata.ts 10  # Process 10 artists
```

**What it does:**
- Finds artists with Wikidata URLs in MusicBrainz data
- Extracts Wikidata ID (e.g., Q29564107)
- Fetches from Wikidata API (rate limited: 1 req/sec)
- Parses 40+ identifiers from claims
- Stores in `wikidata_artists` table

### Step 2: Populate GRC-20 Artists (Merge All Sources)

```bash
# Merge Wikidata with Genius, MusicBrainz, Quansic
bun scripts/migration/populate-grc20-artists.ts
```

**What it does:**
- Reads from all enrichment tables (genius, musicbrainz, wikidata, quansic)
- Merges using priority: override > Genius > MusicBrainz > Wikidata
- Ensures no NULL columns (all sources merged)
- Updates `grc20_artists` table

---

## Value Proposition

### For Karaoke Pipeline

1. **Lyrics Sources** (Musixmatch, LyricsTranslate, SongMeanings)
   - Alternative to Genius for word-level timing
   - Multilingual translations (40+ languages)
   - Community-contributed context

2. **International Library IDs** (VIAF, GND, BNF, LOC)
   - Authoritative artist identification
   - Copyright verification
   - Academic research integration

3. **Asian Market** (Naver VIBE, Line Music, Namuwiki, Douban)
   - Expand to East Asian markets
   - Localized streaming links
   - Cultural context for translations

4. **Concert Data** (Songkick, Setlist.fm, Bandsintown)
   - AI ticket buying integration
   - Tour history, venue info
   - Setlist patterns for segment selection

5. **Music Journalism** (Pitchfork, NME, Songfacts)
   - Artist stories, song context
   - Reviews, interviews
   - Cultural background for karaoke segments

---

## Next Steps

1. **Test Integration**
   - Run processor on 36 processed artists
   - Verify identifiers captured correctly
   - Check merge logic in populate script

2. **Add to GRC-20 Minting**
   - Include library IDs in entity metadata
   - Reference IPI numbers for copyright

3. **AI Agent Integration**
   - Use Songkick/Bandsintown for ticket buying
   - Use Musixmatch/LyricsTranslate for lyrics
   - Use Asian platforms for market expansion

---

## Files Modified

1. `schema/migrations/017-wikidata-artists-table.sql` - New table
2. `schema/migrations/018-add-wikidata-subreddit.sql` - Expanded documentation
3. `src/services/wikidata.ts` - API service with 40+ property mappings
4. `src/db/wikidata.ts` - Database helpers
5. `src/processors/05-enrich-wikidata.ts` - Enrichment processor
6. `scripts/migration/populate-grc20-artists.ts` - Merge logic
7. `scripts/test-wikidata.ts` - Test script (Billie Eilish Q29564107)
8. `scripts/WIKIDATA-FINDINGS.md` - API exploration notes

---

## Rate Limits

- **Wikidata API**: ~60 requests/minute (1 req/sec)
- **Implementation**: Rate limiter in `rateLimitedFetch()`
- **User-Agent**: `KaraokePipeline/1.0`

---

## Example: Billie Eilish (Q29564107)

**International Library IDs:**
- VIAF: 19151246542344130590
- ISNI: 000000046748058X
- GND: 1182709559
- BNF: 17856308k
- LOC: no2017154277

**Lyrics/Translation:**
- Musixmatch: `Billie-Eilish-2`
- LyricsTranslate: `billie-elish-lyrics.html`

**Concert/Ticketing:**
- Songkick: `8913479`
- Setlist.fm: `1bc3b540`
- Bandsintown: `12895856`

**Asian Platforms:**
- Naver VIBE: `1465252`
- Line Music: `mi000000000adf86f3`
- Namuwiki: `빌리 아일리시`
- Douban: `134813`, `34968611`

**Music Journalism:**
- Pitchfork: `billie-eilish`
- NME: `billie-eilish`
- Songfacts: `billie-eilish`

**Copyright:**
- IPI: `00792187700`, `00792187898`

**Universal:**
- Google KG: `/g/11c75ypgws`
- Billboard: `billie-eilish`
- Britannica: `biography/Billie-Eilish`

---

**Total Identifiers Mapped**: 40+
**Primary Focus**: International library IDs, lyrics/translation, concert/ticketing, Asian market
**Integration Status**: Complete, ready for testing
