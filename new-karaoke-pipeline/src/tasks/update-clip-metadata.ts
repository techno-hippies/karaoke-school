#!/usr/bin/env bun
/**
 * Update Clip Metadata in Grove
 *
 * Re-uploads clip lyrics metadata with complete artist/title/cover information
 * so the frontend can filter and display songs properly.
 *
 * This fixes the missing artistLensHandle issue caused by generate-clip-lines.ts
 * only including lyrics data without display metadata.
 */

import { query } from '../db/connection';
import { uploadToGrove } from '../services/storage';

interface ClipMetadataRow {
  spotify_track_id: string;
  title: string;
  primary_artist_name: string;
  grc20_entity_id: string | null;
  artist_lens_handle: string | null;
  cover_url: string | null;
  clip_start_ms: number;
  clip_end_ms: number;
  clip_lyrics_grove_url: string;
  clip_lyrics_grove_cid: string;
}

interface ClipLine {
  clip_line_index: number;
  original_text: string;
  clip_relative_start_ms: number;
  clip_relative_end_ms: number;
  word_timings: any;
}

async function main() {
  console.log('\n📝 Updating clip metadata with artist/title/cover info...\n');

  // Fetch all tracks with clip lyrics
  const tracks = await query<ClipMetadataRow>(`
    SELECT
      t.spotify_track_id,
      t.title,
      t.primary_artist_name,
      gw.grc20_entity_id,
      ga.lens_handle as artist_lens_handle,
      gw.image_url as cover_url,
      ks.clip_start_ms,
      ks.clip_end_ms,
      ks.clip_lyrics_grove_url,
      ks.clip_lyrics_grove_cid
    FROM tracks t
    JOIN karaoke_segments ks ON t.spotify_track_id = ks.spotify_track_id
    LEFT JOIN grc20_works gw ON t.spotify_track_id = gw.spotify_track_id
    LEFT JOIN grc20_artists ga ON gw.primary_artist_id = ga.id
    WHERE ks.clip_lyrics_grove_url IS NOT NULL
    ORDER BY t.title
  `);

  if (tracks.length === 0) {
    console.log('❌ No tracks found with clip lyrics');
    return;
  }

  console.log(`Found ${tracks.length} tracks to update\n`);

  let successCount = 0;
  let failCount = 0;

  for (const track of tracks) {
    console.log(`🎵 ${track.title} - ${track.primary_artist_name}`);
    console.log(`   Spotify: ${track.spotify_track_id}`);
    console.log(`   Artist Handle: ${track.artist_lens_handle || 'N/A'}`);

    try {
      // Fetch existing clip lines from database
      const clipLines = await query<ClipLine>(`
        SELECT
          clip_line_index,
          original_text,
          clip_relative_start_ms,
          clip_relative_end_ms,
          word_timings
        FROM clip_lines
        WHERE spotify_track_id = $1
        ORDER BY clip_line_index
      `, [track.spotify_track_id]);

      if (clipLines.length === 0) {
        console.log('   ⚠️  No clip lines found, skipping');
        continue;
      }

      // Create complete metadata with all fields
      const completeMetadata = {
        version: 'v2',
        type: 'clip_lyrics',

        // Spotify/GRC-20 identifiers
        spotifyTrackId: track.spotify_track_id,
        grc20WorkId: track.grc20_entity_id || track.spotify_track_id,

        // Display metadata (CRITICAL for frontend)
        title: track.title,
        artist: track.primary_artist_name,
        artistLensHandle: track.artist_lens_handle,
        coverUri: track.cover_url,

        // Clip timing
        clipStartMs: track.clip_start_ms,
        clipEndMs: track.clip_end_ms,

        // Lyrics data
        lineCount: clipLines.length,
        lines: clipLines.map((line) => ({
          lineIndex: line.clip_line_index,
          originalText: line.original_text,
          start: line.clip_relative_start_ms / 1000, // Convert to seconds
          end: line.clip_relative_end_ms / 1000,
          words: line.word_timings || [],
        })),

        generatedAt: new Date().toISOString(),
      };

      // Upload to Grove
      const { cid, url } = await uploadToGrove(
        JSON.stringify(completeMetadata, null, 2),
        `clip-lyrics-${track.spotify_track_id}.json`
      );

      console.log(`   ✓ Uploaded to Grove: ${cid}`);

      // Update database with new URL
      await query(`
        UPDATE karaoke_segments
        SET clip_lyrics_grove_cid = $1,
            clip_lyrics_grove_url = $2,
            updated_at = NOW()
        WHERE spotify_track_id = $3
      `, [cid, url, track.spotify_track_id]);

      console.log(`   ✓ Updated database`);
      successCount++;

    } catch (error: any) {
      console.error(`   ✗ Failed: ${error.message}`);
      failCount++;
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
