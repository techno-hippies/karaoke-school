/**
 * Audio Download Service
 *
 * Multi-strategy audio downloads: yt-dlp (fast) → Soulseek P2P (fallback)
 * Workflow: Download → AcoustID verify → Grove upload → Neon updates
 */

import { serve } from "bun";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync, createWriteStream } from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import slsk from "slsk-client";

const execAsync = promisify(exec);

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || "/tmp/slsk-downloads";
const CHAIN_ID = 37111; // Lens Network

// Soulseek credentials (required)
const SOULSEEK_ACCOUNT = process.env.SOULSEEK_ACCOUNT;
const SOULSEEK_PASSWORD = process.env.SOULSEEK_PASSWORD;

if (!SOULSEEK_ACCOUNT || !SOULSEEK_PASSWORD) {
  console.error("❌ SOULSEEK_ACCOUNT and SOULSEEK_PASSWORD environment variables required");
  process.exit(1);
}

// In-flight download tracking
const inflightDownloads = new Map<string, Promise<any>>();

// Create directories on startup
await mkdir(DOWNLOADS_DIR, { recursive: true });

// Cleanup stale temp files
try {
  await execAsync(`find "${DOWNLOADS_DIR}" -type f -mmin +30 -delete 2>/dev/null || true`);
  console.log("✓ Cleaned up stale temp files");
} catch (error) {
  console.error("Warning: Could not cleanup temp files:", error);
}

interface DownloadRequest {
  spotify_track_id: string;
  expected_title: string;
  expected_artist: string;
  acoustid_api_key?: string;
  neon_database_url: string;
  chain_id?: number;
}

// Helper: Promisify slsk-client callbacks
function connectToSoulseek(): Promise<any> {
  return new Promise((resolve, reject) => {
    slsk.connect(
      {
        user: SOULSEEK_ACCOUNT!,
        pass: SOULSEEK_PASSWORD!,
      },
      (err, client) => {
        if (err) {
          reject(err);
        } else if (!client) {
          reject(new Error('No client returned from slsk.connect'));
        } else {
          resolve(client);
        }
      }
    );
  });
}

function searchSoulseek(client: any, query: string, timeout: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    client.search({ req: query, timeout }, (err: any, results: any[]) => {
      if (err) reject(err);
      else resolve(results || []);
    });
  });
}

