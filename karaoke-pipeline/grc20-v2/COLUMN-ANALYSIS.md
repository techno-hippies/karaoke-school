# GRC-20 Artists Column Analysis

**Total Artists:** 52

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Columns with 100% data | 8 | ✅ Must include in GRC-20 |
| Columns with >50% data | 38 | ✅ Include in GRC-20 |
| Columns with 10-50% data | 17 | ⚠️ Consider including |
| Columns with <10% but >0% data | 2 | ✅ Keep & include in GRC-20 |
| Columns with 0% data | 23 | ❌ Remove from DB |

---

## ✅ MUST INCLUDE (100% coverage)

**Core identifiers:**
- `name` (52/52)
- `spotify_artist_id` (52/52)
- `spotify_url` (52/52)
- `pkp_account_id` (52/52) - NEW!
- `lens_account_id` (52/52) - NEW!

**Rich metadata (JSONB):**
- `aliases` (52/52)
- `member_of_groups` (52/52)
- `wikidata_identifiers` (52/52)
- `handle_conflicts` (52/52)
- `handle_overrides` (52/52)
- `labels` (52/52)

---

## ✅ HIGH PRIORITY (>80% coverage)

**Industry identifiers:**
- `isni` (49/52 - 94%)
- `isni_all` (49/52 - 94%)
- `ipi_all` (47/52 - 90%)
- `mbid` (45/52 - 87%)

**Basic metadata:**
- `artist_type` (45/52 - 87%)
- `birth_date` (45/52 - 87%)
- `country` (44/52 - 85%)

**Platform URLs:**
- `wikidata_url` (45/52 - 87%)
- `wikidata_id` (41/52 - 79%)
- `deezer_url` (44/52 - 85%)
- `discogs_url` (44/52 - 85%)
- `discogs_id` (39/52 - 75%)
- `itunes_url` (44/52 - 85%)
- `tidal_url` (42/52 - 81%)
- `apple_music_url` (41/52 - 79%)
- `allmusic_url` (40/52 - 77%)

---

## ✅ MEDIUM PRIORITY (50-80% coverage)

**Library/Archive IDs:**
- `viaf_id` (38/52 - 73%)
- `viaf_url` (36/52 - 69%)
- `loc_id` (33/52 - 63%)
- `loc_url` (31/52 - 60%)
- `gnd_id` (31/52 - 60%)
- `dnb_url` (31/52 - 60%)
- `worldcat_url` (31/52 - 60%)
- `bnf_id` (30/52 - 58%)
- `bnf_url` (27/52 - 52%)

**Music platforms:**
- `genius_artist_id` (36/52 - 69%)
- `genius_url` (34/52 - 65%)
- `lastfm_url` (38/52 - 73%)
- `rateyourmusic_url` (37/52 - 71%)
- `songkick_url` (33/52 - 63%)

**Social media:**
- `instagram_handle` (37/52 - 71%)
- `twitter_handle` (37/52 - 71%)
- `facebook_handle` (36/52 - 69%)
- `soundcloud_handle` (37/52 - 71%)
- `youtube_channel` (40/52 - 77%)
- `weibo_handle` (32/52 - 62%)

**Metadata:**
- `header_image_url` (36/52 - 69%)
- `gender` (36/52 - 69%)
- `official_website` (35/52 - 67%)
- `genres` (30/52 - 58%)
- `is_verified` (27/52 - 52%)

**Grove storage:**
- `grove_image_cid` (27/52 - 52%)
- `grove_image_url` (27/52 - 52%)
- `grove_header_image_cid` (21/52 - 40%)
- `grove_header_image_url` (21/52 - 40%)

---

## ⚠️ LOW PRIORITY (10-50% coverage)

**Niche platforms:**
- `imdb_url` (32/52 - 62%)
- `imvdb_url` (27/52 - 52%)
- `myspace_url` (25/52 - 48%)
- `tiktok_handle` (25/52 - 48%)
- `whosampled_url` (22/52 - 42%)
- `secondhandsongs_url` (21/52 - 40%)
- `bandsintown_url` (18/52 - 35%)
- `setlistfm_url` (17/52 - 33%)
- `beatport_url` (14/52 - 27%)
- `amazon_music_url` (11/52 - 21%)
- `youtube_music_url` (11/52 - 21%)
- `napster_url` (10/52 - 19%)

