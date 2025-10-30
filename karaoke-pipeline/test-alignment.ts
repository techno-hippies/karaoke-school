#!/usr/bin/env bun
/**
 * Test ElevenLabs Forced Alignment
 * Simple test script to verify the alignment processor works
 */

import { query } from './src/db/neon';
import { ElevenLabsService } from './src/services/elevenlabs';

async function main() {
  console.log('🧪 Testing ElevenLabs Forced Alignment\n');

  // Check for API key
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('❌ ELEVENLABS_API_KEY not found in environment');
    process.exit(1);
  }

  const elevenlabs = new ElevenLabsService(apiKey);

  // Find one track needing alignment
  const tracks = await query<{
    spotify_track_id: string;
    title: string;
    artists: string[];
    grove_url: string;
    plain_text: string;
  }>(`
    SELECT
      sp.spotify_track_id,
      st.title,
      st.artists,
      sa.grove_url,
      sl.lyrics as plain_text
    FROM song_pipeline sp
    JOIN spotify_tracks st ON sp.spotify_track_id = st.spotify_track_id
    JOIN song_audio sa ON sp.spotify_track_id = sa.spotify_track_id
    JOIN song_lyrics sl ON sp.spotify_track_id = sl.spotify_track_id
    LEFT JOIN elevenlabs_word_alignments ewa ON sp.spotify_track_id = ewa.spotify_track_id
    WHERE sp.status = 'audio_downloaded'
      AND sp.has_audio = TRUE
      AND sp.has_lyrics = TRUE
      AND ewa.spotify_track_id IS NULL
    ORDER BY sp.updated_at ASC
    LIMIT 1
  `);

  if (tracks.length === 0) {
    console.log('✓ No tracks need alignment');
    return;
  }

  const track = tracks[0];
  const artistsStr = Array.isArray(track.artists) ? track.artists.join(', ') : track.artists;

  console.log(`📍 Track: ${track.title} - ${artistsStr}`);
  console.log(`   Spotify ID: ${track.spotify_track_id}`);
  console.log(`   Audio: ${track.grove_url}`);
  console.log(`   Lyrics: ${track.plain_text.length} chars\n`);

  console.log('🎵 Calling ElevenLabs API...');
  const startTime = Date.now();

  try {
    const alignment = await elevenlabs.forcedAlignment(
      track.grove_url,
      track.plain_text
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Alignment complete (${duration}s):`);
    console.log(`   Words: ${alignment.totalWords}`);
    console.log(`   Characters: ${alignment.totalCharacters}`);
    console.log(`   Loss: ${alignment.overallLoss.toFixed(3)}`);
    console.log(`   Duration: ${(alignment.alignmentDurationMs / 1000).toFixed(1)}s`);

    // Store in database
    console.log('\n💾 Storing in database...');

    const wordsJson = JSON.stringify(alignment.words).replace(/'/g, "''");
    const charactersJson = JSON.stringify(alignment.characters).replace(/'/g, "''");
    const rawJson = JSON.stringify(alignment.rawResponse).replace(/'/g, "''");

    await query(`
      INSERT INTO elevenlabs_word_alignments (
        spotify_track_id,
        words,
        total_words,
        characters,
        total_characters,
        alignment_duration_ms,
        overall_loss,
        raw_alignment_data
      ) VALUES (
        '${track.spotify_track_id}',
        '${wordsJson}'::jsonb,
        ${alignment.totalWords},
        '${charactersJson}'::jsonb,
        ${alignment.totalCharacters},
        ${alignment.alignmentDurationMs},
        ${alignment.overallLoss},
        '${rawJson}'::jsonb
      )
      ON CONFLICT (spotify_track_id)
      DO UPDATE SET
        words = EXCLUDED.words,
        total_words = EXCLUDED.total_words,
        characters = EXCLUDED.characters,
        total_characters = EXCLUDED.total_characters,
        alignment_duration_ms = EXCLUDED.alignment_duration_ms,
        overall_loss = EXCLUDED.overall_loss,
        raw_alignment_data = EXCLUDED.raw_alignment_data,
        updated_at = NOW()
    `);

    // Update pipeline status
    await query(`
      UPDATE song_pipeline
      SET status = 'alignment_complete',
          updated_at = NOW()
      WHERE spotify_track_id = '${track.spotify_track_id}'
    `);

    console.log('✅ Stored successfully!');
    console.log(`   Pipeline status updated: audio_downloaded → alignment_complete`);

  } catch (error: any) {
    console.error(`\n❌ Alignment failed:`, error.message);
    throw error;
  }
}

main().catch(console.error);
