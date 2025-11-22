/**
 * Enhanced Lyrics Discovery Task Processor
 *
 * Complete lyrics discovery with:
 * 1. LRCLIB search with title normalization
 * 2. AI lyrics cleaning (Gemini Flash 2.5 Lite)
 * 3. Language detection
 * 4. Instrumental detection (< 30 words)
 *
 * Simplified from old pipeline - no Lyrics.ovh (low quality)
 */

import {
  getPendingEnrichmentTasks,
  updateEnrichmentTask,
  updateTrackFlags,
} from '../../db/queries';
import { query } from '../../db/connection';
import { searchLyrics, LRCLibLyrics } from '../../services/lrclib';
import { upsertLyricsSQL } from '../../db/lyrics';
import { cleanLyrics, detectLanguages } from '../../services/openrouter';

interface LyricsResult {
  source: string;
  has_synced: boolean;
  word_count: number;
  language: string | null;
  cleaned: boolean;
}

/**
 * Count words in lyrics (simple whitespace split)
 */
function countWords(lyrics: string): number {
  return lyrics.trim().split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * Normalize title for lyrics search
 * Removes TikTok-style modifiers and extended versions that don't affect lyrics
 */
function normalizeTitleForSearch(title: string): string {
  return title
    // Remove "- Slowed Down", "- Slowed", "+ Reverb" variants
    .replace(/\s*[-+]\s*(slowed?\s*(down)?(\s*\+?\s*reverb)?)/gi, '')
    // Remove "- Sped Up", "- Speed Up", "- Nightcore"
    .replace(/\s*-\s*(sped\s*up|speed\s*up|nightcore)/gi, '')
    // Remove standalone "+ Reverb" or "- Reverb"
    .replace(/\s*[-+]\s*reverb/gi, '')
    // Remove "- 8D Audio" or "- 8D"
    .replace(/\s*-\s*8d(\s*audio)?/gi, '')
    // Remove parenthetical variations: "(Slowed)", "(Sped Up)", "(Extended)", etc.
    .replace(/\s*\(.*?(slowed|sped|reverb|8d|nightcore|extended|english)\)/gi, '')
    .trim();
}

/**
 * Main lyrics discovery processor
 */
export async function processLyricsDiscovery(limit: number = 50): Promise<void> {
  console.log(`\n🎵 Enhanced Lyrics Discovery Processor (limit: ${limit})\n`);

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
  let cleanedCount = 0;

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
        language: string | null;
      }>(`
        SELECT plain_lyrics, synced_lyrics, language
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
            language: cached[0].language,
            cleaned: false,
          },
        });
        await updateTrackFlags(task.spotify_track_id, { has_lyrics: true });
        completedCount++;
        continue;
      }

      // Normalize title for search
      const normalizedTitle = normalizeTitleForSearch(track.title);
      const isModifiedTitle = normalizedTitle !== track.title;

      if (isModifiedTitle) {
        console.log(`      🔍 Normalized: "${normalizedTitle}"`);
      }

      // Fetch from LRCLIB
      console.log(`      🔍 Searching LRCLIB...`);
      const result: LRCLibLyrics | null = await searchLyrics({
        trackName: normalizedTitle,
        artistName: artistName,
        // Don't use duration for modified versions - they have different timing
        duration: isModifiedTitle ? undefined : Math.round(track.duration_ms / 1000)
      });

      if (!result || !result.plainLyrics) {
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

      // AI lyrics cleaning (optional - only if OpenRouter API key exists)
      let cleanedLyrics: string = result.plainLyrics;
      let wasCleaned = false;

      if (process.env.OPENROUTER_API_KEY) {
        try {
          console.log(`      🤖 Cleaning lyrics with AI...`);
          cleanedLyrics = await cleanLyrics(result.plainLyrics, track.title, artistName);
          wasCleaned = true;
          cleanedCount++;
        } catch (error: any) {
          console.log(`      ⚠️ AI cleaning failed: ${error.message}, using original`);
          cleanedLyrics = result.plainLyrics;
        }
      }

      // Language detection (optional - only if OpenRouter API key exists)
      let languageCode: string | null = null;

      if (process.env.OPENROUTER_API_KEY) {
        try {
          console.log(`      🌐 Detecting language...`);
          const languages = await detectLanguages(cleanedLyrics);
          languageCode = languages.primary;
          console.log(`      📍 Language: ${languageCode}`);
        } catch (error: any) {
          console.log(`      ⚠️ Language detection failed: ${error.message}`);
        }
      }

      // Store in song_lyrics table
      const lyricsSQL = upsertLyricsSQL({
        spotify_track_id: task.spotify_track_id,
        plain_lyrics: result.plainLyrics,
        synced_lyrics: result.syncedLyrics || null,
        normalized_lyrics: wasCleaned ? cleanedLyrics : null,
        source: 'lrclib',
        language: languageCode,
        line_count: result.plainLyrics.split('\n').filter(l => l.trim()).length,
      });

      await query(lyricsSQL);

      const resultData: LyricsResult = {
        source: 'lrclib',
        has_synced: !!result.syncedLyrics,
        word_count: wordCount,
        language: languageCode,
        cleaned: wasCleaned,
      };

      const statusMsg = [
        `${wordCount} words`,
        result.syncedLyrics ? 'synced' : 'plain',
        wasCleaned ? 'cleaned' : null,
        languageCode ? languageCode : null,
      ].filter(Boolean).join(', ');

      console.log(`      ✅ Stored (${statusMsg})`);

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
  if (cleanedCount > 0) {
    console.log(`   🤖 AI Cleaned: ${cleanedCount}`);
  }
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
