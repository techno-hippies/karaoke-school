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
import { normalizeLyrics, cleanLyrics, detectLanguages } from '../services/openrouter';
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
      AND (tp.has_lyrics = FALSE OR tp.has_lyrics IS NULL)
    ORDER BY tp.id
    LIMIT ${batchSize}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✅ No tracks need lyrics discovery. All caught up!');
    return;
  }

  console.log(`✅ Found ${tracksToProcess.length} tracks to process`);
  console.log('');

  // Helper: Check if track is likely instrumental based on name patterns
  const isLikelyInstrumental = (title: string, artistName: string): boolean => {
    const titleLower = title.toLowerCase();
    const artistLower = artistName.toLowerCase();

    const instrumentalPatterns = [
      'instrumental', 'karaoke', 'piano version', 'acoustic version',
      'beats', 'lofi', 'lo-fi', 'study music', 'relaxing music',
      'background music', 'ambient', 'soundscape'
    ];

    return instrumentalPatterns.some(pattern =>
      titleLower.includes(pattern) || artistLower.includes(pattern)
    );
  };

  // Helper: Normalize title for lyrics search
  // Removes TikTok-style modifiers that don't change lyrics content
  const normalizeTitleForLyricsSearch = (title: string): string => {
    return title
      // Remove "- Slowed Down", "- Slowed", "+ Reverb" variants
      .replace(/\s*[-+]\s*(slowed?\s*(down)?(\s*\+?\s*reverb)?)/gi, '')
      // Remove "- Sped Up", "- Speed Up", "- Nightcore"
      .replace(/\s*-\s*(sped\s*up|speed\s*up|nightcore)/gi, '')
      // Remove standalone "+ Reverb" or "- Reverb"
      .replace(/\s*[-+]\s*reverb/gi, '')
      // Remove "- 8D Audio" or "- 8D"
      .replace(/\s*-\s*8d(\s*audio)?/gi, '')
      // Remove parenthetical variations: "(Slowed)", "(Sped Up)", etc.
      .replace(/\s*\(.*?(slowed|sped|reverb|8d|nightcore).*?\)/gi, '')
      .trim();
  };

  // Filter out instrumental tracks (fail them early) using name pattern detection
  const instrumentalTracks = tracksToProcess.filter(t => {
    const artistName = Array.isArray(t.artists)
      ? (typeof t.artists[0] === 'object' ? t.artists[0].name : t.artists[0])
      : t.artists;

    return isLikelyInstrumental(t.title, artistName);
  });

  const nonInstrumentalTracks = tracksToProcess.filter(t => {
    const artistName = Array.isArray(t.artists)
      ? (typeof t.artists[0] === 'object' ? t.artists[0].name : t.artists[0])
      : t.artists;

    return !isLikelyInstrumental(t.title, artistName);
  });

  if (instrumentalTracks.length > 0) {
    console.log(`🎻 Detected ${instrumentalTracks.length} instrumental tracks (will fail):`);
    const instrumentalStatements: string[] = [];

    for (const track of instrumentalTracks) {
      const artistName = Array.isArray(track.artists)
        ? (typeof track.artists[0] === 'object' ? track.artists[0].name : track.artists[0])
        : track.artists;

      console.log(`   ❌ ${track.title} - ${artistName} (Pattern match)`);

      // Mark as failed with clear error message
      instrumentalStatements.push(`
        UPDATE song_pipeline
        SET status = 'failed',
            has_lyrics = FALSE,
            error_message = 'Likely instrumental track based on name patterns - no lyrics for karaoke',
            updated_at = NOW()
        WHERE spotify_track_id = '${track.spotify_track_id}'
      `);

      instrumentalStatements.push(
        logLyricsProcessingSQL(
          track.spotify_track_id,
          'failed',
          'Likely instrumental track detected via name pattern matching',
          { detection: 'pattern' }
        )
      );
    }

    if (instrumentalStatements.length > 0) {
      await transaction(instrumentalStatements);
      console.log(`   ✅ Marked ${instrumentalTracks.length} instrumental tracks as failed`);
    }
    console.log('');
  }

  // Continue with non-instrumental tracks
  const tracksForLyrics = nonInstrumentalTracks;

  if (tracksForLyrics.length === 0) {
    console.log('✅ All remaining tracks are instrumental. Nothing to process.');
    return;
  }

  console.log(`📝 Processing ${tracksForLyrics.length} non-instrumental tracks`);
  console.log('');

  // Check cache for existing lyrics
  const spotifyIds = tracksForLyrics.map(t => t.spotify_track_id);
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
  const uncachedTracks = tracksForLyrics.filter(t => !cachedIds.has(t.spotify_track_id));

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

        // Normalize title for lyrics search (removes "Slowed Down", "Sped Up", etc.)
        const normalizedTitle = normalizeTitleForLyricsSearch(track.title);
        const isModifiedVersion = normalizedTitle !== track.title;

        if (isModifiedVersion) {
          console.log(`  🔍 ${track.title} - ${artistName}`);
          console.log(`     ↳ Searching with normalized title: "${normalizedTitle}"`);
        } else {
          console.log(`  🔍 ${track.title} - ${artistName}`);
        }

        // Step 1: Try LRCLIB first (with normalized title)
        const lrclibLyrics = await lrclib.searchLyrics({
          trackName: normalizedTitle,
          artistName: artistName,
          albumName: track.album,
          // Don't use duration for modified versions - they have different timing
          duration: isModifiedVersion ? undefined : track.duration_ms / 1000,
        });

        // Step 2: Try Lyrics.ovh as fallback (with normalized title)
        const ovhLyrics = await lyricsOvh.searchLyrics(artistName, normalizedTitle);

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

        // Store original sources (extract strings from API responses)
        let lrclibText: string | null = lrclibLyrics ? (lrclibLyrics.plainLyrics || '') : null;
        let ovhText: string | null = ovhLyrics || null;
        let normalizedLyrics: string | null = null;
        let source: 'lrclib' | 'ovh' | 'lrclib+ovh' | 'normalized' | 'needs_review' = 'lrclib';
        let normalizedBy: string | null = null;
        let confidenceScore: number | null = null;

        // Step 3: Determine if we need to normalize
        if (lrclibText && ovhText) {
          console.log(`     ✅ Found lyrics from both sources`);

          // Calculate similarity
          const similarity = calculateSimilarity(
            lrclibText,
            ovhText
          );

          console.log(`        Jaccard: ${similarity.jaccardScore}`);
          console.log(`        Levenshtein: ${similarity.levenshteinScore}`);
          console.log(`        Combined: ${similarity.combinedScore}`);
          console.log(`        Corroborated: ${similarity.corroborated ? 'Yes' : 'No'}`);

          confidenceScore = similarity.combinedScore;

          // Step 4: Normalize if similarity >= 80%
          if (similarity.corroborated) {
            console.log(`     🤖 Normalizing with AI (similarity >= 80%)...`);
            try {
              normalizedLyrics = await normalizeLyrics(
                lrclibText,
                ovhText,
                track.title,
                artistName
              );
              normalizedBy = 'gemini_flash_2_5';
              source = 'normalized';
              normalizedCount++;
            } catch (error: any) {
              console.log(`     ⚠️  Normalization failed: ${error.message}`);
              // Fallback to LRCLIB, but flag for review
              source = 'needs_review';
              normalizedLyrics = null;
            }
          } else {
            // Low similarity: flag for manual review (don't normalize)
            console.log(`     ⚠️  Low similarity (< 80%) - flagging for review`);
            source = 'needs_review';
            normalizedLyrics = null;  // Needs manual review
          }

        } else if (lrclibText) {
          console.log(`     ✅ Found lyrics from LRCLIB only`);

          // Always clean single-source lyrics
          console.log(`     🧹 Cleaning lyrics (removing [Chorus], (ooh), etc.)...`);
          try {
            normalizedLyrics = await cleanLyrics(
              lrclibText,
              track.title,
              artistName
            );
            normalizedBy = 'gemini_flash_2_5';
            source = 'normalized';
            normalizedCount++;
          } catch (error: any) {
            console.log(`     ⚠️  Cleaning failed: ${error.message}`);
            // Fallback: flag for review
            source = 'needs_review';
            normalizedLyrics = null;
          }

        } else if (ovhText) {
          console.log(`     ✅ Found lyrics from Lyrics.ovh only`);

          // Clean single-source lyrics
          console.log(`     🧹 Cleaning lyrics...`);
          try {
            normalizedLyrics = await cleanLyrics(
              ovhText,
              track.title,
              artistName
            );
            normalizedBy = 'gemini_flash_2_5';
            source = 'normalized';
            normalizedCount++;
          } catch (error: any) {
            console.log(`     ⚠️  Cleaning failed: ${error.message}`);
            source = 'needs_review';
            normalizedLyrics = null;
          }
        }

        // If normalized_lyrics is NULL and source is 'needs_review', skip language detection
        if (source === 'needs_review' && !normalizedLyrics) {
          console.log(`     ⚠️  Track flagged for manual review - skipping language detection`);
        }

        // Step 5: Detect languages (only if we have normalized lyrics)
        let languageData: any | null = null;
        if (normalizedLyrics) {
          console.log(`     🌐 Detecting languages...`);
          try {
            const languages = await detectLanguages(
              normalizedLyrics,
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
        }

        // Step 6: Store lyrics with separate columns for each source
        const lyricsRecord: LyricsRecord = {
          spotify_track_id: track.spotify_track_id,
          lrclib_lyrics: lrclibText,
          ovh_lyrics: ovhText,
          normalized_lyrics: normalizedLyrics,
          source,
          normalized_by: normalizedBy,
          confidence_score: confidenceScore,
          language_data: languageData,
        };

        sqlStatements.push(upsertLyricsSQL(lyricsRecord));

        // Update pipeline (only set has_lyrics=true if normalized_lyrics exists)
        const hasUsableLyrics = !!normalizedLyrics;
        sqlStatements.push(
          updatePipelineLyricsSQL(track.spotify_track_id, hasUsableLyrics)
        );

        // Log success or needs_review
        const logAction = hasUsableLyrics ? 'success' : 'skipped';
        const logMessage = hasUsableLyrics
          ? 'Lyrics discovered successfully'
          : 'Low similarity - needs manual review';

        sqlStatements.push(
          logLyricsProcessingSQL(
            track.spotify_track_id,
            logAction,
            logMessage,
            {
              source,
              normalized: !!normalizedBy,
              confidence_score: confidenceScore,
              needs_review: !hasUsableLyrics,
              primary_language: languageData?.primary,
            }
          )
        );

        if (hasUsableLyrics) {
          successCount++;
        } else {
          failCount++;  // Count flagged tracks as failed (needs review)
        }

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

  for (const track of tracksForLyrics.filter(t => cachedIds.has(t.spotify_track_id))) {
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
  console.log(`   - Instrumental (failed): ${instrumentalTracks.length}`);
  console.log(`   - Cache hits: ${cachedLyrics.length}`);
  console.log(`   - API fetches: ${successCount}`);
  console.log(`   - AI normalized: ${normalizedCount}`);
  console.log(`   - Failed: ${failCount}`);
  console.log('');
  console.log('✅ Done! Tracks moved to: lyrics_ready');
}

/**
 * Export function for orchestrator
 * Uses the same logic as main() but with configurable limit
 */
export async function processDiscoverLyrics(_env: any, limit: number = 50): Promise<void> {
  console.log(`[Step 5] Discover Lyrics (limit: ${limit})`);

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
      AND (tp.has_lyrics = FALSE OR tp.has_lyrics IS NULL)
    ORDER BY tp.id
    LIMIT ${limit}
  `);

  if (tracksToProcess.length === 0) {
    console.log('✓ No tracks need lyrics discovery');
    return;
  }

  console.log(`Found ${tracksToProcess.length} tracks`);

  // Helper: Check if track is likely instrumental based on name patterns
  const isLikelyInstrumental = (title: string, artistName: string): boolean => {
    const titleLower = title.toLowerCase();
    const artistLower = artistName.toLowerCase();

    const instrumentalPatterns = [
      'instrumental', 'karaoke', 'piano version', 'acoustic version',
      'beats', 'lofi', 'lo-fi', 'study music', 'relaxing music',
      'background music', 'ambient', 'soundscape'
    ];

    return instrumentalPatterns.some(pattern =>
      titleLower.includes(pattern) || artistLower.includes(pattern)
    );
  };

  // Helper: Normalize title for lyrics search
  const normalizeTitleForLyricsSearch = (title: string): string => {
    return title
      .replace(/\s*[-+]\s*(slowed?\s*(down)?(\s*\+?\s*reverb)?)/gi, '')
      .replace(/\s*-\s*(sped\s*up|speed\s*up|nightcore)/gi, '')
      .replace(/\s*[-+]\s*reverb/gi, '')
      .replace(/\s*-\s*8d(\s*audio)?/gi, '')
      .replace(/\s*\(.*?(slowed|sped|reverb|8d|nightcore).*?\)/gi, '')
      .trim();
  };

  // Filter out instrumental tracks
  const instrumentalTracks = tracksToProcess.filter(t => {
    const artistName = Array.isArray(t.artists)
      ? (typeof t.artists[0] === 'object' ? t.artists[0].name : t.artists[0])
      : t.artists;
    return isLikelyInstrumental(t.title, artistName);
  });

  const nonInstrumentalTracks = tracksToProcess.filter(t => {
    const artistName = Array.isArray(t.artists)
      ? (typeof t.artists[0] === 'object' ? t.artists[0].name : t.artists[0])
      : t.artists;
    return !isLikelyInstrumental(t.title, artistName);
  });

  if (instrumentalTracks.length > 0) {
    console.log(`   Instrumental tracks (failing): ${instrumentalTracks.length}`);
    const instrumentalStatements: string[] = [];

    for (const track of instrumentalTracks) {
      instrumentalStatements.push(`
        UPDATE song_pipeline
        SET status = 'failed',
            has_lyrics = FALSE,
            error_message = 'Likely instrumental track based on name patterns - no lyrics for karaoke',
            updated_at = NOW()
        WHERE spotify_track_id = '${track.spotify_track_id}'
      `);

      instrumentalStatements.push(
        logLyricsProcessingSQL(
          track.spotify_track_id,
          'failed',
          'Likely instrumental track detected via name pattern matching',
          { detection: 'pattern' }
        )
      );
    }

    if (instrumentalStatements.length > 0) {
      await transaction(instrumentalStatements);
    }
  }

  const tracksForLyrics = nonInstrumentalTracks;

  if (tracksForLyrics.length === 0) {
    console.log('✓ All remaining tracks are instrumental');
    return;
  }

  console.log(`   Processing ${tracksForLyrics.length} non-instrumental tracks`);

  // Check cache
  const spotifyIds = tracksForLyrics.map(t => t.spotify_track_id);
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
  const uncachedTracks = tracksForLyrics.filter(t => !cachedIds.has(t.spotify_track_id));

  console.log(`   Cache hits: ${cachedLyrics.length}, API requests: ${uncachedTracks.length}`);

  const sqlStatements: string[] = [];
  let successCount = 0;
  let normalizedCount = 0;
  let failCount = 0;

  // Fetch uncached tracks
  for (const track of uncachedTracks) {
    try {
      const artistName = Array.isArray(track.artists)
        ? (typeof track.artists[0] === 'object' ? track.artists[0].name : track.artists[0])
        : track.artists;

      const normalizedTitle = normalizeTitleForLyricsSearch(track.title);
      const isModifiedVersion = normalizedTitle !== track.title;

      console.log(`\n  🔍 ${track.title} - ${artistName}`);

      // Try LRCLIB
      console.log('     Querying LRCLIB...');
      const lrclibStart = Date.now();
      const lrclibLyrics = await lrclib.searchLyrics({
        trackName: normalizedTitle,
        artistName: artistName,
        albumName: track.album,
        duration: isModifiedVersion ? undefined : track.duration_ms / 1000,
      });
      console.log(`        (${Date.now() - lrclibStart}ms)`);

      // Try Lyrics.ovh
      console.log('     Querying Lyrics.ovh...');
      const ovhStart = Date.now();
      const ovhLyrics = await lyricsOvh.searchLyrics(artistName, normalizedTitle);
      console.log(`        (${Date.now() - ovhStart}ms)`);

      if (!lrclibLyrics && !ovhLyrics) {
        console.log('     ❌ No lyrics found from any source');
        sqlStatements.push(updatePipelineLyricsSQL(track.spotify_track_id, false));
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

      // Store original sources
      let lrclibText: string | null = lrclibLyrics ? (lrclibLyrics.plainLyrics || '') : null;
      let ovhText: string | null = ovhLyrics || null;
      let normalizedLyrics: string | null = null;
      let source: 'lrclib' | 'ovh' | 'lrclib+ovh' | 'normalized' | 'needs_review' = 'lrclib';
      let normalizedBy: string | null = null;
      let confidenceScore: number | null = null;

      // Determine if we need to normalize
      if (lrclibText && ovhText) {
        const similarity = calculateSimilarity(lrclibText, ovhText);
        confidenceScore = similarity.combinedScore;
        console.log(`     ✅ Found lyrics from both sources`);
        console.log(`        Similarity: ${(similarity.combinedScore * 100).toFixed(0)}%`);

        if (similarity.corroborated) {
          console.log('     🤖 Normalizing with AI...');
          const aiStart = Date.now();
          try {
            normalizedLyrics = await normalizeLyrics(lrclibText, ovhText, track.title, artistName);
            console.log(`        (${Date.now() - aiStart}ms)`);
            normalizedBy = 'gemini_flash_2_5';
            source = 'normalized';
            normalizedCount++;
          } catch (error: any) {
            console.log(`        FAILED (${Date.now() - aiStart}ms)`);
            source = 'needs_review';
            normalizedLyrics = null;
          }
        } else {
          console.log('     ⚠️  Low similarity (< 80%) - flagging for review');
          source = 'needs_review';
          normalizedLyrics = null;
        }
      } else if (lrclibText) {
        console.log('     ✅ Found lyrics from LRCLIB only');
        console.log('     🤖 Cleaning with AI...');
        const aiStart = Date.now();
        try {
          normalizedLyrics = await cleanLyrics(lrclibText, track.title, artistName);
          console.log(`        (${Date.now() - aiStart}ms)`);
          normalizedBy = 'gemini_flash_2_5';
          source = 'normalized';
          normalizedCount++;
        } catch (error: any) {
          console.log(`        FAILED (${Date.now() - aiStart}ms)`);
          source = 'needs_review';
          normalizedLyrics = null;
        }
      } else if (ovhText) {
        console.log('     ✅ Found lyrics from Lyrics.ovh only');
        console.log('     🤖 Cleaning with AI...');
        const aiStart = Date.now();
        try {
          normalizedLyrics = await cleanLyrics(ovhText, track.title, artistName);
          console.log(`        (${Date.now() - aiStart}ms)`);
          normalizedBy = 'gemini_flash_2_5';
          source = 'normalized';
          normalizedCount++;
        } catch (error: any) {
          console.log(`        FAILED (${Date.now() - aiStart}ms)`);
          source = 'needs_review';
          normalizedLyrics = null;
        }
      }

      // Detect languages (only if we have normalized lyrics)
      let languageData: any | null = null;
      if (normalizedLyrics) {
        console.log('     🌐 Detecting languages...');
        const langStart = Date.now();
        try {
          const languages = await detectLanguages(normalizedLyrics, track.title, artistName);
          console.log(`        (${Date.now() - langStart}ms)`);
          languageData = {
            primary: languages.primary,
            breakdown: languages.breakdown,
            confidence: languages.confidence,
          };
        } catch (error: any) {
          // Continue without language data
        }
      }

      // Store lyrics with CORRECT column names
      const lyricsRecord: LyricsRecord = {
        spotify_track_id: track.spotify_track_id,
        lrclib_lyrics: lrclibText,
        ovh_lyrics: ovhText,
        normalized_lyrics: normalizedLyrics,
        source,
        normalized_by: normalizedBy,
        confidence_score: confidenceScore,
        language_data: languageData,
      };

      sqlStatements.push(upsertLyricsSQL(lyricsRecord));

      // Update pipeline
      const hasUsableLyrics = !!normalizedLyrics;
      sqlStatements.push(updatePipelineLyricsSQL(track.spotify_track_id, hasUsableLyrics));

      const logAction = hasUsableLyrics ? 'success' : 'skipped';
      const logMessage = hasUsableLyrics
        ? 'Lyrics discovered successfully'
        : 'Low similarity - needs manual review';

      sqlStatements.push(
        logLyricsProcessingSQL(
          track.spotify_track_id,
          logAction,
          logMessage,
          {
            source,
            normalized: !!normalizedBy,
            confidence_score: confidenceScore,
            needs_review: !hasUsableLyrics,
            primary_language: languageData?.primary,
          }
        )
      );

      if (hasUsableLyrics) {
        successCount++;
      } else {
        failCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      sqlStatements.push(updatePipelineLyricsSQL(track.spotify_track_id, false));
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

  // Update cached tracks
  for (const track of tracksForLyrics.filter(t => cachedIds.has(t.spotify_track_id))) {
    const cached = cachedLyrics.find(l => l.spotify_track_id === track.spotify_track_id);
    if (cached) {
      sqlStatements.push(updatePipelineLyricsSQL(track.spotify_track_id, true));
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

  if (sqlStatements.length > 0) {
    await transaction(sqlStatements);
  }

  console.log(`✅ Step 5 Complete: ${successCount} fetched, ${normalizedCount} normalized, ${failCount} failed`);
}

// Only run main() if this file is executed directly, not when imported
if (import.meta.main) {
  main()
    .catch((error) => {
      console.error('❌ Fatal error:', error);
      process.exit(1);
    })
    .finally(async () => {
      await close();
    });
}
