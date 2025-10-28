/**
 * Database to GRC-20 Mapping Utilities
 *
 * Transforms database rows from multiple tables into validated GRC-20 entities
 */

import type postgres from 'postgres';
import {
  MusicalArtistMintSchema,
  MusicalWorkMintSchema,
  AudioRecordingMintSchema,
  validateBatch,
  formatValidationError,
  type MusicalArtistMint,
  type MusicalWorkMint,
} from '../types/validation-schemas';

// ============ Type Definitions ============

/**
 * Row from grc20_artists corroboration table (post-ETL)
 * This replaces the old EnrichedArtistRow with pre-corroborated data
 */
export interface CorroboratedArtistRow {
  // Core
  name: string;
  alternate_names?: string[];
  sort_name?: string;

  // External IDs
  genius_artist_id: number;
  mbid?: string;
  spotify_artist_id?: string;
  wikidata_id?: string;
  discogs_id?: string;
  isni?: string;
  ipi?: string;

  // Social media
  instagram_handle?: string;
  tiktok_handle?: string;
  twitter_handle?: string;
  facebook_handle?: string;
  youtube_channel?: string;
  soundcloud_handle?: string;

  // URLs
  spotify_url?: string;
  genius_url?: string;

  // Images
  image_url?: string;
  image_source?: string;
  header_image_url?: string;

  // Biographical
  artist_type?: string;
  country?: string;
  gender?: string;
  birth_date?: string;
  death_date?: string;
  disambiguation?: string;

  // Genres/Popularity
  genres?: string[];
  spotify_followers?: number;
  spotify_popularity?: number;

  // Quality metrics
  completeness_score?: number;
  consensus_score?: number;
  ready_to_mint?: boolean;
}

// Keep old interface for legacy reference
export interface EnrichedArtistRow {
  // Genius
  genius_artist_id: number;
  genius_name: string;
  alternate_names?: string[];
  genius_url?: string;
  instagram_name?: string;
  twitter_name?: string;
  facebook_name?: string;
  followers_count?: number;
  is_verified?: boolean;
  image_url?: string;
  header_image_url?: string;

  // Spotify
  spotify_artist_id?: string;
  spotify_name?: string;
  genres?: string[];
  spotify_popularity?: number;
  spotify_followers?: number;

  // MusicBrainz
  mbid?: string;
  mb_name?: string;
  sort_name?: string;
  type?: string;
  isnis?: string[];
  ipi?: string;
  country?: string;
  gender?: string;
  birth_date?: Date;
  death_date?: Date;
  disambiguation?: string;
  tiktok_handle?: string;
  instagram_handle?: string;
  twitter_handle?: string;
  facebook_handle?: string;
  youtube_channel?: string;
  soundcloud_handle?: string;
  wikidata_id?: string;
  genius_slug?: string;
  discogs_id?: string;

  // Generated Images
  generated_image_url?: string;
}

export interface EnrichedWorkRow {
  genius_song_id: number;
  title: string;
  artist_name: string;
  genius_artist_id: number;
  url?: string;
  language?: string;
  release_date?: Date;
  annotation_count?: number;
  pyongs_count?: number;
  apple_music_id?: string;
  spotify_track_id?: string;

  // Composers (from separate join)
  composer_mbids?: string[];
}

// ============ Query Builders ============

/**
 * Query corroborated artists from grc20_artists table
 * This replaces the old multi-table JOIN approach with pre-corroborated data
 */
export function buildCorroboratedArtistsQuery(limit = 1000) {
  return `
    SELECT
      -- Core
      name,
      alternate_names,
      sort_name,

      -- External IDs
      genius_artist_id,
      mbid,
      spotify_artist_id,
      wikidata_id,
      discogs_id,
      isni,
      ipi,

      -- Social media
      instagram_handle,
      tiktok_handle,
      twitter_handle,
      facebook_handle,
      youtube_channel,
      soundcloud_handle,

      -- URLs
      spotify_url,
      genius_url,

      -- Images
      image_url,
      image_source,
      header_image_url,

      -- Biographical
      artist_type,
      country,
      gender,
      birth_date,
      death_date,
      disambiguation,

      -- Genres/Popularity
      genres,
      spotify_followers,
      spotify_popularity,

      -- Quality metrics
      completeness_score,
      consensus_score

    FROM grc20_artists
    WHERE ready_to_mint = TRUE
      AND grc20_entity_id IS NULL  -- Not already minted
    ORDER BY completeness_score DESC, consensus_score DESC
    LIMIT $1
  `;
}

