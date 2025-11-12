#!/usr/bin/env bun
/**
 * Detect Video→Song Mismatches
 *
 * Reconciliation script to flag TikTok videos where the linked Spotify track
 * doesn't match the TikTok music metadata.
 *
 * Detection methods:
 * 1. Music title mismatch (TikTok music_title vs Spotify track title)
 * 2. Artist name mismatch (TikTok music_author vs Spotify artist name)
 * 3. Generic/placeholder music (e.g., "som original", "original sound")
 *
 * Sets needs_review=TRUE for flagged videos with detailed review_reason.
 *
 * Usage:
 *   bun src/tasks/quality/detect-video-song-mismatches.ts --limit=100
 *   bun src/tasks/quality/detect-video-song-mismatches.ts --videoId=<video_id>
 */

import { query } from '../../db/connection';
import { parseArgs } from 'util';

interface VideoWithMetadata {
  video_id: string;
  creator_username: string;
  music_title: string | null;
  music_author: string | null;
  spotify_track_id: string;
  track_title: string;
  artist_name: string;
  mapping_verified: boolean;
  needs_review: boolean;
  spotify_track_id_source: string;
}

interface MismatchResult {
  video_id: string;
  reason: string;
  tiktok_music: string;
  spotify_track: string;
  confidence: number;
}

/**
 * Detect Video→Song Mismatch Task
 */
export class DetectVideoSongMismatchesTask {
  /**
   * Fetch videos with their TikTok and Spotify metadata
   */
  async fetchVideos(limit: number, videoId?: string): Promise<VideoWithMetadata[]> {
    const videoIdFilter = videoId ? 'AND tv.video_id = $2' : '';
    const params = videoId ? [limit, videoId] : [limit];

    return query<VideoWithMetadata>(
      `SELECT
        tv.video_id,
        tv.creator_username,
        tv.music_title,
        tv.music_author,
        tv.spotify_track_id,
        t.title as track_title,
        t.primary_artist_name as artist_name,
        tv.mapping_verified,
        tv.needs_review,
        tv.spotify_track_id_source
      FROM tiktok_videos tv
      JOIN tracks t ON tv.spotify_track_id = t.spotify_track_id
      WHERE tv.spotify_track_id IS NOT NULL
        ${videoIdFilter}
      ORDER BY tv.created_at DESC
      LIMIT $1`,
      params
    );
  }

  /**
   * Normalize string for comparison (lowercase, remove special chars, trim)
   */
  private normalizeString(str: string | null): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if music title/author indicates generic/placeholder content
   */
  private isGenericMusic(title: string | null, author: string | null): boolean {
    if (!title && !author) return false;

    const genericPatterns = [
      'som original',
      'original sound',
      'original audio',
      'áudio original',
      'sonido original',
      'suono originale',
      'оригинальный звук',
    ];

    const normalized = this.normalizeString(title || author || '');
    return genericPatterns.some(pattern => normalized.includes(pattern));
  }

