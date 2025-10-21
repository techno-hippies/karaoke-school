/**
 * Grove Storage utilities
 * Converts lens:// protocol URIs to HTTP gateway URLs
 */

const GROVE_GATEWAY = 'https://api.grove.storage'

/**
 * Convert a lens:// URI to an HTTP URL using Grove gateway
 * @param uri - The lens:// URI to convert
 * @returns HTTP URL for accessing the content
 */
export function lensUriToHttp(uri: string): string {
  if (uri.startsWith('lens://')) {
    const hash = uri.replace('lens://', '')
    return `${GROVE_GATEWAY}/${hash}`
  }
  return uri
}

/**
 * Convert a grove:// URI to an HTTP URL using Grove gateway
 * @param uri - The grove:// URI to convert
 * @returns HTTP URL for accessing the content
 */
export function groveUriToHttp(uri: string): string {
  if (uri.startsWith('grove://')) {
    const hash = uri.replace('grove://', '')
    return `${GROVE_GATEWAY}/${hash}`
  }
  return uri
}
