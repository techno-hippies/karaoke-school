/**
 * Multi-Layer Storage Orchestrator
 *
 * Uploads content to Grove (primary) + Arweave + Lighthouse (full redundancy).
 * Grove URLs remain backwards-compatible in existing columns.
 * Arweave/Lighthouse stored in storage_manifest JSONB.
 *
 * Upload Strategy (FULL REDUNDANCY):
 * - All content → Grove + Lighthouse + Arweave (when possible)
 * - Arweave <100KB: Free via Turbo
 * - Arweave >100KB: Requires funded wallet (skipped if not available)
 * - Lighthouse: Always (5GB free quota)
 */

import { createHash } from 'crypto';
import { uploadToArweave, getArweaveUrls, isWithinFreeLimit } from './arweave';
import { uploadToLighthouse, getIpfsUrls } from './lighthouse';
import { uploadToGrove, uploadImageToGrove, uploadAudioToGrove } from './grove';
import type {
  StorageLayer,
  StorageManifest,
  StorageLayerResult,
  MultiLayerUploadResult,
  GroveUploadResult,
  ArweaveUploadResult,
  LighthouseUploadResult,
} from '../types';

// Re-export for convenience
export { isWithinFreeLimit } from './arweave';

// 100KB limit for free Arweave uploads
const ARWEAVE_FREE_LIMIT = 100 * 1024;

export interface UploadOptions {
  /** Which layers to upload to (default: auto based on size) */
  layers?: StorageLayer[];
  /** Content type for proper handling */
  contentType: 'audio' | 'video' | 'json' | 'image';
  /** MIME type for upload headers */
  mimeType: string;
  /** Filename for logging/metadata */
  filename: string;
  /** Path to Arweave JWK wallet (optional, uses ARWEAVE_WALLET env var) */
  arweaveJwkPath?: string;
  /** Force Arweave upload even if over 100KB (requires funded wallet) */
  forceArweave?: boolean;
}

/**
 * Determine which layers to upload to
 *
 * FULL REDUNDANCY: Always upload to all three layers
 * - Grove: Primary (always)
 * - Lighthouse: IPFS + Filecoin (always - 5GB free)
 * - Arweave: Permanent (free <100KB, or if forceArweave with funded wallet)
 */
function getDefaultLayers(sizeBytes: number, forceArweave = false): StorageLayer[] {
  // Always include Grove and Lighthouse
  const layers: StorageLayer[] = ['grove', 'lighthouse'];

  // Include Arweave if small enough for free upload, or if forced
  if (forceArweave || sizeBytes <= ARWEAVE_FREE_LIMIT) {
    layers.push('arweave');
  }

  return layers;
}

/**
 * Upload content to multiple storage layers
 *
 * Grove is always first (primary/backwards-compatible).
 * Secondary layer is Arweave (small files) or Lighthouse (large files).
 */
