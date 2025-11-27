/**
 * Shared Types
 */

import type { Address, Hex } from 'viem';

// ============================================================================
// Database Entities
// ============================================================================

export interface Account {
  id: string;
  handle: string;
  display_name: string;
  avatar_grove_url: string | null;
  bio: string | null;
  account_type: 'ai' | 'human';
  pkp_address: string | null;
  pkp_token_id: string | null;
  pkp_public_key: string | null;
  pkp_network: string | null;
  lens_handle: string | null;
  lens_account_address: string | null;
  lens_account_id: string | null;
  lens_metadata_uri: string | null;
  lens_transaction_hash: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Artist {
  id: string;
  spotify_artist_id: string;
  name: string;
  slug: string | null;
  image_url: string | null; // Original Spotify URL (for reference)
  image_grove_url: string | null; // Permanent Grove URL
  created_at: Date;
}

export interface Song {
  id: string;
  iswc: string;
  spotify_track_id: string | null;
  title: string;
  artist_id: string | null;
  duration_ms: number | null;
  spotify_images: SpotifyImage[] | null;
  original_audio_url: string | null;
  instrumental_url: string | null;
  vocals_url: string | null;
  enhanced_instrumental_url: string | null;
  alignment_data: AlignmentData | null;
  alignment_version: string | null;
  alignment_loss: number | null;
  genius_song_id: number | null;
  genius_url: string | null;
  stage: SongStage;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export type SongStage = 'pending' | 'aligned' | 'enhanced' | 'ready';

export interface Lyric {
  id: string;
  song_id: string;
  line_index: number;
  language: 'en' | 'zh' | 'vi' | 'id';
  text: string;
  section_marker: string | null;
  start_ms: number | null;
  end_ms: number | null;
  word_timings: WordTiming[] | null;
  created_at: Date;
}

export interface GeniusReferent {
  id: string;
  song_id: string;
  referent_id: number;
  genius_song_id: number;
  fragment: string | null;
  classification: string | null;
  annotations: unknown;
  votes_total: number;
  is_verified: boolean;
  created_at: Date;
}

export interface Clip {
  id: string;
  song_id: string;
  clip_hash: Buffer | null;
  start_ms: number;
  end_ms: number;
  metadata_uri: string | null;
  emitted_at: Date | null;
  transaction_hash: string | null;
  created_at: Date;
}

export interface Video {
  id: string;
  song_id: string;
  background_video_url: string | null;
  output_video_url: string | null;
  subtitles_ass: string | null;
  snippet_start_ms: number;
  snippet_end_ms: number;
  width: number;
  height: number;
  created_at: Date;
}

export interface Post {
  id: string;
  account_id: string;
  song_id: string;
  video_id: string | null;
  ai_cover_audio_url: string | null;
  lens_post_id: string | null;
  content: string | null;
  tags: string[] | null;
  metadata_uri: string | null;
  transaction_hash: string | null;
  published_at: Date | null;
  created_at: Date;
}

export interface Exercise {
  id: string;
  song_id: string;
  clip_id: string | null;
  lyric_id: string | null;
  exercise_type: ExerciseType;
  language_code: string;
  question_data: QuestionData;
  referent_id: number | null;
  metadata_uri: string | null;
  emitted_at: Date | null;
  transaction_hash: string | null;
  enabled: boolean;
  created_at: Date;
}

export type ExerciseType = 'trivia' | 'translation' | 'sayitback' | 'fill_blank';

// ============================================================================
// Nested Types
// ============================================================================

export interface SpotifyImage {
  url: string;
  width: number;
  height: number;
}

export interface AlignmentData {
  words: WordTiming[];
  characters?: CharacterTiming[];
}

export interface WordTiming {
  text: string;
  start: number;  // seconds
  end: number;    // seconds
}

export interface CharacterTiming {
  character: string;
  start: number;
  end: number;
}

export interface QuestionData {
  prompt: string;
  correct_answer: string;
  distractors: string[];
  explanation?: string;
}

// ============================================================================
// Lyrics Parsing
// ============================================================================

export interface ParsedLyrics {
  lines: ParsedLine[];
  sectionMarkers: SectionMarker[];
}

export interface ParsedLine {
  index: number;
  text: string;
  sectionMarker: string | null;
}

export interface SectionMarker {
  marker: string;      // '[Chorus]'
  lineIndex: number;   // Position in line array
}

export interface LyricsValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  enLineCount: number;
  zhLineCount: number;
}

// ============================================================================
// Service Results
// ============================================================================

export interface PKPMintResult {
  pkpAddress: Address;
  pkpTokenId: string;
  pkpPublicKey: string;
  ownerEOA: Address;
  transactionHash: Hex;
}

export interface LensAccountResult {
  lensHandle: string;
  lensAccountAddress: Address;
  lensAccountId: string;
  metadataUri: string;
  transactionHash: Hex;
}

export interface LensPostResult {
  postId: string;
  metadataUri: string;
  transactionHash: Hex;
}

export interface GroveUploadResult {
  cid: string;
  url: string;
  uri: string;  // grove://{cid}
}

export interface AlignmentResult {
  words: WordTiming[];
  loss: number;
  duration: number;
}
