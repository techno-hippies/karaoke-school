#!/usr/bin/env bun
/**
 * Pipeline Step 15: Segment and Translate STT with Gemini
 *
 * Uses Gemini Flash 2.5-lite structured outputs to:
 * 1. Break STT transcription into logical subtitle segments
 * 2. Translate each segment to zh, vi, id
 * 3. Store in structured_segments JSONB column
 *
 * Prerequisites:
 *   - Video has STT transcription in tiktok_video_transcriptions
 *
 * Process:
 *   1. Query videos with STT but no structured_segments
 *   2. Build prompt with word timestamps
 *   3. Call Gemini with JSON Schema enforcement
 *   4. Validate and store result
 *
 * Usage:
 *   bun src/processors/15-segment-stt-gemini.ts --limit=10
 *   bun src/processors/15-segment-stt-gemini.ts --video-id=7038014113984875822
 *   bun src/processors/15-segment-stt-gemini.ts --reprocess  # Re-run all videos
 */

import { parseArgs } from 'util';
import { query } from '../db/neon';

interface VideoWithSTT {
  id: number;
  video_id: string;
  transcription_text: string;
  word_timestamps: Array<{
    text: string;
    start: number;
    end: number;
    type: string;
  }>;
}

interface StructuredSegment {
  english: string;
  startTime: number;
  endTime: number;
  wordIndices: number[];
  translations: {
    zh: string;
    vi: string;
    id: string;
  };
}

interface StructuredSegments {
  segments: StructuredSegment[];
  processedAt: string;
  model: string;
}

// JSON Schema for Gemini structured output
const SEGMENT_SCHEMA = {
  type: 'object',
  properties: {
    segments: {
      type: 'array',
      description: 'Logical subtitle segments with translations',
      items: {
        type: 'object',
        properties: {
          english: {
            type: 'string',
            description: 'English text for this segment (cleaned, no audio events)'
          },
          startTime: {
            type: 'number',
            description: 'Segment start time in seconds'
          },
          endTime: {
            type: 'number',
            description: 'Segment end time in seconds'
          },
          wordIndices: {
            type: 'array',
            description: 'Indices of words from original word_timestamps array',
            items: { type: 'number' }
          },
          translations: {
            type: 'object',
            description: 'Translations for this specific segment',
            properties: {
              zh: { type: 'string', description: 'Mandarin Chinese translation' },
              vi: { type: 'string', description: 'Vietnamese translation' },
              id: { type: 'string', description: 'Indonesian translation' }
            },
            required: ['zh', 'vi', 'id'],
            additionalProperties: false
          }
        },
        required: ['english', 'startTime', 'endTime', 'wordIndices', 'translations'],
        additionalProperties: false
      }
    }
  },
  required: ['segments'],
  additionalProperties: false
};

/**
 * Build prompt for Gemini with word timestamps
 */
function buildSegmentationPrompt(transcriptionText: string, wordTimestamps: any[]): string {
  // Filter out audio event markers
  const actualWords = wordTimestamps.filter(w => w.type === 'word');

  const wordsWithIndices = actualWords.map((w, idx) => ({
    index: idx,
    text: w.text,
    start: w.start,
    end: w.end
  }));

  return `You are a subtitle segmentation and translation expert.

Given this speech-to-text transcription with word-level timing:

Full text: "${transcriptionText}"

Word timestamps:
${JSON.stringify(wordsWithIndices, null, 2)}

**Your task:**
1. Break this into 5-10 logical subtitle segments (sentences, clauses, or natural pauses)
2. Each segment should be 5-15 words for readability
3. Break at sentence boundaries (. ! ?) when possible
4. If no punctuation, break at commas, conjunctions (and, or, but), or natural pauses
5. Remove audio event descriptions like "(music)", "(laughs)", etc. from the text
6. Translate each segment to:
   - Mandarin Chinese (zh)
   - Vietnamese (vi)
   - Indonesian (id)
7. Each translation should preserve the meaning of THAT SPECIFIC segment (not the full text)

**Rules:**
- startTime = first word's start time in the segment
- endTime = last word's end time in the segment
- wordIndices = array of word indices (from the word timestamps array) included in this segment
- Do NOT translate audio events - just remove them
- Keep translations concise but accurate
- Maintain semantic meaning within each segment

Output the segments in the required JSON structure.`;
}

/**
 * Call Gemini Flash 2.5-lite with structured output
 */
