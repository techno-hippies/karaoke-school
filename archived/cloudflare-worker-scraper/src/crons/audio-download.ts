/**
 * Audio Download Cron (runs every 30 minutes)
 *
 * Downloads audio files via Freyr service and stores in Grove IPFS.
 * ONLY processes tracks with corroborated ISWC (viable for licensing).
 *
 * Flow:
 * 1. Find tracks with ISWC but no audio file record
 * 2. Download via freyr-service (YouTube → MP3 → AcoustID verification)
 * 3. Upload to Grove IPFS and store CID in Neon
 * 4. Record download method and verification status
 *
 * Rate limit: 3 seconds between downloads (YouTube rate limiting)
 */

import { NeonDB } from '../neon';
import type { Env } from '../types';

export default async function runAudioDownload(env: Env): Promise<void> {
  console.log('🎧 Audio Download Cron: Starting...');

  if (!env.FREYR_SERVICE_URL) {
    console.log('FREYR_SERVICE_URL not configured, skipping');
    return;
  }

  if (!env.ACOUSTID_API_KEY) {
    console.log('ACOUSTID_API_KEY not configured, skipping');
    return;
  }

  const db = new NeonDB(env.NEON_DATABASE_URL);

  try {
    const readyTracks = await db.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists,
        st.isrc,
        st.iswc_source
      FROM spotify_tracks st
      LEFT JOIN track_audio_files taf ON st.spotify_track_id = taf.spotify_track_id
      WHERE taf.spotify_track_id IS NULL
        AND st.has_iswc = true
      ORDER BY st.popularity DESC NULLS LAST
      LIMIT 100
    `;

    if (readyTracks.length === 0) {
      console.log('No tracks ready for audio download (need corroborated ISWC)');
      return;
    }

    console.log(`Submitting ${readyTracks.length} tracks for audio download (fire-and-forget)...`);
    let submitted = 0;

    // Add delay between submissions to avoid overwhelming Freyr service
    const BATCH_DELAY_MS = 2000; // 2 seconds between submissions

    // Fire-and-forget: submit all downloads without waiting
    // Freyr service will write results to Neon DB when each download completes
    const promises = readyTracks.map(async (track, index) => {
      try {
        // Artists is stored as string array: ["Ariana Grande"], not objects
        const artists = track.artists as string[];
        const primaryArtist = artists[0] || 'Unknown';

        // Add delay between submissions to avoid overwhelming Freyr
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }

        console.log(`Submitting: ${track.title} - ${primaryArtist}`);

        // Fire request without waiting for completion
        fetch(`${env.FREYR_SERVICE_URL}/download-and-store`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spotify_track_id: track.spotify_track_id,
            expected_title: track.title,
            expected_artist: primaryArtist,
            acoustid_api_key: env.ACOUSTID_API_KEY,
            neon_database_url: env.NEON_DATABASE_URL,
            chain_id: 37111, // Lens Network
          }),
        }).catch(error => {
          console.error(`Failed to submit ${track.spotify_track_id}:`, error);
        });

        submitted++;
      } catch (error) {
        console.error(`Error submitting ${track.spotify_track_id}:`, error);
      }
    });

    await Promise.all(promises);

    console.log(`✅ Audio Download: ${submitted} tracks submitted to Freyr service`);
  } catch (error) {
    console.error('❌ Audio Download failed:', error);
    throw error;
  }
}
