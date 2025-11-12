/**
 * Task: Post TikTok Video to Lens Protocol
 *
 * Creates Lens posts for TikTok videos with translated captions.
 * This is the final step in the TikTok→Lens publishing pipeline.
 *
 * Prerequisites:
 * - Video uploaded to Grove (upload-grove task completed)
 * - Transcript + translation available (transcribe + translate tasks completed)
 * - Lens account exists for creator (lens_accounts table)
 *
 * Flow:
 * 1. Select videos ready for publishing
 * 2. Lookup creator's Lens account address
 * 3. Create post via Lens Protocol SDK
 * 4. Store post ID in tiktok_videos table (new column needed)
 *
 * Usage:
 *   bun src/tasks/tiktok/post-lens.ts --limit=10
 *   bun src/tasks/tiktok/post-lens.ts --videoId=7565931111373622550
 */

import { BaseTask, type BaseSubjectInput, type TaskResult, buildAudioTasksFilter } from '../../lib/base-task';
import { AudioTaskType } from '../../db/task-stages';
import { query } from '../../db/connection';
import { createLensService, type CreatePostParams } from '../../services/lens-protocol';
import { TRANSLATION_CONFIG } from '../../config';
import type { Address } from 'viem';

interface TikTokVideoInput extends BaseSubjectInput {
  video_id: string;
  creator_username: string;
  description: string | null;
  grove_video_url: string;
  grove_thumbnail_url: string | null;
  transcript_text: string;
  transcript_segments: any; // Cartesia segments JSONB
  transcript_language: string;
  translated_text: string | null;
  translation_target_language: string | null;
  lens_account_address: Address;
  lens_handle: string;
  spotify_track_id: string | null;
  track_title: string | null;
  track_artist: string | null;
  album_art_url: string | null;
  grc20_work_entity_id: string | null;
  grc20_artist_entity_id: string | null;
  subject_type: 'tiktok_video';
  subject_id: string;
}

interface PostResult extends TaskResult {
  metadata: {
    lens_post_id: string;
    lens_metadata_uri: string;
    lens_transaction_hash: string;
  };
}

export class PostTikTokLensTask extends BaseTask<TikTokVideoInput, PostResult> {
  readonly taskType = AudioTaskType.PostTikTokLens;
  readonly subjectType = 'tiktok_video' as const;
  private readonly preferredLanguage = TRANSLATION_CONFIG.defaultLanguages[0]; // 'zh' (Chinese - largest learner demographic)

  async selectTracks(limit: number, videoId?: string): Promise<TikTokVideoInput[]> {
    const filter = buildAudioTasksFilter(this.taskType, this.subjectType, 'video_id');

    if (videoId) {
      const results = await query<TikTokVideoInput>(
        `SELECT
          t.video_id,
          t.creator_username,
          t.description,
          t.grove_video_url,
          t.grove_thumbnail_url,
          transcripts.transcript_text,
          transcripts.transcript_segments,
          transcripts.transcript_language,
          tr.translated_text,
          tr.language_code as translation_target_language,
          la.lens_account_address,
          la.lens_handle,
          t.spotify_track_id,
          tracks.title as track_title,
          tracks.primary_artist_name as track_artist,
          st.album->>'image_url' as album_art_url,
          gw.grc20_entity_id as grc20_work_entity_id,
          ga.grc20_entity_id as grc20_artist_entity_id,
          'tiktok_video' as subject_type,
          t.video_id as subject_id
         FROM tiktok_videos t
         INNER JOIN tiktok_transcripts transcripts ON transcripts.video_id = t.video_id
         INNER JOIN tiktok_translations tr ON tr.video_id = t.video_id
         INNER JOIN lens_accounts la ON la.tiktok_handle = t.creator_username
         LEFT JOIN tracks ON tracks.spotify_track_id = t.spotify_track_id
         LEFT JOIN spotify_tracks st ON st.spotify_track_id = t.spotify_track_id
         LEFT JOIN grc20_works gw ON gw.spotify_track_id = t.spotify_track_id
         LEFT JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
         WHERE t.video_id = $1
           AND t.grove_video_url IS NOT NULL
           AND tr.language_code = $2
           AND la.lens_account_address IS NOT NULL
           -- AND t.tt2dsp IS NOT NULL
           -- AND t.tt2dsp::text != '{}'
           ${filter}
         LIMIT 1`,
        [videoId, this.preferredLanguage]
      );
      return results;
    }

    const results = await query<TikTokVideoInput>(
      `SELECT
        t.video_id,
        t.creator_username,
        t.description,
        t.grove_video_url,
        t.grove_thumbnail_url,
        transcripts.transcript_text,
        transcripts.transcript_segments,
        transcripts.transcript_language,
        tr.translated_text,
        tr.language_code as translation_target_language,
        la.lens_account_address,
        la.lens_handle,
        t.spotify_track_id,
        tracks.title as track_title,
        tracks.primary_artist_name as track_artist,
        st.album->>'image_url' as album_art_url,
        gw.grc20_entity_id as grc20_work_entity_id,
        ga.grc20_entity_id as grc20_artist_entity_id,
        'tiktok_video' as subject_type,
        t.video_id as subject_id
       FROM tiktok_videos t
       INNER JOIN tiktok_transcripts transcripts ON transcripts.video_id = t.video_id
       INNER JOIN tiktok_translations tr ON tr.video_id = t.video_id
       INNER JOIN lens_accounts la ON la.tiktok_handle = t.creator_username
       LEFT JOIN tracks ON tracks.spotify_track_id = t.spotify_track_id
       LEFT JOIN spotify_tracks st ON st.spotify_track_id = t.spotify_track_id
       LEFT JOIN grc20_works gw ON gw.spotify_track_id = t.spotify_track_id
       LEFT JOIN grc20_artists ga ON ga.id = gw.primary_artist_id
       WHERE t.grove_video_url IS NOT NULL
         AND tr.language_code = $1
         AND la.lens_account_address IS NOT NULL
         -- AND t.tt2dsp IS NOT NULL
         -- AND t.tt2dsp::text != '{}'
         ${filter}
       ORDER BY t.created_at DESC
       LIMIT $2`,
      [this.preferredLanguage, limit]
    );

    return results;
  }

