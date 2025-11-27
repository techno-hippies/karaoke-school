/**
 * Grove Storage Service
 *
 * Upload files to Grove (Lens IPFS storage).
 * No API key required - POST directly to api.grove.storage with chain_id.
 */

import type { GroveUploadResult } from '../types';

const GROVE_API_URL = 'https://api.grove.storage';
const LENS_TESTNET_CHAIN_ID = 37111;

/**
 * Upload a file to Grove
 *
 * @param buffer - File buffer
 * @param filename - Filename with extension (for logging only)
 * @param mimeType - MIME type (e.g., 'audio/mpeg', 'video/mp4')
 * @returns Upload result with CID and URLs
 */
export async function uploadToGrove(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<GroveUploadResult> {
  const uploadUrl = `${GROVE_API_URL}/?chain_id=${LENS_TESTNET_CHAIN_ID}`;
  console.log(`   Uploading ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
    },
    body: buffer,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grove upload failed: ${response.status} - ${error}`);
  }

  const result = await response.json() as any;

  // Grove returns { storage_key: "..." } or [{ storage_key: "..." }]
  const cid = Array.isArray(result) ? result[0].storage_key : result.storage_key;
  if (!cid) {
    throw new Error('Grove response missing storage_key');
  }

  return {
    cid,
    url: `${GROVE_API_URL}/${cid}`,
    uri: `grove://${cid}`,
  };
}

/**
 * Upload JSON metadata to Grove
 */
export async function uploadMetadataToGrove(
  metadata: Record<string, unknown>,
  filename = 'metadata.json'
): Promise<GroveUploadResult> {
  const buffer = Buffer.from(JSON.stringify(metadata, null, 2));
  return uploadToGrove(buffer, filename, 'application/json');
}

/**
 * Upload audio file to Grove
 */
export async function uploadAudioToGrove(
  buffer: Buffer,
  filename: string
): Promise<GroveUploadResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
  return uploadToGrove(buffer, filename, mimeType);
}

/**
 * Upload video file to Grove
 */
export async function uploadVideoToGrove(
  buffer: Buffer,
  filename: string
): Promise<GroveUploadResult> {
  return uploadToGrove(buffer, filename, 'video/mp4');
}

/**
 * Upload ASS subtitle file to Grove
 */
export async function uploadSubtitlesToGrove(
  content: string,
  filename: string
): Promise<GroveUploadResult> {
  const buffer = Buffer.from(content);
  return uploadToGrove(buffer, filename, 'text/x-ssa');
}

/**
 * Upload image file to Grove
 */
export async function uploadImageToGrove(
  buffer: Buffer,
  filename: string
): Promise<GroveUploadResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  const mimeType = mimeTypes[ext || ''] || 'image/jpeg';
  return uploadToGrove(buffer, filename, mimeType);
}

/**
 * Download image from URL and upload to Grove
 */
export async function downloadAndUploadImageToGrove(
  imageUrl: string,
  filename: string
): Promise<GroveUploadResult> {
  console.log(`   Downloading image from ${imageUrl}...`);

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadImageToGrove(buffer, filename);
}
