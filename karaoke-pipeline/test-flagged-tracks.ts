#!/usr/bin/env bun
/**
 * Test: Verify similarity scores for previously flagged tracks
 * Tests the 5 tracks that were flagged for review to ensure formatting normalization
 * is working correctly
 */

import { query } from './src/db/neon';
import { calculateSimilarity } from './src/services/lyrics-similarity';
import * as lrclib from './src/services/lrclib';
import * as lyricsOvh from './src/services/lyrics-ovh';

const FLAGGED_TRACKS = [
  { spotify_id: '1uigwk5hNV84zRd5YQQRTk', title: 'Pocketful of Sunshine', artist: 'Natasha Bedingfield', expected_score: 0.74 },
  { spotify_id: '7EiZI6JVHllARrX9PUvAdX', title: 'Low Life', artist: 'Future', expected_score: 0.74 },
  { spotify_id: '0YRCuqOTnQl5QGaZo4XYdq', title: 'Oh, Pretty Woman', artist: 'Roy Orbison', expected_score: 0.71 },
  { spotify_id: '6nek1Nin9q48AVZcWs9e9D', title: 'Paradise', artist: 'Coldplay', expected_score: 0.63 },
  { spotify_id: '6mhw2fEPH4fMF0wolNm96e', title: 'Macarena', artist: 'Los Del Rio', expected_score: 0.14 },
];

async function testFlaggedTracks() {
  console.log('🧪 Testing Similarity Scores for Flagged Tracks\n');

  for (const track of FLAGGED_TRACKS) {
    try {
      console.log(`📌 ${track.title} - ${track.artist}`);

      // Get lyrics from database first
      const dbResult = await query<{
        lrclib_lyrics: string | null;
        ovh_lyrics: string | null;
        source: string;
        confidence_score: number | null;
      }>(`
        SELECT lrclib_lyrics, ovh_lyrics, source, confidence_score
        FROM song_lyrics
        WHERE spotify_track_id = '${track.spotify_id}'
      `);

      if (dbResult.length === 0) {
        console.log(`   ⚠️  No lyrics found in database for this track`);
        console.log('');
        continue;
      }

      const { lrclib_lyrics, ovh_lyrics, source, confidence_score } = dbResult[0];

      console.log(`   Current status: ${source} (confidence: ${confidence_score})`);

      if (lrclib_lyrics && ovh_lyrics) {
        // Both sources available - recalculate similarity
        console.log(`   Recalculating similarity with formatting normalization...`);

        const similarity = calculateSimilarity(lrclib_lyrics, ovh_lyrics);

        console.log(`   📊 Similarity Scores:`);
        console.log(`      Jaccard: ${similarity.jaccardScore}`);
        console.log(`      Levenshtein: ${similarity.levenshteinScore}`);
        console.log(`      Combined: ${similarity.combinedScore}`);
        console.log(`      Corroborated (≥0.80): ${similarity.corroborated ? '✅ Yes' : '❌ No'}`);

        // Compare with expected/stored score
        const scoreDiff = Math.abs(similarity.combinedScore - (confidence_score || 0));
        if (scoreDiff < 0.01) {
          console.log(`   ✅ Score consistent: stored=${confidence_score}, recalculated=${similarity.combinedScore}`);
        } else {
          console.log(`   ⚠️  Score changed: stored=${confidence_score}, recalculated=${similarity.combinedScore} (diff: ${scoreDiff.toFixed(2)})`);
        }

        if (similarity.corroborated !== (source === 'normalized')) {
          console.log(`   ⚠️  Status mismatch: score says ${similarity.corroborated ? 'should normalize' : 'should flag'} but stored as ${source}`);
        } else {
          console.log(`   ✅ Status consistent with stored value`);
        }
      } else if (lrclib_lyrics) {
        console.log(`   ✅ Single source (LRCLIB) - should be cleaned/normalized`);
        console.log(`   Current status: ${source === 'normalized' ? '✅ Correct' : '❌ Incorrect'}`);
      } else if (ovh_lyrics) {
        console.log(`   ✅ Single source (OVH) - should be cleaned/normalized`);
        console.log(`   Current status: ${source === 'normalized' ? '✅ Correct' : '❌ Incorrect'}`);
      }

      console.log('');
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      console.log('');
    }
  }

  console.log('✅ Test complete!');
}

testFlaggedTracks()
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    const { close } = await import('./src/db/neon');
    await close();
  });
