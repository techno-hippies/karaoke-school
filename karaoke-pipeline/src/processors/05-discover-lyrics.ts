#!/usr/bin/env bun
/**
 * Processor: Discover Lyrics
 * Multi-source lyrics discovery with AI normalization and language detection
 *
 * Flow:
 * 1. Try LRCLIB (best synced lyrics source)
 * 2. Fallback to Lyrics.ovh if LRCLIB fails
 * 3. If both sources found, calculate similarity
 * 4. If similarity >= 80%, normalize with Gemini Flash 2.5 Lite
 * 5. Detect languages (critical for K-pop mixed-language handling)
 * 6. Store in song_lyrics table
 *
 * Usage:
 *   bun src/processors/05-discover-lyrics.ts [batchSize]
 */

import { query, transaction, close } from '../db/neon';
import * as lrclib from '../services/lrclib';
import * as lyricsOvh from '../services/lyrics-ovh';
import { calculateSimilarity } from '../services/lyrics-similarity';
import { normalizeLyrics, detectLanguages } from '../services/openrouter';
import {
  upsertLyricsSQL,
  updatePipelineLyricsSQL,
  logLyricsProcessingSQL,
  type LyricsRecord,
} from '../db/lyrics';

async function main() {
  const args = process.argv.slice(2);
  const batchSize = args[0] ? parseInt(args[0]) : 10;

  console.log('🎵 Lyrics Discovery v2');
  console.log(`📊 Batch size: ${batchSize}`);
  console.log('');

  // Find tracks that need lyrics
  console.log('⏳ Finding tracks ready for lyrics discovery...');

  const tracksToProcess = await query<{
    id: number;
    spotify_track_id: string;
    title: string;
    artists: string[];
    album: string;
    duration_ms: number;
  }>(`
    SELECT
      tp.id,
      tp.spotify_track_id,
      st.title,
      st.artists,
      st.album,
      st.duration_ms
    FROM song_pipeline tp
    JOIN spotify_tracks st ON tp.spotify_track_id = st.spotify_track_id
    WHERE tp.status = 'metadata_enriched'
      AND tp.has_lyrics = FALSE
    ORDER BY tp.id
    LIMIT ${batchSize}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need lyrics discovery. All caught up!');
    return;
  }

  console.log(`✅ Found ${tracksToProcess.length} tracks to process`);
  console.log('');

  // Check cache for existing lyrics
  const spotifyIds = tracksToProcess.map(t => t.spotify_track_id);
  const cachedLyrics = await query<{
    spotify_track_id: string;
    source: string;
    confidence_score: number | null;
  }>(`
    SELECT spotify_track_id, source, confidence_score
    FROM song_lyrics
    WHERE spotify_track_id = ANY(ARRAY[${spotifyIds.map(id => `'${id}'`).join(',')}])
  `);

  const cachedIds = new Set(cachedLyrics.map(l => l.spotify_track_id));
  const uncachedTracks = tracksToProcess.filter(t => !cachedIds.has(t.spotify_track_id));

  console.log(`💾 Cache hits: ${cachedLyrics.length}`);
  console.log(`🌐 API requests needed: ${uncachedTracks.length}`);
  console.log('');

  // Fetch uncached tracks from multiple sources
  const sqlStatements: string[] = [];
  let successCount = 0;
  let failCount = 0;
  let normalizedCount = 0;

  if (uncachedTracks.length > 0) {
    console.log('⏳ Fetching from multiple sources...');

    for (const track of uncachedTracks) {
      try {
        // Extract artist name from array of objects or simple string
        const artistName = Array.isArray(track.artists)
          ? (typeof track.artists[0] === 'object' ? track.artists[0].name : track.artists[0])
          : track.artists;
        console.log(`  🔍 ${track.title} - ${artistName}`);

        // Step 1: Try LRCLIB first
        const lrclibLyrics = await lrclib.searchLyrics({
          trackName: track.title,
          artistName: artistName,
          albumName: track.album,
          duration: track.duration_ms / 1000,
        });

        // Step 2: Try Lyrics.ovh as fallback
        const ovhLyrics = await lyricsOvh.searchLyrics(artistName, track.title);

        if (!lrclibLyrics && !ovhLyrics) {
          console.log(`     ❌ No lyrics found from any source`);
          sqlStatements.push(
            updatePipelineLyricsSQL(track.spotify_track_id, false)
          );
          sqlStatements.push(
            logLyricsProcessingSQL(
              track.spotify_track_id,
              'failed',
              'No lyrics found in LRCLIB or Lyrics.ovh'
            )
          );
          failCount++;
          continue;
        }

        let finalLyrics = '';
        let syncedLrc: string | null = null;
        let source: 'lrclib' | 'lyrics_ovh' | 'lrclib+lyrics_ovh' = 'lrclib';
        let normalizedBy: string | null = null;
        let confidenceScore: number | null = null;
        let rawSources: any | null = null;

        // Step 3: Determine if we need to normalize
        if (lrclibLyrics && ovhLyrics) {
          console.log(`     ✅ Found lyrics from both sources`);

          // Calculate similarity
          const similarity = calculateSimilarity(
            lrclibLyrics.plainLyrics || '',
            ovhLyrics
          );

          console.log(`        Jaccard: ${similarity.jaccardScore}`);
          console.log(`        Levenshtein: ${similarity.levenshteinScore}`);
          console.log(`        Combined: ${similarity.combinedScore}`);
          console.log(`        Corroborated: ${similarity.corroborated ? 'Yes' : 'No'}`);

          source = 'lrclib+lyrics_ovh';
          confidenceScore = similarity.combinedScore;

          // Step 4: Normalize if similarity >= 80%
          if (similarity.corroborated) {
            console.log(`     🤖 Normalizing with AI (similarity >= 80%)...`);
            try {
              finalLyrics = await normalizeLyrics(
                lrclibLyrics.plainLyrics || '',
                ovhLyrics,
                track.title,
                artistName
              );
              normalizedBy = 'gemini_flash_2_5';
              normalizedCount++;

              // Store raw sources for debugging (only when normalized)
              rawSources = {
                lrclib: lrclibLyrics.plainLyrics,
                lyrics_ovh: ovhLyrics,
              };
            } catch (error: any) {
              console.log(`     ⚠️  Normalization failed: ${error.message}`);
              // Fallback to LRCLIB
              finalLyrics = lrclibLyrics.plainLyrics || '';
            }
          } else {
            // Use LRCLIB (typically more accurate)
            console.log(`     📝 Using LRCLIB (similarity < 80%)`);
            finalLyrics = lrclibLyrics.plainLyrics || '';
          }

          // Keep synced lyrics from LRCLIB if available
          syncedLrc = lrclibLyrics.syncedLyrics || null;

        } else if (lrclibLyrics) {
          console.log(`     ✅ Found lyrics from LRCLIB only`);
          finalLyrics = lrclibLyrics.plainLyrics || '';
          syncedLrc = lrclibLyrics.syncedLyrics || null;
          source = 'lrclib';

        } else if (ovhLyrics) {
          console.log(`     ✅ Found lyrics from Lyrics.ovh only`);
          finalLyrics = ovhLyrics;
          source = 'lyrics_ovh';
        }

        if (!finalLyrics) {
          console.log(`     ❌ No usable lyrics after processing`);
          failCount++;
          continue;
        }

        // Step 5: Detect languages
        console.log(`     🌐 Detecting languages...`);
        let languageData: any | null = null;
        try {
          const languages = await detectLanguages(
            finalLyrics,
            track.title,
            artistName
          );

          languageData = {
            primary: languages.primary,
            breakdown: languages.breakdown,
            confidence: languages.confidence,
          };

          console.log(`        Primary: ${languages.primary}`);
          if (languages.breakdown.length > 1) {
            console.log(`        Mixed: ${languages.breakdown.map(l => `${l.code} (${l.percentage}%)`).join(', ')}`);
          }
        } catch (error: any) {
          console.log(`     ⚠️  Language detection failed: ${error.message}`);
          // Continue without language data
        }

        // Step 6: Get LRCLIB duration for validation (if available)
        let lrcDurationMs: number | null = null;
        if (lrclibLyrics?.duration) {
          lrcDurationMs = lrclibLyrics.duration * 1000; // Convert seconds to milliseconds
          const spotifySeconds = Math.round(track.duration_ms / 1000);
          const lrclibSeconds = lrclibLyrics.duration;
          const diffSeconds = Math.abs(spotifySeconds - lrclibSeconds);
          console.log(`        LRCLIB duration: ${lrclibSeconds}s (Spotify: ${spotifySeconds}s, diff: ${diffSeconds}s)`);
        }

        // Step 7: Store lyrics
        const lyricsRecord: LyricsRecord = {
          spotify_track_id: track.spotify_track_id,
          plain_text: finalLyrics,
          synced_lrc: syncedLrc,
          lrc_duration_ms: lrcDurationMs,
          source,
          normalized_by: normalizedBy,
          confidence_score: confidenceScore,
          language_data: languageData,
          raw_sources: rawSources,
          grove_cid: null, // Will be set later during Grove upload
        };

        sqlStatements.push(upsertLyricsSQL(lyricsRecord));

        // Update pipeline
        sqlStatements.push(
          updatePipelineLyricsSQL(track.spotify_track_id, true)
        );

        // Log success
        sqlStatements.push(
          logLyricsProcessingSQL(
            track.spotify_track_id,
            'success',
            'Lyrics discovered successfully',
            {
              source,
              normalized: !!normalizedBy,
              confidence_score: confidenceScore,
              has_synced_lrc: !!syncedLrc,
              primary_language: languageData?.primary,
            }
          )
        );

        successCount++;

        // Rate limiting (be nice to APIs)
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.log(`     ❌ Error: ${error.message}`);
        sqlStatements.push(
          updatePipelineLyricsSQL(track.spotify_track_id, false)
        );
        sqlStatements.push(
          logLyricsProcessingSQL(
            track.spotify_track_id,
            'failed',
            error.message
          )
        );
        failCount++;
      }
    }

    console.log('');
  }

  // Update pipeline status for cached tracks
  console.log('⏳ Updating pipeline entries for cached tracks...');

  for (const track of tracksToProcess.filter(t => cachedIds.has(t.spotify_track_id))) {
    const cached = cachedLyrics.find(l => l.spotify_track_id === track.spotify_track_id);
    if (cached) {
      sqlStatements.push(
        updatePipelineLyricsSQL(track.spotify_track_id, true)
      );

      sqlStatements.push(
        logLyricsProcessingSQL(
          track.spotify_track_id,
          'success',
          'Used cached lyrics',
          {
            source: cached.source,
            confidence_score: cached.confidence_score,
          }
        )
      );
    }
  }

  // Execute all SQL statements
  if (sqlStatements.length > 0) {
    try {
      await transaction(sqlStatements);
      console.log(`✅ Executed ${sqlStatements.length} SQL statements`);
    } catch (error) {
      console.error('❌ Failed to execute transaction:', error);
      throw error;
    }
  }

  console.log('');
  console.log('📊 Summary:');
  console.log(`   - Total tracks: ${tracksToProcess.length}`);
  console.log(`   - Cache hits: ${cachedLyrics.length}`);
  console.log(`   - API fetches: ${successCount}`);
  console.log(`   - AI normalized: ${normalizedCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log('');
  console.log('✅ Done! Tracks moved to: lyrics_ready');
}

main()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await close();
  });
