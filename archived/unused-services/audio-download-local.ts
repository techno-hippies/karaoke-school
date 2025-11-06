/**
 * Embedded Audio Download Service
 * Combines yt-dlp and Soulseek logic directly into pipeline
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { promises as fs, existsSync, createWriteStream } from 'fs';
import path from 'path';
import { neon } from "@neondatabase/serverless";
import { uploadToGrove } from './grove';
import { exec as execCallback } from 'child_process';

const execAsync = promisify(execCallback);

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || "/tmp/karaoke-downloads";
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MIN_FILE_SIZE = 500 * 1024; // 500KB
const SOULSEEK_ACCOUNT = process.env.SOULSEEK_ACCOUNT;
const SOULSEEK_PASSWORD = process.env.SOULSEEK_PASSWORD;

// Ensure download directory exists
await fs.mkdir(DOWNLOADS_DIR, { recursive: true });

export interface AudioDownloadResult {
  success: boolean;
  method: 'yt-dlp' | 'soulseek' | null;
  path?: string;
  fileSize?: number;
  duration?: number;
  error?: string;
  verified?: boolean;
  confidence?: number;
}

export interface AcoustIDVerification {
  verified: boolean;
  confidence: number;
  details: any;
}

/**
 * Download audio using yt-dlp (fast, ~50% success rate)
 */
async function downloadWithYtDlp(
  spotifyTrackId: string,
  title: string,
  artist: string
): Promise<AudioDownloadResult> {
  const outputPath = path.join(DOWNLOADS_DIR, `${spotifyTrackId}.mp3`);

  try {
    console.log(`  📥 Trying yt-dlp (YouTube fallback)...`);

    const searchQuery = `${artist} ${title}`.replace(/"/g, '\\"');
    const cmd = `yt-dlp "ytsearch1:${searchQuery}" -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" --no-playlist --quiet --no-warnings`;

    await execAsync(cmd, { timeout: 60000 });

    if (!existsSync(outputPath)) {
      return { success: false, method: 'yt-dlp', error: 'File not created' };
    }

    const stats = await fs.stat(outputPath);
    if (stats.size < MIN_FILE_SIZE) {
      await fs.unlink(outputPath);
      return { success: false, method: 'yt-dlp', error: 'File too small' };
    }

    console.log(`  ✅ Downloaded via yt-dlp (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
    return { success: true, method: 'yt-dlp', path: outputPath, fileSize: stats.size };
  } catch (error: any) {
    console.log(`  ⚠️  yt-dlp failed: ${error.message}`);
    
    if (existsSync(outputPath)) {
      try { await fs.unlink(outputPath); } catch {}
    }
    
    return { success: false, method: 'yt-dlp', error: error.message };
  }
}

/**
 * Download audio using local Demucs service (passed through to external service)
 */
async function downloadWithDemucs(
  spotifyTrackId: string,
  title: string,
  artist: string
): Promise<AudioDownloadResult> {
  // For now, this is a placeholder for the external Demucs service
  // The actual Demucs separation will happen in Step 8
  return {
    success: false,
    method: null,
    error: 'Demucs download not implemented - separation happens in Step 8'
  };
}

/**
 * Verify download using AcoustID
 */
async function verifyWithAcoustID(
  filePath: string,
  expectedTitle: string,
  expectedArtist: string,
  acoustidApiKey: string
): Promise<AcoustIDVerification> {
  try {
    console.log(`    [verify] AcoustID verification...`);
    
    // Generate fingerprint
    const { stdout: fpcalcOutput } = await execAsync(
      `fpcalc -length 120 "${filePath}"`,
      { timeout: 60000 }
    );

    const durationMatch = fpcalcOutput.match(/DURATION=(\d+)/);
    const fingerprintMatch = fpcalcOutput.match(/FINGERPRINT=(.+)/);

    if (!durationMatch || !fingerprintMatch) {
      return { verified: false, confidence: 0, details: { error: 'Could not generate fingerprint' } };
    }

    const duration = parseInt(durationMatch[1]);
    const fingerprint = fingerprintMatch[1].trim();

    // Query AcoustID
    const acoustidUrl = `https://api.acoustid.org/v2/lookup?client=${acoustidApiKey}&duration=${duration}&fingerprint=${encodeURIComponent(fingerprint)}&meta=recordings`;
    const response = await fetch(acoustidUrl);
    const data = await response.json();

    if (data.status !== "ok" || !data.results || data.results.length === 0) {
      return { verified: false, confidence: 0, details: { error: "No AcoustID results" } };
    }

    const bestMatch = data.results[0];
    const confidence = bestMatch.score || 0;

    console.log(`    [verify] Confidence: ${(confidence * 100).toFixed(1)}%`);

    // Check metadata if available
    if (bestMatch.recordings && bestMatch.recordings.length > 0) {
      const recording = bestMatch.recordings[0];
      const mbTitle = recording.title;
      const mbArtist = recording.artists ? recording.artists[0]?.name : null;

      console.log(`    [verify] Match: "${mbTitle}" by "${mbArtist}"`);

      const titleMatch = mbTitle && expectedTitle
        ? mbTitle.toLowerCase().includes(expectedTitle.toLowerCase()) ||
          expectedTitle.toLowerCase().includes(mbTitle.toLowerCase())
        : false;

      const artistMatch = mbArtist && expectedArtist
        ? mbArtist.toLowerCase().includes(expectedArtist.toLowerCase()) ||
          expectedArtist.toLowerCase().includes(mbArtist.toLowerCase())
        : false;

      const verified = confidence >= 0.90 && (titleMatch || artistMatch || confidence >= 0.95);
      console.log(`    [verify] ${verified ? '✅ VERIFIED' : '❌ REJECTED'}`);

      return {
        verified,
        confidence,
        details: { mbTitle, mbArtist, titleMatch, artistMatch }
      };
    }

    const verified = confidence >= 0.90;
    console.log(`    [verify] ${verified ? '✅ VERIFIED' : '❌ REJECTED'} (no metadata)`);
    return { verified, confidence, details: { high_confidence_only: true } };
  } catch (error: any) {
    console.error(`    [verify] ❌ Error: ${error.message}`);
    return { verified: false, confidence: 0, details: { error: error.message } };
  }
}

/**
 * Get audio file metadata
 */
async function getAudioMetadata(filePath: string): Promise<{ duration?: number; fileSize: number }> {
  try {
    const stats = await fs.stat(filePath);
    
    let duration: number | undefined;
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { timeout: 30000 }
      );
      duration = Math.round(parseFloat(stdout.trim()) * 1000);
      console.log(`     Duration: ${(duration / 1000).toFixed(1)}s`);
    } catch (error: any) {
      console.warn(`     Could not get duration: ${error.message}`);
    }

    return { duration, fileSize: stats.size };
  } catch (error: any) {
    throw new Error(`Failed to get metadata: ${error.message}`);
  }
}

