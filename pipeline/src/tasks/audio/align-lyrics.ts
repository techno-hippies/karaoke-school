#!/usr/bin/env bun
/**
 * Audio Task: Forced Lyrics Alignment
 *
 * Uses ElevenLabs forced alignment API to generate word-level and character-level
 * timing data for lyrics synchronized to audio.
 *
 * Prerequisites:
 * - Track must have audio (song_audio.grove_url)
 * - Track must have lyrics (song_lyrics.synced_lyrics or plain_lyrics)
 *
 * Output:
 * - elevenlabs_word_alignments table populated
 * - audio_tasks status: pending → completed
 *
 * Usage:
 *   bun src/tasks/audio/align-lyrics.ts --limit=10
 */

import { parseArgs } from 'util';
import { ElevenLabsService } from '../../services/elevenlabs';
import { TrackStage } from '../../db/task-stages';

const MUSIC_NOTE_REGEX = /[\u266A-\u266F\u{1F3B5}\u{1F3B6}♪♫♩♬]+/gu;

interface AlignmentTask {
  id: number;
  spotify_track_id: string;
  attempts: number;
}

interface TrackData {
  grove_url: string;
  plain_lyrics: string | null;
  synced_lyrics: string | null;
  normalized_lyrics: string | null;
  title: string;
  artists: any;
}

async function runQuery(sql: string, params: any[] = []) {
  // Import connection dynamically to avoid initialization issues
  const { query } = await import('../../db/connection');
  return query(sql, params);
}

// Extract plain text from synced LRC format
function extractPlainFromLRC(lrc: string): string {
  return lrc
    .split('\n')
    .map(line => line.replace(/^\[\d{2}:\d{2}\.\d{2}\]/, '').trim())
    .filter(line => line.length > 0 && !line.startsWith('['))
    .join('\n');
}

