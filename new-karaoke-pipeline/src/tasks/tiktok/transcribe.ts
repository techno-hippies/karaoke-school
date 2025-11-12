/**
 * Task: Transcribe TikTok Video (Cartesia STT)
 *
 * Uses Cartesia Ink-Whisper STT to transcribe TikTok videos.
 * Stores results in tiktok_transcripts table.
 *
 * Prerequisites:
 * - Video must have grove_video_url (upload-grove task completed)
 *
 * Flow:
 * 1. Select videos with Grove URLs but no transcripts
 * 2. Download video from Grove
 * 3. Call Cartesia STT API
 * 4. Insert transcript into tiktok_transcripts table
 *
 * Usage:
 *   bun src/tasks/tiktok/transcribe.ts --limit=10
 *   bun src/tasks/tiktok/transcribe.ts --videoId=7565931111373622550
 */

import { BaseTask, type BaseSubjectInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { AudioTaskType } from '../../db/task-stages';
import { query } from '../../db/connection';
import { createCartesiaService } from '../../services/cartesia';

interface TikTokVideoInput extends BaseSubjectInput {
  video_id: string;
  creator_username: string;
  grove_video_url: string;
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
          'tiktok_video' as subject_type,
          t.video_id as subject_id
         FROM tiktok_videos t
         WHERE t.video_id = $1
           AND t.grove_video_url IS NOT NULL
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
        'tiktok_video' as subject_type,
        t.video_id as subject_id
       FROM tiktok_videos t
       WHERE t.grove_video_url IS NOT NULL
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
    console.log(`  🎤 Transcribing ${video.video_id}...`);

    // Use Cartesia service to transcribe video
    const cartesiaService = createCartesiaService();
    const transcription = await cartesiaService.transcribe(video.grove_video_url);

    const transcriptText = transcription.text;
    const language = transcription.language;
    const durationS = transcription.duration;
    const wordCount = transcription.wordCount;
    const segments = transcription.segments;

    // Insert into tiktok_transcripts table with segments
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
      [video.video_id, transcriptText, language, durationS, wordCount, JSON.stringify(segments)]
    );

    console.log(`  ✅ Transcribed: ${wordCount} words (${language}), ${segments.length} segments`);

    return {
      metadata: {
        transcript_text: transcriptText,
        transcript_language: language,
        transcript_duration_s: durationS,
        transcript_word_count: wordCount,
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
