/**
 * Populate grc20_artists table - FIXED VERSION
 *
 * Key fixes:
 * - NO spotify followers/popularity (user doesn't want metrics)
 * - Build Spotify URL from spotify_artist_id
 * - Extract handles FROM URLs when missing
 * - Better Genius matching
 * - ROBUST MusicBrainz matching: checks primary name, aliases, AND Spotify ID
 *   (handles edge cases like "Ye" vs "Kanye West")
 * - Handle vs URL distinction:
 *   - handles: from Genius (just username)
 *   - urls: from MusicBrainz (full URL)
 *   - Extract/build one from the other when needed
 * - ISNI Priority: Quansic > MusicBrainz > Genius
 */

import { query } from '../../src/db/neon';

interface ArtistAggregation {
  name: string;
  sortName?: string;
  aliases: Array<{ name: string; locale?: string; type?: string; source?: string }>;
  disambiguation?: string;
  isni?: string;
  isniAll?: string;
  ipiAll?: string;
  mbid?: string;
  spotifyArtistId: string;
  geniusArtistId?: number;
  discogsId?: string;
  artistType?: string;
  gender?: string;
  birthDate?: string;
  deathDate?: string;
  country?: string;
  genres?: string;
  isVerified?: boolean;
  instagramHandle?: string;
  twitterHandle?: string;
  facebookHandle?: string;
  tiktokHandle?: string;
  youtubeChannel?: string;
  soundcloudHandle?: string;
  weiboHandle?: string;
  vkHandle?: string;
  handleConflicts: Array<{ platform: string; genius: string; musicbrainz: string }>;
  handleOverrides?: Record<string, string>;
  urls: Record<string, string>;
  imageUrl?: string;
  headerImageUrl?: string;
  imageSource?: string;

  // Wikidata
  wikidataId?: string;

  // International Library IDs (from Wikidata)
  viafId?: string;
  gndId?: string;
  bnfId?: string;
  locId?: string;
  sbnId?: string;
  bnmmId?: string;
  selibrId?: string;

  // Group relationships (single direction: member → group)
  // Groups have empty array, persons have their groups listed
  memberOfGroups?: Array<{
    grc20_entity_id?: string;      // PRIMARY: for on-chain relationships (populated after minting)
    mbid: string;                  // For validation & sourcing
    name: string;
    spotify_artist_id?: string;    // Supplementary
  }>;

  // PKP & Lens data (foreign keys only)
  pkpAccountId?: number;
  lensAccountId?: number;
}

function extractUrl(allUrls: any, pattern: string): string | undefined {
  if (!allUrls || typeof allUrls !== 'object') return undefined;
  const key = Object.keys(allUrls).find(k =>
    k.toLowerCase().includes(pattern.toLowerCase())
  );
  return key ? allUrls[key] : undefined;
}

function extractHandleFromUrl(url: string | undefined, platform: string): string | undefined {
  if (!url) return undefined;

  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/').filter(Boolean);

    // Handle different URL patterns
    if (platform === 'youtube') {
      // youtube.com/user/ChrisBrownTV or youtube.com/c/billieeilish or youtube.com/@billieeilish or youtube.com/channel/UCiGm_E4ZwYSHV3bcW1pnSeQ
      if (parts[0] === 'user' || parts[0] === 'c' || parts[0] === 'channel' || parts[0].startsWith('@')) {
        const handle = parts[1] || parts[0].replace('@', '');
        return handle.toLowerCase();  // Normalize to lowercase
      }
    } else if (platform === 'soundcloud' || platform === 'instagram' || platform === 'tiktok' || platform === 'twitter' || platform === 'facebook' || platform === 'weibo' || platform === 'vk') {
      // Just the username (first path part), strip @ if present, normalize to lowercase
      // Weibo: weibo.com/6861477307 -> 6861477307
      // VK: vk.com/billieeilish -> billieeilish
      const handle = parts[0]?.replace('@', '');
      return handle?.toLowerCase();
    }
  } catch {}

  return undefined;
}

/**
 * Merge handles from manual override, Genius, and MusicBrainz
 * Priority: override > Genius > MusicBrainz
 */
function mergeHandle(
  override: string | undefined,
  geniusHandle: string | undefined,
  mbHandle: string | undefined,
  platform: string,
  conflicts: Array<{ platform: string; genius: string; musicbrainz: string }>
): string | undefined {
  // Highest priority: manual override
  if (override) return override;

  if (!geniusHandle && !mbHandle) return undefined;
  if (!geniusHandle) return mbHandle;
  if (!mbHandle) return geniusHandle;

  // Both exist - check if they match (case-insensitive)
  const normalized = geniusHandle.toLowerCase();
  const mbNormalized = mbHandle.toLowerCase();

  if (normalized === mbNormalized) {
    return normalized;  // Same handle, return it
  }

  // Conflict detected!
  conflicts.push({
    platform,
    genius: geniusHandle,
    musicbrainz: mbHandle
  });

  // Prefer Genius in case of conflict
  return normalized;
}

