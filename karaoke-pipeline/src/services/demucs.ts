/**
 * Demucs Service
 * GPU-accelerated vocal/instrumental separation with local/remote switching
 *
 * Supports three modes:
 * - 'local': Local GPU (RTX 3080) via http://localhost:8000
 * - 'remote': Remote API endpoint (Modal, etc.)
 * - 'runpod': RunPod serverless GPU (polls for completion, no webhook)
 *
 * Automatically falls back to remote if local is unavailable.
 */

export type DemucsMode = 'local' | 'remote' | 'runpod';

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
  private runpodEndpointId: string;
  private runpodApiKey: string;
  private healthCache: Map<string, {timestamp: number, healthy: boolean}>;
  private cacheMaxAge = 30000; // 30 seconds

  constructor(
    mode: DemucsMode = 'local',
    localEndpoint?: string,
    remoteEndpoint?: string,
    runpodEndpointId?: string,
    runpodApiKey?: string
  ) {
    this.mode = mode;
    this.localEndpoint = localEndpoint || 'http://localhost:8000';
    this.remoteEndpoint = remoteEndpoint || '';
    this.runpodEndpointId = runpodEndpointId || '';
    this.runpodApiKey = runpodApiKey || '';
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
   * Submit job to RunPod and poll for completion (no webhook)
   *
   * @param spotifyTrackId Spotify track ID (used as job ID)
   * @param audioUrl Public URL to audio file (Grove, S3, etc.)
   * @returns Completed job with Grove URLs
   * @throws Error if job fails or times out
   */
  async separateWithRunPod(
    spotifyTrackId: string,
    audioUrl: string
  ): Promise<{
    vocals_grove_url: string;
    instrumental_grove_url: string;
    vocals_grove_cid: string;
    instrumental_grove_cid: string;
    duration: number;
    gpu_time: number;
  }> {
    if (!this.runpodEndpointId || !this.runpodApiKey) {
      throw new Error('RunPod endpoint ID and API key required for runpod mode');
    }

    const runpodUrl = `https://api.runpod.ai/v2/${this.runpodEndpointId}`;

    // Submit job
    console.log(`[Demucs/RunPod] Submitting ${spotifyTrackId} to RunPod...`);

    const submitResponse = await fetch(`${runpodUrl}/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.runpodApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          job_id: spotifyTrackId,
          audio_url: audioUrl,
          webhook_url: 'https://placeholder.invalid',  // Not used but required
          model: 'htdemucs',
          output_format: 'mp3',
          mp3_bitrate: 192,
          spotify_track_id: spotifyTrackId
        }
      })
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`RunPod submission failed (${submitResponse.status}): ${errorText}`);
    }

    const submitResult = await submitResponse.json() as {id: string, status: string};
    const jobId = submitResult.id;

    console.log(`[Demucs/RunPod] Job submitted: ${jobId}, polling for completion...`);

    // Poll for completion
    const maxAttempts = 60; // 5 minutes max
    const pollInterval = 5000; // 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(`${runpodUrl}/status/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${this.runpodApiKey}`
        }
      });

      if (!statusResponse.ok) {
        console.warn(`[Demucs/RunPod] Status check failed (${statusResponse.status}), retrying...`);
        continue;
      }

      const status = await statusResponse.json() as {
        id: string;
        status: string;
        output?: any;
        error?: string;
      };

      if (status.status === 'COMPLETED') {
        console.log(`[Demucs/RunPod] ✅ Job completed in ${(attempt + 1) * 5}s`);

        const output = status.output;
        if (!output || !output.vocals_grove_url || !output.instrumental_grove_url) {
          throw new Error('RunPod job completed but missing Grove URLs in output');
        }

        return {
          vocals_grove_url: output.vocals_grove_url,
          instrumental_grove_url: output.instrumental_grove_url,
          vocals_grove_cid: output.vocals_grove_cid,
          instrumental_grove_cid: output.instrumental_grove_cid,
          duration: output.duration || 0,
          gpu_time: output.gpu_time || 0
        };
      } else if (status.status === 'FAILED') {
        throw new Error(`RunPod job failed: ${status.error || 'Unknown error'}`);
      } else {
        console.log(`[Demucs/RunPod] Status: ${status.status} (attempt ${attempt + 1}/${maxAttempts})`);
      }
    }

    throw new Error(`RunPod job timed out after ${maxAttempts * pollInterval / 1000}s`);
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
 *
 * Environment variables:
 * - DEMUCS_MODE: 'local' | 'remote' | 'runpod' (default: 'local')
 * - DEMUCS_LOCAL_ENDPOINT: http://localhost:8000 (default)
 * - DEMUCS_REMOTE_ENDPOINT: Custom remote endpoint
 * - RUNPOD_DEMUCS_ENDPOINT_ID: RunPod endpoint ID (required for runpod mode)
 * - RUNPOD_API_KEY: RunPod API key (required for runpod mode)
 */
export function createDemucsService(): DemucsService {
  const mode = (process.env.DEMUCS_MODE || 'local') as DemucsMode;
  const localEndpoint = process.env.DEMUCS_LOCAL_ENDPOINT || 'http://localhost:8000';
  const remoteEndpoint = process.env.DEMUCS_REMOTE_ENDPOINT || '';
  const runpodEndpointId = process.env.RUNPOD_DEMUCS_ENDPOINT_ID || '';
  const runpodApiKey = process.env.RUNPOD_API_KEY || '';

  return new DemucsService(mode, localEndpoint, remoteEndpoint, runpodEndpointId, runpodApiKey);
}
