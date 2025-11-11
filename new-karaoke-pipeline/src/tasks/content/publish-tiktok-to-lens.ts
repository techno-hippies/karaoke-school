#!/usr/bin/env bun
/**
 * Publish TikTok Videos to Lens Protocol
 *
 * End-to-end workflow:
 * 1. Select TikTok videos without Lens posts
 * 2. Transcribe audio (Cartesia STT)
 * 3. Translate transcript (Gemini Flash 2.5)
 * 4. Create Lens post with video + translated content
 * 5. Track post in database
 *
 * Prerequisites:
 * - CARTESIA_API_KEY environment variable
 * - PRIVATE_KEY environment variable (Lens wallet)
 * - TikTok videos ingested in database
 * - Lens accounts created for artists
 *
 * Usage:
 *   bun src/tasks/content/publish-tiktok-to-lens.ts --limit=10
 *   bun src/tasks/content/publish-tiktok-to-lens.ts --videoId=<tiktok_video_id>
 */

import { query } from '../../db/connection';
import { createCartesiaService } from '../../services/cartesia';
import { LyricsTranslator } from '../../services/lyrics-translator';
import { createLensService } from '../../services/lens-protocol';
import { LENS_CONFIG, TRANSLATION_CONFIG } from '../../config';
import type { Address, Hex } from 'viem';

/**
 * TikTok video ready for publishing
 */
interface TikTokVideoForPublish {
  tiktok_video_id: string;
  video_url: string;
  spotify_artist_id: string;
  spotify_track_id: string;
  lens_account_address: Address | null;
  lens_handle: string | null;
}

/**
 * Published Lens post record
 */
interface LensPostRecord {
  tiktok_video_id: string;
  lens_post_id: string;
  lens_account_address: Address;
  transcript_text: string;
  translated_text: string;
  target_language: string;
  post_metadata_uri: string;
  transaction_hash: Hex;
  published_at: Date;
}

/**
 * Publish TikTok to Lens Task
 *
 * Orchestrates the complete workflow from TikTok video to published Lens post
 */
export class PublishTikTokToLensTask {
  private cartesiaService = createCartesiaService();
  private lyricsTranslator = new LyricsTranslator();
  private lensService = createLensService();

  /**
   * Select TikTok videos ready for publishing
   *
   * Criteria:
   * - Has video URL
   * - Artist has Lens account
   * - Not already published to Lens
   */
  async selectVideos(limit: number, videoId?: string): Promise<TikTokVideoForPublish[]> {
    const videoIdFilter = videoId ? `AND tv.tiktok_video_id = $2` : '';
    const params = videoId ? [limit, videoId] : [limit];

    return query<TikTokVideoForPublish>(
      `SELECT
        tv.tiktok_video_id,
        tv.video_url,
        tv.spotify_artist_id,
        tv.spotify_track_id,
        la.lens_account_address,
        la.lens_handle
      FROM tiktok_videos tv
      JOIN lens_accounts la ON tv.spotify_artist_id = la.spotify_artist_id
      LEFT JOIN lens_posts lp ON tv.tiktok_video_id = lp.tiktok_video_id
      WHERE tv.video_url IS NOT NULL
        AND la.lens_account_address IS NOT NULL
        AND lp.lens_post_id IS NULL
        ${videoIdFilter}
      ORDER BY tv.created_at DESC
      LIMIT $1`,
      params
    );
  }

