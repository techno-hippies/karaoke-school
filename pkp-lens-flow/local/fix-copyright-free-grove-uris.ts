#!/usr/bin/env bun
/**
 * Fix Grove URIs for copyright-free videos
 *
 * Clears playlist and segments URIs from copyright-free videos
 * since they should use direct MP4 files, not HLS
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const manifestPath = join(process.cwd(), 'data', 'videos', 'beyonce', 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

console.log('🧹 Fixing Grove URIs for copyright-free videos...\n');

let fixed = 0;

for (const video of manifest.videos) {
  if (video.copyrightType === 'copyright-free') {
    console.log(`   Video: ${video.postId} (${video.music.title})`);

    if (video.groveUris.playlist || video.groveUris.segments) {
      console.log('      Clearing HLS URIs...');
      delete video.groveUris.playlist;
      delete video.groveUris.segments;
      fixed++;
      console.log('      ✅ Cleared\n');
    } else {
      console.log('      ⏭️  Already clear\n');
    }
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\n✅ Fixed ${fixed} videos\n`);
