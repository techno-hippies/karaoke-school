# Wikidata API Integration - Findings

## Test Results

**Entity tested:** Billie Eilish (Q29564107)

### API Response Structure

```bash
# Test command
bun scripts/test-wikidata.ts Q29564107

# Raw API URL
https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q29564107&props=labels|descriptions|aliases|claims|sitelinks&languages=en|zh|es|fr|de|ja|ko|pt|ru|ar&format=json
```

### Data Available

#### 1. **Labels** (Names in different languages)
- 10 languages returned: English, Chinese, Spanish, French, German, Japanese, Korean, Portuguese, Russian, Arabic
- Example:
  ```
  en: "Billie Eilish"
  zh: "比莉·艾利什"
  ja: "ビリー・アイリッシュ"
  ko: "빌리 아일리시"
  ru: "Билли Айлиш"
  ar: "بيلي إيليش"
  ```

#### 2. **Descriptions**
- Localized descriptions in each language
- Example (en): "American singer-songwriter (born 2001)"

#### 3. **Aliases** (Alternative names)
- Full name: "Billie Eilish Pirate Baird O'Connell" in multiple languages
- Nickname variations
- Transliterations

#### 4. **Music Identifiers** (The goldmine!)

From **233 total properties**, these music-related identifiers were found:

**Industry IDs:**
- `musicbrainz_artist_id`: "f4abc0b5-3f7a-4eff-8f78-ac078dbce533"
- `discogs_artist_id`: ["5590213", "6502756"] (2 IDs!)
- `spotify_artist_id_old`: "6qqNVTkY8uBg9cP3Jd7DAH"
- `allmusic_artist_id`: "mn0003475903"

**Social Media:**
- `twitter_username`: "billieeilish"
- `instagram_username`: "billieeilish"
- `youtube_channel_id`: "UCiGm_E4ZwYSHV3bcW1pnSeQ"
- `tiktok_username`: "billieeilish"
- `soundcloud_id`: "billieeilish"
- `weibo_id`: "1065981054"

**Libraries & Archives:**
- `viaf_id`: "19151246542344130590" (Virtual International Authority File)
- `loc_id`: "no2017154277" (Library of Congress)
- `gnd_id`: "1182709559" (German National Library)
- `bnf_id`: Not present for Billie (would be French National Library)
- `sbn_id`: "LO1V466474" (Italian National Library)
- `bnmm_id`: "1602157051899" (Spanish National Library)

**Other:**
- `imdb_id`: "nm8483808"
- `wikitree_id`: "O'Connell-2286"
- `carnegie_hall_agent_id`: "133276"

#### 5. **Sitelinks** (Wikipedia articles)
- **115 Wikipedia articles** in different languages
- Includes: English, Chinese, Japanese, Korean, Spanish, French, German, Russian, Arabic, and 106+ more

### Claim Structure

Each identifier is stored as a "claim" with this structure:

```json
{
  "mainsnak": {
    "datavalue": {
      "value": "billieeilish",  // <-- The actual value we want
      "type": "string"
    }
  },
  "qualifiers": {
    // Additional metadata like follower counts, dates, etc.
  },
  "references": [
    // Sources where this data came from
  ]
}
```

**To extract an identifier:**
```typescript
const value = claim.mainsnak.datavalue.value;
```

### Property IDs We Care About

#### Core Music Industry
- `P434`: MusicBrainz artist ID
- `P1953`: Discogs artist ID
- `P2850`: Spotify artist ID (deprecated)
- `P1728`: AllMusic artist ID
- `P5830`: WhoSampled artist ID
- `P10600`: RateYourMusic artist ID

#### Social Media
- `P2002`: Twitter username
- `P2003`: Instagram username
- `P4003`: Facebook ID
- `P2397`: YouTube channel ID
- `P7085`: TikTok username
- `P3040`: SoundCloud ID
- `P2850`: Weibo ID
- `P3267`: VK ID

#### Libraries (International)
- `P214`: VIAF ID
- `P227`: GND (German)
- `P5361`: BNF (French)
- `P244`: Library of Congress
- `P396`: SBN (Italian)
- `P1015`: BNMM (Spanish)
- `P906`: SELIBR (Swedish)

#### Media
- `P345`: IMDB ID
- `P2949`: WikiTree ID
- `P4104`: Carnegie Hall agent ID

### Rate Limiting

Wikidata API:
- No API key required
- Rate limit: ~60 requests/minute (not strictly enforced for single queries)
- **MUST** include User-Agent header
- Be respectful - don't hammer the API

### Recommended Workflow

1. **Extract Wikidata ID from MusicBrainz** (we already have this in `musicbrainz_artists.all_urls`)
2. **Query Wikidata API** with that ID
3. **Extract claims** for properties we care about
4. **Store in `wikidata_artists` table**
5. **Merge into `grc20_artists`** during population

### Comparison with Current Data

**What Wikidata adds that we DON'T have:**

✅ **International library IDs** (German, French, Spanish, Italian, Swedish libraries)
✅ **Multiple Discogs IDs** (we might miss some)
✅ **Weibo ID** (numeric, not just handle)
✅ **Carnegie Hall, WikiTree, IMDB** IDs
✅ **Name variations in 100+ languages**
✅ **AllMusic, RateYourMusic, WhoSampled** IDs
✅ **YouTube channel ID** (more reliable than extracting from URL)

### Next Steps

1. Create `wikidata_artists` table
2. Create `src/services/wikidata.ts` service
3. Create `src/processors/05-enrich-wikidata.ts` processor
4. Update `populate-grc20-artists.ts` to merge Wikidata data

### Full API Response

Full response saved to: `/tmp/wikidata-Q29564107.json` (41 KB)

Inspect with:
```bash
cat /tmp/wikidata-Q29564107.json | python3 -m json.tool | less
```
