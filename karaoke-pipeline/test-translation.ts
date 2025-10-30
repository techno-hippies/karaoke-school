#!/usr/bin/env bun
/**
 * Test Lyrics Translation
 * Simple test script to verify the translation processor works
 */

import { query } from './src/db/neon';
import { LyricsTranslator, type LanguageCode } from './src/services/lyrics-translator';

async function main() {
  console.log('🧪 Testing Lyrics Translation\n');

  // Check for API key
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in environment');
    process.exit(1);
  }

  const translator = new LyricsTranslator(apiKey);

  // Find the track we just aligned
  const tracks = await query<{
    spotify_track_id: string;
    title: string;
    artists: string[];
    words: any[];
    plain_text: string;
    language_data: any;
  }>(`
    SELECT
      sp.spotify_track_id,
      st.title,
      st.artists,
      ewa.words,
      sl.lyrics as plain_text,
      sl.language_data
    FROM song_pipeline sp
    JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
    JOIN elevenlabs_word_alignments ewa ON sp.spotify_track_id = ewa.spotify_track_id
    JOIN song_lyrics sl ON sp.spotify_track_id = sl.spotify_track_id
    WHERE sp.status = 'alignment_complete'
      AND sp.spotify_track_id = '2Di0qFNb7ATroCGB3q0Ka7'
    LIMIT 1
  `);

  if (tracks.length === 0) {
    console.log('✓ No aligned tracks to translate');
    return;
  }

  const track = tracks[0];
  const artistsStr = Array.isArray(track.artists) ? track.artists.join(', ') : track.artists;

  console.log(`📍 Track: ${track.title} - ${artistsStr}`);
  console.log(`   Spotify ID: ${track.spotify_track_id}`);
  console.log(`   Words: ${track.words.length}`);
  console.log(`   Lyrics: ${track.plain_text.length} chars\n`);

  // Detect source language
  const sourceLanguage = track.language_data?.detected_language || 'en';
  console.log(`🌍 Source language: ${sourceLanguage}\n`);

  // Parse words into lines
  console.log('📝 Parsing alignment into lines...');
  const lines = LyricsTranslator.parseLinesFromAlignment(track.words, track.plain_text);
  console.log(`   Found ${lines.length} lines\n`);

  // Target languages to test
  const targetLanguages: LanguageCode[] = ['es', 'zh', 'ja'];

  console.log(`🔤 Translating to ${targetLanguages.length} languages: ${targetLanguages.join(', ')}\n`);

  let successCount = 0;
  let failureCount = 0;

  for (const langCode of targetLanguages) {
    try {
      console.log(`\n🌏 Translating to ${langCode}...`);
      const startTime = Date.now();

      const result = await translator.translateLines(lines, langCode, sourceLanguage);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`   ✓ Translation complete (${duration}s)`);
      console.log(`   Lines: ${result.lines.length}`);
      console.log(`   Confidence: ${result.confidenceScore.toFixed(2)}`);

      // Store in database
      console.log('   💾 Storing in database...');

      const linesJson = JSON.stringify(result.lines).replace(/'/g, "''");
      const sourceLanguageDataJson = JSON.stringify(track.language_data).replace(/'/g, "''");

      await query(`
        INSERT INTO lyrics_translations (
          spotify_track_id,
          language_code,
          lines,
          translation_source,
          confidence_score,
          source_language_code,
          source_language_data
        ) VALUES (
          '${track.spotify_track_id}',
          '${langCode}',
          '${linesJson}'::jsonb,
          'gemini-flash-2.5-lite',
          ${result.confidenceScore},
          '${sourceLanguage}',
          '${sourceLanguageDataJson}'::jsonb
        )
        ON CONFLICT (spotify_track_id, language_code)
        DO UPDATE SET
          lines = EXCLUDED.lines,
          confidence_score = EXCLUDED.confidence_score,
          updated_at = NOW()
      `);

      console.log(`   ✅ Stored ${langCode} translation`);
      successCount++;

      // Rate limiting
      if (targetLanguages.indexOf(langCode) < targetLanguages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.error(`   ❌ Failed to translate to ${langCode}:`, error.message);
      failureCount++;
    }
  }

  // Count total translations
  const translationCount = await query<{ count: string }>(`
    SELECT COUNT(*) as count
    FROM lyrics_translations
    WHERE spotify_track_id = '${track.spotify_track_id}'
  `);

  const totalTranslations = parseInt(translationCount[0].count);

  // Update pipeline status if we have 3+ translations
  if (totalTranslations >= 3) {
    console.log(`\n✅ Track has ${totalTranslations} translations, updating status...`);
    await query(`
      UPDATE song_pipeline
      SET status = 'translations_ready',
          updated_at = NOW()
      WHERE spotify_track_id = '${track.spotify_track_id}'
    `);
    console.log('   Pipeline status updated: alignment_complete → translations_ready');
  }

  console.log(`\n✅ Test Complete: ${successCount} succeeded, ${failureCount} failed`);
}

main().catch(console.error);
