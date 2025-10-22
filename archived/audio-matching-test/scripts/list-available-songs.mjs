#!/usr/bin/env node
/**
 * List available songs from pkp-lens-flow data
 *
 * Usage:
 *   node scripts/list-available-songs.mjs [creator]
 *
 * Example:
 *   node scripts/list-available-songs.mjs                # List all
 *   node scripts/list-available-songs.mjs taylorswift   # List specific creator
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const audioMatchingRoot = resolve(__dirname, '..');
const karaokSchoolRoot = resolve(audioMatchingRoot, '..');
const videosDir = resolve(karaokSchoolRoot, 'pkp-lens-flow/data/videos');

const targetCreator = process.argv[2];

if (!existsSync(videosDir)) {
  console.error('❌ pkp-lens-flow/data/videos not found');
  process.exit(1);
}

const creators = readdirSync(videosDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => !targetCreator || name === targetCreator);

console.log('🎵 AVAILABLE SONGS FOR TESTING');
console.log('=' .repeat(70));
console.log();

for (const creator of creators) {
  const manifestPath = resolve(videosDir, creator, 'manifest.json');

  if (!existsSync(manifestPath)) continue;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  if (!manifest.videos || manifest.videos.length === 0) continue;

  console.log(`📁 ${creator} (${manifest.videos.length} videos)`);
  console.log(`   Lens: ${manifest.lensHandle || 'N/A'}`);
  console.log();

  manifest.videos.forEach((video, idx) => {
    const music = video.music;
    const artist = music.spotify?.metadata?.artists?.[0] || 'Unknown';
    const title = music.title || 'Unknown';
    const views = video.stats.views.toLocaleString();

    console.log(`   [${idx}] ${artist} - ${title}`);
    console.log(`       Views: ${views} | Likes: ${video.stats.likes.toLocaleString()}`);

    if (music.spotifyTrackId) {
      console.log(`       Spotify: https://open.spotify.com/track/${music.spotifyTrackId}`);
    }

    console.log();
  });

  console.log();
}

console.log('=' .repeat(70));
console.log();
console.log('📋 TO CREATE A TEST CASE:');
console.log();
console.log('   node scripts/create-test-from-manifest.mjs <creator> <index>');
console.log();
console.log('Example:');
console.log('   node scripts/create-test-from-manifest.mjs taylorswift 0');
console.log();
