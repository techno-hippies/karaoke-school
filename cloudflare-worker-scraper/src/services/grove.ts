/**
 * Grove Storage Service
 * Decentralized IPFS storage via Lens Network
 */

export interface GroveUploadResult {
  cid: string;
  uri: string;  // lens://...
  gatewayUrl: string;
  size: number;
}

export class GroveService {
  private chainId: number;

  constructor(chainId: number = 37111) {
    this.chainId = chainId;  // 37111 = Lens testnet, 7579 = mainnet
  }

  /**
   * Upload base64-encoded data to Grove
   *
   * @param base64Data Base64 string (without data URI prefix)
   * @param contentType MIME type (e.g., 'audio/mp3')
   * @returns Grove CID and URLs
   */
  async uploadBase64(base64Data: string, contentType: string = 'audio/mp3'): Promise<GroveUploadResult> {
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return await this.uploadBytes(bytes, contentType);
  }

  /**
   * Upload binary data to Grove
   *
   * @param data Uint8Array of file data
   * @param contentType MIME type
   * @returns Grove CID and URLs
   */
  async uploadBytes(data: Uint8Array, contentType: string = 'audio/mp3'): Promise<GroveUploadResult> {
    const response = await fetch(`https://api.grove.storage/?chain_id=${this.chainId}`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType
      },
      body: data
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grove upload failed (${response.status}): ${errorText}`);
    }

    const results = await response.json();
    const groveData = results[0];

    // Extract CID from URI (lens://abc123 -> abc123)
    const cid = groveData.uri.replace('lens://', '');

    return {
      cid,
      uri: groveData.uri,
      gatewayUrl: groveData.gateway_url,
      size: data.length
    };
  }

  /**
   * Upload from URL (download then upload to Grove)
   *
   * @param sourceUrl URL to download from
   * @param contentType MIME type
   * @returns Grove CID and URLs
   */
  async uploadFromUrl(sourceUrl: string, contentType: string = 'audio/mp3'): Promise<GroveUploadResult> {
    // Download from source
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download from ${sourceUrl}: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    return await this.uploadBytes(data, contentType);
  }
}