/**
 * Legacy query builder (kept for reference)
 * @deprecated Use buildCorroboratedArtistsQuery instead
 */
export function buildEnrichedArtistsQuery(limit = 1000) {
  return `
    SELECT
      -- Genius (primary)
      ga.genius_artist_id,
      ga.name as genius_name,
      ga.alternate_names,
      ga.url as genius_url,
      ga.instagram_name,
      ga.twitter_name,
      ga.facebook_name,
      ga.followers_count,
      ga.is_verified,
      ga.image_url as genius_image_url,
      ga.header_image_url,

      -- Spotify
      sa.spotify_artist_id,
      sa.name as spotify_name,
      sa.genres,
      sa.popularity as spotify_popularity,
      sa.followers as spotify_followers,

      -- MusicBrainz
      ma.mbid,
      ma.name as mb_name,
      ma.sort_name,
      ma.type,
      ma.isnis,
      ma.ipi,
      ma.country,
      ma.gender,
      ma.birth_date,
      ma.death_date,
      ma.disambiguation,
      ma.tiktok_handle,
      ma.instagram_handle,
      ma.twitter_handle,
      ma.facebook_handle,
      ma.youtube_channel,
      ma.soundcloud_handle,
      ma.wikidata_id,
      ma.genius_slug,
      ma.discogs_id,

      -- Generated Images
      ai.generated_image_url

    FROM genius_artists ga
    LEFT JOIN spotify_artists sa
      ON sa.spotify_artist_id = (
        SELECT spotify_artist_id
        FROM musicbrainz_artists
        WHERE genius_slug = LOWER(REGEXP_REPLACE(ga.url, 'https://genius.com/artists/', ''))
        LIMIT 1
      )
    LEFT JOIN musicbrainz_artists ma
      ON ma.genius_slug = LOWER(REGEXP_REPLACE(ga.url, 'https://genius.com/artists/', ''))
    LEFT JOIN artist_images ai
      ON ai.spotify_artist_id = sa.spotify_artist_id
      AND ai.status = 'completed'

    WHERE ga.genius_artist_id IS NOT NULL
    LIMIT $1
  `;
}

// ============ Mappers ============

/**
 * Map corroborated artist row to GRC-20 mint format
 * This is simpler than the old mapper since data is already resolved
 */
export function mapCorroboratedArtistToMint(row: CorroboratedArtistRow): MusicalArtistMint {
  const mapped = {
    // Core
    name: row.name,
    geniusId: row.genius_artist_id,

    // External IDs
    spotifyId: row.spotify_artist_id || undefined,
    mbid: row.mbid || undefined,
    wikidataId: row.wikidata_id || undefined,
    discogsId: row.discogs_id || undefined,

    // Industry IDs
    isni: row.isni || undefined,
    ipi: row.ipi || undefined,

    // Alternate names
    alternateNames: row.alternate_names,
    sortName: row.sort_name || undefined,
    disambiguation: row.disambiguation || undefined,

    // Social media (already resolved)
    instagramHandle: row.instagram_handle || undefined,
    tiktokHandle: row.tiktok_handle || undefined,
    twitterHandle: row.twitter_handle || undefined,
    facebookHandle: row.facebook_handle || undefined,
    youtubeChannel: row.youtube_channel || undefined,
    soundcloudHandle: row.soundcloud_handle || undefined,

    // URLs (already constructed)
    geniusUrl: row.genius_url || undefined,
    spotifyUrl: row.spotify_url || undefined,
    appleMusicUrl: undefined, // TODO: Add if we have Apple Music IDs

    // Images (already resolved via Fal > Spotify > Genius priority)
    imageUrl: row.image_url || undefined,
    headerImageUrl: row.header_image_url || undefined,

    // Biographical
    type: row.artist_type as any,
    country: row.country || undefined,
    gender: row.gender as any,
    birthDate: typeof row.birth_date === 'string' ? row.birth_date : (row.birth_date as any)?.toISOString?.()?.split('T')[0],
    deathDate: typeof row.death_date === 'string' ? row.death_date : (row.death_date as any)?.toISOString?.()?.split('T')[0],

    // Popularity
    genres: row.genres,
    spotifyFollowers: row.spotify_followers || undefined,
    spotifyPopularity: row.spotify_popularity || undefined,
    geniusFollowers: undefined, // Not in corroboration table
    isVerified: undefined, // Not in corroboration table

    // App-specific (will be added later via update)
    lensAccount: undefined,
  };

  return mapped as MusicalArtistMint;
}

