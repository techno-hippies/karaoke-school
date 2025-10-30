/**
 * ElevenLabs Word Alignment Cron (runs every 40 minutes)
 *
 * Forced alignment: Match lyrics to audio timestamps for karaoke production.
 * ONLY processes tracks with:
 * - Audio file on Grove IPFS (from audio-download cron)
 * - Corroborated plain lyrics (from lyrics-enrichment cron)
 * - Not instrumental
 *
 * Flow:
 * 1. Find tracks with audio + lyrics but no word alignment
 * 2. Send to ElevenLabs forced alignment API
 * 3. Store word-level timestamps in elevenlabs_word_alignments
 * 4. Word timestamps enable karaoke segment selection
 *
 * Rate limit: 2 seconds between API calls (ElevenLabs processing time)
 */

import { KaraokeDB } from '../db/karaoke';
import { ElevenLabsService } from '../services/elevenlabs';
import type { Env } from '../types';

export default async function runElevenLabsAlignment(env: Env): Promise<void> {
  console.log('🎤 ElevenLabs Alignment Cron: Starting...');

  if (!env.ELEVENLABS_API_KEY) {
    console.log('ELEVENLABS_API_KEY not configured, skipping');
    return;
  }

  const db = new KaraokeDB(env.NEON_DATABASE_URL);
  const elevenlabs = new ElevenLabsService(env.ELEVENLABS_API_KEY);

  try {
    const tracksNeedingAlignment = await db.getTracksNeedingWordAlignment(10);

    if (tracksNeedingAlignment.length === 0) {
      console.log('No tracks need word alignment (need audio + lyrics)');
      return;
    }

    console.log(`Running forced alignment for ${tracksNeedingAlignment.length} tracks...`);
    let alignedCount = 0;
    let failedCount = 0;

    for (const track of tracksNeedingAlignment) {
      try {
        const artistsArray = track.artists as string[];
        const primaryArtist = artistsArray[0] || 'Unknown';

        console.log(`Aligning: ${track.title} - ${primaryArtist}`);
        console.log(`  Audio: ${track.grove_url}`);
        console.log(`  Lyrics: ${track.plain_lyrics.substring(0, 50)}...`);

        // Call ElevenLabs forced alignment API
        const result = await elevenlabs.alignFromGrove(
          track.grove_url,
          track.plain_lyrics
        );

        if (!result.words || result.words.length === 0) {
          console.error(`  ✗ No words returned for ${track.spotify_track_id}`);
          failedCount++;
          continue;
        }

        // Store word-level alignment in DB
        await db.upsertElevenLabsAlignment(
          track.spotify_track_id,
          result.words,
          result.alignment
        );

        const durationS = result.words[result.words.length - 1]?.end || 0;
        alignedCount++;

        console.log(`  ✓ Aligned ${result.words.length} words (${durationS.toFixed(1)}s)`);

        // Rate limiting: 2 seconds between API calls
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        failedCount++;
        console.error(`  ✗ Failed to align ${track.spotify_track_id}:`, error);
      }
    }

    console.log(`✅ ElevenLabs Alignment: ${alignedCount} tracks aligned, ${failedCount} failed`);
  } catch (error) {
    console.error('❌ ElevenLabs Alignment failed:', error);
    throw error;
  }
}