/**
 * Main audio download and store workflow
 */
export async function downloadAndStoreAudio(
  spotifyTrackId: string,
  title: string,
  artist: string,
  neonUrl: string,
  acoustidApiKey?: string,
  chainId: number = 37111
): Promise<AudioDownloadResult> {
  const workflowStart = Date.now();
  console.log(`🔄 Starting audio download for: ${spotifyTrackId}`);
  console.log(`   "${title}" - ${artist}`);

  try {
    // Step 1: Try yt-dlp first
    console.log(`[1/4] Downloading audio...`);
    let downloadResult = await downloadWithYtDlp(spotifyTrackId, title, artist);

    // Step 2: Verify download if AcoustID key provided
    let verificationResult: AcoustIDVerification = { verified: false, confidence: 0, details: {} };

    if (downloadResult.success && acoustidApiKey) {
      console.log(`[2/4] Verifying with AcoustID...`);
      verificationResult = await verifyWithAcoustID(
        downloadResult.path!,
        title,
        artist,
        acoustidApiKey
      );

      if (!verificationResult.verified) {
        console.log(`  ❌ Verification failed, cleaning up...`);
        await fs.unlink(downloadResult.path!);
        downloadResult = { success: false, method: 'yt-dlp', error: 'Verification failed' };
      } else {
        console.log(`  ✅ Verification successful`);
      }
    }

    // If yt-dlp failed, return the failure
    if (!downloadResult.success) {
      return downloadResult;
    }

    // Step 3: Get metadata
    console.log(`[3/4] Getting file metadata...`);
    const { duration, fileSize } = await getAudioMetadata(downloadResult.path!);

    // Step 4: Upload to Grove
    console.log(`[4/4] Uploading to Grove IPFS...`);
    const { cid: groveCid, url: groveUrl } = await uploadToGrove(
      downloadResult.path!,
      'audio',
      chainId
    );

    // Step 5: Update database
    console.log(`[5/5] Updating database...`);
    const sql = neon(neonUrl);

    await sql`BEGIN`;

    try {
      // Insert into song_audio
      await sql`
        INSERT INTO song_audio (
          spotify_track_id,
          grove_cid,
          grove_url,
          download_method,
          verified,
          verification_confidence,
          file_size_bytes,
          duration_ms,
          raw_verification_data,
          created_at,
          updated_at
        ) VALUES (
          ${spotifyTrackId},
          ${groveCid},
          ${groveUrl},
          ${downloadResult.method},
          ${verificationResult.verified},
          ${verificationResult.confidence},
          ${fileSize},
          ${duration || null},
          ${JSON.stringify(verificationResult.details)},
          NOW(),
          NOW()
        )
        ON CONFLICT (spotify_track_id)
        DO UPDATE SET
          grove_cid = EXCLUDED.grove_cid,
          grove_url = EXCLUDED.grove_url,
          download_method = EXCLUDED.download_method,
          verified = EXCLUDED.verified,
          verification_confidence = EXCLUDED.verification_confidence,
          file_size_bytes = EXCLUDED.file_size_bytes,
          duration_ms = EXCLUDED.duration_ms,
          raw_verification_data = EXCLUDED.raw_verification_data,
          updated_at = NOW()
      `;

      // Update song_pipeline
      await sql`
        UPDATE song_pipeline
        SET
          status = 'audio_downloaded',
          has_audio = TRUE,
          updated_at = NOW()
        WHERE spotify_track_id = ${spotifyTrackId}
          AND status = 'lyrics_ready'
      `;

      await sql`COMMIT`;
      console.log(`  ✅ Database updated`);
    } catch (dbError: any) {
      await sql`ROLLBACK`;
      throw dbError;
    }

    // Cleanup temp file
    await fs.unlink(downloadResult.path!);
    console.log(`  ✅ Cleaned up temp file`);

    const workflowDuration = ((Date.now() - workflowStart) / 1000).toFixed(1);
    console.log(`✅ Audio workflow complete in ${workflowDuration}s`);

    return {
      success: true,
      method: downloadResult.method!,
      path: downloadResult.path,
      fileSize,
      duration,
      verified: verificationResult.verified,
      confidence: verificationResult.confidence
    };
  } catch (error: any) {
    console.error(`❌ Audio download failed: ${error.message}`);
    
    // Update retry tracking
    try {
      const sql = neon(neonUrl);
      const result = await sql`
        SELECT retry_count FROM song_pipeline
        WHERE spotify_track_id = ${spotifyTrackId}
      `;

      const currentRetries = result[0]?.retry_count || 0;
      const newRetries = currentRetries + 1;
      const MAX_RETRIES = 3;

      const newStatus = newRetries >= MAX_RETRIES ? 'failed' : 'lyrics_ready';

      await sql`
        UPDATE song_pipeline
        SET
          retry_count = ${newRetries},
          last_attempted_at = NOW(),
          error_message = ${error.message},
          error_stage = 'audio_download',
          status = ${newStatus},
          updated_at = NOW()
        WHERE spotify_track_id = ${spotifyTrackId}
      `;
    } catch (dbError: any) {
      console.error(`Failed to update retry tracking: ${dbError.message}`);
    }

    return {
      success: false,
      method: null,
      error: error.message
    };
  }
}

/**
 * Cleanup old download files
 */
export async function cleanupDownloads(maxAgeMinutes: number = 30) {
  try {
    const files = await fs.readdir(DOWNLOADS_DIR);
    const cutoffTime = Date.now() - (maxAgeMinutes * 60 * 1000);

    for (const file of files) {
      const filePath = path.join(DOWNLOADS_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
          console.log(`  🗑️  Cleaned up: ${file}`);
        }
      } catch (error) {
        // Ignore errors for individual files
      }
    }
  } catch (error) {
    console.error(`Cleanup failed: ${error}`);
  }
}