/**
 * Legacy mapper for old EnrichedArtistRow
 * @deprecated Use mapCorroboratedArtistToMint instead
 */
export function mapArtistRowToMint(row: EnrichedArtistRow): MusicalArtistMint {
  // Build Genius URL from artist ID if not present
  const geniusUrl = row.genius_url ||
    (row.genius_slug ? `https://genius.com/artists/${row.genius_slug}` : undefined);

  const mapped = {
    // Core
    name: row.genius_name || row.mb_name || row.spotify_name || 'Unknown Artist',
    geniusId: row.genius_artist_id,

    // External IDs
    spotifyId: row.spotify_artist_id,
    mbid: row.mbid,
    wikidataId: row.wikidata_id,
    discogsId: row.discogs_id,

    // Industry IDs
    isni: row.isnis?.[0], // Take first ISNI if multiple
    ipi: row.ipi,

    // Alternate names
    alternateNames: row.alternate_names,
    sortName: row.sort_name,
    disambiguation: row.disambiguation,

    // Social media (prefer MusicBrainz, fallback to Genius, convert empty strings to undefined)
    instagramHandle: row.instagram_handle || row.instagram_name || undefined,
    tiktokHandle: row.tiktok_handle || undefined,
    twitterHandle: row.twitter_handle || row.twitter_name || undefined,
    facebookHandle: row.facebook_handle || row.facebook_name || undefined,
    youtubeChannel: row.youtube_channel || undefined,
    soundcloudHandle: row.soundcloud_handle || undefined,

    // URLs
    geniusUrl,
    spotifyUrl: row.spotify_artist_id
      ? `https://open.spotify.com/artist/${row.spotify_artist_id}`
      : undefined,
    appleMusicUrl: undefined, // TODO: Add if we have Apple Music IDs

    // Images (prioritize generated Grove image)
    imageUrl: row.generated_image_url || row.image_url,
    headerImageUrl: row.header_image_url,

    // Biographical
    type: row.type as any,
    country: row.country,
    gender: row.gender as any,
    birthDate: row.birth_date?.toISOString().split('T')[0],
    deathDate: row.death_date?.toISOString().split('T')[0],

    // Popularity
    genres: row.genres,
    spotifyFollowers: row.spotify_followers,
    spotifyPopularity: row.spotify_popularity,
    geniusFollowers: row.followers_count,
    isVerified: row.is_verified,

    // App-specific (will be added later via update)
    lensAccount: undefined,
  };

  return mapped as MusicalArtistMint;
}

export function mapWorkRowToMint(row: EnrichedWorkRow): MusicalWorkMint {
  const geniusUrl = row.url || `https://genius.com/songs/${row.genius_song_id}`;

  const mapped = {
    // Core
    title: row.title,
    geniusId: row.genius_song_id,
    geniusUrl,

    // External IDs
    spotifyId: row.spotify_track_id,
    appleMusicId: row.apple_music_id,
    wikidataId: undefined, // TODO: Add if we link to Wikidata

    // Industry IDs
    iswc: undefined, // TODO: Join with musicbrainz_works

    // Composers (required)
    composerMbids: row.composer_mbids || [],

    // Metadata
    language: row.language,
    releaseDate: row.release_date?.toISOString().split('T')[0],

    // Popularity
    geniusAnnotationCount: row.annotation_count,
    geniusPyongsCount: row.pyongs_count,
  };

  return mapped as MusicalWorkMint;
}

