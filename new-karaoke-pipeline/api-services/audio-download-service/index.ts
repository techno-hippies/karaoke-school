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

const DOWNLOADS_DIR = path.resolve(process.env.DOWNLOADS_DIR || "/tmp/slsk-downloads");
const CHAIN_ID = 37111; // Lens Network

// Required environment variables
const SOULSEEK_ACCOUNT = process.env.SOULSEEK_ACCOUNT;
const SOULSEEK_PASSWORD = process.env.SOULSEEK_PASSWORD;
const DATABASE_URL = process.env.DATABASE_URL;

if (!SOULSEEK_ACCOUNT || !SOULSEEK_PASSWORD) {
  console.error("❌ SOULSEEK_ACCOUNT and SOULSEEK_PASSWORD environment variables required");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable required");
  process.exit(1);
}

// Global request queue to serialize downloads (fix concurrency)
const downloadQueue: Array<{
  id: string;
  fn: () => Promise<any>;
  resolve: (val: any) => void;
  reject: (err: any) => void;
}> = [];
let isProcessingQueue = false;

// Persistent Soulseek connection with resilience tracking
let persistentSoulseekClient: any = null;
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_RESET = 3;
const DOWNLOAD_TIMEOUT_MS = 30000; // 30s for faster failover (was 60s)
const MAX_PEER_ATTEMPTS = 10; // Try more peers (was 5)

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
  chain_id?: number;
}

// Helper: Get or create persistent Soulseek connection
async function getSoulseekClient(): Promise<any> {
  if (persistentSoulseekClient) {
    return persistentSoulseekClient;
  }

  // Wrap connection with 60s timeout to prevent infinite hangs
  const connectionPromise = new Promise((resolve, reject) => {
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
          persistentSoulseekClient = client;
          resolve(client);
        }
      }
    );
  });

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Soulseek connection timeout after 60s'));
    }, 60000);
  });

  return Promise.race([connectionPromise, timeoutPromise]);
}

// Helper: Process download queue
async function processDownloadQueue() {
  if (isProcessingQueue || downloadQueue.length === 0) {
    return;
  }

  isProcessingQueue = true;

  while (downloadQueue.length > 0) {
    const job = downloadQueue.shift();
    if (!job) break;

    try {
      // Add 5-minute timeout per job to prevent queue blocking
      const jobTimeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Job ${job.id} timed out after 5 minutes`));
        }, 300000); // 5 minutes
      });

      const result = await Promise.race([job.fn(), jobTimeout]);
      job.resolve(result);
    } catch (error) {
      console.error(`Queue job ${job.id} failed:`, error);
      job.reject(error);
    }
  }

  isProcessingQueue = false;
}

function searchSoulseek(client: any, query: string, timeout: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    client.search({ req: query, timeout }, (err: any, results: any[]) => {
      if (err) reject(err);
      else resolve(results || []);
    });
  });
}

// Helper: Test if Soulseek connection is healthy
async function isConnectionHealthy(client: any): Promise<boolean> {
  try {
    // Quick search to test if connection works
    const testResults = await searchSoulseek(client, 'test', 2000);
    return true; // Connection works if search completes without error
  } catch {
    return false;
  }
}

// Local music directories to search
const LOCAL_MUSIC_DIRS = [
  '/media/t42/me/Music',
  '/media/t42/sx66/Music',
  '/home/t42/Music',
];

// Helper: Read audio file metadata with ffprobe
async function getAudioMetadata(filePath: string): Promise<{
  artist?: string;
  title?: string;
  album?: string;
  duration?: number;
} | null> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}"`,
      { timeout: 5000 }
    );
    const data = JSON.parse(stdout);
    const tags = data.format?.tags || {};

    return {
      artist: tags.artist || tags.ARTIST || tags.album_artist || tags.ALBUM_ARTIST,
      title: tags.title || tags.TITLE,
      album: tags.album || tags.ALBUM,
      duration: parseFloat(data.format?.duration || '0'),
    };
  } catch {
    return null;
  }
}

