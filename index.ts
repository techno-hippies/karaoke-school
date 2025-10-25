/**
 * Freyr Download Service
 *
 * Provides HTTP API for:
 * - Downloading Spotify tracks with freyr
 * - Extracting segments with ffmpeg
 * - File caching for performance
 */

import { serve } from "bun";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const execAsync = promisify(exec);

const DOWNLOADS_DIR = process.env.DOWNLOADS_DIR || "/tmp/freyr-downloads";
const SEGMENTS_DIR = process.env.SEGMENTS_DIR || "/tmp/freyr-segments";

// Create directories on startup
await mkdir(DOWNLOADS_DIR, { recursive: true });
await mkdir(SEGMENTS_DIR, { recursive: true });

interface DownloadRequest {
  spotify_track_id: string;
  track_title?: string;
  artist?: string;
}

interface SegmentRequest {
  spotify_track_id: string;
  start_ms: number;
  end_ms: number;
}

serve({
  port: process.env.PORT || 3000,

  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers
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
      // GET /health - Health check
      if (url.pathname === "/health") {
        return Response.json({
          status: "healthy",
          uptime: process.uptime(),
          downloads_dir: DOWNLOADS_DIR,
          segments_dir: SEGMENTS_DIR,
          service: "freyr-download-service",
          version: "1.0.0"
        }, { headers });
      }

      // POST /download - Download track with freyr
      if (url.pathname === "/download" && req.method === "POST") {
        const body: DownloadRequest = await req.json();
        const { spotify_track_id } = body;

        if (!spotify_track_id) {
          return Response.json({ error: "spotify_track_id required" }, { status: 400, headers });
        }

        console.log(`📥 Downloading: spotify:track:${spotify_track_id}`);

        // Check cache first
        const cachedPath = path.join(DOWNLOADS_DIR, `${spotify_track_id}.m4a`);
        if (existsSync(cachedPath)) {
          console.log(`✅ Cache hit: ${spotify_track_id}`);
          const audioBuffer = await readFile(cachedPath);
          const audio_base64 = audioBuffer.toString('base64');

          return Response.json({
            success: true,
            cached: true,
            spotify_track_id,
            audio_base64,
            file_size: audioBuffer.length,
            format: "m4a"
          }, { headers });
        }

        // Download with freyr
        const downloadStart = Date.now();

        try {
          const { stdout, stderr } = await execAsync(
            `freyr "spotify:track:${spotify_track_id}" -d "${DOWNLOADS_DIR}" --format m4a`,
            { cwd: DOWNLOADS_DIR, timeout: 300000 } // 5 min timeout
          );

          console.log(`freyr output: ${stdout}`);
          if (stderr) console.error(`freyr stderr: ${stderr}`);

        } catch (error: any) {
          console.error(`freyr error: ${error.message}`);
          return Response.json({
            error: "Download failed",
            message: error.message,
            stderr: error.stderr
          }, { status: 500, headers });
        }

        // Find downloaded file (freyr organizes by artist/album/track)
        const { stdout: findOutput } = await execAsync(
          `find "${DOWNLOADS_DIR}" -name "*.m4a" -type f -mmin -5 | head -1`
        );

        const downloadedFile = findOutput.trim();
        if (!downloadedFile || !existsSync(downloadedFile)) {
          return Response.json({
            error: "freyr download succeeded but file not found",
            searched_in: DOWNLOADS_DIR
          }, { status: 500, headers });
        }

        // Move to cache with track ID
        await execAsync(`mv "${downloadedFile}" "${cachedPath}"`);

        // Encode as base64
        const audioBuffer = await readFile(cachedPath);
        const audio_base64 = audioBuffer.toString('base64');

        const downloadDuration = (Date.now() - downloadStart) / 1000;
        console.log(`✅ Downloaded in ${downloadDuration.toFixed(1)}s: ${spotify_track_id}`);

        return Response.json({
          success: true,
          cached: false,
          spotify_track_id,
          audio_base64,
          file_size: audioBuffer.length,
          format: "m4a",
          download_time_seconds: downloadDuration
        }, { headers });
      }

      // POST /segment - Extract segment with ffmpeg
      if (url.pathname === "/segment" && req.method === "POST") {
        const body: SegmentRequest = await req.json();
        const { spotify_track_id, start_ms, end_ms } = body;

        if (!spotify_track_id || start_ms === undefined || end_ms === undefined) {
          return Response.json({
            error: "spotify_track_id, start_ms, and end_ms required"
          }, { status: 400, headers });
        }

        console.log(`✂️  Segmenting: ${spotify_track_id} [${start_ms}ms - ${end_ms}ms]`);

        const inputPath = path.join(DOWNLOADS_DIR, `${spotify_track_id}.m4a`);
        if (!existsSync(inputPath)) {
          return Response.json({
            error: "Track not downloaded yet, call /download first"
          }, { status: 400, headers });
        }

        const segmentPath = path.join(SEGMENTS_DIR, `${spotify_track_id}_segment.m4a`);
        const startSeconds = start_ms / 1000;
        const durationSeconds = (end_ms - start_ms) / 1000;

        // Extract segment with ffmpeg (stream copy = fast)
        await execAsync(
          `ffmpeg -y -i "${inputPath}" -ss ${startSeconds} -t ${durationSeconds} -c copy "${segmentPath}"`,
          { timeout: 60000 }
        );

        // Read and encode
        const segmentBuffer = await readFile(segmentPath);
        const segment_base64 = segmentBuffer.toString('base64');

        console.log(`✅ Segment extracted: ${segmentBuffer.length} bytes`);

        return Response.json({
          success: true,
          spotify_track_id,
          segment_base64,
          segment_size: segmentBuffer.length,
          start_ms,
          end_ms,
          duration_ms: end_ms - start_ms
        }, { headers });
      }

      // GET /cache-stats - Cache statistics
      if (url.pathname === "/cache-stats") {
        const { stdout } = await execAsync(`du -sh "${DOWNLOADS_DIR}" 2>/dev/null || echo "0K"`);
        const { stdout: fileCount } = await execAsync(
          `find "${DOWNLOADS_DIR}" -name "*.m4a" -type f 2>/dev/null | wc -l`
        );

        return Response.json({
          cache_size: stdout.split('\t')[0].trim(),
          cached_files: parseInt(fileCount.trim()),
          downloads_dir: DOWNLOADS_DIR
        }, { headers });
      }

      return Response.json({
        error: "Not found",
        available_endpoints: [
          "GET /health",
          "POST /download",
          "POST /segment",
          "GET /cache-stats"
        ]
      }, { status: 404, headers });

    } catch (error: any) {
      console.error("❌ Error:", error.message);
      return Response.json({
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, { status: 500, headers });
    }
  }
});

console.log(`🚀 Freyr Download Service running on port ${process.env.PORT || 3000}`);
console.log(`📁 Downloads: ${DOWNLOADS_DIR}`);
console.log(`✂️  Segments: ${SEGMENTS_DIR}`);
