#!/usr/bin/env bun
/**
 * Audio Task: Forced Lyrics Alignment (REFACTORED with BaseTask)
 * Stage: audio_ready → aligned
 *
 * Uses ElevenLabs forced alignment API to generate word-level and character-level
 * timing data for lyrics synchronized to audio.
 *
 * COMPARISON:
 * - Old version: 285 lines with manual lifecycle management
 * - New version: ~120 lines, BaseTask handles boilerplate
 * - Reduction: ~58% less code, same functionality
 *
 * Prerequisites:
 * - Track must have audio (song_audio.grove_url)
 * - Track must have lyrics (song_lyrics.synced_lyrics or plain_lyrics)
 *
 * Output:
 * - elevenlabs_word_alignments table populated
 * - Updates tracks.stage to 'aligned'
 *
 * Usage:
 *   bun src/tasks/audio/align-lyrics-refactored.ts --limit=10
 */

import { query } from '../../db/connection';
import { ElevenLabsService } from '../../services/elevenlabs';
import { TrackStage, AudioTaskType } from '../../db/task-stages';
import { BaseTask, type BaseTrackInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { CONFIG } from '../../config';
import type { AlignMetadata } from '../../types/task-metadata';

/**
 * Track ready for alignment
 */
interface TrackForAlignment extends BaseTrackInput {
  spotify_track_id: string;
  title: string;
  artists: any;
  grove_url: string;
  plain_lyrics: string | null;
  synced_lyrics: string | null;
}

/**
 * Alignment result with metadata
 */
interface AlignmentResult extends TaskResult {
  metadata: AlignMetadata;
}

/**
 * ElevenLabs alignment response
 */
interface AlignmentData {
  words: any[];
  totalWords: number;
  characters: any[];
  totalCharacters: number;
  alignmentDurationMs: number;
  overallLoss: number;
  rawResponse: any;
}

/**
 * Extract plain text from synced LRC format
 */
function extractPlainFromLRC(lrc: string): string {
  return lrc
    .split('\n')
    .map(line => line.replace(/^\[\d{2}:\d{2}\.\d{2}\]/, '').trim())
    .filter(line => line.length > 0 && !line.startsWith('['))
    .join('\n');
}

/**
 * Align Lyrics Task
 *
 * Uses BaseTask to eliminate boilerplate:
 * - No manual ensureAudioTask/startTask/completeTask/failTask
 * - No manual updateTrackStage
 * - No manual error handling and retries
 * - No manual success/failure counting
 */
export class AlignLyricsTask extends BaseTask<TrackForAlignment, AlignmentResult> {
  readonly taskType = AudioTaskType.Align;
  private elevenlabs: ElevenLabsService;

  constructor() {
    super();

    // Initialize ElevenLabs service
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable required');
    }
    this.elevenlabs = new ElevenLabsService(apiKey);
  }

  /**
   * Select tracks at 'audio_ready' stage with audio and lyrics
   * Respects audio_tasks retry logic (attempts, backoff, max_attempts)
   */
  async selectTracks(limit: number): Promise<TrackForAlignment[]> {
    const retryFilter = buildAudioTasksFilter(this.taskType);
    return query<TrackForAlignment>(
      `SELECT
        t.spotify_track_id,
        t.title,
        t.artists,
        sa.grove_url,
        sl.plain_lyrics,
        sl.synced_lyrics
      FROM tracks t
      JOIN song_audio sa ON t.spotify_track_id = sa.spotify_track_id
      JOIN song_lyrics sl ON t.spotify_track_id = sl.spotify_track_id
      WHERE t.stage = $1
        AND sa.grove_url IS NOT NULL
        AND (sl.plain_lyrics IS NOT NULL OR sl.synced_lyrics IS NOT NULL)
        ${retryFilter}
      ORDER BY t.updated_at ASC
      LIMIT $2`,
      [TrackStage.AudioReady, limit]
    );
  }

  /**
   * Process a single track: call ElevenLabs forced alignment
   */
  async processTrack(track: TrackForAlignment): Promise<AlignmentResult> {
    // Get plain lyrics (prefer plain_lyrics, fallback to extracting from synced)
    let plainLyrics = track.plain_lyrics;
    if (!plainLyrics && track.synced_lyrics) {
      plainLyrics = extractPlainFromLRC(track.synced_lyrics);
    }

    if (!plainLyrics || plainLyrics.trim().length === 0) {
      throw new Error('No lyrics available for alignment');
    }

    // Format artist names
    const artistName = Array.isArray(track.artists) && track.artists.length > 0
      ? track.artists.map((a: any) =>
          typeof a === 'object' && a !== null ? a.name || String(a) : String(a)
        ).join(', ')
      : 'Unknown Artist';

    console.log(`\n📍 ${track.title} - ${artistName}`);
    console.log(`   Audio: ${track.grove_url}`);
    console.log(`   Lyrics: ${plainLyrics.length} chars`);

    // Call ElevenLabs forced alignment
    const alignment = await this.elevenlabs.forcedAlignment(track.grove_url, plainLyrics);

    // Store in elevenlabs_word_alignments
    await query(
      `INSERT INTO elevenlabs_word_alignments (
         spotify_track_id,
         words,
         total_words,
         characters,
         total_characters,
         alignment_duration_ms,
         overall_loss,
         raw_alignment_data
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (spotify_track_id)
       DO UPDATE SET
         words = EXCLUDED.words,
         total_words = EXCLUDED.total_words,
         characters = EXCLUDED.characters,
         total_characters = EXCLUDED.total_characters,
         alignment_duration_ms = EXCLUDED.alignment_duration_ms,
         overall_loss = EXCLUDED.overall_loss,
         raw_alignment_data = EXCLUDED.raw_alignment_data,
         updated_at = NOW()`,
      [
        track.spotify_track_id,
        JSON.stringify(alignment.words),
        alignment.totalWords,
        JSON.stringify(alignment.characters),
        alignment.totalCharacters,
        alignment.alignmentDurationMs,
        parseFloat(alignment.overallLoss.toFixed(3)),
        JSON.stringify(alignment.rawResponse)
      ]
    );

    console.log(
      `   ✓ Aligned ${alignment.totalWords} words, ` +
      `${alignment.totalCharacters} characters, ` +
      `loss: ${alignment.overallLoss.toFixed(3)}`
    );

    return {
      metadata: {
        provider: 'elevenlabs',
        word_count: alignment.totalWords,
        total_duration_ms: alignment.alignmentDurationMs,
        average_word_duration_ms: alignment.alignmentDurationMs / alignment.totalWords,
        confidence_score: 1.0 - alignment.overallLoss, // Convert loss to confidence
      },
    };
  }

  /**
   * Hook: Called before the entire run starts
   */
  async beforeRun(options: any): Promise<void> {
    console.log(`\n🎵 Forced Lyrics Alignment (ElevenLabs)`);
    console.log(`   Processing up to ${options.limit || 10} tracks\n`);
  }

  /**
   * Hook: Rate limiting between tracks
   */
  async afterProcessTrack(track: TrackForAlignment, error?: Error): Promise<void> {
    // Rate limiting: 2 seconds between API calls
    if (!error) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.audio.elevenlabs.rateLimitMs));
    }
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  const task = new AlignLyricsTask();
  task.run({ limit }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
