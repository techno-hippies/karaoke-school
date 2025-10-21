/**
 * Build Segment Metadata
 *
 * Creates segment metadata with cropped lyrics for copyright compliance
 * This file is uploaded to Grove as alignmentUri
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { validateSegmentAlignmentMetadata } from '../../lib/schemas/segment.js';

export interface SegmentLyrics {
  plain: string;
  synced: Array<{
    start: number;
    text: string;
  }>;
}

export interface SegmentMetadata {
  version: string;
  geniusId: number;
  segmentHash: string;
  tiktokMusicId: string;
  timeRange: {
    startTime: number;
    endTime: number;
    duration: number;
  };
  lyrics: {
    en?: SegmentLyrics;
    lrclib: {
      id: number;
      source: string;
    };
  };
  blockchain: {
    segmentHash: string;
    registeredAt: string;
    transactionHash: string;
  };
  createdAt: string;
}

/**
 * Crop alignment data to segment timeframe
 *
 * @param fullAlignment Full song alignment from ElevenLabs (825 words for entire song)
 * @param startTime Segment start time in seconds
 * @param endTime Segment end time in seconds
 * @returns Cropped synced lyrics for this segment only
 */
export function cropAlignmentToSegment(
  fullAlignment: Array<{ start: number; text: string }>,
  startTime: number,
  endTime: number
): SegmentLyrics {
  // Filter words within segment timeframe
  const segmentWords = fullAlignment.filter(
    (word) => word.start >= startTime && word.start <= endTime
  );

  // Adjust timestamps to be relative to segment start (0-based)
  const adjustedWords = segmentWords.map((word) => ({
    start: word.start - startTime,
    text: word.text,
  }));

  // Create plain text (spaces already in data, don't add more)
  const plain = adjustedWords.map((w) => w.text).join('');

  return {
    plain,
    synced: adjustedWords,
  };
}

/**
 * Build complete segment metadata
 *
 * @param segmentDir Path to segment directory
 * @param segmentHash Blockchain segment hash
 * @param transactionHash Transaction hash from registration
 * @returns Segment metadata ready for Grove upload
 */
export function buildSegmentMetadata(
  segmentDir: string,
  segmentHash: string,
  transactionHash: string
): SegmentMetadata {
  // Load manifest
  const manifestPath = join(segmentDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  // Load match result (contains full alignment)
  const matchPath = join(segmentDir, 'match.json');
  const matchResult = JSON.parse(readFileSync(matchPath, 'utf-8'));

  // Load song metadata for LRCLib reference
  const songMetadataPath = join(
    process.cwd(),
    'data',
    'metadata',
    `${manifest.geniusId}.json`
  );
  const songMetadata = JSON.parse(readFileSync(songMetadataPath, 'utf-8'));

  // Build cropped lyrics (only for this segment)
  let lyrics: SegmentMetadata['lyrics'] = {
    lrclib: {
      id: matchResult.lrcMatch.id,
      source: 'lrclib',
    },
  };

  // If we have alignment data, crop it to segment
  // Note: This would come from the full ElevenLabs alignment stored during matching
  // For now, we'll need to add this to the match result
  if (matchResult.fullAlignment) {
    const croppedLyrics = cropAlignmentToSegment(
      matchResult.fullAlignment,
      manifest.match.startTime,
      manifest.match.endTime
    );

    lyrics.en = croppedLyrics;
  }

  const metadata: SegmentMetadata = {
    version: '1.0.0',
    geniusId: manifest.geniusId,
    segmentHash,
    tiktokMusicId: manifest.tiktokMusicId,
    timeRange: {
      startTime: manifest.match.startTime,
      endTime: manifest.match.endTime,
      duration: manifest.match.duration,
    },
    lyrics,
    blockchain: {
      segmentHash,
      registeredAt: new Date().toISOString(),
      transactionHash,
    },
    createdAt: manifest.createdAt,
  };

  // Validate before returning
  return validateSegmentAlignmentMetadata(metadata);
}
