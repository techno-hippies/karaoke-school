#!/usr/bin/env bun
/**
 * Post Clip Script
 *
 * Posts a karaoke video clip to Lens Protocol.
 *
 * Usage:
 *   bun src/scripts/post-clip.ts --video-id=<uuid> --account=scarlett
 *   bun src/scripts/post-clip.ts --video-id=<uuid> --account=scarlett --ai-cover=./ai-cover.mp3
 *   bun src/scripts/post-clip.ts --video-id=<uuid> --account=scarlett --content="Check out this karaoke!"
 *   bun src/scripts/post-clip.ts --video-id=<uuid> --account=scarlett --visual-tags="death-note,anime,dark"
 */

import { parseArgs } from 'util';
import type { Address } from 'viem';
import { query, queryOne } from '../db/connection';
import { getAccountByHandle, createPost, getSongByISWC } from '../db/queries';
import { uploadMetadataToGrove, uploadVideoToGrove, uploadAudioToGrove, uploadImageToGrove } from '../services/grove';
import { postToLens, createPostMetadata } from '../services/lens';
import { validateEnv } from '../config';
import { safeValidatePostMetadata, formatZodErrors } from '../lib/schemas';
import type { Video, Song, Account } from '../types';

// Parse CLI arguments
const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'video-id': { type: 'string' },
    account: { type: 'string' },
    content: { type: 'string' },
    'ai-cover': { type: 'string' },
    tags: { type: 'string' }, // Comma-separated general tags
    'visual-tags': { type: 'string' }, // Comma-separated visual content tags (death-note, cosplay, anime)
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

