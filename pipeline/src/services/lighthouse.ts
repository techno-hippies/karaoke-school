/**
 * Lighthouse Storage Service (IPFS + Filecoin)
 *
 * Lighthouse provides "pay once, store forever" semantics.
 * Content gets an IPFS CID accessible via any IPFS gateway.
 * Filecoin deals provide long-term durability.
 *
 * @see https://docs.lighthouse.storage/
 */

import lighthouse from '@lighthouse-web3/sdk';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type { LighthouseUploadResult } from '../types';

// IPFS gateways for accessing uploaded content
export const IPFS_GATEWAYS = [
  'https://gateway.lighthouse.storage/ipfs',
  'https://ipfs.io/ipfs',
  'https://dweb.link/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://w3s.link/ipfs',
];

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const apiKey = process.env.LIGHTHOUSE_API_KEY;
  if (!apiKey) {
    throw new Error('LIGHTHOUSE_API_KEY environment variable not set');
  }
  return apiKey;
}

/**
 * Upload content to Lighthouse (IPFS + Filecoin)
 *
 * @param buffer - Content to upload
 * @param filename - Filename for the upload
 */
export async function uploadToLighthouse(
  buffer: Buffer,
  filename: string
): Promise<LighthouseUploadResult> {
  const apiKey = getApiKey();

  // Lighthouse SDK expects a file path, so we need to write to temp file
  const tempPath = join(tmpdir(), `lighthouse-${randomUUID()}-${filename}`);
  writeFileSync(tempPath, buffer);

  console.log(`   Uploading to Lighthouse: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)...`);

  try {
    const response = await lighthouse.upload(tempPath, apiKey);

    // Response structure: { data: { Name, Hash, Size } }
    const cid = response.data.Hash;

    if (!cid) {
      throw new Error('Lighthouse response missing CID/Hash');
    }

    return {
      cid,
      url: `${IPFS_GATEWAYS[0]}/${cid}`,
      urls: IPFS_GATEWAYS.map((gw) => `${gw}/${cid}`),
    };
  } finally {
    // Clean up temp file
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Upload JSON to Lighthouse
 */
export async function uploadJsonToLighthouse(
  data: unknown,
  filename = 'data.json'
): Promise<LighthouseUploadResult> {
  const json = JSON.stringify(data, null, 2);
  return uploadToLighthouse(Buffer.from(json), filename);
}

/**
 * Upload file from path to Lighthouse
 */
export async function uploadFileToLighthouse(
  filePath: string
): Promise<LighthouseUploadResult> {
  const apiKey = getApiKey();

  console.log(`   Uploading to Lighthouse: ${filePath}...`);

  const response = await lighthouse.upload(filePath, apiKey);
  const cid = response.data.Hash;

  if (!cid) {
    throw new Error('Lighthouse response missing CID/Hash');
  }

  return {
    cid,
    url: `${IPFS_GATEWAYS[0]}/${cid}`,
    urls: IPFS_GATEWAYS.map((gw) => `${gw}/${cid}`),
  };
}

/**
 * Get all gateway URLs for a CID
 */
export function getIpfsUrls(cid: string): string[] {
  return IPFS_GATEWAYS.map((gw) => `${gw}/${cid}`);
}

/**
 * Check if content exists on IPFS
 */
export async function checkIpfsContent(cid: string): Promise<boolean> {
  try {
    const response = await fetch(`${IPFS_GATEWAYS[0]}/${cid}`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get Filecoin deal status for a CID
 */
export async function getDealStatus(cid: string): Promise<unknown> {
  try {
    const response = await lighthouse.dealStatus(cid);
    return response.data;
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get account balance/usage
 */
export async function getLighthouseBalance(): Promise<{ dataUsed: number; dataLimit: number }> {
  const apiKey = getApiKey();
  const response = await lighthouse.getBalance(apiKey);
  return {
    dataUsed: response.data?.dataUsed ?? 0,
    dataLimit: response.data?.dataLimit ?? 0,
  };
}

/**
 * List uploaded files
 */
export async function getLighthouseUploads(): Promise<unknown[]> {
  const apiKey = getApiKey();
  const response = await lighthouse.getUploads(apiKey);
  return response.data?.fileList ?? [];
}
