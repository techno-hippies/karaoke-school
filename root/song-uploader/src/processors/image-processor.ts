#!/usr/bin/env bun

/**
 * Image processing utilities for song covers and thumbnails
 * Generates 300x300 thumbnails from high-res song covers
 */

import { existsSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const THUMBNAIL_SIZE = 300;
const THUMBNAIL_QUALITY = 85;

/**
 * Generate a 300x300 thumbnail from a high-res cover image
 * Uses center crop to maintain aspect ratio
 */
export async function generateThumbnail(
  inputPath: string,
  outputPath: string,
  size: number = THUMBNAIL_SIZE
): Promise<void> {
  try {
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'cover',        // Crop to fill the dimensions
        position: 'center',  // Center the crop
      })
      .png({
        quality: THUMBNAIL_QUALITY,
        compressionLevel: 9  // Max compression for smaller file size
      })
      .toFile(outputPath);

    console.log(`  ✅ Generated thumbnail: ${outputPath}`);
  } catch (error) {
    console.error(`  ❌ Failed to generate thumbnail:`, error);
    throw error;
  }
}

/**
 * Process images for a song:
 * - Checks for song-cover.png
 * - Generates song-cover-thumb.png if it doesn't exist
 */
export async function processSongImages(
  songDir: string,
  force: boolean = false
): Promise<{
  hasCover: boolean;
  hasThumbnail: boolean;
  coverPath: string | null;
  thumbnailPath: string | null;
}> {
  const coverPath = join(songDir, 'song-cover.png');
  const thumbPath = join(songDir, 'song-cover-thumb.png');

  const hasCover = existsSync(coverPath);
  let hasThumbnail = existsSync(thumbPath);

  if (!hasCover) {
    console.log(`  ⚠️  No song-cover.png found`);
    return {
      hasCover: false,
      hasThumbnail: false,
      coverPath: null,
      thumbnailPath: null,
    };
  }

  // Generate thumbnail if it doesn't exist or if forced
  if (!hasThumbnail || force) {
    console.log(`  🖼️  Generating 300x300 thumbnail...`);
    await generateThumbnail(coverPath, thumbPath);
    hasThumbnail = true;
  } else {
    console.log(`  ✓ Thumbnail already exists`);
  }

  return {
    hasCover: true,
    hasThumbnail: true,
    coverPath,
    thumbnailPath: thumbPath,
  };
}

/**
 * Get image files for upload
 */
export async function getImageFilesForUpload(
  songDir: string
): Promise<{
  cover: File | null;
  thumbnail: File | null;
}> {
  const coverPath = join(songDir, 'song-cover.png');
  const thumbPath = join(songDir, 'song-cover-thumb.png');

  let cover: File | null = null;
  let thumbnail: File | null = null;

  if (existsSync(coverPath)) {
    const coverData = await Bun.file(coverPath).arrayBuffer();
    cover = new File([coverData], 'song-cover.png', { type: 'image/png' });
  }

  if (existsSync(thumbPath)) {
    const thumbData = await Bun.file(thumbPath).arrayBuffer();
    thumbnail = new File([thumbData], 'song-cover-thumb.png', { type: 'image/png' });
  }

  return { cover, thumbnail };
}
