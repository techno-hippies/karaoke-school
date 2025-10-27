/**
 * Segment Selection Cron
 *
 * Automatically selects the best 190-second segment for tracks longer than 190 seconds.
 * Uses Gemini Flash 2.5 Lite via OpenRouter to identify the most iconic/singable segment for karaoke.
 *
 * This is required because fal.ai audio-to-audio processing has a 190-second maximum limit.
 */

import { NeonDB } from '../neon';
import { OpenRouterService } from '../services/openrouter';
import type { Env } from '../types';

export default async function runSegmentSelection(env: Env): Promise<void> {
  console.log('🎯 Segment Selection Cron: Starting...');

  const db = new NeonDB(env.NEON_DATABASE_URL);
  const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

  if (!OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not configured');
    return;
  }

  try {
    // Find tracks >190s with synced lyrics but no segment selection
    const tracksNeedingSelection = await db.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists[1] as artist,
        st.duration_ms,
        st.popularity,
        stl.synced_lyrics
      FROM spotify_tracks st
      INNER JOIN spotify_track_lyrics stl ON st.spotify_track_id = stl.spotify_track_id
      LEFT JOIN karaoke_segments ks ON st.spotify_track_id = ks.spotify_track_id
      WHERE st.duration_ms > 190000
        AND stl.synced_lyrics IS NOT NULL
        AND stl.synced_lyrics != ''
        AND ks.spotify_track_id IS NULL
      ORDER BY st.popularity DESC NULLS LAST
      LIMIT 20
    `;

    if (tracksNeedingSelection.length === 0) {
      console.log('✓ No tracks need segment selection');
      return;
    }

    console.log(`Found ${tracksNeedingSelection.length} tracks needing segment selection`);

    const openRouter = new OpenRouterService(OPENROUTER_API_KEY);
    let selected = 0;
    let failed = 0;

    for (const track of tracksNeedingSelection) {
      try {
        console.log(`  Selecting segment: ${track.title} - ${track.artist} (${Math.floor(track.duration_ms / 1000)}s)`);

        const selection = await openRouter.selectKaraokeSegment(
          track.title,
          track.artist,
          track.duration_ms,
          track.synced_lyrics
        );

        // Store in database
        await db.sql`
          INSERT INTO karaoke_segments (
            spotify_track_id,
            fal_segment_start_ms,
            fal_segment_end_ms,
            fal_segment_duration_ms,
            tiktok_clip_start_ms,
            tiktok_clip_end_ms
          )
          VALUES (
            ${track.spotify_track_id},
            ${selection.startMs},
            ${selection.endMs},
            ${selection.endMs - selection.startMs},
            ${selection.tiktokClipStartMs},
            ${selection.tiktokClipEndMs}
          )
          ON CONFLICT (spotify_track_id) DO UPDATE SET
            fal_segment_start_ms = EXCLUDED.fal_segment_start_ms,
            fal_segment_end_ms = EXCLUDED.fal_segment_end_ms,
            fal_segment_duration_ms = EXCLUDED.fal_segment_duration_ms,
            tiktok_clip_start_ms = EXCLUDED.tiktok_clip_start_ms,
            tiktok_clip_end_ms = EXCLUDED.tiktok_clip_end_ms,
            updated_at = NOW()
        `;

        const falStart = Math.floor(selection.startMs / 1000);
        const falEnd = Math.floor(selection.endMs / 1000);
        const tiktokStart = Math.floor(selection.tiktokClipStartMs / 1000);
        const tiktokEnd = Math.floor(selection.tiktokClipEndMs / 1000);

        console.log(`  ✓ Fal segment: ${falStart}s - ${falEnd}s (${falEnd - falStart}s)`);
        console.log(`  ✓ TikTok clip: ${tiktokStart}s - ${tiktokEnd}s (${tiktokEnd - tiktokStart}s)`);

        selected++;

        // Rate limit: 2 seconds between OpenRouter calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`  ✗ Failed: ${track.title}`, error.message);
        failed++;
      }
    }

    console.log(`✓ Segment Selection Cron: Complete (${selected} selected, ${failed} failed)`);
  } catch (error: any) {
    console.error('Segment selection cron failed:', error);
  }
}
