#!/usr/bin/env bun
/**
 * Add copyright-free video to identified_videos.json
 */

import { readJson, writeJson } from './lib/fs.js';

const HANDLE = 'idazeile';
const VIDEO_ID = '7549722100307725590';

// Get video from raw_videos.json
const rawPath = `data/creators/${HANDLE}/raw_videos.json`;
const rawData = readJson(rawPath);
const video = rawData.copyright_free.find((v: any) => v.id === VIDEO_ID);

if (!video) {
  console.error('Video not found in raw_videos.json');
  process.exit(1);
}

console.log(`Found video: ${video.music.title}`);

// Add identification (copyright-free doesn't need API calls)
video.identification = {
  title: video.music.title,
  artist: video.music.authorName || 'Original Sound',
  copyrightType: 'copyright-free',
  storyMintable: true,
};

// Add to identified_videos.json
const identifiedPath = `data/creators/${HANDLE}/identified_videos.json`;
const identified = readJson(identifiedPath);

// Check if already exists
const existingIndex = identified.copyright_free.findIndex((v: any) => v.id === VIDEO_ID);
if (existingIndex >= 0) {
  identified.copyright_free[existingIndex] = video;
  console.log('✅ Updated existing video in identified_videos.json');
} else {
  identified.copyright_free.push(video);
  console.log('✅ Added video to identified_videos.json');
}

writeJson(identifiedPath, identified);
