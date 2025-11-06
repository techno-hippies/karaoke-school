#!/usr/bin/env bun
/**
 * Pipeline Step 14: Post to Lens Feed
 *
 * Posts copyrighted TikTok creator videos to Lens Protocol custom feed
 * Prerequisites:
 *   - Video minted to Story Protocol (Step 13)
 *   - Creator has Lens account
 *
 * Process:
 *   1. Query videos ready for Lens posting
 *   2. Authenticate as creator's Lens account
 *   3. Build video metadata with Story Protocol references
 *   4. Upload metadata to Grove
 *   5. Create post to Lens feed
 *   6. Update database with post info
 *
 * Usage:
 *   bun src/processors/post-lens-feed.ts --limit=3
 *   bun src/processors/post-lens-feed.ts --video-id=7558957526327332118
 */

import { parseArgs } from 'util';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { post as createPost } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { shortVideo, MediaVideoMimeType } from '@lens-protocol/metadata';
import { StorageClient, lensAccountOnly } from '@lens-chain/storage-client';
import { chains } from '@lens-chain/sdk/viem';
import { createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { query } from '../db/neon';

/**
 * Chunk STT word timestamps into subtitle-style segments
 * Avoids the issue of showing all 50+ words at once
 */
function chunkSttWordsIntoSegments(
  wordTimestamps: any[],
  maxWordsPerSegment: number = 8,
  maxSegmentDuration: number = 3000,
  fullText: string
): any[] {
  if (wordTimestamps.length === 0) return [];

  const segments = [];
  let currentSegment = [];
  let currentStartTime = null;
  
  for (let i = 0; i < wordTimestamps.length; i++) {
    const word = wordTimestamps[i];
    
    // Start new segment if needed
    if (currentSegment.length === 0) {
      currentStartTime = word.start;
      currentSegment = [];
    }
    
    currentSegment.push(word);
    
    // Check if we should end the current segment
    const segmentDuration = word.end - currentStartTime;
    const shouldEnd = 
      // Reached maximum word count OR exceeded duration
      (currentSegment.length >= maxWordsPerSegment) ||
      (segmentDuration >= maxSegmentDuration) ||
      // At the end of all words
      (i === wordTimestamps.length - 1);
    
    if (shouldEnd) {
      // Create segment
      const segmentText = currentSegment
        .map(w => w.text)
        .join(' ')
        .trim();
      
      const segmentStart = currentSegment[0].start;
      const segmentEnd = currentSegment[currentSegment.length - 1].end;
      
      // Only add segments with actual text
      if (segmentText.length > 0) {
        segments.push({
          text: segmentText,
          start: segmentStart,
          end: segmentEnd,
          words: currentSegment.map(w => ({
            word: w.text,
            text: w.text,
            start: w.start,
            end: w.end,
          })),
        });
      }
      
      // Reset for next segment
      currentSegment = [];
    }
  }
  
  return segments;
}

/**
 * Match translation lines to English segments by timing overlap
 * This creates subtitle segments where each English segment gets all translation lines that overlap with it
 */
function matchTranslationLinesToSegments(
  translationLines: Array<{
    lineIndex: number;
    originalText: string;
    translatedText: string;
    start: number;
    end: number;
  }>,
  englishSegments: Array<{
    text: string;
    start: number;
    end: number;
    words?: any[];
  }>
): any[] {
  if (translationLines.length === 0 || englishSegments.length === 0) {
    return [];
  }

  const translationSegments = [];

  for (const engSegment of englishSegments) {
    // Find all translation lines that overlap with this English segment
    const overlappingLines = translationLines.filter(line => {
      // Line overlaps if: line.start < segment.end AND line.end > segment.start
      return line.start < engSegment.end && line.end > engSegment.start;
    });

    if (overlappingLines.length === 0) {
      // No matching translation lines - this shouldn't happen but handle gracefully
      // Use empty string to maintain segment count
      translationSegments.push({
        text: '',
        start: engSegment.start,
        end: engSegment.end,
      });
      continue;
    }

    // Concatenate the translated text from all overlapping lines
    const combinedText = overlappingLines
      .map(line => line.translatedText)
      .join(' ')
      .trim();

    translationSegments.push({
      text: combinedText,
      start: engSegment.start,
      end: engSegment.end,
    });
  }

  return translationSegments;
}

/**
 * DEPRECATED: Old function that tried to chunk full translation text
 * Kept for backwards compatibility but should not be used
 */
function chunkTranslationIntoSegments(
  fullTranslationText: string,
  targetSegmentCount: number,
  overallStartTime: number,
  overallEndTime: number
): any[] {
  if (targetSegmentCount <= 0 || !fullTranslationText.trim()) {
    return [];
  }

  // Split translation into roughly equal chunks
  const words = fullTranslationText.trim().split(/\s+/);
  
  if (words.length === 0) {
    return [{
      text: fullTranslationText.trim(),
      start: overallStartTime,
      end: overallEndTime,
    }];
  }

  // Calculate words per segment (distribute evenly)
  const baseWordsPerSegment = Math.floor(words.length / targetSegmentCount);
  const extraWords = words.length % targetSegmentCount;

  const segments = [];
  let wordIndex = 0;

  for (let segmentIndex = 0; segmentIndex < targetSegmentCount; segmentIndex++) {
    // Distribute extra words to first few segments
    const segmentWordCount = baseWordsPerSegment + (segmentIndex < extraWords ? 1 : 0);
    
    if (segmentWordCount > 0 && wordIndex < words.length) {
      const segmentWords = words.slice(wordIndex, wordIndex + segmentWordCount);
      wordIndex += segmentWordCount;
      
      // Calculate timing proportionally
      const segmentStart = overallStartTime + 
        ((overallEndTime - overallStartTime) * (segmentIndex / targetSegmentCount));
      const segmentEnd = overallStartTime + 
        ((overallEndTime - overallStartTime) * ((segmentIndex + 1) / targetSegmentCount));
      
      segments.push({
        text: segmentWords.join(' ').trim(),
        start: segmentStart,
        end: segmentEnd,
      });
    } else {
      // Fallback: use overall timing
      segments.push({
        text: fullTranslationText.trim(),
        start: overallStartTime,
        end: overallEndTime,
      });
      break;
    }
  }
  
  return segments;
}

interface VideoForPosting {
  video_id: string;
  creator_username: string;
  creator_nickname: string | null;
  creator_lens_address: string;
  creator_pkp_address: string;

  spotify_track_id: string;
  track_title: string;
  artist_name: string;
  track_image_url: string | null;
  work_grc20_id: string | null;

  grove_video_cid: string;
  grove_thumbnail_cid: string | null;
  video_url: string | null;

  story_ip_id: string;
  story_metadata_uri: string;
  story_tx_hash: string;

  transcription_text: string;
  detected_language: string;

  lens_post_attempts: number;
}

// Lens app and feed addresses
const APP_ADDRESS = '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0';
const FEED_ADDRESS = '0x5941b291E69069769B8e309746b301928C816fFa';

/**
 * Post a single video to Lens feed
 */
async function postVideo(video: VideoForPosting): Promise<void> {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📹 Video: ${video.video_id}`);
  console.log(`🎵 Song: ${video.track_title} by ${video.artist_name}`);
  console.log(`👤 Creator: @${video.creator_username} (${video.creator_nickname || 'N/A'})`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Setup wallet client with admin key
  console.log('🔑 Setting up wallet client...');
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  const formattedKey = (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);

  const walletClient = createWalletClient({
    account,
    chain: chains.testnet,
    transport: http(),
  });

  console.log(`   Wallet: ${account.address}`);
  console.log(`   Lens Account: ${video.creator_lens_address}`);

  // Setup Lens public client
  console.log('\n🔗 Setting up Lens client...');
  const publicClient = PublicClient.create({
    environment: testnet,
    origin: 'https://karaoke-school.ai',
  });

  // Authenticate as creator
  console.log('\n🔐 Authenticating as creator...');
  const authenticated = await publicClient.login({
    accountOwner: {
      account: evmAddress(video.creator_lens_address),
      owner: evmAddress(account.address),
      app: evmAddress(APP_ADDRESS),
    },
    signMessage: signMessageWith(walletClient),
  });

  if (authenticated.isErr()) {
    throw new Error(`Authentication failed: ${authenticated.error.message}`);
  }

  const sessionClient = authenticated.value;
  console.log('   ✅ Authenticated with Lens');

  // Setup Grove storage
  console.log('\n📝 Building post metadata...');
  const storageClient = StorageClient.create();
  const chainId = chains.testnet.id;
  const acl = lensAccountOnly(video.creator_lens_address as `0x${string}`, chainId);

  // Build post content (keep it simple - just song info)
  const creatorName = video.creator_nickname || video.creator_username;
  const contentText = `🎵 ${video.track_title} by ${video.artist_name}`;

  // Build video URL and thumbnail URL
  const groveVideoUrl = `https://api.grove.storage/${video.grove_video_cid}`;
  const groveThumbnailUrl = video.grove_thumbnail_cid
    ? `https://api.grove.storage/${video.grove_thumbnail_cid}`
    : groveVideoUrl; // Fallback to video if no thumbnail

  // Fetch TikTok video transcriptions (STT data for this specific clip)
  console.log('\n🎤 Fetching video transcriptions...');

  interface VideoTranscription {
    word_timestamps: Array<{
      text: string;
      start: number;
      end: number;
      type: string;
    }>;
    transcription_text: string;
    structured_segments?: {
      segments: Array<{
        english: string;
        startTime: number;
        endTime: number;
        wordIndices: number[];
        translations: {
          zh: string;
          vi: string;
          id: string;
        };
      }>;
      model: string;
      processedAt: string;
    };
  }

  interface VideoTranslation {
    language_code: string;
    lines: Array<{
      lineIndex: number;
      originalText: string;
      translatedText: string;
      start: number;
      end: number;
      words?: Array<{ text: string; start: number; end: number }>;
    }>;
  }

  const transcriptions = await query<VideoTranscription>(`
    SELECT word_timestamps, transcription_text, structured_segments
    FROM tiktok_video_transcriptions
    WHERE video_id = $1
  `, [video.video_id]);

  // Fetch line-by-line translations from lyrics_translations (NOT the blob from tiktok_video_transcription_translations)
  const translations = await query<VideoTranslation>(`
    SELECT language_code, lines
    FROM lyrics_translations
    WHERE spotify_track_id = $1
  `, [video.spotify_track_id]);

  // Build transcriptions object for karaoke overlay
  const transcriptionsData: any = { languages: {} };

  if (transcriptions.length > 0) {
    const transcription = transcriptions[0];

    // Check if we have pre-processed structured segments from Gemini
    if (transcription.structured_segments && transcription.structured_segments.segments) {
      console.log(`   ✨ Using pre-processed Gemini segments (${transcription.structured_segments.model})`);

      const geminiSegments = transcription.structured_segments.segments;
      console.log(`   📝 ${geminiSegments.length} segments with translations`);

      // Get all word timestamps for word-level highlighting
      const allWords = transcription.word_timestamps.filter((item: any) => item.type === 'word');

      // Build English segments with word-level timing
      const englishSegments = geminiSegments.map(seg => {
        // Reconstruct word array from wordIndices
        const segmentWords = seg.wordIndices.map(idx => {
          const word = allWords[idx];
          return {
            text: word.text,
            word: word.text, // Legacy compatibility
            start: word.start,
            end: word.end,
          };
        });

        return {
          text: seg.english,
          start: seg.startTime,
          end: seg.endTime,
          words: segmentWords,
        };
      });

      transcriptionsData.languages.en = { segments: englishSegments };
      console.log(`   ✓ English: ${englishSegments.length} segments with word-level timing`);

      // Add each translation language (no word-level timing for translations)
      const langCodes = ['zh', 'vi', 'id'] as const;
      for (const langCode of langCodes) {
        const translationSegments = geminiSegments.map(seg => ({
          text: seg.translations[langCode],
          start: seg.startTime,
          end: seg.endTime,
        }));

        transcriptionsData.languages[langCode] = { segments: translationSegments };
        console.log(`   ✓ ${langCode}: ${translationSegments.length} segments`);
      }
    }
    // Fallback to old chunking logic if no structured segments
    else if (transcription.word_timestamps) {
      console.log(`   ⚠️  No structured segments, falling back to legacy chunking`);

      // Get STT word timestamps (filtered to only include actual words, not audio events)
      const wordTimestamps = transcription.word_timestamps.filter((item: any) => item.type === 'word');

      console.log(`   📝 Raw word timestamps: ${wordTimestamps.length} words`);

      if (wordTimestamps.length > 0) {
        // Create chunked subtitle segments (NOT one massive segment!)
        const englishSegments = chunkSttWordsIntoSegments(
          wordTimestamps,
          8,      // maxWordsPerSegment: 8 words per subtitle line
          3000,   // maxSegmentDuration: ~3 seconds max per segment
          transcription.transcription_text
        );

        console.log(`   🔨 Chunking result: ${englishSegments.length} segments created`);

        // VALIDATION: Refuse to post if chunking failed (only 1 segment from 10+ words)
        if (wordTimestamps.length >= 10 && englishSegments.length === 1) {
          throw new Error(
            `Chunking failed: ${wordTimestamps.length} words resulted in only 1 segment. ` +
            `This would create a wall of text. Check chunkSttWordsIntoSegments() logic.`
          );
        }

        transcriptionsData.languages.en = { segments: englishSegments };
        console.log(`   ✓ English: ${englishSegments.length} subtitle segments (${wordTimestamps.length} words total)`);

        // Add translations by matching line-by-line translation data to English segments
        for (const translation of translations) {
          if (!translation.lines || translation.lines.length === 0) {
            console.log(`   ⚠️  ${translation.language_code}: No translation lines found, skipping`);
            continue;
          }

          // Match translation lines to English segments by timing overlap
          const translationSegments = matchTranslationLinesToSegments(
            translation.lines,
            englishSegments
          );

          // Validation: Ensure we created proper segments (not empty, not all-in-one)
          if (translationSegments.length === 0) {
            console.log(`   ⚠️  ${translation.language_code}: Matching failed, skipping`);
            continue;
          }

          if (translationSegments.length === 1 && translation.lines.length > 5) {
            console.log(`   ⚠️  ${translation.language_code}: Only 1 segment from ${translation.lines.length} lines, skipping`);
            continue;
          }

          transcriptionsData.languages[translation.language_code] = { segments: translationSegments };
          console.log(`   ✓ ${translation.language_code}: ${translationSegments.length} matched segments (from ${translation.lines.length} lines)`);
        }
      } else {
        console.log(`   ⚠️  No word timestamps found in STT data for video ${video.video_id}`);
      }
    } else {
      console.log(`   ⚠️  No transcription data found for video ${video.video_id}`);
    }
  } else {
    console.log(`   ⚠️  No transcription data found for video ${video.video_id}`);
  }

  // Build tags array
  const tags = [
    'karaoke',
    'tiktok',
    'copyrighted',
    'cover',
    'story-protocol',
  ];

  // Add GRC-20 work ID tag if available (for song-based filtering)
  if (video.work_grc20_id) {
    tags.push(`grc20-${video.work_grc20_id}`);
  }

  // Create video metadata
  const postMetadata = shortVideo({
    title: `${creatorName} - ${video.track_title}`,
    content: contentText,
    video: {
      item: groveVideoUrl,
      type: MediaVideoMimeType.MP4,
      cover: groveThumbnailUrl, // Use thumbnail as cover
      altTag: `${creatorName} singing ${video.track_title}`,
    },
    tags,
    attributes: [
      {
        type: 'String',
        key: 'tiktok_video_id',
        value: video.video_id,
      },
      {
        type: 'String',
        key: 'creator_username',
        value: video.creator_username,
      },
      {
        type: 'String',
        key: 'copyright_type',
        value: 'copyrighted',
      },
      {
        type: 'String',
        key: 'song_name',
        value: video.track_title,
      },
      {
        type: 'String',
        key: 'artist_name',
        value: video.artist_name,
      },
      {
        type: 'String',
        key: 'spotify_track_id',
        value: video.spotify_track_id,
      },
      {
        type: 'String',
        key: 'grc20_work_id',
        value: video.work_grc20_id || '',
      },
      {
        type: 'String',
        key: 'album_art',
        value: video.track_image_url || '',
      },
      {
        type: 'String',
        key: 'story_ip_id',
        value: video.story_ip_id,
      },
      {
        type: 'String',
        key: 'story_metadata_uri',
        value: video.story_metadata_uri,
      },
      {
        type: 'String',
        key: 'grove_video_cid',
        value: video.grove_video_cid,
      },
      {
        type: 'String',
        key: 'transcriptions',
        value: JSON.stringify(transcriptionsData),
      },
    ],
  });

  console.log(`   ✓ Title: ${creatorName} - ${video.track_title}`);
  console.log(`   ✓ Tags: ${tags.join(', ')}`);
  console.log(`   ✓ Transcriptions: ${Object.keys(transcriptionsData.languages).length} languages included`);

  // Upload metadata to Grove
  console.log('\n☁️  Uploading post metadata to Grove...');
  const metadataResult = await storageClient.uploadAsJson(postMetadata, {
    name: `lens-post-${video.video_id}.json`,
    acl,
  });
  console.log(`   ✓ Metadata URI: ${metadataResult.uri}`);

  // Create Lens post
  console.log('\n📱 Creating Lens post...');
  console.log(`   Feed: ${FEED_ADDRESS}`);
  console.log(`   App: ${APP_ADDRESS}`);

  const postResult = await createPost(sessionClient, {
    contentUri: metadataResult.uri as any,
  })
    .andThen(handleOperationWith(walletClient))
    .andThen(sessionClient.waitForTransaction);

  if (postResult.isErr()) {
    throw new Error(`Post creation failed: ${postResult.error.message}`);
  }

  const postHash = postResult.value;
  console.log(`   ✅ Post created! Hash: ${postHash}`);

  // Update database
  console.log('\n💾 Updating database...');
  await query(`
    UPDATE tiktok_videos
    SET lens_post_hash = $1,
        lens_post_uri = $2,
        lens_posted_at = NOW(),
        lens_post_attempts = lens_post_attempts + 1,
        lens_last_error = NULL
    WHERE video_id = $3
  `, [
    postHash,
    metadataResult.uri,
    video.video_id,
  ]);

  console.log('   ✓ Database updated');

  console.log(`\n✨ Video successfully posted to Lens feed!\n`);
}

/**
 * Main processor function
 */
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      limit: { type: 'string', default: '10' },
      'video-id': { type: 'string' },
    },
  });

  const limit = parseInt(values.limit || '10');
  const videoId = values['video-id'];

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Step 14: Post to Lens Feed');
  console.log('═══════════════════════════════════════════════════════\n');

  // Query videos ready for Lens posting
  let videos: VideoForPosting[];

  if (videoId) {
    // Post specific video
    console.log(`🎯 Processing specific video: ${videoId}\n`);
    videos = await query<VideoForPosting>(`
      SELECT * FROM videos_ready_for_lens_posting
      WHERE video_id = $1
    `, [videoId]);

    if (videos.length === 0) {
      console.log(`❌ Video ${videoId} not found or not ready for Lens posting`);
      console.log(`   Requirements:`);
      console.log(`     - Minted to Story Protocol (Step 13)`);
      console.log(`     - Creator has Lens account`);
      console.log(`     - Not already posted to Lens\n`);
      process.exit(1);
    }
  } else {
    // Batch post
    videos = await query<VideoForPosting>(`
      SELECT * FROM videos_ready_for_lens_posting
      LIMIT $1
    `, [limit]);
  }

  if (videos.length === 0) {
    console.log('✅ No videos ready for Lens posting\n');
    console.log('All ready videos have been posted!\n');
    process.exit(0);
  }

  console.log(`Found ${videos.length} video(s) ready for Lens posting\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const video of videos) {
    try {
      await postVideo(video);
      successCount++;
    } catch (error: any) {
      console.error(`\n❌ Failed to post video ${video.video_id}:`);
      console.error(`   ${error.message}\n`);

      // Update error in database
      await query(`
        UPDATE tiktok_videos
        SET lens_post_attempts = lens_post_attempts + 1,
            lens_last_error = $1
        WHERE video_id = $2
      `, [error.message, video.video_id]);

      errorCount++;
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`✅ Successfully posted: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('');

  if (successCount > 0) {
    console.log('🎉 Videos successfully posted to Lens feed!');
    console.log(`   Feed address: ${FEED_ADDRESS}\n`);
  }

  if (errorCount > 0) {
    console.log('⚠️  Some videos failed to post. Check logs above for details.\n');
    process.exit(1);
  }
}

// CLI execution
if (import.meta.main) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Step 14 failed:', error);
      process.exit(1);
    });
}

export { main as postLensFeed };
