/**
 * Genius Database Operations
 */

import type { GeniusSongData, GeniusFullArtistData, GeniusReferent } from '../services/genius';

export interface ProcessingLogData {
  spotify_track_id: string;
  stage: string;
  action: string;
  source?: string;
  message?: string;
  metadata?: Record<string, any>;
}

/**
 * Helper to escape SQL values
 */
function sqlEscape(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (Array.isArray(value)) {
    // Handle arrays - check if it's a text array or should be JSONB
    if (value.length === 0) return 'ARRAY[]::text[]';
    if (typeof value[0] === 'string') {
      return `ARRAY[${value.map(v => `'${String(v).replace(/'/g, "''")}'`).join(', ')}]`;
    }
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return String(value);
}

/**
 * Generate SQL for logging Genius processing
 */
export function logGeniusProcessingSQL(
  spotifyTrackId: string,
  action: 'success' | 'not_found' | 'error',
  message: string,
  metadata?: Record<string, any>
): string {
  const data: ProcessingLogData = {
    spotify_track_id: spotifyTrackId,
    stage: 'genius_enrichment',
    action,
    source: 'genius_api',
    message,
    metadata: metadata || null,
  };

  return `INSERT INTO processing_log (${Object.keys(data).join(', ')}) VALUES (${Object.values(data).map(v => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
    if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
    return String(v);
  }).join(', ')})`;
}

/**
 * Generate SQL to update pipeline with Genius IDs
 */
export function updatePipelineGeniusSQL(
  spotifyTrackId: string,
  geniusSongId: number,
  geniusArtistId: number,
  geniusUrl: string,
  geniusArtistName: string
): string {
  return `
    UPDATE song_pipeline
    SET
      genius_song_id = ${geniusSongId},
      genius_artist_id = ${geniusArtistId},
      genius_url = '${geniusUrl.replace(/'/g, "''")}',
      genius_artist_name = '${geniusArtistName.replace(/'/g, "''")}',
      updated_at = NOW()
    WHERE spotify_track_id = '${spotifyTrackId}'
  `.trim();
}

/**
 * Generate UPSERT SQL for genius_artists table
 */
export function upsertGeniusArtistSQL(artist: GeniusFullArtistData): string {
  return `
    INSERT INTO genius_artists (
      genius_artist_id,
      name,
      alternate_names,
      is_verified,
      is_meme_verified,
      followers_count,
      image_url,
      header_image_url,
      instagram_name,
      twitter_name,
      facebook_name,
      url,
      api_path,
      description,
      raw_data,
      updated_at
    ) VALUES (
      ${artist.genius_artist_id},
      ${sqlEscape(artist.name)},
      ${sqlEscape(artist.alternate_names)},
      ${sqlEscape(artist.is_verified)},
      ${sqlEscape(artist.is_meme_verified)},
      ${sqlEscape(artist.followers_count)},
      ${sqlEscape(artist.image_url)},
      ${sqlEscape(artist.header_image_url)},
      ${sqlEscape(artist.instagram_name)},
      ${sqlEscape(artist.twitter_name)},
      ${sqlEscape(artist.facebook_name)},
      ${sqlEscape(artist.url)},
      ${sqlEscape(artist.api_path)},
      ${sqlEscape(artist.description)},
      ${sqlEscape(artist.raw_data)},
      NOW()
    )
    ON CONFLICT (genius_artist_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      alternate_names = EXCLUDED.alternate_names,
      is_verified = EXCLUDED.is_verified,
      is_meme_verified = EXCLUDED.is_meme_verified,
      followers_count = EXCLUDED.followers_count,
      image_url = EXCLUDED.image_url,
      header_image_url = EXCLUDED.header_image_url,
      instagram_name = EXCLUDED.instagram_name,
      twitter_name = EXCLUDED.twitter_name,
      facebook_name = EXCLUDED.facebook_name,
      url = EXCLUDED.url,
      api_path = EXCLUDED.api_path,
      description = EXCLUDED.description,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
  `.trim();
}