async function main() {
  // Validate required env (Grove doesn't need API key - uses chain_id auth)
  validateEnv(['DATABASE_URL', 'PRIVATE_KEY']);

  // Validate required args
  if (!values['video-id']) {
    console.error('❌ Missing required argument: --video-id');
    console.log('\nUsage:');
    console.log('  bun src/scripts/post-clip.ts --video-id=<uuid> --account=scarlett');
    process.exit(1);
  }

  if (!values.account) {
    console.error('❌ Missing required argument: --account');
    process.exit(1);
  }

  console.log('\n📤 Posting Clip to Lens');
  console.log(`   Video ID: ${values['video-id']}`);
  console.log(`   Account: ${values.account}`);

  if (values['dry-run']) {
    console.log('   Mode: DRY RUN (no transactions)');
  }

  // Get account
  const account = await getAccountByHandle(values.account);
  if (!account) {
    console.error(`❌ Account not found: ${values.account}`);
    process.exit(1);
  }

  if (!account.lens_account_address) {
    console.error(`❌ Account ${values.account} does not have a Lens account`);
    console.log('   Run create-lens-account.ts first');
    process.exit(1);
  }

  console.log(`   Lens Handle: ${account.lens_handle}`);
  console.log(`   Lens Address: ${account.lens_account_address}`);

  // Get video
  const video = await queryOne<Video>(
    `SELECT * FROM videos WHERE id = $1`,
    [values['video-id']]
  );

  if (!video) {
    console.error(`❌ Video not found: ${values['video-id']}`);
    process.exit(1);
  }

  // Get song
  const song = await queryOne<Song>(
    `SELECT * FROM songs WHERE id = $1`,
    [video.song_id]
  );

  if (!song) {
    console.error(`❌ Song not found for video`);
    process.exit(1);
  }

  console.log(`   Song: ${song.title}`);
  console.log(`   Snippet: ${video.snippet_start_ms}ms - ${video.snippet_end_ms}ms`);

  // Check if video file exists locally
  let videoUrl = video.output_video_url;
  const localVideoPath = videoUrl; // Keep original for thumbnail extraction

  if (!videoUrl) {
    console.error('❌ Video has no output URL. Generate the video first.');
    process.exit(1);
  }

  // Extract thumbnail BEFORE uploading (need local file)
  let coverImageUrl: string | undefined;
  if (localVideoPath && !localVideoPath.startsWith('http') && !localVideoPath.startsWith('grove://')) {
    console.log('\n🖼️  Extracting video thumbnail...');
    const thumbnailPath = localVideoPath.replace(/\.[^.]+$/, '-thumb.jpg');
    const { execSync } = await import('child_process');
    try {
      execSync(`ffmpeg -i "${localVideoPath}" -ss 00:00:02 -vframes 1 -update 1 -q:v 2 "${thumbnailPath}" -y`, { stdio: 'pipe' });
      const thumbBuffer = Buffer.from(await Bun.file(thumbnailPath).arrayBuffer());
      const thumbResult = await uploadImageToGrove(thumbBuffer, 'thumbnail.jpg');
      coverImageUrl = thumbResult.url;
      console.log(`   Thumbnail: ${coverImageUrl}`);
    } catch (e) {
      console.log('   ⚠️ Could not extract thumbnail, will use Spotify image');
    }
  }

  // If videoUrl is a local path, upload to Grove
  if (!videoUrl.startsWith('http') && !videoUrl.startsWith('grove://')) {
    console.log('\n☁️  Uploading video to Grove...');
    const videoBuffer = Buffer.from(await Bun.file(videoUrl).arrayBuffer());
    const uploadResult = await uploadVideoToGrove(videoBuffer, `${song.iswc}-clip.mp4`);
    videoUrl = uploadResult.url;
    console.log(`   URL: ${videoUrl}`);

    // Update database
    await query(
      `UPDATE videos SET output_video_url = $2 WHERE id = $1`,
      [video.id, videoUrl]
    );
  }

  // Upload AI cover if provided
  let aiCoverUrl: string | undefined;
  if (values['ai-cover']) {
    console.log('\n🎵 Uploading AI cover...');
    const aiCoverBuffer = Buffer.from(await Bun.file(values['ai-cover']).arrayBuffer());
    const uploadResult = await uploadAudioToGrove(aiCoverBuffer, 'ai-cover.mp3');
    aiCoverUrl = uploadResult.url;
    console.log(`   URL: ${aiCoverUrl}`);
  }

  // Prepare post content
  const defaultContent = `🎤 Karaoke time! "${song.title}" - Practice your singing with our bilingual subtitles!\n\n#karaoke #languagelearning #music`;
  const content = values.content || defaultContent;
  const tags = values.tags?.split(',').map((t) => t.trim()) || ['karaoke', 'music', 'languagelearning'];
  const visualTags = values['visual-tags']?.split(',').map((t) => t.trim()) || [];

  console.log('\n📝 Post content:');
  console.log(`   ${content.slice(0, 100)}...`);
  console.log(`   Tags: ${tags.join(', ')}`);
  if (visualTags.length > 0) {
    console.log(`   Visual tags: ${visualTags.join(', ')}`);
  }

  // Get artist info with slug
  const artist = song.artist_id ? await queryOne<{ name: string; slug: string | null; image_grove_url?: string }>(
    `SELECT name, slug, image_grove_url FROM artists WHERE id = $1`,
    [song.artist_id]
  ) : null;

  // Get Spotify album art for the song (separate from video thumbnail)
  const spotifyImages = song.spotify_images as Array<{ url: string; width: number; height: number }> | null;
  const spotifyAlbumArt = spotifyImages?.[0]?.url;

  // Fall back to Spotify image if no video thumbnail was extracted
  if (!coverImageUrl) {
    coverImageUrl = spotifyAlbumArt;
  }

  // Validate required psychographic tags BEFORE creating metadata
  console.log('\n🔍 Validating psychographic tags...');
  const lyricTags = song.lyric_tags || [];

  if (visualTags.length === 0) {
    console.error('❌ Missing required --visual-tags');
    console.log('   Visual tags describe video content (e.g., "anime,streetwear,cosplay")');
    console.log('   These are provided manually based on what\'s in the video.');
    process.exit(1);
  }

  if (lyricTags.length === 0) {
    console.error('❌ Missing lyric_tags in database');
    console.log('   Run: bun src/scripts/generate-lyric-tags.ts --iswc=' + song.iswc);
    console.log('   This generates psychographic tags from song lyrics via AI.');
    process.exit(1);
  }

  console.log(`   Visual tags: ${visualTags.join(', ')}`);
  console.log(`   Lyric tags: ${lyricTags.join(', ')}`);

  // Create and upload metadata with slug-based linking
  console.log('\n📋 Creating metadata...');
  console.log(`   Artist slug: ${artist?.slug}`);
  console.log(`   Song slug: ${song.slug}`);
  console.log(`   Video thumbnail: ${coverImageUrl}`);
  console.log(`   Album art: ${spotifyAlbumArt}`);

  const metadata = await createPostMetadata({
    content,
    title: `${song.title} - Karaoke`,
    tags,
    videoUrl,
    audioUrl: aiCoverUrl,
    coverImageUrl, // Video thumbnail (frame from video)
    // Primary: slugs for clean URL routing (e.g., /eminem/lose-yourself)
    artistSlug: artist?.slug || undefined,
    songSlug: song.slug || undefined,
    songName: song.title,
    artistName: artist?.name,
    albumArt: spotifyAlbumArt, // Spotify album art (the actual song artwork)
    // Legacy: keep spotify_track_id for backwards compatibility
    spotifyTrackId: song.spotify_track_id || undefined,
    // Content tags for AI chat context (psychographics)
    visualTags,
    lyricTags,
  });

  // Validate metadata with Zod schema before uploading
  const validationResult = safeValidatePostMetadata({
    content,
    title: `${song.title} - Karaoke`,
    videoUrl,
    coverImageUrl,
    artistSlug: artist?.slug,
    songSlug: song.slug,
    songName: song.title,
    artistName: artist?.name || 'Unknown Artist',
    visualTags,
    lyricTags,
    audioUrl: aiCoverUrl,
    albumArt: spotifyAlbumArt,
    spotifyTrackId: song.spotify_track_id || undefined,
    tags,
  });

  if (!validationResult.success) {
    console.error('\n❌ Metadata validation failed:');
    console.error(formatZodErrors(validationResult.error));
    process.exit(1);
  }
  console.log('   ✅ Metadata validated');

  const metadataResult = await uploadMetadataToGrove(metadata, 'post-metadata.json');
  // Use HTTPS URL for contentUri (grove:// not supported by all apps)
  const contentUri = metadataResult.url;
  console.log(`   Metadata URL: ${contentUri}`);

  if (values['dry-run']) {
    console.log('\n🔸 DRY RUN - Skipping Lens transaction');
    console.log('   Would post to:', account.lens_account_address);
    console.log('   Metadata:', contentUri);
    process.exit(0);
  }

  // Post to Lens
  console.log('\n🔗 Posting to Lens...');
  const postResult = await postToLens(
    account.lens_account_address as Address,
    contentUri
  );

  console.log(`   ✅ Posted successfully!`);
  console.log(`   Post ID: ${postResult.postId}`);
  console.log(`   Transaction: ${postResult.transactionHash}`);

  // Save to database
  console.log('\n💾 Saving to database...');
  const post = await createPost({
    account_id: account.id,
    song_id: song.id,
    video_id: video.id,
    ai_cover_audio_url: aiCoverUrl,
    lens_post_id: postResult.postId,
    content,
    tags,
    metadata_uri: contentUri,
    transaction_hash: postResult.transactionHash,
  });

  console.log(`   Post ID: ${post.id}`);

  // Summary
  console.log('\n✅ Clip posted successfully');
  console.log(`   Lens Post: ${postResult.postId}`);
  console.log(`   View: https://testnet.lens.xyz/p/${postResult.postId}`);
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
