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
 *
 * Note: Bun automatically loads .env file from project root
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
  grove_video_url: string | null;
  grove_thumbnail_url: string | null;
  creator_username: string;
  creator_lens_account_address: Address | null;
  creator_lens_handle: string | null;
  spotify_artist_id: string;
  spotify_track_id: string;
  artist_name: string;
  track_title: string;
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
  private cartesiaService?: ReturnType<typeof createCartesiaService>;
  private lyricsTranslator?: LyricsTranslator;
  private lensService?: ReturnType<typeof createLensService>;

  /**
   * Lazy initialization of services (called on first use)
   * This ensures .env is loaded before services are created
   */
  private ensureServices(): void {
    if (!this.cartesiaService) {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterKey) {
        throw new Error('OPENROUTER_API_KEY environment variable required');
      }

      this.cartesiaService = createCartesiaService();
      this.lyricsTranslator = new LyricsTranslator(openRouterKey);
      this.lensService = createLensService();
    }
  }

  /**
   * Select TikTok videos ready for publishing
   *
   * Criteria:
   * - Has video URL
   * - Artist has Lens account
   * - Not already published to Lens
   */
  async selectVideos(limit: number, videoId?: string): Promise<TikTokVideoForPublish[]> {
    const videoIdFilter = videoId ? `AND tv.video_id = $2` : '';
    const params = videoId ? [limit, videoId] : [limit];

    return query<TikTokVideoForPublish>(
      `SELECT
        tv.video_id as tiktok_video_id,
        tv.video_url,
        tv.grove_video_url,
        tv.grove_thumbnail_url,
        tv.creator_username,
        creator_la.lens_account_address as creator_lens_account_address,
        creator_la.lens_handle as creator_lens_handle,
        t.primary_artist_id as spotify_artist_id,
        tv.spotify_track_id,
        t.primary_artist_name as artist_name,
        t.title as track_title
      FROM tiktok_videos tv
      JOIN tracks t ON tv.spotify_track_id = t.spotify_track_id
      JOIN lens_accounts creator_la ON tv.creator_username = creator_la.tiktok_handle
      LEFT JOIN lens_posts lp ON tv.video_id = lp.tiktok_video_id
      WHERE tv.grove_video_url IS NOT NULL
        AND creator_la.lens_account_address IS NOT NULL
        AND lp.lens_post_id IS NULL
        ${videoIdFilter}
      ORDER BY tv.created_at DESC
      LIMIT $1`,
      params
    );
  }

  /**
   * Process a single TikTok video: post to Lens (simplified version without transcription)
   *
   * Note: Full workflow (STT → translate → post) requires video download infrastructure.
   * For now, we post the TikTok link directly with basic metadata.
   */
  async processVideo(video: TikTokVideoForPublish): Promise<LensPostRecord> {
    this.ensureServices();

    const {
      tiktok_video_id,
      grove_video_url,
      grove_thumbnail_url,
      creator_username,
      creator_lens_account_address,
      creator_lens_handle,
      artist_name,
      track_title,
      spotify_track_id
    } = video;

    if (!creator_lens_account_address) {
      throw new Error(`Missing Lens account for creator @${creator_username}`);
    }

    if (!grove_video_url) {
      throw new Error('Missing Grove video URL - video must be uploaded to Grove first');
    }

    console.log(`\n📹 Processing: ${tiktok_video_id}`);
    console.log(`   Creator: @${creator_lens_handle}`);
    console.log(`   Song: ${artist_name} - "${track_title}"`);
    console.log(`   Video: ${grove_video_url}`);
    console.log(`   Thumbnail: ${grove_thumbnail_url || 'none'}`);

    // Create post content from creator's perspective
    console.log('\n   📤 Publishing to Lens...');

    const postContent = `🎤 Singing "${track_title}" by ${artist_name}

#KaraokeSchool #${artist_name.replace(/\s+/g, '')} #Cover #TikTok`;

    const postResult = await this.lensService!.createPost({
      accountAddress: creator_lens_account_address,
      content: postContent,
      videoUri: grove_video_url,
      coverImageUri: grove_thumbnail_url || undefined,
      tags: ['karaoke', 'cover', 'music', 'tiktok'],
    });

    console.log(`   ✓ Post created: ${postResult.postId}`);
    console.log(`   Transaction: ${postResult.transactionHash}`);

    // Save to database (without transcription/translation for now)
    const record: LensPostRecord = {
      tiktok_video_id,
      lens_post_id: postResult.postId,
      lens_account_address: creator_lens_account_address,
      transcript_text: '', // TODO: Add transcription when video download is available
      translated_text: '',
      target_language: 'en',
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

    // Guard: Check for creators without PKP/Lens accounts
    const creatorsWithoutAccounts = await query<{ username: string; video_count: number }>(`
      SELECT tv.creator_username as username, COUNT(*) as video_count
      FROM tiktok_videos tv
      WHERE tv.grove_video_url IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM lens_accounts la
          WHERE la.tiktok_handle = tv.creator_username
            AND la.account_type = 'tiktok_creator'
        )
        ${videoId ? 'AND tv.video_id = $1' : ''}
      GROUP BY tv.creator_username
      ORDER BY video_count DESC`,
      videoId ? [videoId] : []
    );

    if (creatorsWithoutAccounts.length > 0) {
      console.log('⚠️  GUARD: Found creators without PKP/Lens accounts:\n');
      for (const creator of creatorsWithoutAccounts) {
        console.log(`   @${creator.username} (${creator.video_count} videos)`);
      }
      console.log('\n💡 Run identity pipeline first:');
      console.log('   bun src/tasks/identity/mint-pkps.ts --type=creator');
      console.log('   bun src/tasks/identity/create-lens-accounts.ts --type=tiktok_creator\n');
      throw new Error(`Cannot publish: ${creatorsWithoutAccounts.length} creator(s) need PKP/Lens accounts`);
    }

    const videos = await this.selectVideos(limit, videoId);

    if (videos.length === 0) {
      console.log('✓ No videos ready for publishing\n');
      console.log('Possible reasons:');
      console.log('  - All videos already published');
      console.log('  - No creators with videos and Lens accounts');
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