/**
 * Generate UPSERT SQL for genius_songs table
 */
export function upsertGeniusSongSQL(song: GeniusSongData): string {
  // Handle spotify_track_id - if empty string or undefined, use NULL
  const spotifyTrackId = song.spotify_track_id && song.spotify_track_id.trim()
    ? sqlEscape(song.spotify_track_id)
    : 'NULL';

  return `
    INSERT INTO genius_songs (
      genius_song_id,
      spotify_track_id,
      title,
      artist_name,
      genius_artist_id,
      url,
      language,
      release_date,
      lyrics_state,
      annotation_count,
      pyongs_count,
      apple_music_id,
      description,
      raw_data,
      updated_at
    ) VALUES (
      ${song.genius_song_id},
      ${spotifyTrackId},
      ${sqlEscape(song.title)},
      ${sqlEscape(song.artist_name)},
      ${song.genius_artist_id},
      ${sqlEscape(song.url)},
      ${sqlEscape(song.language)},
      ${sqlEscape(song.release_date)},
      ${sqlEscape(song.lyrics_state)},
      ${song.annotation_count},
      ${song.pyongs_count},
      ${sqlEscape(song.apple_music_id)},
      ${sqlEscape(song.description)},
      ${sqlEscape(song.raw_data)},
      NOW()
    )
    ON CONFLICT (genius_song_id)
    DO UPDATE SET
      spotify_track_id = EXCLUDED.spotify_track_id,
      title = EXCLUDED.title,
      artist_name = EXCLUDED.artist_name,
      genius_artist_id = EXCLUDED.genius_artist_id,
      url = EXCLUDED.url,
      language = EXCLUDED.language,
      release_date = EXCLUDED.release_date,
      lyrics_state = EXCLUDED.lyrics_state,
      annotation_count = EXCLUDED.annotation_count,
      pyongs_count = EXCLUDED.pyongs_count,
      apple_music_id = EXCLUDED.apple_music_id,
      description = EXCLUDED.description,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
  `.trim();
}

/**
 * Generate UPSERT SQL for genius_song_referents table
 */
export function upsertGeniusReferentSQL(referent: GeniusReferent): string {
  return `
    INSERT INTO genius_song_referents (
      referent_id,
      genius_song_id,
      fragment,
      classification,
      votes_total,
      comment_count,
      is_verified,
      annotator_id,
      annotator_login,
      url,
      path,
      api_path,
      annotations,
      raw_data,
      updated_at
    ) VALUES (
      ${referent.referent_id},
      ${referent.genius_song_id},
      ${sqlEscape(referent.fragment)},
      ${sqlEscape(referent.classification)},
      ${referent.votes_total},
      ${referent.comment_count},
      ${sqlEscape(referent.is_verified)},
      ${sqlEscape(referent.annotator_id)},
      ${sqlEscape(referent.annotator_login)},
      ${sqlEscape(referent.url)},
      ${sqlEscape(referent.path)},
      ${sqlEscape(referent.api_path)},
      ${sqlEscape(referent.annotations)},
      ${sqlEscape(referent.raw_data)},
      NOW()
    )
    ON CONFLICT (referent_id)
    DO UPDATE SET
      fragment = EXCLUDED.fragment,
      classification = EXCLUDED.classification,
      votes_total = EXCLUDED.votes_total,
      comment_count = EXCLUDED.comment_count,
      is_verified = EXCLUDED.is_verified,
      annotator_id = EXCLUDED.annotator_id,
      annotator_login = EXCLUDED.annotator_login,
      url = EXCLUDED.url,
      path = EXCLUDED.path,
      api_path = EXCLUDED.api_path,
      annotations = EXCLUDED.annotations,
      raw_data = EXCLUDED.raw_data,
      updated_at = NOW()
  `.trim();
}
