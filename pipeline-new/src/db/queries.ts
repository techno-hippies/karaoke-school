/**
 * Type-Safe Database Queries
 *
 * CRUD operations for all entities.
 */

import { query, queryOne } from './connection';
import type {
  Account,
  Artist,
  Song,
  Lyric,
  GeniusReferent,
  Clip,
  Video,
  Post,
  Exercise,
  ParsedLine,
  WordTiming,
  SpotifyImage,
  AlignmentData,
  QuestionData,
  ExerciseType,
} from '../types';

// ============================================================================
// ACCOUNTS
// ============================================================================

export interface CreateAccountData {
  handle: string;
  display_name: string;
  avatar_grove_url?: string;
  bio?: string;
  account_type: 'ai' | 'human';
  pkp_address?: string;
  pkp_token_id?: string;
  pkp_public_key?: string;
  pkp_network?: string;
  lens_handle?: string;
  lens_account_address?: string;
  lens_account_id?: string;
  lens_metadata_uri?: string;
  lens_transaction_hash?: string;
}

export async function createAccount(data: CreateAccountData): Promise<Account> {
  const result = await query<Account>(
    `INSERT INTO accounts (
      handle, display_name, avatar_grove_url, bio, account_type,
      pkp_address, pkp_token_id, pkp_public_key, pkp_network,
      lens_handle, lens_account_address, lens_account_id, lens_metadata_uri, lens_transaction_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      data.handle,
      data.display_name,
      data.avatar_grove_url || null,
      data.bio || null,
      data.account_type,
      data.pkp_address || null,
      data.pkp_token_id || null,
      data.pkp_public_key || null,
      data.pkp_network || null,
      data.lens_handle || null,
      data.lens_account_address || null,
      data.lens_account_id || null,
      data.lens_metadata_uri || null,
      data.lens_transaction_hash || null,
    ]
  );
  return result[0];
}

export async function getAccountByHandle(handle: string): Promise<Account | null> {
  return queryOne<Account>(
    `SELECT * FROM accounts WHERE handle = $1`,
    [handle]
  );
}

export async function updateAccountPkp(
  handle: string,
  data: {
    pkp_address: string;
    pkp_token_id: string;
    pkp_public_key: string;
    pkp_network: string;
  }
): Promise<Account | null> {
  const result = await query<Account>(
    `UPDATE accounts SET
      pkp_address = $2,
      pkp_token_id = $3,
      pkp_public_key = $4,
      pkp_network = $5,
      updated_at = NOW()
    WHERE handle = $1
    RETURNING *`,
    [
      handle,
      data.pkp_address,
      data.pkp_token_id,
      data.pkp_public_key,
      data.pkp_network,
    ]
  );
  return result[0] || null;
}

export async function updateAccountLens(
  handle: string,
  data: {
    lens_handle: string;
    lens_account_address: string;
    lens_account_id: string;
    lens_metadata_uri: string;
    lens_transaction_hash: string;
  }
): Promise<Account | null> {
  const result = await query<Account>(
    `UPDATE accounts SET
      lens_handle = $2,
      lens_account_address = $3,
      lens_account_id = $4,
      lens_metadata_uri = $5,
      lens_transaction_hash = $6,
      updated_at = NOW()
    WHERE handle = $1
    RETURNING *`,
    [
      handle,
      data.lens_handle,
      data.lens_account_address,
      data.lens_account_id,
      data.lens_metadata_uri,
      data.lens_transaction_hash,
    ]
  );
  return result[0] || null;
}

// ============================================================================
// ARTISTS
// ============================================================================

export interface CreateArtistData {
  spotify_artist_id: string;
  name: string;
  slug?: string;
  image_url?: string;
  image_grove_url?: string;
}

export async function createArtist(data: CreateArtistData): Promise<Artist> {
  const result = await query<Artist>(
    `INSERT INTO artists (spotify_artist_id, name, slug, image_url, image_grove_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (spotify_artist_id) DO UPDATE SET
       name = EXCLUDED.name,
       slug = COALESCE(EXCLUDED.slug, artists.slug),
       image_url = COALESCE(EXCLUDED.image_url, artists.image_url),
       image_grove_url = COALESCE(EXCLUDED.image_grove_url, artists.image_grove_url)
     RETURNING *`,
    [
      data.spotify_artist_id,
      data.name,
      data.slug || null,
      data.image_url || null,
      data.image_grove_url || null,
    ]
  );
  return result[0];
}

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  return queryOne<Artist>(
    `SELECT * FROM artists WHERE slug = $1`,
    [slug]
  );
}

export async function updateArtistImage(
  spotifyArtistId: string,
  imageGroveUrl: string
): Promise<Artist | null> {
  const result = await query<Artist>(
    `UPDATE artists SET image_grove_url = $2 WHERE spotify_artist_id = $1 RETURNING *`,
    [spotifyArtistId, imageGroveUrl]
  );
  return result[0] || null;
}

export async function getArtistBySpotifyId(spotifyArtistId: string): Promise<Artist | null> {
  return queryOne<Artist>(
    `SELECT * FROM artists WHERE spotify_artist_id = $1`,
    [spotifyArtistId]
  );
}

// ============================================================================
// SONGS
// ============================================================================

export interface CreateSongData {
  iswc: string;
  title: string;
  spotify_track_id?: string;
  artist_id?: string;
  duration_ms?: number;
  spotify_images?: SpotifyImage[];
  genius_song_id?: number;
  genius_url?: string;
}

export async function createSong(data: CreateSongData): Promise<Song> {
  const result = await query<Song>(
    `INSERT INTO songs (
      iswc, title, spotify_track_id, artist_id, duration_ms,
      spotify_images, genius_song_id, genius_url, stage
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
    RETURNING *`,
    [
      data.iswc,
      data.title,
      data.spotify_track_id || null,
      data.artist_id || null,
      data.duration_ms || null,
      data.spotify_images ? JSON.stringify(data.spotify_images) : null,
      data.genius_song_id || null,
      data.genius_url || null,
    ]
  );
  return result[0];
}

export async function getSongByISWC(iswc: string): Promise<Song | null> {
  return queryOne<Song>(
    `SELECT * FROM songs WHERE iswc = $1`,
    [iswc]
  );
}

export async function updateSongAudio(
  iswc: string,
  data: {
    original_audio_url?: string;
    instrumental_url?: string;
    vocals_url?: string;
    enhanced_instrumental_url?: string;
  }
): Promise<Song | null> {
  const result = await query<Song>(
    `UPDATE songs SET
      original_audio_url = COALESCE($2, original_audio_url),
      instrumental_url = COALESCE($3, instrumental_url),
      vocals_url = COALESCE($4, vocals_url),
      enhanced_instrumental_url = COALESCE($5, enhanced_instrumental_url),
      updated_at = NOW()
    WHERE iswc = $1
    RETURNING *`,
    [
      iswc,
      data.original_audio_url || null,
      data.instrumental_url || null,
      data.vocals_url || null,
      data.enhanced_instrumental_url || null,
    ]
  );
  return result[0] || null;
}

export async function updateSongAlignment(
  iswc: string,
  data: {
    alignment_data: AlignmentData;
    alignment_version: string;
    alignment_loss: number;
  }
): Promise<Song | null> {
  const result = await query<Song>(
    `UPDATE songs SET
      alignment_data = $2,
      alignment_version = $3,
      alignment_loss = $4,
      stage = 'aligned',
      updated_at = NOW()
    WHERE iswc = $1
    RETURNING *`,
    [
      iswc,
      JSON.stringify(data.alignment_data),
      data.alignment_version,
      data.alignment_loss,
    ]
  );
  return result[0] || null;
}

export async function updateSongStage(
  iswc: string,
  stage: string,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE songs SET
      stage = $2,
      error_message = $3,
      updated_at = NOW()
    WHERE iswc = $1`,
    [iswc, stage, errorMessage || null]
  );
}

// ============================================================================
// LYRICS
// ============================================================================

export interface CreateLyricData {
  song_id: string;
  line_index: number;
  language: 'en' | 'zh' | 'vi' | 'id';
  text: string;
  section_marker?: string;
  start_ms?: number;
  end_ms?: number;
  word_timings?: WordTiming[];
}

export async function createLyrics(data: CreateLyricData[]): Promise<Lyric[]> {
  if (data.length === 0) return [];

  const values: unknown[] = [];
  const placeholders: string[] = [];

  data.forEach((lyric, i) => {
    const offset = i * 8;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
    );
    values.push(
      lyric.song_id,
      lyric.line_index,
      lyric.language,
      lyric.text,
      lyric.section_marker || null,
      lyric.start_ms || null,
      lyric.end_ms || null,
      lyric.word_timings ? JSON.stringify(lyric.word_timings) : null
    );
  });

  const result = await query<Lyric>(
    `INSERT INTO lyrics (song_id, line_index, language, text, section_marker, start_ms, end_ms, word_timings)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (song_id, line_index, language) DO UPDATE SET
       text = EXCLUDED.text,
       section_marker = EXCLUDED.section_marker,
       start_ms = COALESCE(EXCLUDED.start_ms, lyrics.start_ms),
       end_ms = COALESCE(EXCLUDED.end_ms, lyrics.end_ms),
       word_timings = COALESCE(EXCLUDED.word_timings, lyrics.word_timings)
     RETURNING *`,
    values
  );

  return result;
}

export async function getLyricsBySong(
  songId: string,
  language?: 'en' | 'zh' | 'vi' | 'id'
): Promise<Lyric[]> {
  if (language) {
    return query<Lyric>(
      `SELECT * FROM lyrics WHERE song_id = $1 AND language = $2 ORDER BY line_index`,
      [songId, language]
    );
  }
  return query<Lyric>(
    `SELECT * FROM lyrics WHERE song_id = $1 ORDER BY language, line_index`,
    [songId]
  );
}

// ============================================================================
// GENIUS REFERENTS
// ============================================================================

export interface CreateReferentData {
  song_id: string;
  referent_id: number;
  genius_song_id: number;
  fragment?: string;
  classification?: string;
  annotations?: unknown;
  votes_total?: number;
  is_verified?: boolean;
}

export async function createReferents(data: CreateReferentData[]): Promise<GeniusReferent[]> {
  if (data.length === 0) return [];

  const values: unknown[] = [];
  const placeholders: string[] = [];

  data.forEach((ref, i) => {
    const offset = i * 8;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
    );
    values.push(
      ref.song_id,
      ref.referent_id,
      ref.genius_song_id,
      ref.fragment || null,
      ref.classification || null,
      ref.annotations ? JSON.stringify(ref.annotations) : null,
      ref.votes_total || 0,
      ref.is_verified || false
    );
  });

  const result = await query<GeniusReferent>(
    `INSERT INTO genius_referents (song_id, referent_id, genius_song_id, fragment, classification, annotations, votes_total, is_verified)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (song_id, referent_id) DO UPDATE SET
       annotations = COALESCE(EXCLUDED.annotations, genius_referents.annotations),
       votes_total = EXCLUDED.votes_total,
       is_verified = EXCLUDED.is_verified
     RETURNING *`,
    values
  );

  return result;
}