// ============ Batch Processing ============

/**
 * Fetch and validate corroborated artists (ready to mint)
 * This replaces the old approach with pre-validated data from grc20_artists
 */
export async function fetchAndValidateArtists(
  sql: ReturnType<typeof postgres>,
  limit = 1000
) {
  console.log(`🔍 Fetching ${limit} ready-to-mint artists from grc20_artists...`);

  const query = buildCorroboratedArtistsQuery(limit);
  const rows = await sql.unsafe<CorroboratedArtistRow[]>(query, [limit]);

  console.log(`📊 Fetched ${rows.length} corroborated artists (completeness: ${rows[0]?.completeness_score || 'N/A'})`);
  console.log(`   Mapping to GRC-20 format...`);

  const mappedArtists = rows.map(mapCorroboratedArtistToMint);

  console.log(`✅ Validating with Zod schemas...`);

  const result = validateBatch(mappedArtists, MusicalArtistMintSchema);

  console.log(`
📊 Validation Results:
   Total Artists: ${result.stats.total}
   ✅ Valid: ${result.stats.validCount} (${result.stats.validPercent}%)
   ❌ Invalid: ${result.stats.invalidCount}
  `);

  if (result.invalid.length > 0) {
    console.log(`\n⚠️  First 5 validation errors:`);
    result.invalid.slice(0, 5).forEach(({ item, errors }) => {
      console.log(`\n   ${item.name}:`);
      console.log(formatValidationError(errors).split('\n').map(l => `   ${l}`).join('\n'));
    });
  }

  return result;
}

export async function fetchAndValidateWorks(
  sql: ReturnType<typeof postgres>,
  limit = 1000
) {
  console.log(`🔍 Fetching ${limit} works from database...`);

  // TODO: Build enriched works query with composer links
  const rows = await sql<EnrichedWorkRow[]>`
    SELECT
      gs.genius_song_id,
      gs.title,
      gs.artist_name,
      gs.genius_artist_id,
      gs.url,
      gs.language,
      gs.release_date,
      gs.annotation_count,
      gs.pyongs_count,
      gs.apple_music_id,
      gs.spotify_track_id
    FROM genius_songs gs
    WHERE gs.genius_song_id IS NOT NULL
    LIMIT ${limit}
  `;

  console.log(`📊 Fetched ${rows.length} works, mapping to GRC-20 format...`);

  // For each work, fetch composers (simplified - assumes 1 composer = primary artist)
  const worksWithComposers = await Promise.all(
    rows.map(async (row) => {
      // Get MBID for primary artist
      const composer = await sql<{ mbid?: string }[]>`
        SELECT mbid
        FROM musicbrainz_artists ma
        JOIN genius_artists ga ON ga.url = 'https://genius.com/artists/' || ma.genius_slug
        WHERE ga.genius_artist_id = ${row.genius_artist_id}
        LIMIT 1
      `;

      return {
        ...row,
        composer_mbids: composer[0]?.mbid ? [composer[0].mbid] : [],
      };
    })
  );

  const mappedWorks = worksWithComposers.map(mapWorkRowToMint);

  console.log(`✅ Validating with Zod schemas...`);

  const result = validateBatch(mappedWorks, MusicalWorkMintSchema);

  console.log(`
📊 Validation Results:
   Total Works: ${result.stats.total}
   ✅ Valid: ${result.stats.validCount} (${result.stats.validPercent}%)
   ❌ Invalid: ${result.stats.invalidCount}
  `);

  if (result.invalid.length > 0) {
    console.log(`\n⚠️  First 5 validation errors:`);
    result.invalid.slice(0, 5).forEach(({ item, errors }) => {
      console.log(`\n   ${item.title}:`);
      console.log(formatValidationError(errors).split('\n').map(l => `   ${l}`).join('\n'));
    });
  }

  return result;
}
