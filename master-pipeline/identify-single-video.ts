#!/usr/bin/env bun
/**
 * Quick script to identify a single video and add to identified_videos.json
 */

import { readJson, writeJson } from './lib/fs.js';
import { SongIdentificationService } from './services/song-identification.js';

const VIDEO_ID = '7554645173863517462';
const HANDLE = 'idazeile';

// Read raw videos
const rawPath = `data/creators/${HANDLE}/raw_videos.json`;
const rawData = readJson(rawPath);

// Find the video
const video = rawData.copyrighted.find((v: any) => v.id === VIDEO_ID);
if (!video) {
  console.error('Video not found');
  process.exit(1);
}

console.log(`Found video: ${video.music.title} by ${video.music.authorName}`);

// Identify the song
const service = new SongIdentificationService();
const result = await service.identifyFromTikTok({
  title: video.music.title,
  authorName: video.music.authorName,
  isCopyrighted: video.music.isCopyrighted,
  tt2dsp: video.music.tt2dsp,
});

console.log('Identification result:', result);

// Add to identified videos
const identifiedPath = `data/creators/${HANDLE}/identified_videos.json`;
const identified = readJson(identifiedPath);

// Add identification to video
video.identification = result;

// Add to copyrighted array if not already there
const exists = identified.copyrighted.find((v: any) => v.id === VIDEO_ID);
if (!exists) {
  identified.copyrighted.push(video);
  writeJson(identifiedPath, identified);
  console.log('✅ Added to identified_videos.json');
} else {
  console.log('Already in identified_videos.json');
}