async function main() {
  console.log('🎵 Populating grc20_artists (ALL ARTISTS VERSION)...\n');

  // CHANGED: Process ALL artists in the artists array, not just index 0
  const processedArtists = await query(`
    SELECT DISTINCT
      artist->>'id' as spotify_artist_id,
      artist->>'name' as artist_name
    FROM karaoke_segments ks
    JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id,
    LATERAL jsonb_array_elements(st.artists) as artist
    WHERE ks.fal_enhanced_grove_cid IS NOT NULL
      AND artist->>'id' IS NOT NULL
    ORDER BY artist->>'name'
  `);

  console.log(`   Found ${processedArtists.length} artists (including group members & featured artists)\n`);

  for (const { spotify_artist_id, artist_name } of processedArtists) {
    console.log(`\n🔍 ${artist_name}`);

    const agg: ArtistAggregation = {
      name: artist_name.trim(),
      spotifyArtistId: spotify_artist_id,
      aliases: [],
      handleConflicts: [],
      urls: {}
    };

    // Check if artist already exists (to preserve manual overrides)
    const existing = await query(`
      SELECT handle_overrides FROM grc20_artists WHERE spotify_artist_id = $1
    `, [spotify_artist_id]);
    if (existing[0]?.handle_overrides) {
      agg.handleOverrides = existing[0].handle_overrides;
    }

    // 1. SPOTIFY - Get basic data ONLY (genres), NO images
    const spotify = await query(`SELECT name, genres FROM spotify_artists WHERE spotify_artist_id = $1`, [spotify_artist_id]);
    if (spotify[0]) {
      if (spotify[0].genres?.length) agg.genres = spotify[0].genres.join(', ');
      console.log(`   ✅ Spotify: genres`);
    }

    // ALWAYS build Spotify URL
    agg.urls.spotify_url = `https://open.spotify.com/artist/${spotify_artist_id}`;

    // 1b. GROVE IMAGES - Get images from Grove (if uploaded)
    // Note: Migration 034 removed derivative_images table - images now stored directly in grc20_artists
    // Images are uploaded separately via Grove upload script
    // For now, skip image fetching - images will be NULL until Grove upload is completed

    // 2. GENIUS - Better matching with trim
    const genius = await query(`
      SELECT * FROM genius_artists
      WHERE TRIM(LOWER(name)) = TRIM(LOWER($1))
      LIMIT 1
    `, [artist_name]);

    if (genius[0]) {
      const g = genius[0];
      agg.geniusArtistId = g.genius_artist_id;
      agg.isVerified = g.is_verified;

      // Handles from Genius (normalized to lowercase)
      agg.instagramHandle = g.instagram_name?.toLowerCase();
      agg.twitterHandle = g.twitter_name?.toLowerCase();
      agg.facebookHandle = g.facebook_name?.toLowerCase();

      agg.headerImageUrl = g.header_image_url;

      // Add Genius alternate names as aliases
      if (g.alternate_names?.length) {
        g.alternate_names.forEach((altName: string) => {
          agg.aliases.push({ name: altName, source: 'genius' });
        });
      }

      console.log(`   ✅ Genius: @${g.instagram_name || 'none'}${g.is_verified ? ' (verified)' : ''}`);
    } else {
      console.log(`   ⚠️  Genius: not found for "${artist_name.trim()}"`);
    }

    // 3. MUSICBRAINZ - URLs and aliases
    // ROBUST: Check both primary name AND aliases (handles cases like "Ye" vs "Kanye West")
    let mb = await query(`
      SELECT * FROM musicbrainz_artists
      WHERE TRIM(LOWER(name)) = TRIM(LOWER($1))
      LIMIT 1
    `, [artist_name]);

    // If not found by primary name, check aliases
    if (mb.length === 0) {
      mb = await query(`
        SELECT * FROM musicbrainz_artists
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(aliases) AS alias
          WHERE TRIM(LOWER(alias->>'name')) = TRIM(LOWER($1))
        )
        LIMIT 1
      `, [artist_name]);

      if (mb.length > 0) {
        console.log(`   🔍 MusicBrainz: Found by alias match (primary name: "${mb[0].name}")`);
      }
    }

    // Final fallback: Try Spotify ID from MusicBrainz URLs (extract from spotify URLs in all_urls)
    if (mb.length === 0) {
      mb = await query(`
        SELECT * FROM musicbrainz_artists
        WHERE all_urls::text ILIKE $1
        LIMIT 1
      `, [`%${spotify_artist_id}%`]);

      if (mb.length > 0) {
        console.log(`   🔍 MusicBrainz: Found by Spotify ID in URLs (name: "${mb[0].name}")`);
      }
    }

    if (mb[0]) {
      const m = mb[0];
      agg.mbid = m.artist_mbid;
      agg.artistType = m.artist_type;
      agg.gender = m.gender;
      agg.birthDate = m.birth_date;
      agg.country = m.country;

      // ISNI Priority: MusicBrainz > Genius (Genius doesn't have ISNI)
      // Note: Quansic will override this later if it has ISNI (most authoritative)
      if (m.isnis?.length) {
        agg.isni = m.isnis[0];
        agg.isniAll = m.isnis.join(', ');
      }
      if (m.ipis?.length) {
        agg.ipiAll = m.ipis.join(', ');
      }

      // Add MusicBrainz aliases with language codes
      if (m.aliases?.length) {
        m.aliases.forEach((alias: any) => {
          agg.aliases.push({
            name: alias.name,
            locale: alias.locale || undefined,
            type: alias.type || undefined,
            source: 'musicbrainz'
          });
        });
      }

      // Extract ALL URLs from MusicBrainz all_urls JSONB
      if (m.all_urls) {
        // Social Media - Extract handles and merge with Genius
        const instagramUrl = extractUrl(m.all_urls, 'instagram.com');
        const twitterUrl = extractUrl(m.all_urls, 'twitter.com');
        const facebookUrl = extractUrl(m.all_urls, 'facebook.com');
        const tiktokUrl = extractUrl(m.all_urls, 'tiktok.com');
        const youtubeUrl = extractUrl(m.all_urls, 'youtube.youtube.com');
        const soundcloudUrl = extractUrl(m.all_urls, 'soundcloud.com');
        const weiboUrl = extractUrl(m.all_urls, 'weibo.com');
        const vkUrl = extractUrl(m.all_urls, 'vk.com');

        agg.instagramHandle = mergeHandle(agg.handleOverrides?.instagram, agg.instagramHandle, extractHandleFromUrl(instagramUrl, 'instagram'), 'instagram', agg.handleConflicts);
        agg.twitterHandle = mergeHandle(agg.handleOverrides?.twitter, agg.twitterHandle, extractHandleFromUrl(twitterUrl, 'twitter'), 'twitter', agg.handleConflicts);
        agg.facebookHandle = mergeHandle(agg.handleOverrides?.facebook, agg.facebookHandle, extractHandleFromUrl(facebookUrl, 'facebook'), 'facebook', agg.handleConflicts);
        agg.tiktokHandle = mergeHandle(agg.handleOverrides?.tiktok, agg.tiktokHandle, extractHandleFromUrl(tiktokUrl, 'tiktok'), 'tiktok', agg.handleConflicts);
        agg.youtubeChannel = mergeHandle(agg.handleOverrides?.youtube, agg.youtubeChannel, extractHandleFromUrl(youtubeUrl, 'youtube'), 'youtube', agg.handleConflicts);
        agg.soundcloudHandle = mergeHandle(agg.handleOverrides?.soundcloud, agg.soundcloudHandle, extractHandleFromUrl(soundcloudUrl, 'soundcloud'), 'soundcloud', agg.handleConflicts);
        agg.weiboHandle = mergeHandle(agg.handleOverrides?.weibo, agg.weiboHandle, extractHandleFromUrl(weiboUrl, 'weibo'), 'weibo', agg.handleConflicts);
        agg.vkHandle = mergeHandle(agg.handleOverrides?.vk, agg.vkHandle, extractHandleFromUrl(vkUrl, 'vk'), 'vk', agg.handleConflicts);

        // Other URLs (keep these - not social media handles)
        agg.urls.myspace_url = extractUrl(m.all_urls, 'myspace.com');
        agg.urls.youtube_music_url = extractUrl(m.all_urls, 'youtube music.music.youtube.com');
        agg.urls.vimeo_url = extractUrl(m.all_urls, 'vimeo.com');
        agg.urls.imvdb_url = extractUrl(m.all_urls, 'imvdb.com');

        // Streaming Platforms
        agg.urls.deezer_url = extractUrl(m.all_urls, 'deezer.com');
        agg.urls.tidal_url = extractUrl(m.all_urls, 'tidal.com');
        agg.urls.apple_music_url = extractUrl(m.all_urls, 'music.apple.com');
        agg.urls.amazon_music_url = extractUrl(m.all_urls, 'music.amazon.com');
        agg.urls.napster_url = extractUrl(m.all_urls, 'napster.com');
        agg.urls.yandex_music_url = extractUrl(m.all_urls, 'music.yandex.com');
        agg.urls.boomplay_url = extractUrl(m.all_urls, 'boomplay.com');
        agg.urls.melon_url = extractUrl(m.all_urls, 'melon.com');
        agg.urls.qobuz_url = extractUrl(m.all_urls, 'qobuz.com');

        // Database & Reference
        agg.urls.wikidata_url = extractUrl(m.all_urls, 'wikidata.org');
        agg.urls.viaf_url = extractUrl(m.all_urls, 'viaf.org');
        agg.urls.imdb_url = extractUrl(m.all_urls, 'imdb.com');
        agg.urls.allmusic_url = extractUrl(m.all_urls, 'allmusic.com');
        agg.urls.discogs_url = extractUrl(m.all_urls, 'discogs.com');
        agg.urls.songkick_url = extractUrl(m.all_urls, 'songkick.com');
        agg.urls.bandsintown_url = extractUrl(m.all_urls, 'bandsintown.com');
        agg.urls.setlistfm_url = extractUrl(m.all_urls, 'setlist.fm');
        agg.urls.secondhandsongs_url = extractUrl(m.all_urls, 'secondhandsongs.com');

        // Lyrics & Info
        agg.urls.genius_url = extractUrl(m.all_urls, 'genius.com');
        agg.urls.lastfm_url = extractUrl(m.all_urls, 'last.fm');
        agg.urls.musixmatch_url = extractUrl(m.all_urls, 'musixmatch.com');

        // Library & Catalog
        agg.urls.loc_url = extractUrl(m.all_urls, 'id.loc.gov');
        agg.urls.bnf_url = extractUrl(m.all_urls, 'bnf.fr');
        agg.urls.dnb_url = extractUrl(m.all_urls, 'd-nb.info');
        agg.urls.worldcat_url = extractUrl(m.all_urls, 'worldcat.org');
        agg.urls.openlibrary_url = extractUrl(m.all_urls, 'openlibrary.org');

        // Specialized Databases
        agg.urls.rateyourmusic_url = extractUrl(m.all_urls, 'rateyourmusic.com');
        agg.urls.whosampled_url = extractUrl(m.all_urls, 'whosampled.com');
        agg.urls.jaxsta_url = extractUrl(m.all_urls, 'jaxsta.com');
        agg.urls.themoviedb_url = extractUrl(m.all_urls, 'themoviedb.org');

        // Purchase & Download
        agg.urls.beatport_url = extractUrl(m.all_urls, 'beatport.com');
        agg.urls.itunes_url = extractUrl(m.all_urls, 'itunes.apple.com') || extractUrl(m.all_urls, 'music.apple.com');

        // Other
        agg.urls.official_website = extractUrl(m.all_urls, 'official homepage');

        // Extract Discogs ID from URL
        if (agg.urls.discogs_url) {
          const match = agg.urls.discogs_url.match(/artist\/(\d+)/);
          if (match) agg.discogsId = match[1];
        }

        const urlCount = Object.values(agg.urls).filter(Boolean).length;
        const aliasCount = m.aliases?.length || 0;
        const conflictCount = agg.handleConflicts.length;
        const conflictMsg = conflictCount > 0 ? `, ⚠️  ${conflictCount} handle conflicts` : '';
        console.log(`   ✅ MusicBrainz: ISNI ${agg.isni || 'none'}, ${urlCount} URLs, ${aliasCount} aliases${conflictMsg}`);
      }

      // Build group relationships from MusicBrainz member_relations
      // Single direction: member → group (Groups will have empty array)
      const memberRelations = m.member_relations || [];

      // Members have direction="forward" (member → group)
      const memberOfGroups = memberRelations.filter(rel => rel.direction === 'forward');
      if (memberOfGroups.length > 0) {
        agg.memberOfGroups = [];
        for (const rel of memberOfGroups) {
          // Try to find Spotify ID for this group
          const groupData = await query(`
            SELECT spotify_artist_id, name
            FROM grc20_artists
            WHERE mbid = $1
          `, [rel.artist_mbid]);

          agg.memberOfGroups.push({
            grc20_entity_id: null,                         // Will be populated after group is minted
            mbid: rel.artist_mbid,                         // For validation & sourcing
            name: rel.artist_name,
            spotify_artist_id: groupData[0]?.spotify_artist_id
          });
        }
      } else {
        agg.memberOfGroups = [];
      }
    } else {
      console.log(`   ⚠️  MusicBrainz: not found for "${artist_name.trim()}"`);
      // No MusicBrainz data = no relationships
      agg.memberOfGroups = [];
    }

    // 4. WIKIDATA - International library IDs and additional identifiers
    const wikidata = await query(`
      SELECT * FROM wikidata_artists
      WHERE spotify_artist_id = $1
      LIMIT 1
    `, [spotify_artist_id]);

    if (wikidata[0]) {
      const wd = wikidata[0];

      // Wikidata QID (universal entity identifier)
      agg.wikidataId = wd.wikidata_id;

      // International Library IDs (PRIMARY)
      agg.viafId = wd.viaf_id || agg.viafId;
      agg.gndId = wd.gnd_id || agg.gndId;
      agg.bnfId = wd.bnf_id || agg.bnfId;
      agg.locId = wd.loc_id || agg.locId;
      agg.sbnId = wd.sbn_id || agg.sbnId;
      agg.bnmmId = wd.bnmm_id || agg.bnmmId;
      agg.selibrId = wd.selibr_id || agg.selibrId;

      const libraryIds = [
        agg.viafId && `VIAF:${agg.viafId}`,
        agg.gndId && `GND:${agg.gndId}`,
        agg.bnfId && `BNF:${agg.bnfId}`,
        agg.locId && `LOC:${agg.locId}`,
        agg.sbnId && `SBN:${agg.sbnId}`,
        agg.bnmmId && `BNMM:${agg.bnmmId}`,
        agg.selibrId && `SELIBR:${agg.selibrId}`
      ].filter(Boolean);

      // Store full Wikidata identifiers (musicbrainz, discogs, allmusic, imdb, etc.)
      agg.wikidataIdentifiers = wd.identifiers || {};

      // Store Wikidata labels (artist names in different languages)
      agg.labels = wd.labels || [];

      // NEW: Store library IDs separately for GRC-20 columns
      // These are cleaner than URLs and enable cross-reference validation

      // Merge social media handles from Wikidata identifiers (priority: override > Genius > MusicBrainz > Wikidata)
      if (wd.identifiers) {
        const ids = wd.identifiers;
        const getHandle = (val: any) => typeof val === 'string' ? val.toLowerCase() : undefined;
        agg.instagramHandle = mergeHandle(agg.handleOverrides?.instagram, agg.instagramHandle, getHandle(ids.instagram), 'instagram', agg.handleConflicts);
        agg.twitterHandle = mergeHandle(agg.handleOverrides?.twitter, agg.twitterHandle, getHandle(ids.twitter), 'twitter', agg.handleConflicts);
        agg.facebookHandle = mergeHandle(agg.handleOverrides?.facebook, agg.facebookHandle, getHandle(ids.facebook), 'facebook', agg.handleConflicts);
        agg.tiktokHandle = mergeHandle(agg.handleOverrides?.tiktok, agg.tiktokHandle, getHandle(ids.tiktok), 'tiktok', agg.handleConflicts);
        agg.youtubeChannel = mergeHandle(agg.handleOverrides?.youtube, agg.youtubeChannel, getHandle(ids.youtube), 'youtube', agg.handleConflicts);
        agg.soundcloudHandle = mergeHandle(agg.handleOverrides?.soundcloud, agg.soundcloudHandle, getHandle(ids.soundcloud), 'soundcloud', agg.handleConflicts);
        agg.weiboHandle = mergeHandle(agg.handleOverrides?.weibo, agg.weiboHandle, getHandle(ids.weibo), 'weibo', agg.handleConflicts);
        agg.vkHandle = mergeHandle(agg.handleOverrides?.vk, agg.vkHandle, getHandle(ids.vk), 'vk', agg.handleConflicts);
      }

      console.log(`   ✅ Wikidata: ${agg.wikidataId || 'no QID'}, ${libraryIds.length} library IDs${libraryIds.length ? ` (${libraryIds.join(', ')})` : ''}`);
    } else {
      console.log(`   ⚠️  Wikidata: not found (run processor 05-enrich-wikidata)`);
    }

    // 5. QUANSIC - ISNI override (direct artist lookup from quansic_artists table)
    const quansic = await query(`
      SELECT name, isni, isni_all, ipi_all
      FROM quansic_artists
      WHERE spotify_artist_id = $1
      LIMIT 1
    `, [spotify_artist_id]);

    if (quansic[0]?.isni) {
      agg.isni = quansic[0].isni;
      // isni_all and ipi_all are JSONB arrays, convert to comma-separated strings
      if (quansic[0].isni_all) {
        const isniArray = Array.isArray(quansic[0].isni_all) ? quansic[0].isni_all : quansic[0].isni_all;
        agg.isniAll = isniArray.join(', ');
      }
      if (quansic[0].ipi_all) {
        const ipiArray = Array.isArray(quansic[0].ipi_all) ? quansic[0].ipi_all : quansic[0].ipi_all;
        agg.ipiAll = ipiArray.join(', ');
      }
      console.log(`   ✅ Quansic: ISNI override ${agg.isni} (from quansic_artists)`);
    }

    // 6. PKP - Lit Protocol PKP data (store foreign key only)
    const pkp = await query<{ id: number; pkp_address: string }>(`
      SELECT id, pkp_address
      FROM pkp_accounts
      WHERE spotify_artist_id = $1 AND account_type = 'artist'
      LIMIT 1
    `, [spotify_artist_id]);

    if (pkp[0]) {
      agg.pkpAccountId = pkp[0].id;
      console.log(`   ✅ PKP: ${pkp[0].pkp_address} (FK: ${agg.pkpAccountId})`);
    } else {
      console.log(`   ⚠️  PKP: not minted (run: bun src/processors/mint-artist-pkps.ts)`);
    }

    // 7. LENS - Lens Protocol account data (store foreign key only)
    const lens = await query<{ id: number; lens_handle: string; lens_account_address: string }>(`
      SELECT id, lens_handle, lens_account_address
      FROM lens_accounts
      WHERE spotify_artist_id = $1 AND account_type = 'artist'
      LIMIT 1
    `, [spotify_artist_id]);

    if (lens[0]) {
      agg.lensAccountId = lens[0].id;
      console.log(`   ✅ Lens: @${lens[0].lens_handle} (${lens[0].lens_account_address}, FK: ${agg.lensAccountId})`);
    } else {
      console.log(`   ⚠️  Lens: not created (run: bun src/processors/create-artist-lens.ts)`);
    }

    // INSERT
    await query(`
      INSERT INTO grc20_artists (
        name, sort_name, aliases, disambiguation,
        isni, isni_all, ipi_all, mbid,
        spotify_artist_id, genius_artist_id, discogs_id,
        artist_type, gender, birth_date, death_date, country,
        genres, is_verified,
        instagram_handle, twitter_handle, facebook_handle, tiktok_handle,
        youtube_channel, soundcloud_handle, weibo_handle, vk_handle,
        handle_conflicts, handle_overrides,
        labels, wikidata_identifiers,
        wikidata_id, viaf_id, gnd_id, bnf_id, loc_id,
        myspace_url, spotify_url, deezer_url, tidal_url, apple_music_url, amazon_music_url,
        youtube_music_url, napster_url, yandex_music_url, boomplay_url, melon_url, qobuz_url,
        bandsintown_url_alt, maniadb_url, mora_url, cdjapan_url, livefans_url, vgmdb_url, junodownload_url,
        vimeo_url, imvdb_url, wikidata_url, viaf_url, imdb_url, allmusic_url, discogs_url,
        songkick_url, bandsintown_url, setlistfm_url, secondhandsongs_url,
        genius_url, lastfm_url, musixmatch_url,
        loc_url, bnf_url, dnb_url, worldcat_url, openlibrary_url,
        snac_url, ibdb_url, goodreads_url, librarything_url,
        rateyourmusic_url, whosampled_url, jaxsta_url, themoviedb_url,
        beatport_url, itunes_url, official_website,
        blog_url, bbc_music_url, musicmoz_url, musik_sammler_url, muziekweb_url, spirit_of_rock_url,
        image_url, header_image_url, image_source,
        member_of_groups,
        pkp_account_id, lens_account_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47,
        $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62,
        $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77,
        $78, $79, $80, $81, $82, $83, $84, $85, $86, $87, $88, $89, $90, $91, $92,
        $93, $94, $95, $96
      )
      ON CONFLICT (spotify_artist_id) DO UPDATE SET
        isni = EXCLUDED.isni, isni_all = EXCLUDED.isni_all, ipi_all = EXCLUDED.ipi_all,
        mbid = EXCLUDED.mbid, artist_type = EXCLUDED.artist_type,
        gender = EXCLUDED.gender, birth_date = EXCLUDED.birth_date, country = EXCLUDED.country,
        aliases = EXCLUDED.aliases, genres = EXCLUDED.genres,
        genius_artist_id = EXCLUDED.genius_artist_id,
        instagram_handle = EXCLUDED.instagram_handle, twitter_handle = EXCLUDED.twitter_handle,
        facebook_handle = EXCLUDED.facebook_handle, tiktok_handle = EXCLUDED.tiktok_handle,
        youtube_channel = EXCLUDED.youtube_channel, soundcloud_handle = EXCLUDED.soundcloud_handle,
        weibo_handle = EXCLUDED.weibo_handle, vk_handle = EXCLUDED.vk_handle,
        handle_conflicts = EXCLUDED.handle_conflicts,
        labels = EXCLUDED.labels, wikidata_identifiers = EXCLUDED.wikidata_identifiers,
        wikidata_id = EXCLUDED.wikidata_id, viaf_id = EXCLUDED.viaf_id,
        gnd_id = EXCLUDED.gnd_id, bnf_id = EXCLUDED.bnf_id, loc_id = EXCLUDED.loc_id,
        myspace_url = EXCLUDED.myspace_url, spotify_url = EXCLUDED.spotify_url,
        deezer_url = EXCLUDED.deezer_url, tidal_url = EXCLUDED.tidal_url,
        apple_music_url = EXCLUDED.apple_music_url, amazon_music_url = EXCLUDED.amazon_music_url,
        youtube_music_url = EXCLUDED.youtube_music_url, napster_url = EXCLUDED.napster_url,
        yandex_music_url = EXCLUDED.yandex_music_url, boomplay_url = EXCLUDED.boomplay_url,
        melon_url = EXCLUDED.melon_url, qobuz_url = EXCLUDED.qobuz_url,
        bandsintown_url_alt = EXCLUDED.bandsintown_url_alt, maniadb_url = EXCLUDED.maniadb_url,
        mora_url = EXCLUDED.mora_url, cdjapan_url = EXCLUDED.cdjapan_url,
        livefans_url = EXCLUDED.livefans_url, vgmdb_url = EXCLUDED.vgmdb_url,
        junodownload_url = EXCLUDED.junodownload_url,
        vimeo_url = EXCLUDED.vimeo_url, imvdb_url = EXCLUDED.imvdb_url,
        wikidata_url = EXCLUDED.wikidata_url, viaf_url = EXCLUDED.viaf_url,
        imdb_url = EXCLUDED.imdb_url, allmusic_url = EXCLUDED.allmusic_url,
        discogs_url = EXCLUDED.discogs_url, songkick_url = EXCLUDED.songkick_url,
        bandsintown_url = EXCLUDED.bandsintown_url, setlistfm_url = EXCLUDED.setlistfm_url,
        secondhandsongs_url = EXCLUDED.secondhandsongs_url,
        genius_url = EXCLUDED.genius_url, lastfm_url = EXCLUDED.lastfm_url,
        musixmatch_url = EXCLUDED.musixmatch_url,
        loc_url = EXCLUDED.loc_url, bnf_url = EXCLUDED.bnf_url, dnb_url = EXCLUDED.dnb_url,
        worldcat_url = EXCLUDED.worldcat_url, openlibrary_url = EXCLUDED.openlibrary_url,
        snac_url = EXCLUDED.snac_url, ibdb_url = EXCLUDED.ibdb_url,
        goodreads_url = EXCLUDED.goodreads_url, librarything_url = EXCLUDED.librarything_url,
        rateyourmusic_url = EXCLUDED.rateyourmusic_url, whosampled_url = EXCLUDED.whosampled_url,
        jaxsta_url = EXCLUDED.jaxsta_url, themoviedb_url = EXCLUDED.themoviedb_url,
        beatport_url = EXCLUDED.beatport_url, itunes_url = EXCLUDED.itunes_url,
        official_website = EXCLUDED.official_website,
        blog_url = EXCLUDED.blog_url, bbc_music_url = EXCLUDED.bbc_music_url,
        musicmoz_url = EXCLUDED.musicmoz_url, musik_sammler_url = EXCLUDED.musik_sammler_url,
        muziekweb_url = EXCLUDED.muziekweb_url, spirit_of_rock_url = EXCLUDED.spirit_of_rock_url,
        image_url = EXCLUDED.image_url, header_image_url = EXCLUDED.header_image_url,
        image_source = EXCLUDED.image_source,
        member_of_groups = EXCLUDED.member_of_groups,
        pkp_account_id = EXCLUDED.pkp_account_id,
        lens_account_id = EXCLUDED.lens_account_id,
        updated_at = NOW()
    `, [
      agg.name, agg.sortName, JSON.stringify(agg.aliases), agg.disambiguation,
      agg.isni, agg.isniAll, agg.ipiAll, agg.mbid,
      agg.spotifyArtistId, agg.geniusArtistId, agg.discogsId,
      agg.artistType, agg.gender, agg.birthDate, agg.deathDate, agg.country, agg.genres,
      agg.isVerified,
      agg.instagramHandle, agg.twitterHandle, agg.facebookHandle, agg.tiktokHandle,
      agg.youtubeChannel, agg.soundcloudHandle, agg.weiboHandle, agg.vkHandle,
      JSON.stringify(agg.handleConflicts),
      JSON.stringify(agg.handleOverrides || {}),
      JSON.stringify(agg.labels || []),
      JSON.stringify(agg.wikidataIdentifiers || {}),
      agg.wikidataId, agg.viafId, agg.gndId, agg.bnfId, agg.locId,
      agg.urls.myspace_url, agg.urls.spotify_url, agg.urls.deezer_url, agg.urls.tidal_url, agg.urls.apple_music_url, agg.urls.amazon_music_url,
      agg.urls.youtube_music_url, agg.urls.napster_url, agg.urls.yandex_music_url, agg.urls.boomplay_url, agg.urls.melon_url, agg.urls.qobuz_url,
      agg.urls.bandsintown_url_alt, agg.urls.maniadb_url, agg.urls.mora_url, agg.urls.cdjapan_url, agg.urls.livefans_url, agg.urls.vgmdb_url, agg.urls.junodownload_url,
      agg.urls.vimeo_url, agg.urls.imvdb_url, agg.urls.wikidata_url, agg.urls.viaf_url, agg.urls.imdb_url, agg.urls.allmusic_url, agg.urls.discogs_url,
      agg.urls.songkick_url, agg.urls.bandsintown_url, agg.urls.setlistfm_url, agg.urls.secondhandsongs_url,
      agg.urls.genius_url, agg.urls.lastfm_url, agg.urls.musixmatch_url,
      agg.urls.loc_url, agg.urls.bnf_url, agg.urls.dnb_url, agg.urls.worldcat_url, agg.urls.openlibrary_url,
      agg.urls.snac_url, agg.urls.ibdb_url, agg.urls.goodreads_url, agg.urls.librarything_url,
      agg.urls.rateyourmusic_url, agg.urls.whosampled_url, agg.urls.jaxsta_url, agg.urls.themoviedb_url,
      agg.urls.beatport_url, agg.urls.itunes_url, agg.urls.official_website,
      agg.urls.blog_url, agg.urls.bbc_music_url, agg.urls.musicmoz_url, agg.urls.musik_sammler_url, agg.urls.muziekweb_url, agg.urls.spirit_of_rock_url,
      agg.imageUrl, agg.headerImageUrl, agg.imageSource,
      JSON.stringify(agg.memberOfGroups || []),
      agg.pkpAccountId, agg.lensAccountId
    ]);

    console.log(`   ✅ SAVED`);
  }

  // SECOND PASS: Update relationships for artists that were missing Spotify IDs
  // (happens when related artists weren't processed yet in first pass)
  console.log('\n🔄 Second pass: Updating incomplete relationships...\n');

  const artistsWithRelations = await query<{
    id: number;
    name: string;
    spotify_artist_id: string;
    mbid: string;
    member_of_groups: any[];
  }>(`
    SELECT id, name, spotify_artist_id, mbid, member_of_groups
    FROM grc20_artists
    WHERE mbid IS NOT NULL
      AND jsonb_array_length(member_of_groups) > 0
  `);

  let updatedCount = 0;

  for (const artist of artistsWithRelations) {
    // Check member_of_groups for missing Spotify IDs
    if (artist.member_of_groups && artist.member_of_groups.length > 0) {
      const updatedGroups = [];
      let groupNeedsUpdate = false;

      for (const group of artist.member_of_groups) {
        if (!group.spotify_artist_id && group.mbid) {
          // Try to find Spotify ID by MBID
          const groupData = await query(`
            SELECT spotify_artist_id
            FROM grc20_artists
            WHERE mbid = $1
          `, [group.mbid]);

          if (groupData[0]?.spotify_artist_id) {
            updatedGroups.push({
              ...group,
              spotify_artist_id: groupData[0].spotify_artist_id
            });
            groupNeedsUpdate = true;
          } else {
            updatedGroups.push(group);
          }
        } else {
          updatedGroups.push(group);
        }
      }

      if (groupNeedsUpdate) {
        await query(`
          UPDATE grc20_artists
          SET member_of_groups = $1,
              updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(updatedGroups), artist.id]);
        updatedCount++;
      }
    }
  }

  console.log(`✅ Updated ${updatedCount} artists with complete relationship data\n`);

  const summary = await query(`
    SELECT
      COUNT(*) as total,
      COUNT(isni) as with_isni,
      COUNT(genius_artist_id) as with_genius,
      COUNT(instagram_handle) as with_ig_handle,
      COUNT(twitter_handle) as with_tw_handle,
      COUNT(facebook_handle) as with_fb_handle,
      COUNT(youtube_channel) as with_yt_channel,
      COUNT(soundcloud_handle) as with_sc_handle,
      COUNT(tiktok_handle) as with_tt_handle,
      COUNT(weibo_handle) as with_weibo_handle,
      COUNT(vk_handle) as with_vk_handle,
      COUNT(handle_conflicts) FILTER (WHERE jsonb_array_length(handle_conflicts) > 0) as with_conflicts,
      COUNT(spotify_url) as with_spotify_url,
      COUNT(amazon_music_url) as with_amazon,
      COUNT(bandsintown_url) as with_bandsintown,
      COUNT(loc_url) as with_loc_url,
      COUNT(wikidata_url) as with_wikidata,
      COUNT(allmusic_url) as with_allmusic,
      COUNT(imdb_url) as with_imdb,
      COUNT(pkp_account_id) as with_pkp,
      COUNT(lens_account_id) as with_lens
    FROM grc20_artists
  `);

  console.log('\n📊 FINAL SUMMARY:');
  console.log(`   Total: ${summary[0].total}`);
  console.log(`   ISNI: ${summary[0].with_isni} (${Math.round(summary[0].with_isni/summary[0].total*100)}%)`);
  console.log(`   Genius: ${summary[0].with_genius} (${Math.round(summary[0].with_genius/summary[0].total*100)}%)`);
  console.log(`\n   Social Media Handles (merged from Genius + MusicBrainz):`);
  console.log(`   Instagram: ${summary[0].with_ig_handle}`);
  console.log(`   Twitter: ${summary[0].with_tw_handle}`);
  console.log(`   Facebook: ${summary[0].with_fb_handle}`);
  console.log(`   YouTube: ${summary[0].with_yt_channel}`);
  console.log(`   SoundCloud: ${summary[0].with_sc_handle}`);
  console.log(`   TikTok: ${summary[0].with_tt_handle}`);
  console.log(`   Weibo: ${summary[0].with_weibo_handle}`);
  console.log(`   VK: ${summary[0].with_vk_handle}`);
  console.log(`   ⚠️  Handle conflicts: ${summary[0].with_conflicts}`);
  console.log(`\n   Reference URLs:`);
  console.log(`   Spotify: ${summary[0].with_spotify_url} (${Math.round(summary[0].with_spotify_url/summary[0].total*100)}%)`);
  console.log(`   Amazon Music: ${summary[0].with_amazon}`);
  console.log(`   Bandsintown: ${summary[0].with_bandsintown}`);
  console.log(`   Library of Congress: ${summary[0].with_loc}`);
  console.log(`   Wikidata: ${summary[0].with_wikidata}`);
  console.log(`   AllMusic: ${summary[0].with_allmusic}`);
  console.log(`   IMDB: ${summary[0].with_imdb}`);
  console.log(`\n   Web3 Accounts:`);
  console.log(`   PKP: ${summary[0].with_pkp} (${Math.round(summary[0].with_pkp/summary[0].total*100)}%)`);
  console.log(`   Lens: ${summary[0].with_lens} (${Math.round(summary[0].with_lens/summary[0].total*100)}%)`);
  console.log('\n✅ Done!\n');
}

main().catch(console.error);
