#!/usr/bin/env bun
/**
 * Fix Nightcall identification using Spotify ID
 */

import { readJson, writeJson } from './lib/fs.js';
import { SongIdentificationService } from './services/song-identification.js';

const HANDLE = 'idazeile';
const VIDEO_ID = '7554645173863517462';
const SPOTIFY_ID = '2KejCKgm7l3uefW9cFt8cH'; // From TikTok tt2dsp data

// Use the identification service to get all data
const spotifyConfig = {
  clientId: process.env.SPOTIFY_CLIENT_ID || '',
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
};

const geniusConfig = {
  apiKey: process.env.GENIUS_API_KEY || '',
};

const service = new SongIdentificationService(spotifyConfig, geniusConfig);
const result = await service.identifyFromTikTok({
  title: 'Nightcall',
  artist: 'Kavinsky & Angèle & Phoenix',
  spotifyTrackId: SPOTIFY_ID,
});

console.log('Identification result:', result);

// Get video from raw_videos.json
const rawPath = `data/creators/${HANDLE}/raw_videos.json`;
const rawData = readJson(rawPath);
const video = rawData.copyrighted.find((v: any) => v.id === VIDEO_ID);

if (!video) {
  console.error('Video not found in raw_videos.json');
  process.exit(1);
}

// Add identification to video
video.identification = result;

// Add to identified_videos.json
const identifiedPath = `data/creators/${HANDLE}/identified_videos.json`;
const identified = readJson(identifiedPath);

// Check if already exists
const existingIndex = identified.copyrighted.findIndex((v: any) => v.id === VIDEO_ID);
if (existingIndex >= 0) {
  // Update existing
  identified.copyrighted[existingIndex] = video;
  console.log('✅ Updated existing video in identified_videos.json');
} else {
  // Add new
  identified.copyrighted.push(video);
  console.log('✅ Added video to identified_videos.json');
}

writeJson(identifiedPath, identified);