  /**
   * Process a single TikTok video: STT → translate → post
   */
  async processVideo(video: TikTokVideoForPublish): Promise<LensPostRecord> {
    const { tiktok_video_id, video_url, lens_account_address, lens_handle } = video;

    if (!lens_account_address) {
      throw new Error('Missing Lens account address');
    }

    console.log(`\n📹 Processing: ${tiktok_video_id}`);
    console.log(`   Artist: @${lens_handle}`);
    console.log(`   Video: ${video_url}`);

    // Step 1: Transcribe audio with Cartesia STT
    console.log('\n   🎤 Step 1: Transcribing audio...');
    const transcription = await this.cartesiaService.transcribe(video_url, {
      wordTimestamps: true,
    });

    console.log(`   ✓ Transcribed: ${transcription.wordCount} words, ${transcription.duration.toFixed(1)}s`);
    console.log(`   Language: ${transcription.language}`);

    // Step 2: Translate transcript to target language
    // Use first target language from config (typically 'zh' for Chinese)
    const targetLanguage = TRANSLATION_CONFIG.defaultLanguages[0];
    console.log(`\n   🌐 Step 2: Translating to ${targetLanguage}...`);

    // Convert transcription to line format for translator
    const lines = transcription.segments.map((seg, idx) => ({
      lineIndex: idx,
      originalText: seg.text,
      start: seg.start,
      end: seg.end,
      words: seg.words.map(w => ({
        text: w.word,
        start: w.start,
        end: w.end,
      })),
    }));

    const translation = await this.lyricsTranslator.translateLyrics(
      lines,
      'en', // Source language (from STT detection)
      targetLanguage
    );

    const translatedText = translation.lines
      .map(line => line.translatedText)
      .join('\n');

    console.log(`   ✓ Translated: ${translation.lines.length} lines`);

    // Step 3: Create Lens post with video + bilingual caption
    console.log('\n   📤 Step 3: Publishing to Lens...');

    const postContent = this.buildPostContent(
      transcription.text,
      translatedText,
      targetLanguage
    );

    const postResult = await this.lensService.createPost({
      accountAddress: lens_account_address,
      content: postContent,
      videoUri: video_url,
      tags: ['karaoke', 'music', 'tiktok'],
      appId: LENS_CONFIG.feedAddress, // Associate with custom karaoke feed
    });

    console.log(`   ✓ Post created: ${postResult.postId}`);
    console.log(`   Transaction: ${postResult.transactionHash}`);

    // Step 4: Save to database
    const record: LensPostRecord = {
      tiktok_video_id,
      lens_post_id: postResult.postId,
      lens_account_address,
      transcript_text: transcription.text,
      translated_text: translatedText,
      target_language: targetLanguage,
      post_metadata_uri: postResult.metadataUri,
      transaction_hash: postResult.transactionHash,
      published_at: new Date(),
    };

    await this.saveLensPost(record);

    console.log(`   ✓ Saved to database\n`);

    return record;
  }

  /**
   * Build bilingual post content (English + Translation)
   */
  private buildPostContent(
    originalText: string,
    translatedText: string,
    targetLanguage: string
  ): string {
    const languageNames: Record<string, string> = {
      zh: '中文',
      vi: 'Tiếng Việt',
      id: 'Bahasa Indonesia',
      es: 'Español',
      ja: '日本語',
      ko: '한국어',
    };

    const languageName = languageNames[targetLanguage] || targetLanguage.toUpperCase();

    return `${originalText}

---

${languageName}:
${translatedText}

#KaraokeSchool #TikTok #Music`;
  }

  /**
   * Save Lens post to database
   */
  private async saveLensPost(record: LensPostRecord): Promise<void> {
    await query(
      `INSERT INTO lens_posts (
        tiktok_video_id,
        lens_post_id,
        lens_account_address,
        transcript_text,
        translated_text,
        target_language,
        post_metadata_uri,
        transaction_hash,
        published_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (tiktok_video_id) DO UPDATE SET
        lens_post_id = EXCLUDED.lens_post_id,
        post_metadata_uri = EXCLUDED.post_metadata_uri,
        transaction_hash = EXCLUDED.transaction_hash,
        published_at = EXCLUDED.published_at`,
      [
        record.tiktok_video_id,
        record.lens_post_id,
        record.lens_account_address,
        record.transcript_text,
        record.translated_text,
        record.target_language,
        record.post_metadata_uri,
        record.transaction_hash,
        record.published_at,
      ]
    );
  }

  /**
   * Main execution method
   */
  async run(options: { limit?: number; videoId?: string } = {}): Promise<void> {
    const limit = options.limit || 10;
    const videoId = options.videoId;

    console.log(`\n📱 Publishing TikTok videos to Lens (limit: ${limit})\n`);

    const videos = await this.selectVideos(limit, videoId);

    if (videos.length === 0) {
      console.log('✓ No videos ready for publishing\n');
      console.log('Possible reasons:');
      console.log('  - All videos already published');
      console.log('  - No Lens accounts created for artists');
      console.log('  - No TikTok videos ingested\n');
      return;
    }

    console.log(`Found ${videos.length} videos ready for publishing\n`);

    let successCount = 0;
    let failedCount = 0;

    for (const video of videos) {
      try {
        await this.processVideo(video);
        successCount++;
      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}\n`);
        failedCount++;
      }
    }

    console.log(
      `\n✓ Complete: ${successCount} published, ${failedCount} failed\n`
    );
  }
}

// CLI execution
if (import.meta.main) {
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;

  const videoIdArg = process.argv.find(arg => arg.startsWith('--videoId='));
  const videoId = videoIdArg ? videoIdArg.split('=')[1] : undefined;

  const task = new PublishTikTokToLensTask();
  task.run({ limit, videoId }).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