  async processTrack(video: TikTokVideoInput): Promise<PostResult> {
    console.log(`  📝 Posting ${video.video_id} to Lens (@${video.lens_handle})...`);

    // Initialize Lens service
    const lensService = createLensService();

    // Build post content (translated text + original description)
    const postContent = this.buildPostContent(video);

    // Build tags (include GRC-20 entity IDs if available)
    const tags = ['tiktok', 'karaoke-school'];
    if (video.grc20_work_entity_id) {
      tags.push(`grc20-work-${video.grc20_work_entity_id}`);
    }
    if (video.grc20_artist_entity_id) {
      tags.push(`grc20-artist-${video.grc20_artist_entity_id}`);
    }
    if (video.spotify_track_id) {
      tags.push(`spotify-${video.spotify_track_id}`);
    }

    // Build attributes (song metadata for app display)
    const attributes: Array<{ type: 'Boolean' | 'Date' | 'Number' | 'String' | 'JSON'; key: string; value: string }> = [];

    // Add song metadata
    if (video.track_title) {
      attributes.push({ type: 'String', key: 'song_name', value: video.track_title });
    }
    if (video.track_artist) {
      attributes.push({ type: 'String', key: 'artist_name', value: video.track_artist });
    }
    if (video.album_art_url) {
      attributes.push({ type: 'String', key: 'album_art', value: video.album_art_url });
    }

    // Add entity IDs
    if (video.spotify_track_id) {
      attributes.push({ type: 'String', key: 'spotify_track_id', value: video.spotify_track_id });
    }
    if (video.grc20_work_entity_id) {
      attributes.push({ type: 'String', key: 'grc20_work_id', value: video.grc20_work_entity_id });
    }
    if (video.grc20_artist_entity_id) {
      attributes.push({ type: 'String', key: 'grc20_artist_id', value: video.grc20_artist_entity_id });
    }

    // Add TikTok video ID for transcription lookup
    attributes.push({ type: 'String', key: 'tiktok_video_id', value: video.video_id });

    // Build transcriptions attribute for karaoke overlay
    if (video.transcript_segments && Array.isArray(video.transcript_segments)) {
      const transcriptions: any = {
        languages: {}
      };

      // Add original language segments (use transcript_language as key)
      transcriptions.languages[video.transcript_language] = {
        segments: video.transcript_segments
      };

      // Add translated segments if available
      if (video.translated_text && video.translation_target_language) {
        // Create a single segment for the full translation
        // (We don't have word-level timing for translations yet)
        transcriptions.languages[video.translation_target_language] = {
          segments: [{
            text: video.translated_text,
            start: 0,
            end: video.transcript_segments[video.transcript_segments.length - 1]?.end || 0,
            words: []
          }]
        };
      }

      attributes.push({
        type: 'JSON',
        key: 'transcriptions',
        value: JSON.stringify(transcriptions)
      });
    }

    // Create post parameters
    const postParams: CreatePostParams = {
      accountAddress: video.lens_account_address,
      content: postContent,
      videoUri: video.grove_video_url,
      coverImageUri: video.grove_thumbnail_url || undefined,
      tags,
      attributes,
    };

    // Create post via Lens Protocol
    const result = await lensService.createPost(postParams);

    // Store post in lens_posts table
    await query(
      `INSERT INTO lens_posts (
        tiktok_video_id,
        lens_post_id,
        lens_account_address,
        transcript_text,
        translated_text,
        target_language,
        post_metadata_uri,
        transaction_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tiktok_video_id) DO UPDATE SET
        lens_post_id = EXCLUDED.lens_post_id,
        post_metadata_uri = EXCLUDED.post_metadata_uri,
        transaction_hash = EXCLUDED.transaction_hash,
        published_at = NOW(),
        updated_at = NOW()`,
      [
        video.video_id,
        result.postId,
        video.lens_account_address,
        video.transcript_text,
        video.translated_text || video.transcript_text,
        video.translation_target_language || 'en',
        result.metadataUri,
        result.transactionHash,
      ]
    );

    console.log(`  ✅ Posted to Lens: ${result.postId}`);

    return {
      metadata: {
        lens_post_id: result.postId,
        lens_metadata_uri: result.metadataUri,
        lens_transaction_hash: result.transactionHash,
      },
    };
  }

  /**
   * Build post content (caption only)
   *
   * Song metadata, GRC-20 IDs, and other structured data are stored in attributes,
   * not in the visible caption. The app extracts metadata from attributes to render
   * song info in the UI.
   */
  private buildPostContent(video: TikTokVideoInput): string {
    // Use translated text if available, otherwise original transcript
    const captionText = video.translated_text || video.transcript_text;

    // Return clean caption without any metadata pollution
    return captionText || '';
  }
}

// CLI wrapper
if (import.meta.main) {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const videoIdArg = args.find(arg => arg.startsWith('--videoId='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  const videoId = videoIdArg ? videoIdArg.split('=')[1] : undefined;

  const task = new PostTikTokLensTask();
  await task.run({ limit, trackId: videoId });
}