// Normalize lyrics before sending to ElevenLabs. This strips musical note
// markers and other decorative glyphs so alignment stays lyric-only.
function sanitizeLyrics(text: string): string {
  return text
    .normalize('NFKC')
    .split('\n')
    .map(line => line.replace(MUSIC_NOTE_REGEX, '').trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

async function processAlignmentTask(task: AlignmentTask, elevenlabs: ElevenLabsService): Promise<void> {
  const startTime = Date.now();

  // Fetch track data
  const trackResult = await runQuery(
    `SELECT
      sa.grove_url,
      sl.plain_lyrics,
      sl.synced_lyrics,
      sl.normalized_lyrics,
      st.title,
      st.artists
    FROM song_audio sa
    JOIN song_lyrics sl ON sa.spotify_track_id = sl.spotify_track_id
    JOIN spotify_tracks st ON sa.spotify_track_id = st.spotify_track_id
    WHERE sa.spotify_track_id = $1`,
    [task.spotify_track_id]
  );

  if (trackResult.length === 0) {
    throw new Error('Track not found or missing audio/lyrics data');
  }

  const track = trackResult[0] as TrackData;

  // Prefer normalized lyrics for deterministic alignment, fall back to the
  // original plain text when normalization is unavailable.
  let lyricsForAlignment = track.normalized_lyrics?.trim();

  if (!lyricsForAlignment || lyricsForAlignment.length === 0) {
    let plainLyrics = track.plain_lyrics;
    if (!plainLyrics && track.synced_lyrics) {
      plainLyrics = extractPlainFromLRC(track.synced_lyrics);
    }

    lyricsForAlignment = plainLyrics?.trim() ?? '';
  }

  lyricsForAlignment = sanitizeLyrics(lyricsForAlignment);

  if (!lyricsForAlignment || lyricsForAlignment.length === 0) {
    throw new Error('No lyrics available for alignment');
  }

  // Format artist names
  let artistsStr = 'Unknown Artist';
  if (Array.isArray(track.artists)) {
    artistsStr = track.artists
      .map((a: any) => (typeof a === 'object' && a !== null ? a.name || String(a) : String(a)))
      .join(', ');
  }

  console.log(`\n📍 ${track.title} - ${artistsStr}`);
  console.log(`   Audio: ${track.grove_url}`);
  console.log(`   Lyrics: ${lyricsForAlignment.length} chars (normalized)`);

  // Update task: mark as running
  await runQuery(
    `UPDATE audio_tasks
     SET status = 'running',
         last_attempt_at = NOW(),
         attempts = attempts + 1
     WHERE id = $1`,
    [task.id]
  );

  // Call ElevenLabs forced alignment
  const alignment = await elevenlabs.forcedAlignment(track.grove_url, lyricsForAlignment);

  // Store in elevenlabs_word_alignments
  await runQuery(
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
      task.spotify_track_id,
      JSON.stringify(alignment.words),
      alignment.totalWords,
      JSON.stringify(alignment.characters),
      alignment.totalCharacters,
      alignment.alignmentDurationMs,
      parseFloat(alignment.overallLoss.toFixed(3)),
      JSON.stringify(alignment.rawResponse)
    ]
  );

  const processingTime = Date.now() - startTime;

  // Update task: mark as completed
  await runQuery(
    `UPDATE audio_tasks
     SET status = 'completed',
         completed_at = NOW(),
         processing_duration_ms = $2,
         metadata = $3::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [
      task.id,
      processingTime,
      JSON.stringify({
        total_words: alignment.totalWords,
        total_characters: alignment.totalCharacters,
        overall_loss: parseFloat(alignment.overallLoss.toFixed(3)),
        alignment_duration_ms: alignment.alignmentDurationMs
      })
    ]
  );

  // Update track stage: audio_ready → aligned
  await runQuery(
    `UPDATE tracks
     SET stage = $1,
         updated_at = NOW()
     WHERE spotify_track_id = $2
       AND stage = $3`,
    [TrackStage.Aligned, task.spotify_track_id, TrackStage.AudioReady]
  );

  console.log(
    `   ✓ Aligned ${alignment.totalWords} words, ` +
    `${alignment.totalCharacters} characters, ` +
    `loss: ${alignment.overallLoss.toFixed(3)}, ` +
    `time: ${(processingTime / 1000).toFixed(1)}s`
  );
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '10' },
    },
  });

  const limit = parseInt(values.limit || '10');

  console.log(`\n🎵 Forced Lyrics Alignment (ElevenLabs)`);
  console.log(`   Processing up to ${limit} tracks\n`);

  // Check for API key
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY environment variable required');
    process.exit(1);
  }

  const elevenlabs = new ElevenLabsService(apiKey);

  // Get pending alignment tasks
  const tasks = await runQuery(
    `SELECT id, spotify_track_id, attempts
     FROM audio_tasks
     WHERE task_type = 'align'
       AND status IN ('pending', 'failed')
       AND attempts < max_attempts
       AND (next_retry_at IS NULL OR next_retry_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  if (tasks.length === 0) {
    console.log('✓ No alignment tasks pending (all caught up!)');
    return;
  }

  console.log(`Found ${tasks.length} tracks needing alignment\n`);

  let completedCount = 0;
  let failedCount = 0;

  for (const task of tasks as AlignmentTask[]) {
    try {
      await processAlignmentTask(task, elevenlabs);
      completedCount++;

      // Rate limiting: 2 seconds between API calls
      if (completedCount < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error: any) {
      failedCount++;
      console.error(`   ✗ Failed: ${error.message}`);

      // Calculate exponential backoff retry time
      const retryDelayMinutes = Math.min(Math.pow(2, task.attempts), 60); // Max 1 hour
      const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60 * 1000);

      // Update task with error
      await runQuery(
        `UPDATE audio_tasks
         SET status = 'failed',
             error_message = $2,
             error_details = $3::jsonb,
             next_retry_at = $4,
             updated_at = NOW()
         WHERE id = $1`,
        [
          task.id,
          error.message.substring(0, 500),
          JSON.stringify({
            error: error.stack || error.message,
            attempt: task.attempts + 1
          }),
          task.attempts + 1 >= 3 ? null : nextRetryAt.toISOString()
        ]
      );

      if (task.attempts + 1 >= 3) {
        console.log(`   ⚠️  Max retries reached, task marked as failed permanently`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ Alignment Complete: ${completedCount} succeeded, ${failedCount} failed`);
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
