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
      LIMIT 20
    `;

    if (readyTracks.length === 0) {
      console.log('No tracks ready for audio download (need corroborated ISWC)');
      return;
    }

    console.log(`Downloading audio for ${readyTracks.length} tracks...`);
    let downloaded = 0;

    for (const track of readyTracks) {
      try {
        // Artists is stored as string array: ["Ariana Grande"], not objects
        const artists = track.artists as string[];
        const primaryArtist = artists[0] || 'Unknown';

        console.log(`Downloading: ${track.title} - ${primaryArtist}`);

        const response = await fetch(`${env.FREYR_SERVICE_URL}/download-and-store`, {
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
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Failed to download ${track.spotify_track_id}: ${errorData.message}`);
          continue;
        }

        const data = await response.json();
        downloaded++;

        console.log(`✓ Downloaded "${track.title}" (CID: ${data.grove_cid}, ${data.download_method}, verified: ${data.verification?.verified})`);

        // Rate limiting: 3 seconds between downloads
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Error downloading ${track.spotify_track_id}:`, error);
      }
    }

    console.log(`✅ Audio Download: ${downloaded} audio files downloaded to Grove`);
  } catch (error) {
    console.error('❌ Audio Download failed:', error);
    throw error;
  }
}
