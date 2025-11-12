import { StorageService } from '../services/storage';
import { groveUriToHttps, toGroveUri, isGroveUri, normalizeGroveUrl } from '../utils/grove';

interface AvatarCacheParams {
  username: string;
  sourceUrl?: string | null;
  existingAvatarUrl?: string | null;
  existingSourceUrl?: string | null;
  existingUploadedAt?: string | Date | null;
  forceRefresh?: boolean;
}

export interface AvatarCacheResult {
  avatarUrl: string | null;
  avatarSourceUrl: string | null;
  avatarUploadedAt: Date | null;
  uploaded: boolean;
  publicUrl: string | null;
}

const storage = new StorageService();

/**
 * Ensure we have a Grove-hosted avatar for a TikTok creator.
 * Will reuse cached uploads until TikTok source URL changes or forceRefresh is true.
 */
export async function ensureCreatorAvatarCached(params: AvatarCacheParams): Promise<AvatarCacheResult> {
  const normalizedExistingAvatar = normalizeGroveUrl(params.existingAvatarUrl);
  const normalizedExistingSource = normalizeTikTokAvatarUrl(params.existingSourceUrl);
  const normalizedSourceUrl = normalizeTikTokAvatarUrl(params.sourceUrl) || normalizedExistingSource;
  const existingUploadedAt = params.existingUploadedAt
    ? new Date(params.existingUploadedAt)
    : null;

  if (!normalizedSourceUrl) {
    return {
      avatarUrl: normalizedExistingAvatar,
      avatarSourceUrl: normalizedExistingSource,
      avatarUploadedAt: existingUploadedAt,
      uploaded: false,
      publicUrl: normalizedExistingAvatar ? groveUriToHttps(normalizedExistingAvatar) : null,
    };
  }

  const alreadyCached =
    !params.forceRefresh &&
    normalizedExistingAvatar &&
    isGroveUri(normalizedExistingAvatar) &&
    normalizedExistingSource === normalizedSourceUrl;

  if (alreadyCached) {
    return {
      avatarUrl: normalizedExistingAvatar,
      avatarSourceUrl: normalizedSourceUrl,
      avatarUploadedAt: existingUploadedAt,
      uploaded: false,
      publicUrl: groveUriToHttps(normalizedExistingAvatar),
    };
  }

  const { buffer, contentType } = await downloadAvatar(normalizedSourceUrl);
  const extension = guessExtension(contentType, normalizedSourceUrl);
  const fileName = `tiktok-avatar-${params.username}-${Date.now()}.${extension}`;

  const uploadResult = await storage.uploadToGrove(buffer, contentType, fileName);
  const groveUri = toGroveUri(uploadResult.cid);

  return {
    avatarUrl: groveUri,
    avatarSourceUrl: normalizedSourceUrl,
    avatarUploadedAt: new Date(),
    uploaded: true,
    publicUrl: uploadResult.url,
  };
}

function normalizeTikTokAvatarUrl(raw?: string | null): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;

  // Decode escaped forward slashes returned by TikTok JSON blobs
  value = value.replace(/\\u002F/gi, '/').replace(/u002F/gi, '/');

  // If URL accidentally lost slashes after protocol, collapse duplicates
  value = value.replace(/https?:\/+/gi, (match) =>
    match.toLowerCase().startsWith('https') ? 'https://' : 'http://'
  );

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }

  return value;
}

async function downloadAvatar(url: string): Promise<{ buffer: Buffer; contentType: string }>
{
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'karaoke-school-avatar-cache/1.0',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: 'https://www.tiktok.com/',
    },
  });

  if (!response.ok) {
    throw new Error(`Avatar download failed (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

function guessExtension(contentType: string, url: string): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';

  const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  return 'jpg';
}
