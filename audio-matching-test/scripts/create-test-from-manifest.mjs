#!/usr/bin/env node
/**
 * Create test cases from existing pkp-lens-flow data
 *
 * Usage:
 *   node scripts/create-test-from-manifest.mjs <creator> <video-index>
 *
 * Example:
 *   node scripts/create-test-from-manifest.mjs taylorswift 0
 *   node scripts/create-test-from-manifest.mjs billieeilish 1
 */

import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const audioMatchingRoot = resolve(__dirname, '..');
const karaokSchoolRoot = resolve(audioMatchingRoot, '..');

// Parse args
const [creator, videoIndexStr] = process.argv.slice(2);

if (!creator || videoIndexStr === undefined) {
  console.error('Usage: node scripts/create-test-from-manifest.mjs <creator> <video-index>');
  console.error('\nExample:');
  console.error('  node scripts/create-test-from-manifest.mjs taylorswift 0');
  process.exit(1);
}

const videoIndex = parseInt(videoIndexStr);

// Paths
const manifestPath = resolve(karaokSchoolRoot, `pkp-lens-flow/data/videos/${creator}/manifest.json`);
const videosDir = resolve(karaokSchoolRoot, `pkp-lens-flow/data/videos/${creator}`);

if (!existsSync(manifestPath)) {
  console.error(`❌ Manifest not found: ${manifestPath}`);
  process.exit(1);
}

// Load manifest
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

if (!manifest.videos || !manifest.videos[videoIndex]) {
  console.error(`❌ Video index ${videoIndex} not found in manifest`);
  console.error(`   Available: 0-${manifest.videos.length - 1}`);
  process.exit(1);
}

const video = manifest.videos[videoIndex];
const music = video.music;

// Create test ID
const artistSlug = (music.spotify?.metadata?.artists?.[0] || creator)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const songSlug = (music.title || 'unknown')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const testId = `${artistSlug}-${songSlug}`;

// Create test directory
const testDir = resolve(audioMatchingRoot, `test-cases/${testId}`);

if (existsSync(testDir)) {
  console.error(`⚠️  Test case already exists: ${testId}`);
  console.error(`   Remove it first or choose a different video`);
  process.exit(1);
}

console.log(`📁 Creating test case: ${testId}`);
mkdirSync(testDir, { recursive: true });

// Copy video file
const videoSrc = resolve(videosDir, `video_${videoIndex + 1}_${video.postId}.mp4`);
const videoDst = resolve(testDir, 'tiktok_clip.mp4');

if (existsSync(videoSrc)) {
  copyFileSync(videoSrc, videoDst);
  console.log(`✓ Copied TikTok clip`);
} else {
  console.warn(`⚠️  Video file not found: ${videoSrc}`);
}

// Create metadata
const metadata = {
  testId,
  artist: music.spotify?.metadata?.artists?.join(', ') || creator,
  songTitle: music.title,
  album: music.spotify?.metadata?.album || null,
  isrc: music.spotify?.isrc || null,
  spotifyId: music.spotifyTrackId || null,
  geniusId: music.geniusId || null,
  tiktokCreator: manifest.tiktokHandle,
  tiktokPostId: video.postId,
  tiktokUrl: video.postUrl,
  expectedMatch: {
    startTime: null,
    endTime: null,
    section: null,
    notes: "Manual verification needed - run test to get actual match"
  },
  files: {
    original: "original.mp3",
    clip: "tiktok_clip.mp4",
    lyrics: null,
    segments: null
  }
};

writeFileSync(
  resolve(testDir, 'metadata.json'),
  JSON.stringify(metadata, null, 2)
);

console.log(`✓ Created metadata.json`);
console.log();

// Instructions for next steps
console.log('=' .repeat(70));
console.log('📋 NEXT STEPS');
console.log('=' .repeat(70));
console.log();

console.log(`Test case created at: test-cases/${testId}/`);
console.log();

console.log('1. Download the original song:');
console.log();

if (metadata.spotifyId) {
  console.log(`   # Using spotify-dl (install: pip install spotify-dl)`);
  console.log(`   spotify-dl \\`);
  console.log(`     --url "https://open.spotify.com/track/${metadata.spotifyId}" \\`);
  console.log(`     --output "audio-matching-test/test-cases/${testId}/original.mp3"`);
  console.log();
  console.log(`   # Or using spotdl (install: pip install spotdl)`);
  console.log(`   spotdl download \\`);
  console.log(`     "https://open.spotify.com/track/${metadata.spotifyId}" \\`);
  console.log(`     --output "audio-matching-test/test-cases/${testId}/original.mp3"`);
} else {
  console.log(`   # Search and download: "${metadata.artist} - ${metadata.songTitle}"`);
  console.log(`   # Save to: audio-matching-test/test-cases/${testId}/original.mp3`);
}

console.log();
console.log('2. Run the test:');
console.log();
console.log(`   python3 scripts/run-test-suite.py ${testId}`);
console.log();
console.log('=' .repeat(70));
console.log();

// Show video info
console.log('📺 TikTok Video Info:');
console.log();
console.log(`   Post: ${video.postUrl}`);
console.log(`   Views: ${video.stats.views.toLocaleString()}`);
console.log(`   Likes: ${video.stats.likes.toLocaleString()}`);
console.log(`   Description: ${video.description}`);
console.log();

// Show music info
console.log('🎵 Music Info:');
console.log();
console.log(`   Title: ${metadata.songTitle}`);
console.log(`   Artist: ${metadata.artist}`);
if (metadata.album) console.log(`   Album: ${metadata.album}`);
if (metadata.isrc) console.log(`   ISRC: ${metadata.isrc}`);
if (metadata.spotifyId) console.log(`   Spotify: https://open.spotify.com/track/${metadata.spotifyId}`);
console.log();