**Minimal data:**
- `qobuz_url` (8/52 - 15%)
- `musixmatch_url` (7/52 - 13%)
- `themoviedb_url` (7/52 - 13%)
- `openlibrary_url` (7/52 - 13%)
- `jaxsta_url` (7/52 - 13%)
- `melon_url` (6/52 - 12%)
- `songmeanings_url` (5/52 - 10%)
- `vk_handle` (5/52 - 10%)

---

## ⚠️ LOW DATA BUT KEEP (<10% but >0%)

**These columns have minimal data but we MUST keep them:**
- `yandex_music_url` (3/52 - 6%) - **Kanye West, Destiny's Child, Billie Eilish**
- `boomplay_url` (4/52 - 8%) - **Phil Collins, Destiny's Child, Beyoncé, Billie Eilish**

---

## ❌ REMOVE FROM DATABASE (0% coverage)

**Zero data (23 columns):**
- `sort_name` (0/52)
- `disambiguation` (0/52)
- `image_url` (0/52) - replaced by grove_image_url
- `image_source` (0/52)
- `death_date` (0/52)
- `vimeo_url` (0/52)
- `snac_url` (0/52)
- `ibdb_url` (0/52)
- `goodreads_url` (0/52)
- `librarything_url` (0/52)
- `junodownload_url` (0/52)
- `bandsintown_url_alt` (0/52)
- `maniadb_url` (0/52)
- `mora_url` (0/52)
- `cdjapan_url` (0/52)
- `livefans_url` (0/52)
- `vgmdb_url` (0/52)
- `blog_url` (0/52)
- `bbc_music_url` (0/52)
- `musicmoz_url` (0/52)
- `musik_sammler_url` (0/52)
- `muziekweb_url` (0/52)
- `spirit_of_rock_url` (0/52)


---

## 📊 Recommendations

### 1. Add to GRC-20 (not currently in schema)
These columns have data but were missing from `02-define-types.ts`:

**High priority additions:**
- `pkpAddress` (pkp_account_id) - 100% ✅ CRITICAL
- `lensAccountId` (lens_account_id) - 100% ✅ CRITICAL
- `isniAll` (isni_all) - 94%
- `ipiAll` (ipi_all) - 90%
- `artistType` (artist_type) - 87%
- `birthDate` (birth_date) - 87%
- `discogsId` (discogs_id) - 75%

**Medium priority additions:**
- `viafId` (viaf_id) - 73%
- `locId` (loc_id) - 63%
- `gndId` (gnd_id) - 60%
- `bnfId` (bnf_id) - 58%
- `wikidata_identifiers` (JSONB) - 100%
- `aliases` (JSONB) - 100%
- `member_of_groups` (JSONB) - 100%
- `handle_conflicts` (JSONB) - 100%
- `handle_overrides` (JSONB) - 100%
- `labels` (JSONB) - 100%

**URLs with good coverage:**
- `viafUrl`, `locUrl`, `dnbUrl`, `worldcatUrl`, `bnfUrl`
- `imdbUrl`, `imvdbUrl`, `myspaceUrl`
- `songkickUrl`, `bandsintownUrl`, `setlistfmUrl`
- `lastfmUrl`, `rateyourmusicUrl`, `whosampled_url`, `secondhandsongs_url`

**Grove storage:**
- `groveImageCid`, `groveImageUrl`
- `groveHeaderImageCid`, `groveHeaderImageUrl`

### 2. Remove from Database
Create migration to drop **23 columns** with 0% data:
```sql
ALTER TABLE grc20_artists
  DROP COLUMN sort_name,
  DROP COLUMN disambiguation,
  DROP COLUMN image_url,
  DROP COLUMN image_source,
  DROP COLUMN death_date,
  -- ... (18 more zero-data columns)
  DROP COLUMN muziekweb_url,
  DROP COLUMN spirit_of_rock_url;
```

**KEEP** `yandex_music_url` and `boomplay_url` - they have data!

### 3. Update GRC-20 Schema
Add missing properties to `02-define-types.ts`:
- 8 new identifier properties (pkp, lens, isni_all, etc.)
- 4 new JSONB properties (aliases, member_of_groups, etc.)
- 12 new URL properties (library IDs, niche platforms)
- 4 Grove storage properties

**Total additions needed:** ~28 properties

---

## Next Steps

1. ✅ Create migration to drop 27 unused columns
2. ✅ Update `02-define-types.ts` with 28 missing properties
3. ✅ Re-run property creation (will add new ones, skip existing)
4. ✅ Update Zod schemas to include all properties
5. ✅ Mint artists with complete data
