/**
 * Artist Value Builder for GRC-20 Entities
 *
 * This module builds property-value pairs for artist entities in the GRC-20 space.
 * It handles:
 * - Type conversions (JSONB -> string, numbers -> string)
 * - Data cleaning (null/empty checks, trimming)
 * - Format standardization (Lens handles with @ prefix, etc.)
 *
 * Usage:
 *   const values = buildArtistValues(artistRow);
 *   Graph.updateEntity({ id: entityId, values });
 *
 * Property Exclusions:
 * - artistWikipediaUrls: Too large (70+ languages), use single preferred URL instead
 * - artistExternalIds: Redundant, individual URLs already extracted
 * - artistLibraryIds: Redundant, use separate VIAF/BNF/GND/LOC properties
 */

import {
  GRC20_PROPERTY_IDS,
} from '../../../config/grc20-space';

export interface ArtistMetadataRow {
  id: number;
  name: string;
  sort_name: string | null;
  alternate_names: string | null;
  discogs_id: string | null;
  isni: string | null;
  isni_all: string | null;
  spotify_artist_id: string | null;
  spotify_url: string | null;
  genius_artist_id: number | null;
  genius_url: string | null;
  wikidata_url: string | null;
  genres: string | null;
  country: string | null;
  artist_type: string | null;
  image_url: string | null;
  image_grove_url: string | null;
  official_website: string | null;
  instagram_url: string | null;
  twitter_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  soundcloud_url: string | null;
  bandcamp_url: string | null;
  songkick_url: string | null;
  setlistfm_url: string | null;
  lastfm_url: string | null;
  pitchfork_url: string | null;
  songfacts_url: string | null;
  musixmatch_url: string | null;
  rateyourmusic_url: string | null;
  discogs_url: string | null;
  allmusic_url: string | null;
  imdb_url: string | null;
  facebook_url: string | null;
  deezer_url: string | null;
  apple_music_url: string | null;
  weibo_url: string | null;
  vk_url: string | null;
  subreddit_url: string | null;
  carnegie_hall_url: string | null;
  wikipedia_url: string | null;
  wikipedia_urls: Record<string, string> | null;
  library_ids: Record<string, any> | null;
  external_ids: Record<string, any> | null;
  lens_handle: string | null;
  viaf_id: string | null;
  bnf_id: string | null;
  gnd_id: string | null;
  loc_id: string | null;
  aliases: Record<string, string[]> | null;
}

type PropertyValue = { property: string; value: string };

export const ARTIST_MANAGED_PROPERTY_IDS: string[] = [
  GRC20_PROPERTY_IDS.artistIsni,
  GRC20_PROPERTY_IDS.artistIsniAll,
  GRC20_PROPERTY_IDS.artistSpotifyId,
  GRC20_PROPERTY_IDS.artistSpotifyUrl,
  GRC20_PROPERTY_IDS.artistGeniusId,
  GRC20_PROPERTY_IDS.artistGeniusUrl,
  GRC20_PROPERTY_IDS.artistWikidataUrl,
  GRC20_PROPERTY_IDS.artistGenres,
  GRC20_PROPERTY_IDS.artistCountry,
  GRC20_PROPERTY_IDS.artistType,
  GRC20_PROPERTY_IDS.artistGroveImageUrl,
  GRC20_PROPERTY_IDS.artistOfficialWebsite,
  GRC20_PROPERTY_IDS.artistInstagramUrl,
  GRC20_PROPERTY_IDS.artistTwitterUrl,
  GRC20_PROPERTY_IDS.artistTiktokUrl,
  GRC20_PROPERTY_IDS.artistYoutubeUrl,
  GRC20_PROPERTY_IDS.artistSoundcloudUrl,
  GRC20_PROPERTY_IDS.artistFacebookUrl,
  GRC20_PROPERTY_IDS.artistDeezerUrl,
  GRC20_PROPERTY_IDS.artistAppleMusicUrl,
  GRC20_PROPERTY_IDS.artistWikipediaUrl,
  // Skip artistWikipediaUrls - too large (70+ languages)
  GRC20_PROPERTY_IDS.artistLensHandle,
  GRC20_PROPERTY_IDS.artistLibraryIds,
  // Skip artistExternalIds - redundant with individual URL fields
  GRC20_PROPERTY_IDS.artistViafId,
  GRC20_PROPERTY_IDS.artistBnfId,
  GRC20_PROPERTY_IDS.artistGndId,
  GRC20_PROPERTY_IDS.artistLocId,
  GRC20_PROPERTY_IDS.artistAliases,
  GRC20_PROPERTY_IDS.artistAlternateNames,
  GRC20_PROPERTY_IDS.artistDiscogsId,
  GRC20_PROPERTY_IDS.artistBandcampUrl,
  GRC20_PROPERTY_IDS.artistSongkickUrl,
  GRC20_PROPERTY_IDS.artistSetlistfmUrl,
  GRC20_PROPERTY_IDS.artistLastfmUrl,
  GRC20_PROPERTY_IDS.artistPitchforkUrl,
  GRC20_PROPERTY_IDS.artistSongfactsUrl,
  GRC20_PROPERTY_IDS.artistMusixmatchUrl,
  GRC20_PROPERTY_IDS.artistRateyourmusicUrl,
  GRC20_PROPERTY_IDS.artistDiscogsUrl,
  GRC20_PROPERTY_IDS.artistAllmusicUrl,
  GRC20_PROPERTY_IDS.artistImdbUrl,
  GRC20_PROPERTY_IDS.artistWeiboUrl,
  GRC20_PROPERTY_IDS.artistVkUrl,
  GRC20_PROPERTY_IDS.artistSubredditUrl,
  GRC20_PROPERTY_IDS.artistCarnegieHallUrl,
];

