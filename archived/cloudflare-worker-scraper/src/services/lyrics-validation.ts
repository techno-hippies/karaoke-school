/**
 * Lyrics Validation Service
 * Orchestrates multi-source lyrics fetching, comparison, and validation
 */

import { LRCLIBService } from './lrclib';
import { LyricsOvhService } from './lyrics-ovh';
import { compareLyrics, getValidationNotes } from './lyrics-similarity';
import type { LyricsSourceInsert, LyricsValidationInsert } from '../types/lyrics';

export interface TrackMetadata {
  spotify_track_id: string;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
}

export interface ValidationResult {
  spotify_track_id: string;
  lrclib_lyrics: string | null;
  lyrics_ovh_lyrics: string | null;
  similarity_score: number | null;
  corroborated: boolean;
  validation_status: string;
  primary_source: string | null;
  notes: string;
}

export class LyricsValidationService {
  private lrclib: LRCLIBService;
  private lyricsOvh: LyricsOvhService;
  private similarityThreshold: number;

  constructor(similarityThreshold: number = 0.80) {
    this.lrclib = new LRCLIBService();
    this.lyricsOvh = new LyricsOvhService();
    this.similarityThreshold = similarityThreshold;
  }

  /**
   * Fetch lyrics from LRCLIB
   */
  async fetchFromLrclib(track: TrackMetadata): Promise<string | null> {
    try {
      const result = await this.lrclib.getLyrics({
        track_name: track.title,
        artist_name: track.artist,
        album_name: track.album,
        duration: Math.round(track.duration_ms / 1000),
      });

      return result?.plainLyrics || null;
    } catch (error) {
      console.error(`LRCLIB fetch error for ${track.spotify_track_id}:`, error);
      return null;
    }
  }

  /**
   * Fetch lyrics from Lyrics.ovh
   */
  async fetchFromLyricsOvh(track: TrackMetadata): Promise<string | null> {
    try {
      const lyrics = await this.lyricsOvh.getLyrics({
        artist: track.artist,
        title: track.title,
      });

      return lyrics;
    } catch (error) {
      console.error(`Lyrics.ovh fetch error for ${track.spotify_track_id}:`, error);
      return null;
    }
  }

  /**
   * Validate lyrics from multiple sources and compare
   */
  async validateTrack(track: TrackMetadata): Promise<ValidationResult> {
    console.log(`Validating: ${track.title} - ${track.artist}`);

    // Fetch from both sources
    const [lrclibLyrics, lyricsOvhLyrics] = await Promise.all([
      this.fetchFromLrclib(track),
      this.fetchFromLyricsOvh(track),
    ]);

    // Default result
    const result: ValidationResult = {
      spotify_track_id: track.spotify_track_id,
      lrclib_lyrics: lrclibLyrics,
      lyrics_ovh_lyrics: lyricsOvhLyrics,
      similarity_score: null,
      corroborated: false,
      validation_status: 'no_lyrics',
      primary_source: null,
      notes: '',
    };

    // Case 1: Both sources have lyrics - compare them
    if (lrclibLyrics && lyricsOvhLyrics) {
      const comparison = compareLyrics(lrclibLyrics, lyricsOvhLyrics, this.similarityThreshold);

      result.similarity_score = comparison.normalizedSimilarity;
      result.corroborated = comparison.corroborated;
      result.validation_status = comparison.validationStatus;
      result.primary_source = 'lrclib'; // Prefer lrclib (has synced lyrics)
      result.notes = getValidationNotes(comparison);

      console.log(`  ✓ Both sources found. Similarity: ${(comparison.normalizedSimilarity * 100).toFixed(1)}%`);
    }
    // Case 2: Only LRCLIB has lyrics
    else if (lrclibLyrics && !lyricsOvhLyrics) {
      result.validation_status = 'single_source';
      result.primary_source = 'lrclib';
      result.notes = 'Only LRCLIB has lyrics. No corroboration available.';

      console.log(`  ⚠ Only LRCLIB found lyrics`);
    }
    // Case 3: Only Lyrics.ovh has lyrics
    else if (!lrclibLyrics && lyricsOvhLyrics) {
      result.validation_status = 'single_source';
      result.primary_source = 'lyrics_ovh';
      result.notes = 'Only Lyrics.ovh has lyrics. No corroboration available.';

      console.log(`  ⚠ Only Lyrics.ovh found lyrics`);
    }
    // Case 4: No lyrics found
    else {
      result.validation_status = 'no_lyrics';
      result.notes = 'No lyrics found from any source.';

      console.log(`  ✗ No lyrics found`);
    }

    return result;
  }

  /**
   * Create insert objects for database storage
   */
  prepareDatabaseInserts(
    track: TrackMetadata,
    validation: ValidationResult
  ): {
    lyricsSources: LyricsSourceInsert[];
    lyricsValidation: LyricsValidationInsert | null;
  } {
    const sources: LyricsSourceInsert[] = [];

    // Add LRCLIB source if found
    if (validation.lrclib_lyrics) {
      sources.push({
        spotify_track_id: track.spotify_track_id,
        source: 'lrclib',
        plain_lyrics: validation.lrclib_lyrics,
        char_count: validation.lrclib_lyrics.length,
        line_count: validation.lrclib_lyrics.split('\n').length,
      });
    }

    // Add Lyrics.ovh source if found
    if (validation.lyrics_ovh_lyrics) {
      sources.push({
        spotify_track_id: track.spotify_track_id,
        source: 'lyrics_ovh',
        plain_lyrics: validation.lyrics_ovh_lyrics,
        char_count: validation.lyrics_ovh_lyrics.length,
        line_count: validation.lyrics_ovh_lyrics.split('\n').length,
      });
    }

    // Create validation record
    const validationRecord: LyricsValidationInsert | null =
      sources.length > 0
        ? {
            spotify_track_id: track.spotify_track_id,
            sources_compared: sources.map(s => s.source),
            primary_source: validation.primary_source || null,
            similarity_score: validation.similarity_score,
            jaccard_similarity: validation.similarity_score, // Same for now
            corroborated: validation.corroborated,
            validation_status: validation.validation_status,
            validation_notes: validation.notes,
          }
        : null;

    return {
      lyricsSources: sources,
      lyricsValidation: validationRecord,
    };
  }
}
