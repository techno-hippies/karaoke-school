const DEFAULT_GATEWAY = process.env.GROVE_GATEWAY_URL || 'https://api.grove.storage';

/**
 * Convert grove://CID URI into a public HTTPS gateway URL
 */
export function groveUriToHttps(uri?: string | null): string | null {
  if (!uri) return null;
  if (!uri.startsWith('grove://')) {
    return uri;
  }

  const cid = uri.slice('grove://'.length);
  if (!cid) return null;

  const base = DEFAULT_GATEWAY.replace(/\/$/, '');
  return `${base}/${cid}`;
}

/**
 * Ensure grove:// prefix for a CID returned from Grove uploads
 */
export function toGroveUri(cid: string): string {
  return `grove://${cid}`;
}

/**
 * Determine if the provided value already references Grove storage
 */
export function isGroveUri(value?: string | null): boolean {
  if (!value) return false;
  return value.startsWith('grove://') || value.includes('api.grove.storage');
}

/**
 * Normalize Grove gateway URLs back to grove://CID form
 */
export function normalizeGroveUrl(value?: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('grove://')) {
    return value;
  }

  const match = value.match(/api\.grove\.storage\/([^/?#]+)/i);
  if (match && match[1]) {
    return toGroveUri(match[1]);
  }

  return value;
}

export const groveGatewayBase = DEFAULT_GATEWAY;
