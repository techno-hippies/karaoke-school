/**
 * Lyrics Discovery Task Processor
 *
 * Simplified lyrics discovery using only LRCLIB:
 * 1. Fetch synced lyrics from LRCLIB
 * 2. Check word count (< 30 words = instrumental)
 * 3. Store in song_lyrics cache table
 * 4. Update track flags
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
  updateTrackFlags,
} from '../../db/queries';
import { query } from '../../db/connection';
import { searchLyrics } from '../../services/lrclib';
import { upsertLyricsSQL } from '../../db/lyrics';

interface LyricsResult {
  source: string;
  has_synced: boolean;
  word_count: number;
  language: string | null;
}

/**
 * Count words in lyrics (simple whitespace split)
 */
function countWords(lyrics: string): number {
  return lyrics.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Main lyrics discovery processor
 */
export async function processLyricsDiscovery(limit: number = 50): Promise<void> {
  console.log(`\n🎵 Lyrics Discovery Task Processor (limit: ${limit})\n`);

  // Get pending tasks
  const tasks = await getPendingEnrichmentTasks('lyrics_discovery', limit);

  if (tasks.length === 0) {
    console.log('✅ No pending lyrics discovery tasks\n');
    return;
  }

  console.log(`Found ${tasks.length} pending tasks\n`);

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const task of tasks) {
    // Get track details
    const tracks = await query<{
      title: string;
      artists: Array<{ name: string }>;
      duration_ms: number;
    }>(`
      SELECT title, artists, duration_ms
      FROM tracks
      WHERE spotify_track_id = $1
    `, [task.spotify_track_id]);

    if (tracks.length === 0) {
      console.log(`   ⚠️ Track ${task.spotify_track_id} not found, skipping`);
      await updateEnrichmentTask(task.id, { status: 'skipped' });
      skippedCount++;
      continue;
    }

    const track = tracks[0];
    const artistName = track.artists[0]?.name || 'Unknown';
    console.log(`   🎵 "${track.title}" by ${artistName}`);

    try {
      // Check cache first
      const cached = await query<{
        plain_lyrics: string;
        synced_lyrics: string | null;
      }>(`
        SELECT plain_lyrics, synced_lyrics
        FROM song_lyrics
        WHERE spotify_track_id = $1
      `, [task.spotify_track_id]);

      if (cached.length > 0 && cached[0].plain_lyrics) {
        const wordCount = countWords(cached[0].plain_lyrics);
        console.log(`      ✅ Found in cache (${wordCount} words)`);
        await updateEnrichmentTask(task.id, {
          status: 'completed',
          source: 'cache',
          result_data: {
            source: 'cache',
            has_synced: !!cached[0].synced_lyrics,
            word_count: wordCount,
          },
        });
        await updateTrackFlags(task.spotify_track_id, { has_lyrics: true });
        completedCount++;
        continue;
      }

      // Fetch from LRCLIB
      console.log(`      🔍 Searching LRCLIB...`);
      const result = await searchLyrics({
        trackName: track.title,
        artistName: artistName,
        duration: Math.round(track.duration_ms / 1000) // duration in seconds
      });

      if (!result) {
        console.log(`      ❌ Not found in LRCLIB`);
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: 'Lyrics not found in LRCLIB',
        });
        failedCount++;
        continue;
      }

      // Check word count for instrumentals
      const wordCount = countWords(result.plainLyrics);
      console.log(`      📝 Found ${wordCount} words`);

      if (wordCount < 30) {
        console.log(`      ⚠️ Too few words (< 30), likely instrumental`);
        await updateEnrichmentTask(task.id, {
          status: 'failed',
          error_message: 'Too few words (< 30), likely instrumental track',
        });
        failedCount++;
        continue;
      }

      // Store in song_lyrics table
      const lyricsSQL = upsertLyricsSQL({
        spotify_track_id: task.spotify_track_id,
        plain_lyrics: result.plainLyrics,
        synced_lyrics: result.syncedLyrics || null,
        source: 'lrclib',
        language: null, // Will be detected later if needed
        confidence_score: null,
      });

      await query(lyricsSQL);

      const resultData: LyricsResult = {
        source: 'lrclib',
        has_synced: !!result.syncedLyrics,
        word_count: wordCount,
        language: null,
      };

      console.log(`      ✅ Stored ${wordCount} words${result.syncedLyrics ? ' (synced)' : ''}`);
      await updateEnrichmentTask(task.id, {
        status: 'completed',
        source: 'lrclib',
        result_data: resultData,
      });
      await updateTrackFlags(task.spotify_track_id, { has_lyrics: true });
      completedCount++;

    } catch (error: any) {
      console.log(`      ❌ Error: ${error.message}`);
      await updateEnrichmentTask(task.id, {
        status: 'failed',
        error_message: error.message,
      });
      failedCount++;
    }

    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Completed: ${completedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   ⏭️ Skipped: ${skippedCount}`);
  console.log('');
}

// Run if called directly
if (import.meta.main) {
  const limit = parseInt(process.argv[2]) || 50;
  processLyricsDiscovery(limit)
    .catch(error => {
      console.error('❌ Lyrics discovery failed:', error);
      process.exit(1);
    });
}
