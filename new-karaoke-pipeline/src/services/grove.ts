/**
 * Grove Storage Service
 * Uploads audio files to Grove API
 */

export interface GroveUploadResult {
  cid: string;        // Storage key
  url: string;        // Public Grove URL
  size: number;       // File size in bytes
  timestamp: Date;
}

export interface UploadProgress {
  bytesUploaded: number;
  totalBytes: number;
  percentComplete: number;
}

export class GroveService {
  private groveApiUrl: string;
  private chainId: number;
  private maxRetries: number = 3;
  private retryDelayMs: number = 1000;

  constructor(chainId: number = 37111) {
    this.groveApiUrl = 'https://api.grove.storage';
    this.chainId = chainId; // 37111 = Lens Testnet, 232 = Lens Mainnet
  }

  /**
   * Upload audio file to Grove/Irys
   *
   * @param base64Audio Base64-encoded audio data (e.g., from Demucs webhook)
   * @param fileName Descriptive filename for logging
   * @param audioType Type of audio (instrumental, vocal, etc.)
   * @returns Upload result with CID and public URL
   * @throws Error on upload failure
   */
  async uploadAudio(
    base64Audio: string,
    fileName: string,
    audioType: 'instrumental' | 'vocal' = 'instrumental'
  ): Promise<GroveUploadResult> {
    // Decode base64 to bytes
    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const fileSizeKb = (audioBuffer.length / 1024).toFixed(2);

    console.log(
      `[Grove] Uploading ${audioType} audio: ${fileName} (${fileSizeKb} KB)`
    );

    // Retry logic
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this._uploadWithRetry(audioBuffer, fileName);
        console.log(
          `[Grove] ✓ Upload successful on attempt ${attempt}: ${result.cid}`
        );
        return result;
      } catch (error: any) {
        lastError = error;
        console.warn(
          `[Grove] Attempt ${attempt}/${this.maxRetries} failed: ${error.message}`
        );

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < this.maxRetries) {
          const delayMs = this.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    throw new Error(
      `Grove upload failed after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Internal: Upload with Grove API
   * Posts file data and receives storage_key
   */
  private async _uploadWithRetry(
    audioBuffer: Buffer,
    fileName: string
  ): Promise<GroveUploadResult> {
    const uploadUrl = `${this.groveApiUrl}/?chain_id=${this.chainId}`;

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/mpeg',
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Grove API error (${response.status}): ${errorText}`
        );
      }

      const result = await response.json() as any;

      // Grove returns { storage_key: "..." } or [{ storage_key: "..." }]
      const cid = Array.isArray(result) ? result[0].storage_key : result.storage_key;
      if (!cid) {
        throw new Error('Grove response missing storage_key');
      }

      return {
        cid,
        url: `${this.groveApiUrl}/${cid}`,
        size: audioBuffer.length,
        timestamp: new Date(),
      };
    } catch (error: any) {
      throw new Error(
        `Grove upload failed: ${error.message}`
      );
    }
  }

  /**
   * Download audio from Grove/IPFS
   * Useful for verification after upload
   *
   * @param cid IPFS Content Identifier
   * @returns Audio file as Buffer
   */
  async downloadAudio(cid: string): Promise<Buffer> {
    const url = `${this.nodeUrl}/download/${cid}`;

    console.log(`[Grove] Downloading from ${cid}...`);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      throw new Error(
        `Grove download failed: ${error.message}`
      );
    }
  }

  /**
   * Get file metadata from Irys (size, timestamp, etc.)
   *
   * @param cid IPFS Content Identifier
   * @returns File metadata
   */
  async getFileMetadata(cid: string): Promise<Record<string, any>> {
    const url = `${this.nodeUrl}/metadata/${cid}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Metadata request failed (${response.status})`);
      }

      return await response.json();
    } catch (error: any) {
      throw new Error(
        `Grove metadata request failed: ${error.message}`
      );
    }
  }

  /**
   * Create public Grove URL from CID
   */
  static createGroveUrl(cid: string): string {
    return `grove://${cid}`;
  }

  /**
   * Parse CID from Grove URL
   */
  static parseGroveUrl(url: string): string | null {
    const match = url.match(/^grove:\/\/(.+)$/);
    return match ? match[1] : null;
  }
}

/**
 * Create a Grove service instance (Lens Testnet by default)
 */
export function createGroveService(): GroveService {
  return new GroveService(); // Uses 37111 (Lens Testnet) by default
}

// Note: uploadToGrove() has been consolidated to src/services/storage.ts
// All processors should import from storage.ts for unified storage handling
