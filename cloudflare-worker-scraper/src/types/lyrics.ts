/**
 * Database types for multi-source lyrics storage and validation
 */

export interface LyricsSource {
  id: number;
  spotify_track_id: string;
  source: 'lrclib' | 'lyrics_ovh' | 'genius' | string;

  plain_lyrics: string | null;
  synced_lyrics: string | null;

  source_track_id: string | null;
  char_count: number | null;
  line_count: number | null;

  fetched_at: Date;
}

export interface LyricsValidation {
  id: number;
  spotify_track_id: string;

  sources_compared: string[];
  primary_source: string | null;

  similarity_score: number | null;
  jaccard_similarity: number | null;
  levenshtein_distance: number | null;

  corroborated: boolean | null;
  validation_status: 'high_confidence' | 'medium_confidence' | 'low_confidence' | 'conflict' | null;

  validation_notes: string | null;

  validated_at: Date;
}

export interface LyricsSourceInsert {
  spotify_track_id: string;
  source: string;
  plain_lyrics: string | null;
  synced_lyrics?: string | null;
  source_track_id?: string | null;
  char_count?: number | null;
  line_count?: number | null;
}

export interface LyricsValidationInsert {
  spotify_track_id: string;
  sources_compared: string[];
  primary_source?: string;
  similarity_score?: number;
  jaccard_similarity?: number;
  levenshtein_distance?: number;
  corroborated?: boolean;
  validation_status?: string;
  validation_notes?: string;
}
