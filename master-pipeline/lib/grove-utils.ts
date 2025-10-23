/**
 * Grove URI Utilities
 *
 * Helper functions for converting between lens:// URIs and HTTP gateway URLs
 */

const GROVE_GATEWAY = 'https://api.grove.storage';

/**
 * Convert lens:// URI to HTTP gateway URL
 *
 * @param lensUri lens:// URI (e.g., lens://abc123...)
 * @returns HTTP gateway URL (e.g., https://api.grove.storage/abc123...)
 *
 * @example
 * lensToHttp('lens://abc123') // => 'https://api.grove.storage/abc123'
 */
export function lensToHttp(lensUri: string): string {
  if (!lensUri) {
    throw new Error('lensUri is required');
  }

  if (lensUri.startsWith('http://') || lensUri.startsWith('https://')) {
    // Already an HTTP URL, return as-is
    return lensUri;
  }

  if (!lensUri.startsWith('lens://')) {
    throw new Error(`Invalid lens:// URI: ${lensUri}`);
  }

  const hash = lensUri.replace('lens://', '');
  return `${GROVE_GATEWAY}/${hash}`;
}

/**
 * Convert HTTP gateway URL to lens:// URI
 *
 * @param httpUrl HTTP gateway URL (e.g., https://api.grove.storage/abc123...)
 * @returns lens:// URI (e.g., lens://abc123...)
 *
 * @example
 * httpToLens('https://api.grove.storage/abc123') // => 'lens://abc123'
 */
export function httpToLens(httpUrl: string): string {
  if (!httpUrl) {
    throw new Error('httpUrl is required');
  }

  if (httpUrl.startsWith('lens://')) {
    // Already a lens:// URI, return as-is
    return httpUrl;
  }

  if (!httpUrl.startsWith(GROVE_GATEWAY)) {
    throw new Error(`Invalid Grove gateway URL: ${httpUrl}`);
  }

  const hash = httpUrl.replace(`${GROVE_GATEWAY}/`, '');
  return `lens://${hash}`;
}

/**
 * Extract IPFS CID from lens:// URI or HTTP gateway URL
 *
 * @param uri lens:// URI or HTTP gateway URL
 * @returns IPFS CID hash
 *
 * @example
 * extractCid('lens://abc123') // => 'abc123'
 * extractCid('https://api.grove.storage/abc123') // => 'abc123'
 */
export function extractCid(uri: string): string {
  if (!uri) {
    throw new Error('uri is required');
  }

  if (uri.startsWith('lens://')) {
    return uri.replace('lens://', '');
  }

  if (uri.startsWith(GROVE_GATEWAY)) {
    return uri.replace(`${GROVE_GATEWAY}/`, '');
  }

  throw new Error(`Invalid URI format: ${uri}`);
}

/**
 * Check if a URI is a lens:// URI
 */
export function isLensUri(uri: string): boolean {
  return uri.startsWith('lens://');
}

/**
 * Check if a URL is a Grove HTTP gateway URL
 */
export function isGroveHttpUrl(url: string): boolean {
  return url.startsWith(GROVE_GATEWAY);
}

/**
 * Normalize URI to ensure it's an HTTP gateway URL
 * (converts lens:// to HTTP, leaves HTTP as-is)
 *
 * @param uri lens:// URI or HTTP URL
 * @returns HTTP gateway URL
 */
export function normalizeToHttp(uri: string): string {
  if (isLensUri(uri)) {
    return lensToHttp(uri);
  }
  return uri;
}

/**
 * Normalize URI to ensure it's a lens:// URI
 * (converts HTTP to lens://, leaves lens:// as-is)
 *
 * @param uri lens:// URI or HTTP URL
 * @returns lens:// URI
 */
export function normalizeToLens(uri: string): string {
  if (isGroveHttpUrl(uri)) {
    return httpToLens(uri);
  }
  return uri;
}