  /**
   * Calculate similarity between two strings (simple Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const norm1 = this.normalizeString(str1);
    const norm2 = this.normalizeString(str2);

    if (norm1 === norm2) return 1.0;
    if (!norm1 || !norm2) return 0.0;

    // Check for substring match
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.7;
    }

    // Simple word overlap
    const words1 = new Set(norm1.split(' '));
    const words2 = new Set(norm2.split(' '));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Analyze a single video for mismatches
   */
  analyzeVideo(video: VideoWithMetadata): MismatchResult | null {
    // Skip already verified
    if (video.mapping_verified) {
      return null;
    }

    // Check for generic music (high confidence mismatch)
    if (this.isGenericMusic(video.music_title, video.music_author)) {
      return {
        video_id: video.video_id,
        reason: 'Generic/placeholder TikTok music metadata',
        tiktok_music: `"${video.music_title}" by ${video.music_author}`,
        spotify_track: `"${video.track_title}" by ${video.artist_name}`,
        confidence: 0.0,
      };
    }

    // Calculate title similarity
    const titleSimilarity = this.calculateSimilarity(
      video.music_title || '',
      video.track_title
    );

    // Calculate artist similarity
    const artistSimilarity = this.calculateSimilarity(
      video.music_author || '',
      video.artist_name
    );

    // Flag if both title and artist have low similarity
    if (titleSimilarity < 0.5 && artistSimilarity < 0.5) {
      return {
        video_id: video.video_id,
        reason: 'TikTok music metadata does not match Spotify track',
        tiktok_music: `"${video.music_title}" by ${video.music_author}`,
        spotify_track: `"${video.track_title}" by ${video.artist_name}`,
        confidence: Math.max(titleSimilarity, artistSimilarity),
      };
    }

    // Flag if title has very low similarity (even if artist matches)
    if (titleSimilarity < 0.3) {
      return {
        video_id: video.video_id,
        reason: 'TikTok music title does not match Spotify track title',
        tiktok_music: `"${video.music_title}" by ${video.music_author}`,
        spotify_track: `"${video.track_title}" by ${video.artist_name}`,
        confidence: titleSimilarity,
      };
    }

    return null;
  }

  /**
   * Update video with mismatch flag
   */
  async flagMismatch(mismatch: MismatchResult): Promise<void> {
    await query(
      `UPDATE tiktok_videos
       SET needs_review = TRUE,
           review_reason = $2,
           spotify_track_id_confidence = $3
       WHERE video_id = $1`,
      [
        mismatch.video_id,
        `${mismatch.reason}: TikTok=${mismatch.tiktok_music}, Spotify=${mismatch.spotify_track}`,
        mismatch.confidence,
      ]
    );
  }

  /**
   * Main execution method
   */
  async run(options: { limit?: number; videoId?: string } = {}): Promise<void> {
    const limit = options.limit || 100;
    const videoId = options.videoId;

    console.log(`\n🔍 Detecting video→song mismatches (limit: ${limit})\n`);

    const videos = await this.fetchVideos(limit, videoId);

    if (videos.length === 0) {
      console.log('✓ No videos found to analyze\n');
      return;
    }

    console.log(`Found ${videos.length} videos to analyze\n`);

    let mismatchCount = 0;
    let matchCount = 0;
    let alreadyReviewedCount = 0;

    for (const video of videos) {
      if (video.mapping_verified) {
        alreadyReviewedCount++;
        continue;
      }

      const mismatch = this.analyzeVideo(video);

      if (mismatch) {
        console.log(`⚠️  MISMATCH: ${video.video_id}`);
        console.log(`   TikTok:  ${mismatch.tiktok_music}`);
        console.log(`   Spotify: ${mismatch.spotify_track}`);
        console.log(`   Confidence: ${(mismatch.confidence * 100).toFixed(0)}%`);
        console.log(`   Reason: ${mismatch.reason}\n`);

        await this.flagMismatch(mismatch);
        mismatchCount++;
      } else {
        matchCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Matches: ${matchCount}`);
    console.log(`⚠️  Mismatches: ${mismatchCount}`);
    console.log(`🔒 Already Verified: ${alreadyReviewedCount}`);
    console.log('='.repeat(60) + '\n');

    if (mismatchCount > 0) {
      console.log('💡 Next steps:');
      console.log('   1. Review flagged videos manually');
      console.log('   2. Update mapping_verified=TRUE for correct mappings');
      console.log('   3. Re-assign spotify_track_id for incorrect mappings\n');
    }
  }
}

// CLI execution
if (import.meta.main) {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '100' },
      videoId: { type: 'string' },
    },
  });

  const limit = parseInt(values.limit || '100');
  const videoId = values.videoId;

  const task = new DetectVideoSongMismatchesTask();
  task.run({ limit, videoId }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
