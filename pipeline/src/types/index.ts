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
  // 12 language translations/transliterations
  name_zh: string | null; // Chinese
  name_vi: string | null; // Vietnamese
  name_id: string | null; // Indonesian
  name_ja: string | null; // Japanese
  name_ko: string | null; // Korean
  name_es: string | null; // Spanish
  name_pt: string | null; // Portuguese
  name_ar: string | null; // Arabic
  name_tr: string | null; // Turkish
  name_ru: string | null; // Russian
  name_hi: string | null; // Hindi
  name_th: string | null; // Thai
  slug: string | null;
  image_url: string | null; // Original Spotify URL (for reference)
  image_grove_url: string | null; // Permanent Grove URL
  genres: string[]; // Spotify genres (e.g., ["pop", "r&b", "dance pop"])
  // Unlock Protocol locks (per environment)
  unlock_lock_address_testnet: string | null;
  unlock_lock_deployed_at_testnet: Date | null;
  unlock_lock_address_mainnet: string | null;
  unlock_lock_deployed_at_mainnet: Date | null;
  created_at: Date;
}

export interface Song {
  id: string;
  iswc: string;
  spotify_track_id: string | null;
  title: string;
  title_zh: string | null; // Chinese translation
  title_vi: string | null; // Vietnamese translation
  title_id: string | null; // Indonesian translation
  title_ja: string | null; // Japanese translation
  title_ko: string | null; // Korean translation
  slug: string | null;
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
  // Cover images (Grove URLs - permanent storage)
  cover_grove_url: string | null;      // Full size (640x640)
  thumbnail_grove_url: string | null;  // Small (100x100) for lists
  // Free clip (0 → clip_end_ms)
  clip_end_ms: number | null;
  clip_instrumental_url: string | null;
  clip_lyrics_url: string | null;
  // Unlock Protocol (per-song purchase)
  unlock_lock_address_testnet: string | null;
  unlock_lock_address_mainnet: string | null;
  // Testnet encryption (naga-dev/naga-test + Base Sepolia)
  encrypted_full_url_testnet: string | null;
  encryption_manifest_url_testnet: string | null;
  lit_network_testnet: string | null;
  // Mainnet encryption (naga-mainnet + Base)
  encrypted_full_url_mainnet: string | null;
  encryption_manifest_url_mainnet: string | null;
  lit_network_mainnet: string | null;
  // Content tags for AI chat context
  lyric_tags: string[] | null;
  created_at: Date;
  updated_at: Date;
}

export type SongStage = 'pending' | 'aligned' | 'enhanced' | 'ready';

export interface Lyric {
  id: string;
  song_id: string;
  line_index: number;
  language: 'en' | 'zh' | 'vi' | 'id' | 'ja' | 'ko';
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

export interface SongFactRecord {
  id: string;
  song_id: string;
  fact_index: number;
  text: string;
  html: string | null;
  source_url: string | null;
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
  // Content tags for AI chat context
  visual_tags: string[] | null;
  lyric_tags: string[] | null;
  created_at: Date;
}

export interface Video {
  id: string;
  song_id: string;
  background_video_url: string | null;
  output_video_url: string | null;
  thumbnail_url: string | null;  // Video frame thumbnail (Grove) - NOT album art
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
  text: string;  // The character (matches ElevenLabs API)
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

// ============================================================================
// Multi-Layer Storage Types
// ============================================================================

/**
 * Storage layers in order of censorship resistance
 * - grove: Lens Protocol IPFS (primary, backwards-compatible)
 * - arweave: Permanent storage via Turbo SDK (free <100KB)
 * - lighthouse: IPFS + Filecoin deals (pay-once, store forever)
 */
export type StorageLayer = 'grove' | 'arweave' | 'lighthouse';

/**
 * Arweave upload result
 */
export interface ArweaveUploadResult {
  txId: string;
  url: string;
  urls: string[];
}

/**
 * Lighthouse (IPFS + Filecoin) upload result
 */
export interface LighthouseUploadResult {
  cid: string;
  url: string;
  urls: string[];
}

/**
 * Result from a single storage layer upload
 */
export interface StorageLayerResult {
  layer: StorageLayer;
  success: boolean;
  identifier: string; // CID, txId, or storage_key
  url: string;
  urls?: string[];
  error?: string;
}

/**
 * Storage manifest stored in JSONB column
 * Tracks where content is stored across layers
 */
export interface StorageManifest {
  contentHash: string; // SHA-256
  sizeBytes: number;
  mimeType: string;
  uploadedAt: string;

  grove?: {
    cid: string;
    url: string;
  };

  arweave?: {
    txId: string;
    url: string;
    urls: string[];
  };

  lighthouse?: {
    cid: string;
    url: string;
    urls: string[];
  };
}

/**
 * Result from multi-layer upload
 */
export interface MultiLayerUploadResult {
  contentHash: string;
  results: StorageLayerResult[];
  manifest: StorageManifest;
  primaryUrl: string; // Grove URL for backwards compatibility
}
