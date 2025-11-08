/**
 * Demucs Service
 * GPU-accelerated vocal/instrumental separation via RunPod serverless
 *
 * Uses RunPod polling-based API for synchronous separation.
 * Submits job and polls until completion (no webhook needed).
 */

export interface DemucsResult {
  jobId: string;
  status: 'processing';
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
  private runpodEndpointId: string;
  private runpodApiKey: string;

  constructor(
    runpodEndpointId?: string,
    runpodApiKey?: string
  ) {
    this.runpodEndpointId = runpodEndpointId || '';
    this.runpodApiKey = runpodApiKey || '';
  }

  /**
   * Submit Demucs separation job via RunPod
   *
   * RunPod-only implementation. Submits job and polls for completion.
   *
   * @param spotifyTrackId Spotify track ID (used as job ID)
   * @param audioUrl Public URL to audio file (Grove, S3, etc.)
   * @returns Job ID and status
   * @throws Error if submission fails or credentials missing
   */
  async separateAsync(
    spotifyTrackId: string,
    audioUrl: string
  ): Promise<DemucsResult> {
    if (!this.runpodEndpointId || !this.runpodApiKey) {
      throw new Error('RunPod endpoint ID and API key required. Set RUNPOD_DEMUCS_ENDPOINT_ID and RUNPOD_API_KEY');
    }

    const runpodUrl = `https://api.runpod.ai/v2/${this.runpodEndpointId}`;

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

    console.log(`[Demucs/RunPod] Job submitted: ${jobId}`);

    return {
      jobId,
      status: 'processing',
      message: `Demucs separation submitted to RunPod with job ID ${jobId}`,
    };
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

}

/**
 * Create a singleton instance from environment variables
 *
 * Environment variables (RunPod-only):
 * - RUNPOD_DEMUCS_ENDPOINT_ID: RunPod endpoint ID (required)
 * - RUNPOD_API_KEY: RunPod API key (required)
 */
export function createDemucsService(): DemucsService {
  const runpodEndpointId = process.env.RUNPOD_DEMUCS_ENDPOINT_ID || '';
  const runpodApiKey = process.env.RUNPOD_API_KEY || '';

  return new DemucsService(runpodEndpointId, runpodApiKey);
}