// Helper: Calculate match score for a file
function calculateMatchScore(
  fileTags: { artist?: string; title?: string; duration?: number },
  expectedArtist: string,
  expectedTitle: string,
  expectedDuration?: number
): number {
  let artistScore = 0;
  let titleScore = 0;

  // Normalize strings for comparison
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const fileArtist = normalize(fileTags.artist || '');
  const fileTitle = normalize(fileTags.title || '');
  const expArtist = normalize(expectedArtist);
  const expTitle = normalize(expectedTitle);

  // Artist match (most important) - whole word matching
  if (fileArtist && expArtist) {
    if (fileArtist === expArtist) {
      artistScore = 100; // Perfect match
    } else if (fileArtist.includes(expArtist) || expArtist.includes(fileArtist)) {
      artistScore = 60; // Partial match
    } else {
      // Check word overlap
      const artistWords = expArtist.split(/\s+/).filter(w => w.length > 2);
      const matchedWords = artistWords.filter(w => fileArtist.includes(w));
      artistScore = (matchedWords.length / Math.max(artistWords.length, 1)) * 50;
    }
  }

  // Title match (very important)
  if (fileTitle && expTitle) {
    if (fileTitle === expTitle) {
      titleScore = 100; // Perfect match
    } else if (fileTitle.includes(expTitle) || expTitle.includes(fileTitle)) {
      titleScore = 70; // Partial match
    } else {
      // Check word overlap (prevents "les" matching "rules")
      const titleWords = expTitle.split(/\s+/).filter(w => w.length > 2);
      const matchedWords = titleWords.filter(w => fileTitle.includes(w));
      titleScore = (matchedWords.length / Math.max(titleWords.length, 1)) * 60;
    }
  }

  // CRITICAL: Require BOTH artist AND title to have good matches
  // If either artist or title score is below 40, reject the match
  if (artistScore < 40 || titleScore < 40) {
    return 0; // Not a valid match
  }

  let score = artistScore + titleScore;

  // Duration match (bonus points)
  if (fileTags.duration && expectedDuration && expectedDuration > 0) {
    const diff = Math.abs(fileTags.duration - expectedDuration);
    if (diff < 5) score += 20; // Within 5 seconds
    else if (diff < 15) score += 10; // Within 15 seconds
  }

  return score;
}

// Helper: Quick filename-based scoring (fast pre-filter)
function scoreFilename(filePath: string, artist: string, title: string): number {
  const filename = path.basename(filePath).toLowerCase().replace(/[^a-z0-9]/g, '');
  const fullPath = filePath.toLowerCase().replace(/[^a-z0-9]/g, ''); // Include full path for better matching
  const artistNorm = artist.toLowerCase().replace(/[^a-z0-9]/g, '');
  const titleNorm = title.toLowerCase().replace(/[^a-z0-9]/g, '');

  let score = 0;

  // Check filename first (higher weight)
  if (filename.includes(artistNorm)) score += 50;
  if (filename.includes(titleNorm)) score += 50;

  // Check full path (parent directories) for artist/album/title
  if (fullPath.includes(artistNorm)) score += 30;
  if (fullPath.includes(titleNorm)) score += 30;

  // Check word overlap in both filename and path
  const artistWords = artistNorm.split(/\s+/).filter(w => w.length > 2);
  const titleWords = titleNorm.split(/\s+/).filter(w => w.length > 2);

  for (const word of artistWords) {
    if (filename.includes(word)) score += 10;
    else if (fullPath.includes(word)) score += 5; // Lower weight for path-only matches
  }
  for (const word of titleWords) {
    if (filename.includes(word)) score += 10;
    else if (fullPath.includes(word)) score += 5; // Lower weight for path-only matches
  }

  return score;
}

