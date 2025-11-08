-- Migration 048: Drop Empty Artist Columns
--
-- Purpose: Remove 23 columns from grc20_artists with ZERO data
-- This reduces database size and prevents confusion about what data we track
--
-- IMPORTANT: Only dropping columns with 0/52 data coverage
-- Keeping yandex_music_url (3 artists) and boomplay_url (4 artists)
--
-- Analysis: See grc20-v2/COLUMN-ANALYSIS.md

BEGIN;

-- Step 1: Drop dependent view
DROP VIEW IF EXISTS grc20_artists_with_accounts;

-- Step 2: Drop columns with ZERO data (23 columns)
ALTER TABLE grc20_artists
  DROP COLUMN IF EXISTS sort_name,
  DROP COLUMN IF EXISTS disambiguation,
  DROP COLUMN IF EXISTS image_url,              -- Replaced by grove_image_url
  DROP COLUMN IF EXISTS image_source,
  DROP COLUMN IF EXISTS death_date,
  DROP COLUMN IF EXISTS vimeo_url,
  DROP COLUMN IF EXISTS snac_url,
  DROP COLUMN IF EXISTS ibdb_url,
  DROP COLUMN IF EXISTS goodreads_url,
  DROP COLUMN IF EXISTS librarything_url,
  DROP COLUMN IF EXISTS junodownload_url,
  DROP COLUMN IF EXISTS bandsintown_url_alt,
  DROP COLUMN IF EXISTS maniadb_url,
  DROP COLUMN IF EXISTS mora_url,
  DROP COLUMN IF EXISTS cdjapan_url,
  DROP COLUMN IF EXISTS livefans_url,
  DROP COLUMN IF EXISTS vgmdb_url,
  DROP COLUMN IF EXISTS blog_url,
  DROP COLUMN IF EXISTS bbc_music_url,
  DROP COLUMN IF EXISTS musicmoz_url,
  DROP COLUMN IF EXISTS musik_sammler_url,
  DROP COLUMN IF EXISTS muziekweb_url,
  DROP COLUMN IF EXISTS spirit_of_rock_url;

-- NOTE: Keeping yandex_music_url (3 artists) and boomplay_url (4 artists) - they have data!

-- Step 3: Recreate view without dropped columns
CREATE VIEW grc20_artists_with_accounts AS
SELECT
  ga.id,
  ga.name,
  ga.isni,
  ga.isni_all,
  ga.ipi_all,
  ga.mbid,
  ga.spotify_artist_id,
  ga.genius_artist_id,
  ga.discogs_id,
  ga.artist_type,
  ga.gender,
  ga.birth_date,
  ga.country,
  ga.genres,
  ga.is_verified,
  ga.instagram_handle,
  ga.twitter_handle,
  ga.facebook_handle,
  ga.tiktok_handle,
  ga.youtube_channel,
  ga.soundcloud_handle,
  ga.deezer_url,
  ga.tidal_url,
  ga.apple_music_url,
  ga.amazon_music_url,
  ga.youtube_music_url,
  ga.yandex_music_url,
  ga.boomplay_url,
  ga.wikidata_url,
  ga.viaf_url,
  ga.imdb_url,
  ga.allmusic_url,
  ga.discogs_url,
  ga.songkick_url,
  ga.bandsintown_url,
  ga.setlistfm_url,
  ga.secondhandsongs_url,
  ga.lastfm_url,
  ga.imvdb_url,
  ga.loc_url,
  ga.bnf_url,
  ga.dnb_url,
  ga.worldcat_url,
  ga.openlibrary_url,
  ga.rateyourmusic_url,
  ga.whosampled_url,
  ga.jaxsta_url,
  ga.themoviedb_url,
  ga.beatport_url,
  ga.itunes_url,
  ga.qobuz_url,
  ga.melon_url,
  ga.official_website,
  ga.header_image_url,
  ga.created_at,
  ga.updated_at,
  ga.aliases,
  ga.handle_conflicts,
  ga.handle_overrides,
  ga.weibo_handle,
  ga.vk_handle,
  ga.labels,
  ga.wikidata_identifiers,
  ga.myspace_url,
  ga.spotify_url,
  ga.napster_url,
  ga.genius_url,
  ga.musixmatch_url,
  ga.member_of_groups,
  ga.grove_image_cid,
  ga.grove_image_url,
  ga.grove_header_image_cid,
  ga.grove_header_image_url,
  ga.wikidata_id,
  ga.viaf_id,
  ga.gnd_id,
  ga.bnf_id,
  ga.loc_id,
  ga.songmeanings_url,
  ga.pkp_account_id,
  ga.lens_account_id,
  ga.grc20_entity_id,
  ga.minted_at,
  pkp.pkp_address,
  pkp.pkp_token_id,
  pkp.pkp_public_key,
  pkp.minted_at AS pkp_minted_at,
  lens.lens_handle,
  lens.lens_account_address,
  lens.lens_account_id AS lens_account_id_text,
  lens.lens_metadata_uri,
  lens.created_at_chain AS lens_created_at
FROM grc20_artists ga
LEFT JOIN pkp_accounts pkp ON ga.pkp_account_id = pkp.id
LEFT JOIN lens_accounts lens ON ga.lens_account_id = lens.id;

-- Verify columns were dropped
SELECT
  COUNT(*) as remaining_columns,
  106 - COUNT(*) as dropped_columns
FROM information_schema.columns
WHERE table_name = 'grc20_artists';

COMMIT;