// Helper: Download with yt-dlp (fast, ~50% success rate)
async function downloadWithYtDlp(
  spotify_track_id: string,
  title: string,
  artist: string
): Promise<{ path: string; method: 'yt-dlp' } | null> {
  const outputPath = path.join(DOWNLOADS_DIR, `${spotify_track_id}.mp3`);

  try {
    console.log(`  📥 Trying yt-dlp (Spotify → YouTube)...`);

    // Use yt-dlp to search YouTube and download best audio
    const searchQuery = `${artist} ${title}`.replace(/"/g, '\\"');
    const cmd = `yt-dlp "ytsearch1:${searchQuery}" -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" --no-playlist --quiet --no-warnings`;

    await execAsync(cmd, { timeout: 60000 }); // 60s timeout

    if (existsSync(outputPath)) {
      const stats = await Bun.file(outputPath).stat();
      if (stats.size > 100000) { // At least 100KB
        console.log(`  ✅ Downloaded via yt-dlp (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);
        return { path: outputPath, method: 'yt-dlp' };
      }
    }

    console.log(`  ⚠️  yt-dlp failed or file too small`);
    return null;
  } catch (error: any) {
    console.log(`  ⚠️  yt-dlp failed: ${error.message}`);

    // Cleanup partial download
    if (existsSync(outputPath)) {
      try {
        await unlink(outputPath);
      } catch {}
    }

    return null;
  }
}

// Helper: Download with Soulseek (slower but more reliable fallback)
async function downloadWithSoulseek(
  spotify_track_id: string,
  title: string,
  artist: string
): Promise<{ path: string; method: 'soulseek' } | null> {
  let client: any = null;

  try {
    console.log(`  📥 Connecting to Soulseek P2P network...`);
    client = await connectToSoulseek();
    console.log(`  ✓ Connected as ${SOULSEEK_ACCOUNT}`);

    // Try multiple search queries
    const queries = [
      `${artist} ${title}`,
      `${title} ${artist}`,
      `${title}`,  // Try title only as fallback
    ];

    let allResults: any[] = [];
    let usedQuery = '';

    for (const query of queries) {
      console.log(`  🔍 Searching: "${query}"`);
      const results = await searchSoulseek(client, query, 4000); // Use library default (CLI uses 2000)
      console.log(`     Found ${results.length} results`);

      if (results.length > 0) {
        allResults = results;
        usedQuery = query;
        break;
      }
    }

    if (allResults.length === 0) {
      console.log(`  ❌ No results found with any query`);
      return null;
    }

    console.log(`  ✓ Using query: "${usedQuery}" (${allResults.length} results)`);

    // Group results by user and build file lists
    const peerMap = new Map<string, any>();

    for (const result of allResults) {
      const { user, file: filePath, size, slots, bitrate, speed } = result;

      // Filter audio files >500KB
      const isAudio = filePath.toLowerCase().match(/\.(mp3|flac|m4a|ogg)$/);
      const goodSize = Number(size) > 500000;

      if (!isAudio || !goodSize) continue;

      if (!peerMap.has(user)) {
        peerMap.set(user, {
          username: user,
          files: [],
          slotsFree: slots === true, // slots is boolean in slsk-client
          speed: speed || 0,
        });
      }

      peerMap.get(user).files.push({
        path: filePath,
        size: size,
        bitrate: bitrate,
      });
    }

    const peers = Array.from(peerMap.values()).filter(p => p.files.length > 0);
    console.log(`  📊 Peers with audio files: ${peers.length}`);

    // Separate into free slots and queued
    const freeSlots = peers.filter(p => p.slotsFree);
    const queued = peers.filter(p => !p.slotsFree);

    console.log(`     Free slots: ${freeSlots.length}, Queued: ${queued.length}`);

    // Sort: free slots > speed > file size
    const candidates = [...freeSlots, ...queued].sort((a, b) => {
      return (
        (b.slotsFree ? 1000000 : 0) - (a.slotsFree ? 1000000 : 0) ||
        b.speed - a.speed ||
        Number(b.files[0].size) - Number(a.files[0].size)
      );
    });

    if (candidates.length === 0) {
      console.log(`  ❌ No valid peers found`);
      return null;
    }

    console.log(`  🎯 Top candidates:`);
    candidates.slice(0, 5).forEach((c, i) => {
      const file = c.files[0];
      console.log(`     ${i+1}. ${c.username} - ${(Number(file.size)/1024/1024).toFixed(1)}MB, ${c.speed}kb/s, ${c.slotsFree ? 'FREE' : 'QUEUED'}`);
    });

    // Try up to 3 best peers
    for (let i = 0; i < Math.min(3, candidates.length); i++) {
      const peer = candidates[i];
      const file = peer.files[0];

      console.log(`  [Attempt ${i + 1}] Trying: ${path.basename(file.path)} from ${peer.username}`);
      console.log(`     Size: ${(Number(file.size) / 1024 / 1024).toFixed(2)}MB, Speed: ${peer.speed}kb/s, Slots: ${peer.slotsFree ? 'FREE' : 'QUEUED'}`);

      try {
        const cachedPath = path.join(DOWNLOADS_DIR, `${spotify_track_id}.mp3`);

        // Download with slsk-client's downloadStream
        await new Promise<void>((resolve, reject) => {
          client.downloadStream(
            { file: { user: peer.username, file: file.path, size: file.size } },
            (err: any, stream: any) => {
              if (err) {
                reject(err);
                return;
              }

              console.log(`  ⬇️  Starting download...`);
              const fileStream = createWriteStream(cachedPath);
              let downloaded = 0;
              const totalSize = Number(file.size);
              let lastProgressLog = 0;

              // Timeout if no data for 60 seconds
              let lastDataTime = Date.now();
              const progressTimeout = setInterval(() => {
                const elapsed = Date.now() - lastDataTime;
                if (elapsed > 60000) {
                  clearInterval(progressTimeout);
                  stream.destroy();
                  reject(new Error('Download timeout: no data for 60 seconds'));
                }
              }, 1000);

              stream.on('data', (chunk: Buffer) => {
                lastDataTime = Date.now();
                downloaded += chunk.length;
                const progress = downloaded / totalSize;

                // Log at 25%, 50%, 75%
                if (progress >= 0.25 && lastProgressLog < 0.25) {
                  console.log(`     25%...`);
                  lastProgressLog = 0.25;
                } else if (progress >= 0.50 && lastProgressLog < 0.50) {
                  console.log(`     50%...`);
                  lastProgressLog = 0.50;
                } else if (progress >= 0.75 && lastProgressLog < 0.75) {
                  console.log(`     75%...`);
                  lastProgressLog = 0.75;
                }
              });

              stream.pipe(fileStream);

              stream.on('end', () => {
                clearInterval(progressTimeout);
                fileStream.end();
                resolve();
              });

              stream.on('error', (err: any) => {
                clearInterval(progressTimeout);
                reject(err);
              });

              fileStream.on('error', (err: any) => {
                clearInterval(progressTimeout);
                reject(err);
              });
            }
          );
        });

        console.log(`  ✅ Downloaded: ${path.basename(cachedPath)}`);
        return { path: cachedPath, method: 'soulseek' };
      } catch (downloadError: any) {
        console.log(`  ⚠️  Download failed from ${peer.username}: ${downloadError.message}`);
        if (i < Math.min(3, candidates.length) - 1) {
          console.log(`  🔄 Trying next peer...`);
        }
      }
    }

    console.log(`  ❌ All download attempts failed`);
    return null;
  } catch (error: any) {
    console.error(`  ❌ Soulseek failed:`, error);
    console.error(`  Error type: ${typeof error}`);
    console.error(`  Error message: ${error?.message || 'no message'}`);
    console.error(`  Error string: ${String(error)}`);
    return null;
  } finally {
    // Cleanup connection (slsk-client doesn't have destroy method)
    if (client) {
      try {
        client.disconnect?.();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }
}

// Helper: Verify with AcoustID
async function verifyDownload(
  filePath: string,
  expected_title: string,
  expected_artist: string,
  acoustid_api_key: string
): Promise<{ verified: boolean; confidence: number; details: any }> {
  try {
    console.log(`    [verify] File: ${filePath}`);
    console.log(`    [verify] Expected: "${expected_title}" by "${expected_artist}"`);

    // Generate fingerprint
    const { stdout: fpcalcOutput } = await execAsync(
      `fpcalc -length 120 "${filePath}"`,
      { timeout: 60000 }
    );

    const durationMatch = fpcalcOutput.match(/DURATION=(\d+)/);
    const fingerprintMatch = fpcalcOutput.match(/FINGERPRINT=(.+)/);

    if (!durationMatch || !fingerprintMatch) {
      console.log(`    [verify] ❌ Could not extract fingerprint`);
      return { verified: false, confidence: 0, details: { error: "Could not generate fingerprint" } };
    }

    const duration = parseInt(durationMatch[1]);
    const fingerprint = fingerprintMatch[1].trim();

    // Query AcoustID
    const acoustidUrl = `https://api.acoustid.org/v2/lookup?client=${acoustid_api_key}&duration=${duration}&fingerprint=${encodeURIComponent(fingerprint)}&meta=recordings`;
    const response = await fetch(acoustidUrl);
    const data = await response.json();

    if (data.status !== "ok" || !data.results || data.results.length === 0) {
      console.log(`    [verify] ❌ No AcoustID results`);
      return { verified: false, confidence: 0, details: { error: "No AcoustID match" } };
    }

    const bestMatch = data.results[0];
    const confidence = bestMatch.score || 0;

    console.log(`    [verify] Confidence: ${(confidence * 100).toFixed(1)}%`);

    // Check metadata if available
    if (bestMatch.recordings && bestMatch.recordings.length > 0) {
      const recording = bestMatch.recordings[0];
      const mb_title = recording.title;
      const mb_artist = recording.artists ? recording.artists[0]?.name : null;

      console.log(`    [verify] Match: "${mb_title}" by "${mb_artist}"`);

      const title_match = mb_title && expected_title
        ? mb_title.toLowerCase().includes(expected_title.toLowerCase()) ||
          expected_title.toLowerCase().includes(mb_title.toLowerCase())
        : false;

      const artist_match = mb_artist && expected_artist
        ? mb_artist.toLowerCase().includes(expected_artist.toLowerCase()) ||
          expected_artist.toLowerCase().includes(mb_artist.toLowerCase())
        : false;

      const verified = confidence >= 0.90 && (title_match || artist_match || confidence >= 0.95);
      console.log(`    [verify] ${verified ? '✅ VERIFIED' : '❌ REJECTED'}`);

      return {
        verified,
        confidence,
        details: { mb_title, mb_artist, title_match, artist_match }
      };
    }

    // No metadata - rely on confidence only
    const verified = confidence >= 0.90;
    console.log(`    [verify] ${verified ? '✅ VERIFIED' : '❌ REJECTED'} (no metadata)`);
    return { verified, confidence, details: { high_confidence_only: true } };
  } catch (error: any) {
    console.error(`    [verify] ❌ Error: ${error.message}`);
    return { verified: false, confidence: 0, details: { error: error.message } };
  }
}

// Helper: Upload to Grove IPFS
async function uploadToGrove(
  filePath: string,
  spotify_track_id: string,
  chain_id: number
): Promise<{ cid: string; url: string }> {
  try {
    console.log(`  [grove] Uploading to IPFS...`);

    const fileBuffer = await readFile(filePath);

    // Grove expects: raw binary body with Content-Type header
    const response = await fetch(`https://api.grove.storage/?chain_id=${chain_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mpeg',
      },
      body: fileBuffer
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grove upload failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    // Grove returns storage_key field
    const cid = Array.isArray(data) ? data[0].storage_key : data.storage_key;
    const url = `https://api.grove.storage/${cid}`;

    console.log(`  [grove] ✅ Uploaded: ${cid}`);
    return { cid, url };
  } catch (error: any) {
    console.error(`  [grove] ❌ Upload failed: ${error.message}`);
    throw error;
  }
}

serve({
  port: process.env.PORT || 3001,

  async fetch(req) {
    const url = new URL(req.url);

    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    try {
      // GET /health
      if (url.pathname === "/health") {
        return Response.json({
          status: "healthy",
          service: "audio-download-service",
          version: "2.0.0",
          downloads_dir: DOWNLOADS_DIR,
          soulseek_configured: !!(SOULSEEK_ACCOUNT && SOULSEEK_PASSWORD),
          strategies: ["yt-dlp", "soulseek-p2p"]
        }, { headers });
      }

      // POST /download-and-store
      if (url.pathname === "/download-and-store" && req.method === "POST") {
        const body: DownloadRequest = await req.json();
        const {
          spotify_track_id,
          expected_title,
          expected_artist,
          acoustid_api_key,
          neon_database_url,
          chain_id = CHAIN_ID
        } = body;

        if (!spotify_track_id || !expected_title || !expected_artist) {
          return Response.json({
            error: "Missing required fields: spotify_track_id, expected_title, expected_artist"
          }, { status: 400, headers });
        }

        // Use env var as fallback for Akash deployments
        const dbUrl = neon_database_url || process.env.DATABASE_URL;

        if (!dbUrl) {
          return Response.json({ error: "neon_database_url or DATABASE_URL env var required" }, { status: 400, headers });
        }

        // Prevent duplicate concurrent downloads
        if (inflightDownloads.has(spotify_track_id)) {
          console.log(`⏳ Download already in progress for ${spotify_track_id}`);
          return await inflightDownloads.get(spotify_track_id);
        }

        const workflowStart = Date.now();
        console.log(`🔄 Starting workflow for: ${spotify_track_id}`);
        console.log(`   "${expected_title}" - ${expected_artist}`);

        const workflowPromise = (async () => {
          try {
            // Step 1: Try yt-dlp first, fallback to Soulseek if verification fails
            console.log(`[1/5] Downloading audio...`);

            let downloadResult = await downloadWithYtDlp(
              spotify_track_id,
              expected_title,
              expected_artist
            );

            let verificationResult: any = null;
            let downloadMethod = 'unknown';

            // Step 2: Verify yt-dlp result
            if (downloadResult && acoustid_api_key) {
              console.log(`[2/5] Verifying yt-dlp download with AcoustID...`);
              verificationResult = await verifyDownload(
                downloadResult.path,
                expected_title,
                expected_artist,
                acoustid_api_key
              );

              if (!verificationResult.verified) {
                console.log(`  ❌ yt-dlp verification failed, trying Soulseek fallback...`);
                // Clean up bad file
                try {
                  await unlink(downloadResult.path);
                } catch (e) {
                  console.warn(`  Could not delete bad yt-dlp file: ${e}`);
                }
                downloadResult = null;
                verificationResult = null;
              } else {
                console.log(`  ✅ yt-dlp verified successfully`);
                downloadMethod = 'yt-dlp';
              }
            } else if (!downloadResult) {
              console.log(`  🔄 yt-dlp failed, trying Soulseek fallback...`);
            }

            // Step 3: If yt-dlp failed or didn't verify, try Soulseek
            if (!downloadResult) {
              downloadResult = await downloadWithSoulseek(
                spotify_track_id,
                expected_title,
                expected_artist
              );

              if (!downloadResult) {
                throw new Error("Both yt-dlp and Soulseek failed to download");
              }

              // Verify Soulseek result
              if (acoustid_api_key) {
                console.log(`[2/5] Verifying Soulseek download with AcoustID...`);
                verificationResult = await verifyDownload(
                  downloadResult.path,
                  expected_title,
                  expected_artist,
                  acoustid_api_key
                );

                if (!verificationResult.verified) {
                  console.log(`  ❌ Soulseek verification also failed`);
                  await unlink(downloadResult.path);
                  throw new Error("Both download methods failed verification - not uploading wrong audio");
                }

                console.log(`  ✅ Soulseek verified successfully`);
              }

              downloadMethod = 'soulseek';
            }

            if (!downloadResult) {
              throw new Error("No valid download available");
            }

            const downloadedPath = downloadResult.path;

            // If no AcoustID key provided, allow unverified uploads (risky!)
            if (!acoustid_api_key) {
              console.log(`[2/5] Skipping verification (no AcoustID key) - RISKY!`);
            }

            // Step 3: Get file metadata with ffprobe
            console.log(`[3/5] Getting file metadata...`);
            const { size: fileSizeBytes } = await Bun.file(downloadedPath).stat();

            let durationMs: number | null = null;
            try {
              const { stdout } = await execAsync(
                `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${downloadedPath}"`,
                { timeout: 30000 }
              );
              durationMs = Math.round(parseFloat(stdout.trim()) * 1000);
              console.log(`     Duration: ${(durationMs / 1000).toFixed(1)}s`);
            } catch (error: any) {
              console.warn(`     Could not get duration: ${error.message}`);
            }

            // Step 4: Upload to Grove
            console.log(`[4/5] Uploading to Grove IPFS...`);
            const { cid: grove_cid, url: grove_url } = await uploadToGrove(
              downloadedPath,
              spotify_track_id,
              chain_id
            );

            // Step 5: Update database atomically
            console.log(`[5/5] Updating database...`);
            const sql = neon(dbUrl);

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
                  ${spotify_track_id},
                  ${grove_cid},
                  ${grove_url},
                  ${downloadMethod},
                  ${verificationResult?.verified || false},
                  ${verificationResult?.confidence || null},
                  ${fileSizeBytes},
                  ${durationMs},
                  ${verificationResult ? JSON.stringify(verificationResult.details) : null},
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
                WHERE spotify_track_id = ${spotify_track_id}
                  AND status = 'lyrics_ready'
              `;

              await sql`COMMIT`;
              console.log(`  ✓ Database updated`);
            } catch (dbError) {
              await sql`ROLLBACK`;
              throw dbError;
            }

            // Cleanup
            await unlink(downloadedPath);
            console.log(`  ✓ Cleaned up temp file`);

            const duration = ((Date.now() - workflowStart) / 1000).toFixed(1);
            console.log(`✅ Workflow complete in ${duration}s`);

            const response = Response.json({
              success: true,
              spotify_track_id,
              grove_cid,
              grove_url,
              download_method: "soulseek",
              verified: verificationResult?.verified || false,
              confidence: verificationResult?.confidence || null,
              duration_seconds: parseFloat(duration)
            }, { headers });

            inflightDownloads.delete(spotify_track_id);
            return response;
          } catch (error: any) {
            console.error(`❌ Workflow error: ${error.message}`);
            inflightDownloads.delete(spotify_track_id);

            // Track failure in pipeline for retry logic
            try {
              const sql = neon(dbUrl);

              // Get current retry count
              const result = await sql`
                SELECT retry_count FROM song_pipeline
                WHERE spotify_track_id = ${spotify_track_id}
              `;

              const currentRetries = result[0]?.retry_count || 0;
              const newRetries = currentRetries + 1;
              const MAX_RETRIES = 3;

              // If max retries reached, mark as permanently failed
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
                WHERE spotify_track_id = ${spotify_track_id}
              `;

              if (newStatus === 'failed') {
                console.log(`  ⚠️  Permanently failed after ${newRetries} attempts`);
              } else {
                console.log(`  ⚠️  Attempt ${newRetries}/${MAX_RETRIES} failed, will retry`);
              }
            } catch (dbError: any) {
              console.error(`  Failed to update retry tracking: ${dbError.message}`);
            }

            return Response.json({
              error: "Workflow failed",
              message: error.message,
              spotify_track_id
            }, { status: 500, headers });
          }
        })();

        inflightDownloads.set(spotify_track_id, workflowPromise);

        // Fire-and-forget: Start workflow but return immediately
        workflowPromise.catch(err => {
          console.error(`❌ Background workflow error for ${spotify_track_id}:`, err.message);
        });

        return Response.json({
          status: "processing",
          workflow_id: spotify_track_id
        }, { headers });
      }

      return Response.json({ error: "Not found" }, { status: 404, headers });
    } catch (error: any) {
      console.error("Request error:", error);
      return Response.json({
        error: "Internal server error",
        message: error.message
      }, { status: 500, headers });
    }
  }
});

console.log("🎵 Soulseek Download Service");
console.log(`📡 Running on port ${process.env.PORT || 3001}`);
console.log(`📁 Downloads: ${DOWNLOADS_DIR}`);
console.log(`🔐 Soulseek: ${SOULSEEK_ACCOUNT}`);
console.log("");
