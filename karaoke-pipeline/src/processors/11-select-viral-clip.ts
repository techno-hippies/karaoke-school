/**
 * Step 11: AI-Powered Viral Clip Selection
 *
 * Uses AI to analyze song structure and select compelling verse+chorus sections.
 * Ensures clips are 30-60s for optimal karaoke engagement.
 *
 * FLOW:
 * 1. Load karaoke_lines for song structure
 * 2. Use AI to identify best verse+chorus section (30-60s)
 * 3. Crop from merged instrumental
 * 4. Upload to Grove
 * 5. Update karaoke_segments with clip metadata
 */

import { query } from '../db/neon';
import { FFmpegService } from '../services/ffmpeg';
import { uploadToGrove } from '../services/grove';
import type { Env } from '../types';

interface ViralClipSelection {
  startMs: number;
  endMs: number;
  durationMs: number;
  lyrics: string;
}

/**
 * Use AI to select the best viral clip from song structure
 */
async function selectViralClipWithAI(
  spotifyTrackId: string,
  databaseUrl: string,
  openRouterKey: string
): Promise<ViralClipSelection> {
  // Get song structure from karaoke_lines
  const lines = await query(
    `SELECT
      line_index,
      start_ms,
      end_ms,
      original_text,
      word_count
    FROM karaoke_lines
    WHERE spotify_track_id = $1
    ORDER BY line_index`,
    [spotifyTrackId]
  );

  if (lines.length === 0) {
    throw new Error('No karaoke lines found for track');
  }

  // Format lyrics with timestamps for AI
  const lyricsWithTimestamps = lines.map((l: any) =>
    `[${(l.start_ms / 1000).toFixed(1)}s-${(l.end_ms / 1000).toFixed(1)}s] ${l.original_text}`
  ).join('\n');

  const totalDurationMs = lines[lines.length - 1].end_ms;

  console.log(`   Analyzing ${lines.length} lines (${(totalDurationMs / 1000).toFixed(1)}s total)...`);

  // Ask AI to select best segment
  const prompt = `You are a music producer selecting the best 30-60 second clip for a karaoke app.

The clip should:
- Be 30-60 seconds (ideally 40-50s)
- Include a complete verse + chorus (or chorus + verse)
- Start at a natural beginning (start of verse/chorus)
- End at a natural ending (end of chorus/verse)
- Be the most recognizable/catchy part of the song
- Have clear, singable lyrics

Song lyrics with timestamps:
${lyricsWithTimestamps}

Total duration: ${(totalDurationMs / 1000).toFixed(1)}s

Respond with ONLY a JSON object in this exact format (no markdown, no explanation):
{
  "start_ms": <number>,
  "end_ms": <number>
}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API failed: ${response.status}`);
  }

  const data = await response.json();
  const aiResponse = data.choices[0].message.content.trim();

  // Parse AI response
  let selection: any;
  try {
    // Remove markdown code blocks if present
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    selection = JSON.parse(jsonMatch[0]);
  } catch (e: any) {
    throw new Error(`Failed to parse AI response: ${e.message}\nResponse: ${aiResponse}`);
  }

  // Validate selection
  const durationMs = selection.end_ms - selection.start_ms;

  if (durationMs < 30000) {
    throw new Error(`AI selected clip too short: ${(durationMs / 1000).toFixed(1)}s (minimum 30s)`);
  }

  if (durationMs > 60000) {
    throw new Error(`AI selected clip too long: ${(durationMs / 1000).toFixed(1)}s (maximum 60s)`);
  }

  // Get lyrics for selected section
  const selectedLines = lines.filter((l: any) =>
    l.start_ms >= selection.start_ms && l.end_ms <= selection.end_ms
  );
  const lyrics = selectedLines.map((l: any) => l.original_text).join('\n');

  console.log(`   ✓ AI selected: ${(selection.start_ms / 1000).toFixed(1)}s - ${(selection.end_ms / 1000).toFixed(1)}s (${(durationMs / 1000).toFixed(1)}s)`);

  return {
    startMs: selection.start_ms,
    endMs: selection.end_ms,
    durationMs,
    lyrics,
  };
}