export async function uploadToMultipleLayers(
  content: Buffer,
  options: UploadOptions
): Promise<MultiLayerUploadResult> {
  const layers = options.layers ?? getDefaultLayers(content.length, options.forceArweave);

  // Calculate content hash for integrity verification
  const sha256 = createHash('sha256').update(content).digest('hex');

  const results: StorageLayerResult[] = [];
  let groveResult: GroveUploadResult | undefined;
  let arweaveResult: ArweaveUploadResult | undefined;
  let lighthouseResult: LighthouseUploadResult | undefined;

  // Upload to Grove first (primary layer)
  if (layers.includes('grove')) {
    try {
      groveResult = await uploadToGrove(content, options.filename, options.mimeType);
      results.push({
        layer: 'grove',
        success: true,
        identifier: groveResult.cid,
        url: groveResult.url,
        urls: [groveResult.url],
      });
    } catch (error) {
      results.push({
        layer: 'grove',
        success: false,
        identifier: '',
        url: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Upload to Arweave (small files, metadata)
  if (layers.includes('arweave')) {
    try {
      arweaveResult = await uploadToArweave(
        content,
        options.filename,
        { contentType: options.mimeType },
        options.arweaveJwkPath
      );
      results.push({
        layer: 'arweave',
        success: true,
        identifier: arweaveResult.txId,
        url: arweaveResult.url,
        urls: arweaveResult.urls,
      });
    } catch (error) {
      results.push({
        layer: 'arweave',
        success: false,
        identifier: '',
        url: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Upload to Lighthouse (large files)
  if (layers.includes('lighthouse')) {
    try {
      lighthouseResult = await uploadToLighthouse(content, options.filename);
      results.push({
        layer: 'lighthouse',
        success: true,
        identifier: lighthouseResult.cid,
        url: lighthouseResult.url,
        urls: lighthouseResult.urls,
      });
    } catch (error) {
      results.push({
        layer: 'lighthouse',
        success: false,
        identifier: '',
        url: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Build storage manifest for JSONB column
  const manifest: StorageManifest = {
    contentHash: sha256,
    sizeBytes: content.length,
    mimeType: options.mimeType,
    uploadedAt: new Date().toISOString(),
  };

  if (groveResult) {
    manifest.grove = {
      cid: groveResult.cid,
      url: groveResult.url,
    };
  }

  if (arweaveResult) {
    manifest.arweave = {
      txId: arweaveResult.txId,
      url: arweaveResult.url,
      urls: arweaveResult.urls,
    };
  }

  if (lighthouseResult) {
    manifest.lighthouse = {
      cid: lighthouseResult.cid,
      url: lighthouseResult.url,
      urls: lighthouseResult.urls,
    };
  }

  return {
    contentHash: sha256,
    results,
    manifest,
    // Convenience: primary URL is always Grove
    primaryUrl: groveResult?.url ?? results.find((r) => r.success)?.url ?? '',
  };
}

/**
 * Upload JSON metadata to storage layers
 * Full redundancy: Grove + Lighthouse + Arweave (if <100KB)
 */
export async function uploadJsonToLayers(
  data: unknown,
  filename = 'metadata.json',
  options?: Partial<UploadOptions>
): Promise<MultiLayerUploadResult> {
  const json = JSON.stringify(data, null, 2);
  const buffer = Buffer.from(json);

  // Let getDefaultLayers determine based on size
  return uploadToMultipleLayers(buffer, {
    contentType: 'json',
    mimeType: 'application/json',
    filename,
    ...options,
  });
}

/**
 * Upload audio to storage layers
 * Full redundancy: Grove + Lighthouse (Arweave only if forced with funded wallet)
 */
export async function uploadAudioToLayers(
  content: Buffer,
  filename: string,
  options?: Partial<UploadOptions>
): Promise<MultiLayerUploadResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';

  // Let getDefaultLayers determine based on size
  return uploadToMultipleLayers(content, {
    contentType: 'audio',
    mimeType,
    filename,
    ...options,
  });
}

/**
 * Upload image to storage layers
 * Images go to Grove + Lighthouse (usually >100KB)
 */
export async function uploadImageToLayers(
  content: Buffer,
  filename: string,
  options?: Partial<UploadOptions>
): Promise<MultiLayerUploadResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  const mimeType = mimeTypes[ext ?? ''] ?? 'image/jpeg';

  return uploadToMultipleLayers(content, {
    contentType: 'image',
    mimeType,
    filename,
    // Auto-select based on size
    ...options,
  });
}

/**
 * Upload video to storage layers
 * Full redundancy: Grove + Lighthouse (Arweave only if forced with funded wallet)
 */
export async function uploadVideoToLayers(
  content: Buffer,
  filename: string,
  options?: Partial<UploadOptions>
): Promise<MultiLayerUploadResult> {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeType = ext === 'webm' ? 'video/webm' : 'video/mp4';

  // Let getDefaultLayers determine based on size
  return uploadToMultipleLayers(content, {
    contentType: 'video',
    mimeType,
    filename,
    ...options,
  });
}

/**
 * Upload file from path to storage layers
 */
export async function uploadFileToLayers(
  filePath: string,
  options?: Partial<UploadOptions>
): Promise<MultiLayerUploadResult> {
  const file = Bun.file(filePath);
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = filePath.split('/').pop() ?? 'file';

  // Infer content type from extension
  const ext = filename.split('.').pop()?.toLowerCase();
  let contentType: 'audio' | 'video' | 'json' | 'image' = 'image';
  let mimeType = 'application/octet-stream';

  if (['mp3', 'wav', 'flac', 'm4a'].includes(ext ?? '')) {
    contentType = 'audio';
    mimeType = ext === 'wav' ? 'audio/wav' : 'audio/mpeg';
  } else if (['mp4', 'webm', 'mov'].includes(ext ?? '')) {
    contentType = 'video';
    mimeType = ext === 'webm' ? 'video/webm' : 'video/mp4';
  } else if (ext === 'json') {
    contentType = 'json';
    mimeType = 'application/json';
  } else if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext ?? '')) {
    contentType = 'image';
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    mimeType = mimeTypes[ext ?? ''] ?? 'image/jpeg';
  }

  return uploadToMultipleLayers(buffer, {
    contentType,
    mimeType,
    filename,
    ...options,
  });
}

/**
 * Get all available URLs for content from a storage manifest
 * Ordered by preference: Grove (fast) → Lighthouse (IPFS) → Arweave (permanent)
 */
export function getUrlsFromManifest(manifest: StorageManifest): string[] {
  const urls: string[] = [];

  if (manifest.grove?.url) {
    urls.push(manifest.grove.url);
  }

  if (manifest.lighthouse?.urls) {
    urls.push(...manifest.lighthouse.urls);
  } else if (manifest.lighthouse?.url) {
    urls.push(manifest.lighthouse.url);
  }

  if (manifest.arweave?.urls) {
    urls.push(...manifest.arweave.urls);
  } else if (manifest.arweave?.url) {
    urls.push(manifest.arweave.url);
  }

  return urls;
}

/**
 * Print upload results for CLI output
 */
export function printUploadResults(result: MultiLayerUploadResult): void {
  console.log('\n📦 Multi-Layer Upload Results');
  console.log('─'.repeat(50));
  console.log(`Content Hash: ${result.contentHash}`);
  console.log(`Primary URL: ${result.primaryUrl}`);
  console.log('');

  for (const r of result.results) {
    const icon = r.success ? '✅' : '❌';
    console.log(`${icon} ${r.layer.toUpperCase()}`);
    if (r.success) {
      console.log(`   ID: ${r.identifier}`);
      console.log(`   URL: ${r.url}`);
    } else {
      console.log(`   Error: ${r.error}`);
    }
    console.log('');
  }
}
