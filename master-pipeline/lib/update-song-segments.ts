/**
 * Update song metadata to add registered segment
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Add segment hash to song's segments array
 *
 * @param geniusId Song's Genius ID
 * @param segmentHash Blockchain segment hash (0x...)
 */
export function addSegmentToSong(geniusId: number, segmentHash: string): void {
  const metadataPath = join(process.cwd(), 'data', 'metadata', `${geniusId}.json`);

  if (!existsSync(metadataPath)) {
    throw new Error(`Song metadata not found for geniusId ${geniusId}`);
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

  // Initialize segments array if it doesn't exist
  if (!metadata.segments) {
    metadata.segments = [];
  }

  // Add segment if not already present
  if (!metadata.segments.includes(segmentHash)) {
    metadata.segments.push(segmentHash);
    metadata.updatedAt = new Date().toISOString();

    writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`  ✓ Added segment ${segmentHash} to song ${geniusId}`);
  } else {
    console.log(`  ⚠️  Segment already in song metadata`);
  }
}