// Helper: Search local music directories with metadata-based scoring
async function searchLocalMusic(
  spotify_track_id: string,
  title: string,
  artist: string,
  duration?: number
): Promise<{ path: string; method: 'local' } | null> {
  try {
    console.log(`  📁 Searching local music directories...`);

    let bestMatch: { path: string; score: number } | null = null;

    for (const dir of LOCAL_MUSIC_DIRS) {
      if (!existsSync(dir)) continue;

      console.log(`     Scanning: ${dir}`);

      try {
        const { stdout } = await execAsync(
          `find "${dir}" -type f \\( -iname "*.mp3" -o -iname "*.flac" -o -iname "*.m4a" -o -iname "*.ogg" \\) 2>/dev/null`,
          { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }  // 60s timeout, 10MB buffer for large directories
        );

        const files = stdout.trim().split('\n').filter(f => f.length > 0);
        console.log(`     Found ${files.length} audio files`);

        // Pre-filter by filename (fast)
        const candidates = files
          .map(f => ({ path: f, filenameScore: scoreFilename(f, artist, title) }))
          .filter(f => f.filenameScore > 0)
          .sort((a, b) => b.filenameScore - a.filenameScore)
          .slice(0, 50); // Only check top 50 filename matches

        console.log(`     Checking ${candidates.length} candidates with metadata...`);

        // Score candidates based on metadata (slower but accurate)
        for (const candidate of candidates) {
          const tags = await getAudioMetadata(candidate.path);
          if (!tags) continue;

          const score = calculateMatchScore(tags, artist, title, duration);

          // Require minimum score of 100 (at least one good match)
          if (score >= 100 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { path: candidate.path, score };
            console.log(`     New best: ${path.basename(candidate.path)} (score: ${score})`);
          }
        }
      } catch (err) {
        console.log(`     ⚠️  Error scanning ${dir}: ${err.message}`);
        continue;
      }
    }

    if (bestMatch) {
      console.log(`  ✅ Found local match (score: ${bestMatch.score}): ${path.basename(bestMatch.path)}`);

      // Copy and convert to MP3
      const tempPath = path.join(DOWNLOADS_DIR, `${spotify_track_id}.mp3`);
      const ext = path.extname(bestMatch.path).toLowerCase();

      if (ext === '.mp3') {
        await execAsync(`cp "${bestMatch.path}" "${tempPath}"`);
      } else {
        // Convert to MP3
        console.log(`  🔄 Converting ${ext} to MP3...`);
        await execAsync(
          `ffmpeg -i "${bestMatch.path}" -codec:a libmp3lame -qscale:a 2 "${tempPath}" -y -loglevel error`,
          { timeout: 60000 }
        );
      }

      return { path: tempPath, method: 'local' };
    }

    console.log(`  ⚠️  No local match found (min score: 100)`);
    return null;
  } catch (error: any) {
    console.log(`  ⚠️  Local search failed: ${error.message}`);
    return null;
  }
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
    const cmd = `yt-dlp "ytsearch1:${searchQuery}" -x --audio-format mp3 --audio-quality 0 -o "${outputPath}" --no-playlist --quiet --no-warnings --cookies-from-browser chrome`;

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

// Helper: Download TikTok video with yt-dlp
async function downloadTikTokVideo(
  video_id: string,
  tiktok_url: string
): Promise<{ videoPath: string; thumbnailPath: string; method: 'yt-dlp-tiktok' } | null> {
  const outputPath = path.join(DOWNLOADS_DIR, `tiktok-${video_id}.mp4`);
  const thumbnailPath = path.join(DOWNLOADS_DIR, `tiktok-${video_id}-thumbnail.jpg`);

  try {
    console.log(`  📥 Downloading TikTok video with yt-dlp...`);
    console.log(`     URL: ${tiktok_url}`);

    // Download TikTok video (yt-dlp supports TikTok!)
    const cmd = `yt-dlp "${tiktok_url}" -f "best[ext=mp4]" -o "${outputPath}" --no-playlist --quiet --no-warnings`;

    await execAsync(cmd, { timeout: 90000 }); // 90s timeout for video

    if (!existsSync(outputPath)) {
      console.log(`  ⚠️  TikTok download failed or file too small`);
      return null;
    }

    const stats = await Bun.file(outputPath).stat();
    if (stats.size < 100000) { // At least 100KB
      console.log(`  ⚠️  Downloaded file too small`);
      await unlink(outputPath);
      return null;
    }

    console.log(`  ✅ Downloaded TikTok video (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

    // Convert to H.264 for Chrome compatibility
    console.log(`  🔄 Converting to H.264 for browser compatibility...`);
    const tempVideoPath = path.join(DOWNLOADS_DIR, `tiktok-${video_id}-h264.mp4`);

    try {
      // Check current codec
      const { stdout: codecCheck } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${outputPath}"`,
        { timeout: 30000 }
      );
      const currentCodec = codecCheck.trim();
      console.log(`     Current codec: ${currentCodec}`);

      if (currentCodec !== 'h264') {
        console.log(`     Converting ${currentCodec} → H.264...`);
        // Convert to H.264 with web-optimized settings
        await execAsync(
          `ffmpeg -i "${outputPath}" -c:v libx264 -crf 23 -preset medium -profile:v high -c:a aac -b:a 128k -movflags +faststart -y "${tempVideoPath}"`,
          { timeout: 180000 } // 3min timeout
        );

        // Replace original with converted
        await unlink(outputPath);
        await execAsync(`mv "${tempVideoPath}" "${outputPath}"`);
        console.log(`     ✅ Converted to H.264`);
      } else {
        console.log(`     ✅ Already H.264, no conversion needed`);
      }
    } catch (error: any) {
      console.log(`     ⚠️  Codec detection failed, encoding anyway to be safe`);
      // If codec check fails, convert anyway to ensure H.264
      await execAsync(
        `ffmpeg -i "${outputPath}" -c:v libx264 -crf 23 -preset medium -profile:v high -c:a aac -b:a 128k -movflags +faststart -y "${tempVideoPath}"`,
        { timeout: 180000 }
      );
      await unlink(outputPath);
      await execAsync(`mv "${tempVideoPath}" "${outputPath}"`);
      console.log(`     ✅ Converted to H.264`);
    }

    // Extract thumbnail from first frame
    console.log(`  🖼️  Extracting thumbnail from video...`);
    await execAsync(
      `ffmpeg -i "${outputPath}" -vf "select=eq(n\\,0)" -vframes 1 -q:v 2 -y "${thumbnailPath}"`,
      { timeout: 30000 }
    );

    if (existsSync(thumbnailPath)) {
      const thumbStats = await Bun.file(thumbnailPath).stat();
      console.log(`     ✅ Thumbnail extracted (${(thumbStats.size / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`     ⚠️  Thumbnail extraction failed, continuing without it`);
    }

    return {
      videoPath: outputPath,
      thumbnailPath: existsSync(thumbnailPath) ? thumbnailPath : '',
      method: 'yt-dlp-tiktok'
    };
  } catch (error: any) {
    console.log(`  ⚠️  yt-dlp TikTok download failed: ${error.message}`);

    // Cleanup partial downloads
    if (existsSync(outputPath)) {
      try {
        await unlink(outputPath);
      } catch {}
    }
    if (existsSync(thumbnailPath)) {
      try {
        await unlink(thumbnailPath);
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
    client = await getSoulseekClient();
    console.log(`  ✓ Connected as ${SOULSEEK_ACCOUNT}`);

    // Health check: verify connection is working
    const isHealthy = await isConnectionHealthy(client);
    if (!isHealthy) {
      console.log(`  ⚠️  Connection health check failed, reconnecting...`);
      persistentSoulseekClient?.disconnect?.();
      persistentSoulseekClient = null;
      client = await getSoulseekClient();
      console.log(`  ✓ Reconnected successfully`);
    }

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

    // Blacklist keywords that indicate wrong versions
    const versionBlacklist = [
      'bootleg', 'mashup', 'remix', 'cover', 'live', 'acoustic',
      'karaoke', 'instrumental', 'acapella', 'demo', 'tribute',
      'remaster', 'remastered', 'extended', 'radio edit', 'clean',
      'explicit', 'feat', 'featuring', 'vs', 'version'
    ];

    // Helper: Check if filename contains blacklisted keywords
    const hasBlacklistedKeywords = (filePath: string): boolean => {
      const normalized = filePath.toLowerCase();
      return versionBlacklist.some(keyword => normalized.includes(keyword));
    };

    // Helper: Check if filepath contains artist name
    const getArtistMatchScore = (filePath: string, artistName: string): number => {
      const normalized = filePath.toLowerCase().replace(/[^a-z0-9]/g, '');
      const artistNorm = artistName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Check exact artist match
      if (normalized.includes(artistNorm)) {
        return 500000; // HUGE bonus for artist match
      }

      // Check word overlap (important for multi-word artists like "The Weeknd")
      const artistWords = artistNorm.split(/\s+/).filter(w => w.length > 2);
      if (artistWords.length === 0) return 0;

      const matchedWords = artistWords.filter(word => normalized.includes(word));
      const wordMatchRatio = matchedWords.length / artistWords.length;

      // Require at least 50% word match for partial credit
      if (wordMatchRatio >= 0.5) {
        return Math.floor(wordMatchRatio * 250000);
      }

      return 0; // No artist match
    };

    // Better scoring algorithm to avoid firewalled/throttled peers
    const scorePeer = (peer: any) => {
      const file = peer.files[0];
      const fileSizeMB = Number(file.size) / 1024 / 1024;
      const speedMBps = peer.speed / 1024;

      // CRITICAL: Reject files with blacklisted keywords (bootleg, live, remix, etc.)
      if (hasBlacklistedKeywords(file.path)) {
        return -9999999; // Ensure these are ranked last
      }

      // CRITICAL: Prioritize files with artist name match (prevents U2 vs The Weeknd mix-ups)
      const artistMatchBonus = getArtistMatchScore(file.path, artist);

      // Prefer MP3 (smaller, faster) over FLAC
      const isMP3 = file.path.toLowerCase().endsWith('.mp3');
      const formatBonus = isMP3 ? 50000 : 0;

      // Prefer moderate file sizes (3-15MB = likely 320kbps mp3)
      const sizeBonus = (fileSizeMB >= 3 && fileSizeMB <= 15) ? 30000 : 0;

      // Penalize unrealistic speeds (>10MB/s is suspicious, likely firewalled)
      const speedPenalty = speedMBps > 10000 ? -100000 : 0;

      // Free slots get priority
      const slotBonus = peer.slotsFree ? 1000000 : 0;

      // Moderate speed bonus (capped to avoid unrealistic values)
      const cappedSpeed = Math.min(speedMBps, 5000);

      return slotBonus + artistMatchBonus + formatBonus + sizeBonus + speedPenalty + cappedSpeed;
    };

    // Sort by composite score
    const allCandidates = [...freeSlots, ...queued].sort((a, b) => {
      return scorePeer(b) - scorePeer(a);
    });

    // Filter out candidates with only blacklisted files (score < 0)
    const candidates = allCandidates.filter(peer => scorePeer(peer) >= 0);

    if (candidates.length === 0) {
      console.log(`  ❌ No valid peers found (all results contain bootleg/remix/live versions)`);
      if (allCandidates.length > 0) {
        console.log(`     Rejected ${allCandidates.length} peers with unwanted versions`);
      }
      return null;
    }

    console.log(`  🎯 Top candidates (${candidates.length} valid):`);
    candidates.slice(0, 5).forEach((c, i) => {
      const file = c.files[0];
      console.log(`     ${i+1}. ${c.username} - ${(Number(file.size)/1024/1024).toFixed(1)}MB, ${c.speed}kb/s, ${c.slotsFree ? 'FREE' : 'QUEUED'}`);
    });

    // Try up to 10 best peers (increased for better resilience)
    for (let i = 0; i < Math.min(MAX_PEER_ATTEMPTS, candidates.length); i++) {
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

              // Timeout if no data for 30 seconds (faster failover to try next peer)
              let lastDataTime = Date.now();
              const progressTimeout = setInterval(() => {
                const elapsed = Date.now() - lastDataTime;
                if (elapsed > DOWNLOAD_TIMEOUT_MS) {
                  clearInterval(progressTimeout);
                  stream.destroy();
                  reject(new Error(`Download timeout: no data for ${DOWNLOAD_TIMEOUT_MS/1000} seconds`));
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
        consecutiveFailures = 0; // Reset on success
        return { path: cachedPath, method: 'soulseek' };
      } catch (downloadError: any) {
        console.log(`  ⚠️  Download failed from ${peer.username}: ${downloadError.message}`);
        if (i < Math.min(MAX_PEER_ATTEMPTS, candidates.length) - 1) {
          console.log(`  🔄 Trying next peer...`);
        }
      }
    }

    console.log(`  ❌ All download attempts failed`);

    // Track consecutive failures and reset connection if needed
    consecutiveFailures++;
    console.log(`  ⚠️  Consecutive failures: ${consecutiveFailures}/${MAX_FAILURES_BEFORE_RESET}`);

    if (consecutiveFailures >= MAX_FAILURES_BEFORE_RESET) {
      console.log(`  🔄 Resetting Soulseek connection after ${consecutiveFailures} failures`);
      persistentSoulseekClient?.disconnect?.();
      persistentSoulseekClient = null;
      consecutiveFailures = 0;
    }

    return null;
  } catch (error: any) {
    console.error(`  ❌ Soulseek failed:`, error);
    console.error(`  Error type: ${typeof error}`);
    console.error(`  Error message: ${error?.message || 'no message'}`);
    console.error(`  Error string: ${String(error)}`);
    return null;
  } finally {
    // Don't disconnect - keep persistent connection
    // Connection will be reused for next download
  }
}

// Helper: Verify with AcoustID
async function verifyDownload(
  filePath: string,
  expected_title: string,
  expected_artist: string,
  acoustid_api_key: string
): Promise<{ verified: boolean; confidence: number; fingerprint: string | null; duration: number | null; details: any }> {
  let fingerprint: string | null = null;
  let duration: number | null = null;

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
      return {
        verified: false,
        confidence: 0,
        fingerprint,
        duration,
        details: { error: "Could not generate fingerprint", fingerprint }
      };
    }

    duration = parseInt(durationMatch[1]);
    fingerprint = fingerprintMatch[1].trim();

    // Query AcoustID
    const acoustidUrl = `https://api.acoustid.org/v2/lookup?client=${acoustid_api_key}&duration=${duration}&fingerprint=${encodeURIComponent(fingerprint)}&meta=recordings`;
    const response = await fetch(acoustidUrl);
    const data = await response.json();

    if (data.status !== "ok" || !data.results || data.results.length === 0) {
      console.log(`    [verify] ❌ No AcoustID results`);
      return {
        verified: false,
        confidence: 0,
        fingerprint,
        duration,
        details: { error: "No AcoustID match", fingerprint }
      };
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
        fingerprint,
        duration,
        details: { mb_title, mb_artist, title_match, artist_match, fingerprint }
      };
    }

    // No metadata - rely on confidence only
    const verified = confidence >= 0.90;
    console.log(`    [verify] ${verified ? '✅ VERIFIED' : '❌ REJECTED'} (no metadata)`);
    return { verified, confidence, fingerprint, duration, details: { high_confidence_only: true, fingerprint } };
  } catch (error: any) {
    console.error(`    [verify] ❌ Error: ${error.message}`);
    return { verified: false, confidence: 0, fingerprint, duration, details: { error: error.message, fingerprint } };
  }
}

// Helper: Upload to Grove IPFS
async function uploadToGrove(
  filePath: string,
  spotify_track_id: string,
  chain_id: number,
  contentType?: string
): Promise<{ cid: string; url: string }> {
  try {
    console.log(`  [grove] Uploading to IPFS...`);

    const fileBuffer = await readFile(filePath);

    // Detect content type from file extension if not provided
    let finalContentType = contentType;
    if (!finalContentType) {
      const ext = filePath.split('.').pop()?.toLowerCase();
      if (ext === 'mp4') {
        finalContentType = 'video/mp4';
      } else if (ext === 'jpg' || ext === 'jpeg') {
        finalContentType = 'image/jpeg';
      } else if (ext === 'png') {
        finalContentType = 'image/png';
      } else {
        finalContentType = 'audio/mpeg'; // Default
      }
    }

    // Grove expects: raw binary body with Content-Type header
    const response = await fetch(`https://api.grove.storage/?chain_id=${chain_id}`, {
      method: 'POST',
      headers: {
        'Content-Type': finalContentType,
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
          version: "2.5.0",
          downloads_dir: DOWNLOADS_DIR,
          soulseek_configured: !!(SOULSEEK_ACCOUNT && SOULSEEK_PASSWORD),
          strategies: ["yt-dlp", "soulseek-p2p", "yt-dlp-tiktok"]
        }, { headers });
      }

      // POST /download-tiktok-video (FIRE-AND-FORGET)
      if (url.pathname === "/download-tiktok-video" && req.method === "POST") {
        const body: { video_id: string; tiktok_url: string; chain_id?: number; neon_database_url?: string } = await req.json();
        const { video_id, tiktok_url, chain_id = CHAIN_ID, neon_database_url } = body;

        if (!video_id || !tiktok_url) {
          return Response.json({
            error: "Missing required fields: video_id, tiktok_url"
          }, { status: 400, headers });
        }

        // Prevent duplicate concurrent downloads
        if (inflightDownloads.has(video_id)) {
          console.log(`⏳ Video download already in progress for ${video_id}`);
          return Response.json({
            status: "already_processing",
            workflow_id: video_id
          }, { headers });
        }

        console.log(`🔄 Starting TikTok video workflow: ${video_id}`);
        console.log(`   URL: ${tiktok_url}`);

        // Start workflow asynchronously
        const workflowPromise = (async () => {
          try {
            // Step 1: Download TikTok video with yt-dlp (includes H.264 conversion + thumbnail extraction)
            const downloadResult = await downloadTikTokVideo(video_id, tiktok_url);

            if (!downloadResult) {
              throw new Error("Failed to download TikTok video");
            }

            // Step 2: Upload video to Grove
            console.log(`  📦 Uploading video to Grove...`);
            const { cid: grove_video_cid, url: grove_video_url } = await uploadToGrove(
              downloadResult.videoPath,
              video_id,
              chain_id
            );

            // Step 3: Upload thumbnail to Grove (if available)
            let grove_thumbnail_cid = null;
            let grove_thumbnail_url = null;

            if (downloadResult.thumbnailPath) {
              console.log(`  📦 Uploading thumbnail to Grove...`);
              try {
                const thumbnailResult = await uploadToGrove(
                  downloadResult.thumbnailPath,
                  `${video_id}-thumbnail`,
                  chain_id
                );
                grove_thumbnail_cid = thumbnailResult.cid;
                grove_thumbnail_url = thumbnailResult.url;
                console.log(`     ✅ Thumbnail uploaded: ${grove_thumbnail_cid}`);
              } catch (thumbError: any) {
                console.log(`     ⚠️  Thumbnail upload failed: ${thumbError.message}`);
              }
            }

            // Step 4: Update database if credentials provided
            if (neon_database_url) {
              console.log(`  💾 Updating database...`);
              const sql = neon(neon_database_url);
              await sql`
                UPDATE tiktok_videos
                SET
                  grove_video_cid = ${grove_video_cid},
                  grove_video_url = ${grove_video_url},
                  grove_thumbnail_cid = ${grove_thumbnail_cid},
                  grove_thumbnail_url = ${grove_thumbnail_url},
                  grove_uploaded_at = NOW(),
                  updated_at = NOW()
                WHERE video_id = ${video_id}
              `;
              console.log(`     ✅ Database updated`);
            }

            // Step 5: Cleanup temp files
            await unlink(downloadResult.videoPath);
            if (downloadResult.thumbnailPath) {
              try {
                await unlink(downloadResult.thumbnailPath);
              } catch {}
            }
            console.log(`  ✓ Cleaned up temp files`);

            console.log(`✅ TikTok video workflow complete: ${grove_video_cid}`);

          } catch (error: any) {
            console.error(`❌ TikTok video workflow failed: ${error.message}`);
          } finally {
            inflightDownloads.delete(video_id);
          }
        })();

        inflightDownloads.set(video_id, workflowPromise);

        // Return immediately (fire-and-forget)
        return Response.json({
          status: "processing",
          workflow_id: video_id
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
          chain_id = CHAIN_ID
        } = body;

        if (!spotify_track_id || !expected_title || !expected_artist) {
          return Response.json({
            error: "Missing required fields: spotify_track_id, expected_title, expected_artist"
          }, { status: 400, headers });
        }

        // Prevent duplicate concurrent downloads
        if (inflightDownloads.has(spotify_track_id)) {
          console.log(`⏳ Download already in progress for ${spotify_track_id}`);
          return Response.json({
            status: "already_processing",
            workflow_id: spotify_track_id
          }, { headers });
        }

        const workflowStart = Date.now();
        const queuePosition = downloadQueue.length + 1;
        console.log(`📋 Queued workflow for: ${spotify_track_id} (position ${queuePosition})`);
        console.log(`   "${expected_title}" - ${expected_artist}`);

        // Enqueue work to serialize downloads
        const workflowPromise = new Promise((resolve, reject) => {
          downloadQueue.push({
            id: spotify_track_id,
            fn: async () => {
          try {
            // Now actually starting the workflow
            console.log(`\n🔄 Starting workflow for: ${spotify_track_id}`);
            console.log(`   "${expected_title}" - ${expected_artist}`);

            // Step 1: Try local music first, then yt-dlp, then Soulseek
            console.log(`[1/5] Downloading audio...`);

            // Try local directories first (fastest!)
            let downloadResult = await searchLocalMusic(
              spotify_track_id,
              expected_title,
              expected_artist,
              undefined // duration not available in request
            );

            // If not found locally, try yt-dlp
            if (!downloadResult) {
              downloadResult = await downloadWithYtDlp(
                spotify_track_id,
                expected_title,
                expected_artist
              );
            }

            let verificationResult: any = null;
            let downloadMethod = 'unknown';

            // Step 2: Verify download result
            if (downloadResult && acoustid_api_key) {
              const source = downloadResult.method === 'local' ? 'local' :
                            downloadResult.method === 'yt-dlp' ? 'yt-dlp' : 'unknown';
              console.log(`[2/5] Verifying ${source} download with AcoustID...`);
              verificationResult = await verifyDownload(
                downloadResult.path,
                expected_title,
                expected_artist,
                acoustid_api_key
              );

              if (!verificationResult.verified) {
                console.log(`  ❌ ${source} verification failed, trying next fallback...`);
                // Clean up bad file
                try {
                  await unlink(downloadResult.path);
                } catch (e) {
                  console.warn(`  Could not delete bad ${source} file: ${e}`);
                }
                downloadResult = null;
                verificationResult = null;
              } else {
                console.log(`  ✅ ${source} verified successfully`);
                downloadMethod = downloadResult.method;
              }
            } else if (!downloadResult) {
              console.log(`  🔄 Previous methods failed, trying Soulseek fallback...`);
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

              // Verify Soulseek result (strict)
              if (acoustid_api_key) {
                console.log(`[2/5] Verifying Soulseek download with AcoustID...`);
                verificationResult = await verifyDownload(
                  downloadResult.path,
                  expected_title,
                  expected_artist,
                  acoustid_api_key
                );

                if (!verificationResult.verified) {
                  const reason = verificationResult.details?.error || 'Verification failed';
                  console.log(`  ❌ Soulseek verification failed: ${reason}`);
                  await unlink(downloadResult.path);
                  throw new Error("Downloaded audio doesn't match expected track");
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
            const sql = neon(DATABASE_URL);

            const audioFormat = (() => {
              const ext = path.extname(downloadedPath).replace('.', '').toLowerCase();
              return ext || 'mp3';
            })();

            const normalizedDownloadSource = (() => {
              switch (downloadMethod) {
                case 'yt-dlp':
                  return 'youtube';
                case 'soulseek':
                  return 'soulseek';
                case 'local':
                  return 'local';
                case 'spotify':
                  return 'youtube';
                default:
                  return downloadMethod || 'unknown';
              }
            })();

            const audioTaskMetadata: Record<string, any> = {
              download_method: downloadMethod,
              download_source: normalizedDownloadSource,
              verified: verificationResult?.verified ?? false,
              verification_confidence: verificationResult?.confidence ?? null,
              file_size_bytes: fileSizeBytes,
              duration_ms: durationMs,
              acoustid_details: verificationResult?.details ?? null
            };

            if (verificationResult?.fingerprint) {
              audioTaskMetadata.acoustid_fingerprint = verificationResult.fingerprint;
            }

            const audioTaskMetadataJson = JSON.stringify(audioTaskMetadata);
            const acoustidFingerprint = verificationResult?.fingerprint || null;

            await sql`BEGIN`;

            try {
              // Upsert song_audio (OLD schema: download_source, format, acoustid_fingerprint)
              await sql`
                INSERT INTO song_audio (
                  spotify_track_id,
                  grove_cid,
                  grove_url,
                  download_source,
                  format,
                  duration_ms,
                  acoustid_fingerprint,
                  created_at,
                  updated_at
                ) VALUES (
                  ${spotify_track_id},
                  ${grove_cid},
                  ${grove_url},
                  ${normalizedDownloadSource},
                  ${'mp3'},
                  ${durationMs},
                  ${verificationResult?.details?.fingerprint ?? null},
                  NOW(),
                  NOW()
                )
                ON CONFLICT (spotify_track_id)
                DO UPDATE SET
                  grove_cid = EXCLUDED.grove_cid,
                  grove_url = EXCLUDED.grove_url,
                  download_source = EXCLUDED.download_source,
                  format = EXCLUDED.format,
                  duration_ms = EXCLUDED.duration_ms,
                  acoustid_fingerprint = EXCLUDED.acoustid_fingerprint,
                  updated_at = NOW()
              `;

              // Update audio_tasks entry
              const taskUpdate = await sql`
                UPDATE audio_tasks
                SET
                  status = 'completed',
                  grove_cid = ${grove_cid},
                  grove_url = ${grove_url},
                  metadata = ${audioTaskMetadataJson},
                  completed_at = NOW(),
                  updated_at = NOW(),
                  last_attempt_at = NOW(),
                  next_retry_at = NULL,
                  error_message = NULL,
                  error_details = NULL,
                  attempts = GREATEST(attempts + 1, 1)
                WHERE spotify_track_id = ${spotify_track_id}
                  AND task_type = 'download'
                RETURNING id
              `;

              if (taskUpdate.length === 0) {
                await sql`
                  INSERT INTO audio_tasks (
                    spotify_track_id,
                    task_type,
                    status,
                    grove_cid,
                    grove_url,
                    metadata,
                    attempts,
                    max_attempts,
                    last_attempt_at,
                    completed_at,
                    updated_at
                  ) VALUES (
                    ${spotify_track_id},
                    'download',
                    'completed',
                    ${grove_cid},
                    ${grove_url},
                    ${audioTaskMetadataJson},
                    1,
                    3,
                    NOW(),
                    NOW(),
                    NOW()
                  )
                  ON CONFLICT (spotify_track_id, task_type) DO NOTHING
                `;
              }

              // Update track stage & flags
              await sql`
                UPDATE tracks
                SET
                  stage = CASE
                    WHEN stage IN ('pending', 'enriched', 'lyrics_acquired') THEN 'audio_ready'
                    ELSE stage
                  END,
                  has_audio = TRUE,
                  error_message = NULL,
                  error_at = NULL,
                  updated_at = NOW()
                WHERE spotify_track_id = ${spotify_track_id}
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
              download_method: downloadMethod,
              download_source: normalizedDownloadSource,
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
              const sql = neon(DATABASE_URL);
              const errorDetails = {
                stage: 'audio_download',
                message: error.message,
                stack: error.stack ? error.stack.split('\n').slice(0, 5) : undefined
              };

              const taskUpdate = await sql`
                UPDATE audio_tasks
                SET
                  attempts = attempts + 1,
                  last_attempt_at = NOW(),
                  status = CASE
                    WHEN attempts + 1 >= max_attempts THEN 'failed'
                    ELSE 'pending'
                  END,
                  next_retry_at = CASE
                    WHEN attempts + 1 >= max_attempts THEN NULL
                    ELSE NOW() + INTERVAL '1 hour'
                  END,
                  error_message = ${error.message},
                  error_details = ${JSON.stringify(errorDetails)},
                  updated_at = NOW()
                WHERE spotify_track_id = ${spotify_track_id}
                  AND task_type = 'download'
                RETURNING attempts, max_attempts, status
              `;

              if (taskUpdate.length === 0) {
                await sql`
                  INSERT INTO audio_tasks (
                    spotify_track_id,
                    task_type,
                    status,
                    attempts,
                    max_attempts,
                    error_message,
                    error_details,
                    last_attempt_at,
                    next_retry_at,
                    updated_at
                  ) VALUES (
                    ${spotify_track_id},
                    'download',
                    'failed',
                    1,
                    3,
                    ${error.message},
                    ${JSON.stringify(errorDetails)},
                    NOW(),
                    NOW() + INTERVAL '1 hour',
                    NOW()
                  )
                  ON CONFLICT (spotify_track_id, task_type) DO NOTHING
                `;
              }

              const attempts = taskUpdate[0]?.attempts ?? 1;
              const maxAttempts = taskUpdate[0]?.max_attempts ?? 3;
              const statusAfterUpdate = taskUpdate[0]?.status ?? 'failed';
              const reachedMaxAttempts = statusAfterUpdate === 'failed' && attempts >= maxAttempts;

              await sql`
                UPDATE tracks
                SET
                  has_audio = FALSE,
                  error_message = ${error.message},
                  error_at = NOW(),
                  stage = CASE
                    WHEN ${reachedMaxAttempts} THEN 'failed'
                    ELSE stage
                  END,
                  updated_at = NOW()
                WHERE spotify_track_id = ${spotify_track_id}
              `;

              if (reachedMaxAttempts) {
                console.log(`  ⚠️  Permanently failed after ${attempts} attempts`);
              } else {
                console.log(`  ⚠️  Attempt ${attempts}/${maxAttempts} failed, queued for retry`);
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
            },
            resolve,
            reject
          });

          // Start processing queue
          processDownloadQueue();
        });

        inflightDownloads.set(spotify_track_id, workflowPromise);

        // Fire-and-forget: Start workflow but return immediately
        workflowPromise.catch(err => {
          console.error(`❌ Background workflow error for ${spotify_track_id}:`, err.message);
          inflightDownloads.delete(spotify_track_id);  // FIX: Clean up on ANY error
        }).finally(() => {
          inflightDownloads.delete(spotify_track_id);  // FIX: Always clean up when done
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
