/**
 * Demucs Service
 * GPU-accelerated vocal/instrumental separation with local/remote switching
 *
 * Supports two modes:
 * - 'local': Local GPU (RTX 3080) via http://localhost:8000
 * - 'remote': Remote API endpoint (future: Modal, Runpod, etc.)
 *
 * Automatically falls back to remote if local is unavailable.
 */

export type DemucsMode = 'local' | 'remote';

export interface DemucsResult {
  jobId: string;
  status: 'processing';
  mode: DemucsMode; // Track which backend was used
  message: string;
}

export interface DemucsWebhookPayload {
  job_id: string;
  status: 'completed' | 'failed';
  vocals_base64?: string;
  instrumental_base64?: string;
  vocals_size?: number;
  instrumental_size?: number;
  model?: string;
  format?: string;
  duration?: number;
  error?: string;
}

export class DemucsService {
  private mode: DemucsMode;
  private localEndpoint: string;
  private remoteEndpoint: string;
  private healthCache: Map<string, {timestamp: number, healthy: boolean}>;
  private cacheMaxAge = 30000; // 30 seconds

  constructor(
    mode: DemucsMode = 'local',
    localEndpoint?: string,
    remoteEndpoint?: string
  ) {
    this.mode = mode;
    this.localEndpoint = localEndpoint || 'http://localhost:8000';
    this.remoteEndpoint = remoteEndpoint || '';
    this.healthCache = new Map();
  }

  /**
   * Check if local endpoint is available
   * Cached for 30 seconds to avoid hammering the service
   */
  private async isLocalHealthy(): Promise<boolean> {
    const cacheKey = `local-health`;
    const cached = this.healthCache.get(cacheKey);

    // Return cached result if fresh
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return cached.healthy;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout (model loading can take 15s)

      const response = await fetch(`${this.localEndpoint}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isHealthy = response.ok;
      this.healthCache.set(cacheKey, {
        timestamp: Date.now(),
        healthy: isHealthy,
      });

      return isHealthy;
    } catch (error) {
      this.healthCache.set(cacheKey, {
        timestamp: Date.now(),
        healthy: false,
      });
      return false;
    }
  }

  /**
   * Submit async Demucs separation job
   *
   * Tries local GPU first (if mode=local), falls back to remote if unavailable.
   *
   * @param spotifyTrackId Spotify track ID (used as job ID)
   * @param audioUrl Public URL to audio file (Grove, S3, etc.)
   * @param webhookUrl URL to POST results when complete
   * @returns Job ID, status, and mode used
   * @throws Error if no backend available
   */
  async separateAsync(
    spotifyTrackId: string,
    audioUrl: string,
    webhookUrl: string
  ): Promise<DemucsResult> {
    // Determine which backend to use
    let useMode: DemucsMode = 'local';
    let endpoint = '';

    if (this.mode === 'local') {
      const localAvailable = await this.isLocalHealthy();
      if (localAvailable) {
        useMode = 'local';
        endpoint = this.localEndpoint;
        console.log(
          `[Demucs] Using local GPU at ${endpoint} for ${spotifyTrackId}`
        );
      } else if (this.remoteEndpoint) {
        // Fallback to remote
        useMode = 'remote';
        endpoint = this.remoteEndpoint;
        console.log(
          `[Demucs] Local GPU unavailable, falling back to remote for ${spotifyTrackId}`
        );
      } else {
        throw new Error(
          'Demucs local GPU unavailable and DEMUCS_REMOTE_ENDPOINT not configured'
        );
      }
    } else {
      // Mode is 'remote'
      if (!this.remoteEndpoint) {
        throw new Error('DEMUCS_MODE=remote but DEMUCS_REMOTE_ENDPOINT not configured');
      }
      useMode = 'remote';
      endpoint = this.remoteEndpoint;
      console.log(`[Demucs] Using remote endpoint at ${endpoint} for ${spotifyTrackId}`);
    }

    // Submit to selected endpoint
    const formData = new FormData();
    formData.append('job_id', spotifyTrackId);
    formData.append('audio_url', audioUrl);
    formData.append('webhook_url', webhookUrl);
    formData.append('model', 'mdx_extra');
    formData.append('output_format', 'mp3');
    formData.append('mp3_bitrate', '192');

    try {
      const response = await fetch(`${endpoint}/separate-async`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Demucs ${useMode} submission failed (${response.status}): ${errorText}`
        );
      }

      const result = await response.json() as any;

      return {
        jobId: result.job_id || spotifyTrackId,
        status: 'processing',
        mode: useMode,
        message: `Demucs separation started on ${useMode} backend`,
      };
    } catch (error: any) {
      throw new Error(
        `Demucs ${useMode} request failed: ${error.message}`
      );
    }
  }

  /**
   * Get the current mode configuration
   */
  getMode(): DemucsMode {
    return this.mode;
  }

  /**
   * Clear health cache (useful for testing)
   */
  clearHealthCache(): void {
    this.healthCache.clear();
  }
}

/**
 * Create a singleton instance from environment variables
 */
export function createDemucsService(): DemucsService {
  const mode = (process.env.DEMUCS_MODE || 'local') as DemucsMode;
  const localEndpoint = process.env.DEMUCS_LOCAL_ENDPOINT || 'http://localhost:8000';
  const remoteEndpoint = process.env.DEMUCS_REMOTE_ENDPOINT || '';

  return new DemucsService(mode, localEndpoint, remoteEndpoint);
}
