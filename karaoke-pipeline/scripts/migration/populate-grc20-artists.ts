/**
 * Populate grc20_artists table - FIXED VERSION
 *
 * Key fixes:
 * - NO spotify followers/popularity (user doesn't want metrics)
 * - Build Spotify URL from spotify_artist_id
 * - Extract handles FROM URLs when missing
 * - Better Genius matching
 * - Handle vs URL distinction:
 *   - handles: from Genius (just username)
 *   - urls: from MusicBrainz (full URL)
 *   - Extract/build one from the other when needed
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

  // International Library IDs (from Wikidata)
  viafId?: string;
  gndId?: string;
  bnfId?: string;
  locId?: string;
  sbnId?: string;
  bnmmId?: string;
  selibrId?: string;
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
  console.log('🎵 Populating grc20_artists (FIXED VERSION)...\n');

  const processedArtists = await query(`
    SELECT DISTINCT
      st.artists->0->>'id' as spotify_artist_id,
      st.artists->0->>'name' as artist_name
    FROM karaoke_segments ks
    JOIN spotify_tracks st ON st.spotify_track_id = ks.spotify_track_id
    WHERE ks.fal_enhanced_grove_cid IS NOT NULL
      AND st.artists->0->>'id' IS NOT NULL
    ORDER BY st.artists->0->>'name'
  `);

  console.log(`   Found ${processedArtists.length} artists\n`);

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

    // 1b. DERIVATIVE IMAGES - Get fal-generated images from Grove
    // Note: image_source indicates SOURCE image location (spotify/genius), but grove_url is ALWAYS fal derivative
    const derivativeImage = await query(`
      SELECT grove_url, image_source
      FROM derivative_images
      WHERE spotify_artist_id = $1
        AND asset_type = 'artist'
      LIMIT 1
    `, [spotify_artist_id]);

    if (derivativeImage[0]) {
      agg.imageUrl = derivativeImage[0].grove_url;
      agg.imageSource = 'fal';  // Grove images are always fal derivatives
      console.log(`   ✅ Derivative image: fal (source: ${derivativeImage[0].image_source})`);
    } else {
      console.log(`   ⚠️  No derivative image (run step 12)`);
    }

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
    const mb = await query(`
      SELECT * FROM musicbrainz_artists
      WHERE TRIM(LOWER(name)) = TRIM(LOWER($1))
      LIMIT 1
    `, [artist_name]);

    if (mb[0]) {
      const m = mb[0];
      agg.mbid = m.artist_mbid;
      agg.artistType = m.artist_type;
      agg.gender = m.gender;
      agg.birthDate = m.birth_date;
      agg.country = m.country;

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
    } else {
      console.log(`   ⚠️  MusicBrainz: not found for "${artist_name.trim()}"`);
    }

    // 4. WIKIDATA - International library IDs and additional identifiers
    const wikidata = await query(`
      SELECT * FROM wikidata_artists
      WHERE spotify_artist_id = $1
      LIMIT 1
    `, [spotify_artist_id]);

    if (wikidata[0]) {
      const wd = wikidata[0];

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

      console.log(`   ✅ Wikidata: ${libraryIds.length} library IDs${libraryIds.length ? ` (${libraryIds.join(', ')})` : ''}`);
    } else {
      console.log(`   ⚠️  Wikidata: not found (run processor 05-enrich-wikidata)`);
    }

    // 5. QUANSIC - ISNI override
    const quansic = await query(`
      SELECT artists FROM quansic_recordings
      WHERE spotify_track_id IN (
        SELECT spotify_track_id FROM spotify_tracks
        WHERE artists->0->>'id' = $1
      )
      LIMIT 1
    `, [spotify_artist_id]);

    if (quansic[0]?.artists?.[0]?.ids?.isnis?.length) {
      const isnis = quansic[0].artists[0].ids.isnis;
      agg.isni = isnis[0];
      agg.isniAll = isnis.join(', ');
      console.log(`   ✅ Quansic: ISNI override ${agg.isni}`);
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
        myspace_url, spotify_url, deezer_url, tidal_url, apple_music_url, amazon_music_url,
        youtube_music_url, napster_url, yandex_music_url, boomplay_url, melon_url, qobuz_url,
        vimeo_url, imvdb_url, wikidata_url, viaf_url, imdb_url, allmusic_url, discogs_url,
        songkick_url, bandsintown_url, setlistfm_url, secondhandsongs_url,
        genius_url, lastfm_url, musixmatch_url,
        loc_url, bnf_url, dnb_url, worldcat_url, openlibrary_url,
        rateyourmusic_url, whosampled_url, jaxsta_url, themoviedb_url,
        beatport_url, itunes_url, official_website,
        image_url, header_image_url, image_source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47,
        $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69
      )
      ON CONFLICT (spotify_artist_id) DO UPDATE SET
        isni = EXCLUDED.isni, isni_all = EXCLUDED.isni_all, ipi_all = EXCLUDED.ipi_all,
        genius_artist_id = EXCLUDED.genius_artist_id,
        instagram_handle = EXCLUDED.instagram_handle, twitter_handle = EXCLUDED.twitter_handle,
        facebook_handle = EXCLUDED.facebook_handle, tiktok_handle = EXCLUDED.tiktok_handle,
        youtube_channel = EXCLUDED.youtube_channel, soundcloud_handle = EXCLUDED.soundcloud_handle,
        weibo_handle = EXCLUDED.weibo_handle, vk_handle = EXCLUDED.vk_handle,
        handle_conflicts = EXCLUDED.handle_conflicts,
        wikidata_url = EXCLUDED.wikidata_url, allmusic_url = EXCLUDED.allmusic_url,
        spotify_url = EXCLUDED.spotify_url,
        amazon_music_url = EXCLUDED.amazon_music_url, bandsintown_url = EXCLUDED.bandsintown_url,
        melon_url = EXCLUDED.melon_url, qobuz_url = EXCLUDED.qobuz_url,
        loc_url = EXCLUDED.loc_url,
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
      agg.urls.myspace_url, agg.urls.spotify_url, agg.urls.deezer_url, agg.urls.tidal_url, agg.urls.apple_music_url, agg.urls.amazon_music_url,
      agg.urls.youtube_music_url, agg.urls.napster_url, agg.urls.yandex_music_url, agg.urls.boomplay_url, agg.urls.melon_url, agg.urls.qobuz_url,
      agg.urls.vimeo_url, agg.urls.imvdb_url, agg.urls.wikidata_url, agg.urls.viaf_url, agg.urls.imdb_url, agg.urls.allmusic_url, agg.urls.discogs_url,
      agg.urls.songkick_url, agg.urls.bandsintown_url, agg.urls.setlistfm_url, agg.urls.secondhandsongs_url,
      agg.urls.genius_url, agg.urls.lastfm_url, agg.urls.musixmatch_url,
      agg.urls.loc_url, agg.urls.bnf_url, agg.urls.dnb_url, agg.urls.worldcat_url, agg.urls.openlibrary_url,
      agg.urls.rateyourmusic_url, agg.urls.whosampled_url, agg.urls.jaxsta_url, agg.urls.themoviedb_url,
      agg.urls.beatport_url, agg.urls.itunes_url, agg.urls.official_website,
      agg.imageUrl, agg.headerImageUrl, agg.imageSource
    ]);

    console.log(`   ✅ SAVED`);
  }

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
      COUNT(imdb_url) as with_imdb
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
  console.log('\n✅ Done!\n');
}

main().catch(console.error);