/**
 * Process viral clip selection for tracks
 */
export async function processViralClipSelection(env: Env, limit: number = 10): Promise<void> {
  console.log(`\n[Step 11] AI-Powered Viral Clip Selection (limit: ${limit})`);

  if (!env.OPENROUTER_API_KEY) {
    console.log('⚠️  OPENROUTER_API_KEY not configured, skipping');
    return;
  }

  const hasFFmpeg = FFmpegService.isAvailable();
  if (!hasFFmpeg) {
    console.error('❌ FFmpeg not available');
    return;
  }

  console.log(`   FFmpeg: ✓ Available`);
  console.log(`   AI: Claude 3.5 Sonnet via OpenRouter`);

  const ffmpegService = new FFmpegService();

  try {
    // Find tracks needing viral clip selection
    const tracks = await query(
      `SELECT
        ks.spotify_track_id,
        st.title,
        st.artists,
        sa.duration_ms,
        ks.merged_instrumental_cid
      FROM karaoke_segments ks
      JOIN spotify_tracks st ON ks.spotify_track_id = st.spotify_track_id
      JOIN song_audio sa ON ks.spotify_track_id = sa.spotify_track_id
      WHERE ks.merged_instrumental_cid IS NOT NULL
        AND (ks.clip_cropped_grove_cid IS NULL
             OR (ks.clip_end_ms - ks.clip_start_ms) > 60000)
      ORDER BY ks.updated_at DESC
      LIMIT $1`,
      [limit]
    );

    if (tracks.length === 0) {
      console.log('✓ No tracks need viral clip selection');
      return;
    }

    console.log(`Found ${tracks.length} tracks needing viral clip selection\n`);

    let successCount = 0;
    let failedCount = 0;

    for (const track of tracks) {
      try {
        console.log(`📍 ${track.title} - ${track.artists}`);
        console.log(`   Spotify ID: ${track.spotify_track_id}`);

        // Step 1: AI selects best segment
        const selection = await selectViralClipWithAI(
          track.spotify_track_id,
          env.DATABASE_URL,
          env.OPENROUTER_API_KEY
        );

        // Step 2: Crop from merged instrumental
        console.log(`   Cropping viral clip...`);
        const mergedInstrumentalUrl = `https://api.grove.storage/${track.merged_instrumental_cid}`;

        const cropResult = await ffmpegService.cropFromUrl(mergedInstrumentalUrl, {
          startMs: selection.startMs,
          endMs: selection.endMs,
          bitrate: 192,
        });

        console.log(`   ✓ Cropped (${(cropResult.buffer.length / 1024 / 1024).toFixed(2)}MB)`);

        // Step 3: Upload to Grove
        console.log(`   Uploading viral clip to Grove...`);
        const groveResult = await uploadToGrove(
          cropResult.buffer,
          'audio/mpeg',
          `viral-clip-${track.spotify_track_id}.mp3`
        );

        console.log(`   ✓ Uploaded: ${groveResult.cid}`);

        // Step 4: Update database
        const sql = `
          UPDATE karaoke_segments
          SET
            clip_start_ms = ${selection.startMs},
            clip_end_ms = ${selection.endMs},
            clip_relative_start_ms = ${selection.startMs},
            clip_relative_end_ms = ${selection.endMs},
            clip_cropped_grove_cid = '${groveResult.cid}',
            clip_cropped_grove_url = '${groveResult.url}',
            updated_at = NOW()
          WHERE spotify_track_id = '${track.spotify_track_id}'
        `;
        await query(sql);

        console.log(`   ✓ Database updated\n`);
        successCount++;

      } catch (error: any) {
        console.error(`   ✗ Failed: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
        }
        failedCount++;
      }
    }

    console.log(`\n✓ Step 11 complete: ${successCount} clips selected, ${failedCount} failed`);

  } catch (error: any) {
    console.error(`[Step 11] Fatal error: ${error.message}`);
    throw error;
  }
}