async function segmentWithGemini(videoId: string, transcriptionText: string, wordTimestamps: any[]): Promise<StructuredSegments> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable required');
  }

  const prompt = buildSegmentationPrompt(transcriptionText, wordTimestamps);

  console.log(`   🤖 Calling Gemini Flash 2.5-lite...`);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://karaoke-school.ai',
      'X-Title': 'Karaoke School STT Segmentation'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite-preview-09-2025',  // Gemini Flash 2.5 lite (existing in project)
      messages: [
        { role: 'user', content: prompt }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'stt_segments',
          strict: true,
          schema: SEGMENT_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  console.log(`   ✓ Gemini response received`);

  // Parse and validate
  const parsed = JSON.parse(content);

  if (!parsed.segments || !Array.isArray(parsed.segments)) {
    throw new Error('Invalid Gemini response: missing segments array');
  }

  // Validation: Ensure we got reasonable segments
  if (parsed.segments.length === 0) {
    throw new Error('Gemini returned 0 segments');
  }

  if (parsed.segments.length === 1 && wordTimestamps.filter(w => w.type === 'word').length > 15) {
    throw new Error(`Gemini failed to segment: only 1 segment from ${wordTimestamps.length} words`);
  }

  // Add metadata
  const result: StructuredSegments = {
    segments: parsed.segments,
    processedAt: new Date().toISOString(),
    model: 'google/gemini-2.5-flash-lite-preview-09-2025'
  };

  console.log(`   ✓ Created ${result.segments.length} segments`);
  console.log(`   ✓ Languages: en, zh, vi, id`);

  return result;
}

/**
 * Process a single video
 */
async function processVideo(video: VideoWithSTT): Promise<void> {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📹 Video: ${video.video_id}`);
  console.log(`📝 Text length: ${video.transcription_text.length} chars`);
  console.log(`🔤 Word count: ${video.word_timestamps.filter(w => w.type === 'word').length} words`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    // Call Gemini
    const structured = await segmentWithGemini(
      video.video_id,
      video.transcription_text,
      video.word_timestamps
    );

    // Store in database
    console.log(`   💾 Updating database...`);
    await query(`
      UPDATE tiktok_video_transcriptions
      SET structured_segments = $1
      WHERE id = $2
    `, [JSON.stringify(structured), video.id]);

    console.log(`   ✅ Video processed successfully\n`);
  } catch (error: any) {
    console.error(`   ❌ Error processing video: ${error.message}\n`);
    throw error;
  }
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
      reprocess: { type: 'boolean', default: false }
    },
  });

  const limit = parseInt(values.limit || '10');
  const videoId = values['video-id'];
  const reprocess = values.reprocess || false;

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Step 15: Segment and Translate STT with Gemini');
  console.log('═══════════════════════════════════════════════════════\n');

  // Build query
  let videos: VideoWithSTT[];

  if (videoId) {
    // Process specific video
    console.log(`🎯 Processing specific video: ${videoId}\n`);
    videos = await query<VideoWithSTT>(`
      SELECT id, video_id, transcription_text, word_timestamps
      FROM tiktok_video_transcriptions
      WHERE video_id = $1
    `, [videoId]);

    if (videos.length === 0) {
      console.log(`❌ Video ${videoId} not found or has no STT transcription\n`);
      process.exit(1);
    }
  } else {
    // Batch process
    const condition = reprocess
      ? 'TRUE'  // Reprocess all
      : 'structured_segments IS NULL';  // Only unprocessed

    videos = await query<VideoWithSTT>(`
      SELECT id, video_id, transcription_text, word_timestamps
      FROM tiktok_video_transcriptions
      WHERE ${condition}
        AND word_timestamps IS NOT NULL
        AND jsonb_array_length(word_timestamps) > 5
      ORDER BY id DESC
      LIMIT $1
    `, [limit]);
  }

  if (videos.length === 0) {
    console.log('✅ No videos to process\n');
    console.log(reprocess ? 'All videos already processed!\n' : 'Run with --reprocess to re-run all videos\n');
    process.exit(0);
  }

  console.log(`Found ${videos.length} video(s) to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const video of videos) {
    try {
      await processVideo(video);
      successCount++;

      // Rate limiting: small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      console.error(`Failed to process video ${video.video_id}:`, error.message);
      errorCount++;
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('Summary');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`✅ Successfully processed: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('');

  if (successCount > 0) {
    console.log('🎉 Videos segmented and translated!');
    console.log('   Ready for Lens posting with proper subtitle alignment\n');
  }

  if (errorCount > 0) {
    console.log('⚠️  Some videos failed. Check logs above for details.\n');
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
      console.error('\n❌ Step 15 failed:', error);
      process.exit(1);
    });
}

export { main as segmentSttWithGemini };