function pushStringValue(values: PropertyValue[], property: string, value: string | null) {
  if (value && value.trim().length > 0) {
    values.push({ property, value });
  }
}

function pushNumberValue(values: PropertyValue[], property: string, value: number | null) {
  if (value !== null && value !== undefined) {
    values.push({ property, value: value.toString() });
  }
}

function pushJsonValue(values: PropertyValue[], property: string, value: Record<string, any> | any[] | null) {
  if (!value) return;
  if (Array.isArray(value) && value.length === 0) return;
  if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) return;

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  pushStringValue(values, property, serialized);
}

export function buildArtistValues(artist: ArtistMetadataRow): PropertyValue[] {
  const values: PropertyValue[] = [];
  const spotifyUrl = artist.spotify_url ?? (artist.spotify_artist_id ? `https://open.spotify.com/artist/${artist.spotify_artist_id}` : null);
  const preferredWikipediaUrl = artist.wikipedia_url
    ?? artist.wikipedia_urls?.en
    ?? artist.wikipedia_urls?.enwiki
    ?? null;

  pushStringValue(values, GRC20_PROPERTY_IDS.artistIsni, artist.isni);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistIsniAll, artist.isni_all);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistSpotifyId, artist.spotify_artist_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistSpotifyUrl, spotifyUrl);
  pushNumberValue(values, GRC20_PROPERTY_IDS.artistGeniusId, artist.genius_artist_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistGeniusUrl, artist.genius_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistWikidataUrl, artist.wikidata_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistGenres, artist.genres);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistCountry, artist.country);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistType, artist.artist_type);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistGroveImageUrl, artist.image_grove_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistOfficialWebsite, artist.official_website);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistInstagramUrl, artist.instagram_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistTwitterUrl, artist.twitter_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistTiktokUrl, artist.tiktok_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistYoutubeUrl, artist.youtube_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistSoundcloudUrl, artist.soundcloud_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistFacebookUrl, artist.facebook_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistDeezerUrl, artist.deezer_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistAppleMusicUrl, artist.apple_music_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistWikipediaUrl, preferredWikipediaUrl);
  // Skip wikipedia_urls - too large, queryable from Wikidata
  const lensHandle = artist.lens_handle
    ? artist.lens_handle.startsWith('@') ? artist.lens_handle : `@${artist.lens_handle}`
    : null;
  pushStringValue(values, GRC20_PROPERTY_IDS.artistLensHandle, lensHandle);
  pushJsonValue(values, GRC20_PROPERTY_IDS.artistLibraryIds, artist.library_ids);
  // Skip external_ids - redundant, individual URLs already extracted
  pushStringValue(values, GRC20_PROPERTY_IDS.artistViafId, artist.viaf_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistBnfId, artist.bnf_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistGndId, artist.gnd_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistLocId, artist.loc_id);
  pushJsonValue(values, GRC20_PROPERTY_IDS.artistAliases, artist.aliases);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistAlternateNames, artist.alternate_names);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistDiscogsId, artist.discogs_id);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistBandcampUrl, artist.bandcamp_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistSongkickUrl, artist.songkick_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistSetlistfmUrl, artist.setlistfm_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistLastfmUrl, artist.lastfm_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistPitchforkUrl, artist.pitchfork_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistSongfactsUrl, artist.songfacts_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistMusixmatchUrl, artist.musixmatch_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistRateyourmusicUrl, artist.rateyourmusic_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistDiscogsUrl, artist.discogs_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistAllmusicUrl, artist.allmusic_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistImdbUrl, artist.imdb_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistWeiboUrl, artist.weibo_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistVkUrl, artist.vk_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistSubredditUrl, artist.subreddit_url);
  pushStringValue(values, GRC20_PROPERTY_IDS.artistCarnegieHallUrl, artist.carnegie_hall_url);

  return values;
}