// ============================================================================
// CLIPS
// ============================================================================

export interface CreateClipData {
  song_id: string;
  start_ms: number;
  end_ms: number;
  clip_hash?: Buffer;
  metadata_uri?: string;
}

export async function createClip(data: CreateClipData): Promise<Clip> {
  const result = await query<Clip>(
    `INSERT INTO clips (song_id, start_ms, end_ms, clip_hash, metadata_uri)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (song_id, start_ms) DO UPDATE SET
       end_ms = EXCLUDED.end_ms,
       clip_hash = COALESCE(EXCLUDED.clip_hash, clips.clip_hash),
       metadata_uri = COALESCE(EXCLUDED.metadata_uri, clips.metadata_uri)
     RETURNING *`,
    [
      data.song_id,
      data.start_ms,
      data.end_ms,
      data.clip_hash || null,
      data.metadata_uri || null,
    ]
  );
  return result[0];
}

// ============================================================================
// VIDEOS
// ============================================================================

export interface CreateVideoData {
  song_id: string;
  snippet_start_ms: number;
  snippet_end_ms: number;
  background_video_url?: string;
  output_video_url?: string;
  subtitles_ass?: string;
  width?: number;
  height?: number;
}

export async function createVideo(data: CreateVideoData): Promise<Video> {
  const result = await query<Video>(
    `INSERT INTO videos (song_id, snippet_start_ms, snippet_end_ms, background_video_url, output_video_url, subtitles_ass, width, height)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.song_id,
      data.snippet_start_ms,
      data.snippet_end_ms,
      data.background_video_url || null,
      data.output_video_url || null,
      data.subtitles_ass || null,
      data.width || 1440,
      data.height || 1440,
    ]
  );
  return result[0];
}

// ============================================================================
// POSTS
// ============================================================================

export interface CreatePostData {
  account_id: string;
  song_id: string;
  video_id?: string;
  ai_cover_audio_url?: string;
  lens_post_id?: string;
  content?: string;
  tags?: string[];
  metadata_uri?: string;
  transaction_hash?: string;
}

export async function createPost(data: CreatePostData): Promise<Post> {
  const result = await query<Post>(
    `INSERT INTO posts (account_id, song_id, video_id, ai_cover_audio_url, lens_post_id, content, tags, metadata_uri, transaction_hash, published_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`,
    [
      data.account_id,
      data.song_id,
      data.video_id || null,
      data.ai_cover_audio_url || null,
      data.lens_post_id || null,
      data.content || null,
      data.tags || null,
      data.metadata_uri || null,
      data.transaction_hash || null,
    ]
  );
  return result[0];
}

// ============================================================================
// EXERCISES
// ============================================================================

export interface CreateExerciseData {
  song_id: string;
  clip_id?: string;
  lyric_id?: string;
  exercise_type: ExerciseType;
  language_code: string;
  question_data: QuestionData;
  referent_id?: number;
  metadata_uri?: string;
}

export async function createExercises(data: CreateExerciseData[]): Promise<Exercise[]> {
  if (data.length === 0) return [];

  const values: unknown[] = [];
  const placeholders: string[] = [];

  data.forEach((ex, i) => {
    const offset = i * 8;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`
    );
    values.push(
      ex.song_id,
      ex.clip_id || null,
      ex.lyric_id || null,
      ex.exercise_type,
      ex.language_code,
      JSON.stringify(ex.question_data),
      ex.referent_id || null,
      ex.metadata_uri || null
    );
  });

  const result = await query<Exercise>(
    `INSERT INTO exercises (song_id, clip_id, lyric_id, exercise_type, language_code, question_data, referent_id, metadata_uri)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  );

  return result;
}
