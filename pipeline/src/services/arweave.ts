/**
 * Arweave Storage Service (via Turbo SDK)
 *
 * Uses ArDrive Turbo for uploading to Arweave L1.
 * Data ends up on the real Arweave network, accessible via any Arweave gateway.
 *
 * FREE uploads under 100KB using authenticated client (Turbo gives free credits).
 * For larger files, need funded wallet with $AR.
 *
 * @see https://docs.ardrive.io/docs/turbo/
 */

import { TurboFactory, ArweaveSigner } from '@ardrive/turbo-sdk/node';
import { Readable } from 'stream';
import type { ArweaveUploadResult } from '../types';

// Free upload limit (100KB) - Turbo gives free credits for small files
const FREE_UPLOAD_LIMIT = 100 * 1024;

// Arweave gateways for accessing uploaded content
export const ARWEAVE_GATEWAYS = [
  'https://arweave.net',
  'https://ar-io.dev',
  'https://g8way.io',
];

export interface ArweaveUploadOptions {
  contentType?: string;
  tags?: { name: string; value: string }[];
}

/**
 * Create authenticated Turbo client from JWK wallet file
 */
async function createTurboClient(jwkPath?: string) {
  const walletPath = jwkPath ?? process.env.ARWEAVE_WALLET ?? './arweave-key.json';

  try {
    const jwkRaw = await Bun.file(walletPath).text();
    const jwk = JSON.parse(jwkRaw);
    const signer = new ArweaveSigner(jwk);
    return TurboFactory.authenticated({ signer });
  } catch (error) {
    throw new Error(`Failed to load Arweave wallet from ${walletPath}: ${error}`);
  }
}

/**
 * Upload content to Arweave via Turbo
 *
 * Files under 100KB: FREE (uses Turbo free credits)
 * Files over 100KB: Requires funded wallet with $AR
 *
 * @param buffer - Content to upload
 * @param filename - Original filename (for content-type inference)
 * @param options - Upload options (content type, tags)
 * @param jwkPath - Path to Arweave JWK wallet file
 */
export async function uploadToArweave(
  buffer: Buffer,
  filename: string,
  options: ArweaveUploadOptions = {},
  jwkPath?: string
): Promise<ArweaveUploadResult> {
  const turbo = await createTurboClient(jwkPath);

  // Infer content type from filename if not provided
  const contentType = options.contentType ?? inferContentType(filename);

  // Default tags
  const tags = [
    { name: 'Content-Type', value: contentType },
    { name: 'App-Name', value: 'karaoke-school' },
    { name: 'App-Version', value: '1.0.0' },
    ...(options.tags ?? []),
  ];

  console.log(`   Uploading to Arweave: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)...`);

  if (buffer.length > FREE_UPLOAD_LIMIT) {
    console.log(`   ⚠️  File exceeds 100KB free limit, requires funded wallet`);
  }

  const result = await turbo.uploadFile({
    fileStreamFactory: () => Readable.from(buffer),
    fileSizeFactory: () => buffer.length,
    dataItemOpts: { tags },
  });

  const txId = result.id;

  return {
    txId,
    url: `${ARWEAVE_GATEWAYS[0]}/${txId}`,
    urls: ARWEAVE_GATEWAYS.map((gw) => `${gw}/${txId}`),
  };
}

/**
 * Upload JSON to Arweave (usually under 100KB, so free)
 */
export async function uploadJsonToArweave(
  data: unknown,
  filename = 'data.json',
  jwkPath?: string
): Promise<ArweaveUploadResult> {
  const json = JSON.stringify(data, null, 2);
  return uploadToArweave(Buffer.from(json), filename, { contentType: 'application/json' }, jwkPath);
}

/**
 * Upload file from path to Arweave
 */
export async function uploadFileToArweave(
  filePath: string,
  jwkPath?: string
): Promise<ArweaveUploadResult> {
  const file = Bun.file(filePath);
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = filePath.split('/').pop() ?? 'file';
  return uploadToArweave(buffer, filename, {}, jwkPath);
}

/**
 * Get all gateway URLs for a transaction
 */
export function getArweaveUrls(txId: string): string[] {
  return ARWEAVE_GATEWAYS.map((gw) => `${gw}/${txId}`);
}

/**
 * Check if content exists on Arweave
 */
export async function checkArweaveContent(txId: string): Promise<boolean> {
  try {
    const response = await fetch(`${ARWEAVE_GATEWAYS[0]}/${txId}`, {
      method: 'HEAD',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get Turbo balance for authenticated wallet
 */
export async function getTurboBalance(jwkPath?: string): Promise<{ winc: string; ar: number }> {
  const turbo = await createTurboClient(jwkPath);
  const balance = await turbo.getBalance();
  // Convert Winston to AR (1 AR = 10^12 Winston)
  const ar = Number(balance.winc) / 1e12;
  return { winc: balance.winc.toString(), ar };
}

/**
 * Check if file size is within free upload limit
 */
export function isWithinFreeLimit(sizeBytes: number): boolean {
  return sizeBytes <= FREE_UPLOAD_LIMIT;
}

/**
 * Infer content type from filename
 */
function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    json: 'application/json',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    txt: 'text/plain',
  };
  return types[ext ?? ''] ?? 'application/octet-stream';
}
