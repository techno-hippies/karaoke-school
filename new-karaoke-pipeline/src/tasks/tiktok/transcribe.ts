/**
 * Task: Transcribe TikTok Video (Hybrid STT Pipeline)
 *
 * Uses Voxtral STT + Gemini Lyrics Matching + FA Lookup for perfect timing.
 * Stores results in tiktok_transcripts table.
 *
 * Prerequisites:
 * - Video must have grove_video_url (upload-grove task completed)
 * - Video must have spotify_track_id (matched song)
 * - Song must have elevenlabs_word_alignments (FA data)
 *
 * Flow:
 * 1. Select videos with Grove URLs and spotify_track_id
 * 2. Voxtral STT: Transcribe audio (multilingual, accurate)
 * 3. Gemini Flash: Match transcript to full song lyrics
 * 4. FA Lookup: Extract word timestamps from elevenlabs_word_alignments
 * 5. Insert segments with perfect timing into tiktok_transcripts
 *
 * Cost: ~$0.00065 per 11s clip (Voxtral $0.00055 + Gemini $0.0001)
 * Quality: Perfect timing (from full-song FA), accurate text (Voxtral multilingual)
 *
 * Usage:
 *   bun src/tasks/tiktok/transcribe.ts --limit=10
 *   bun src/tasks/tiktok/transcribe.ts --videoId=7565931111373622550
 */

import { BaseTask, type BaseSubjectInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { AudioTaskType } from '../../db/task-stages';
import { query } from '../../db/connection';
import { createVoxtralService } from '../../services/voxtral';
import { createLyricsMatcherService } from '../../services/lyrics-matcher';
import { createFALookupService } from '../../services/fa-lookup';

interface TikTokVideoInput extends BaseSubjectInput {
  video_id: string;
  creator_username: string;
  grove_video_url: string;
  spotify_track_id: string | null;
  subject_type: 'tiktok_video';
  subject_id: string;
}

interface TranscriptResult extends TaskResult {
  metadata: {
    transcript_text: string;
    transcript_language: string;
    transcript_duration_s?: number;
    transcript_word_count: number;
  };
}

export class TranscribeTikTokTask extends BaseTask<TikTokVideoInput, TranscriptResult> {
  readonly taskType = AudioTaskType.TranscribeTikTok;
  readonly subjectType = 'tiktok_video' as const;

  async selectTracks(limit: number, videoId?: string): Promise<TikTokVideoInput[]> {
    const filter = buildAudioTasksFilter(this.taskType, this.subjectType, 'video_id');

    if (videoId) {
      const results = await query<TikTokVideoInput>(
        `SELECT
          t.video_id,
          t.creator_username,
          t.grove_video_url,
          t.spotify_track_id,
          'tiktok_video' as subject_type,
          t.video_id as subject_id
         FROM tiktok_videos t
         WHERE t.video_id = $1
           AND t.grove_video_url IS NOT NULL
           AND t.spotify_track_id IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM elevenlabs_word_alignments
             WHERE spotify_track_id = t.spotify_track_id
           )
           AND NOT EXISTS (
             SELECT 1 FROM tiktok_transcripts
             WHERE video_id = t.video_id
           )
           ${filter}
         LIMIT 1`,
        [videoId]
      );
      return results;
    }

    const results = await query<TikTokVideoInput>(
      `SELECT
        t.video_id,
        t.creator_username,
        t.grove_video_url,
        t.spotify_track_id,
        'tiktok_video' as subject_type,
        t.video_id as subject_id
       FROM tiktok_videos t
       WHERE t.grove_video_url IS NOT NULL
         AND t.spotify_track_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM elevenlabs_word_alignments
           WHERE spotify_track_id = t.spotify_track_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM tiktok_transcripts
           WHERE video_id = t.video_id
         )
         ${filter}
       ORDER BY t.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return results;
  }

  async processTrack(video: TikTokVideoInput): Promise<TranscriptResult> {
    console.log(`  🎤 Transcribing ${video.video_id} (song: ${video.spotify_track_id})...`);

    if (!video.spotify_track_id) {
      throw new Error(`No spotify_track_id for video ${video.video_id}`);
    }

    // Step 1: Voxtral STT - Get accurate transcript (especially for multilingual)
    console.log(`  [1/3] Running Voxtral STT...`);
    const voxtralService = createVoxtralService();
    const voxtralResult = await voxtralService.transcribe(video.grove_video_url);

    const transcriptText = voxtralResult.text;
    const durationS = voxtralResult.duration;
    const wordCount = voxtralResult.wordCount;

    console.log(`  ✓ Voxtral: "${transcriptText}" (${wordCount} words)`);

    // Step 2: Gemini Flash - Match transcript to full song lyrics
    console.log(`  [2/3] Matching lyrics with Gemini Flash...`);
    const lyricsMatcherService = createLyricsMatcherService();
    const lyricsMatch = await lyricsMatcherService.matchTranscriptToLyrics(
      transcriptText,
      video.spotify_track_id
    );

    console.log(`  ✓ Matched lines ${lyricsMatch.startLineIndex}-${lyricsMatch.endLineIndex} (confidence: ${lyricsMatch.confidence})`);

    // Step 3: FA Lookup - Extract word timestamps from elevenlabs_word_alignments
    console.log(`  [3/3] Extracting word timestamps from FA data...`);
    const faLookupService = createFALookupService();
    const segments = await faLookupService.extractWordsForLines(
      video.spotify_track_id,
      lyricsMatch.startLineIndex,
      lyricsMatch.endLineIndex
    );

    const totalWords = segments.reduce((acc, seg) => acc + seg.words.length, 0);
    console.log(`  ✓ Extracted ${segments.length} segments with ${totalWords} words`);

    // Determine language from Voxtral result (fallback to 'en' for English)
    const language = voxtralResult.language || 'en';

    // Insert into tiktok_transcripts table with perfect timing
    await query(
      `INSERT INTO tiktok_transcripts (
        video_id,
        transcript_text,
        transcript_language,
        transcript_duration_s,
        transcript_word_count,
        transcript_segments
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (video_id) DO UPDATE SET
        transcript_text = EXCLUDED.transcript_text,
        transcript_language = EXCLUDED.transcript_language,
        transcript_duration_s = EXCLUDED.transcript_duration_s,
        transcript_word_count = EXCLUDED.transcript_word_count,
        transcript_segments = EXCLUDED.transcript_segments,
        updated_at = NOW()`,
      [video.video_id, lyricsMatch.matchedText, language, durationS, totalWords, JSON.stringify(segments)]
    );

    console.log(`  ✅ Transcribed with hybrid pipeline: ${totalWords} words, ${segments.length} segments`);

    return {
      metadata: {
        transcript_text: lyricsMatch.matchedText,
        transcript_language: language,
        transcript_duration_s: durationS,
        transcript_word_count: totalWords,
      },
    };
  }
}

// CLI wrapper
if (import.meta.main) {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const videoIdArg = args.find(arg => arg.startsWith('--videoId='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  const videoId = videoIdArg ? videoIdArg.split('=')[1] : undefined;

  const task = new TranscribeTikTokTask();
  await task.run({ limit, trackId: videoId });
}
