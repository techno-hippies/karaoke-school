/**
 * Demucs Service
 * GPU-accelerated vocal/instrumental separation via RunPod serverless
 *
 * Uses RunPod polling-based API for synchronous separation.
 * Submits job and polls until completion (no webhook needed).
 */

export interface DemucsResult {
  vocals_grove_url: string;
  instrumental_grove_url: string;
  vocals_grove_cid: string;
  instrumental_grove_cid: string;
  duration: number;
  gpu_time: number;
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
   * Submit job to RunPod and poll for completion
   *
   * @param spotifyTrackId Spotify track ID (used as job ID)
   * @param audioUrl Public URL to audio file (Grove, S3, etc.)
   * @returns Completed job with Grove URLs
   * @throws Error if job fails or times out
   */
  async separate(
    spotifyTrackId: string,
    audioUrl: string
  ): Promise<DemucsResult> {
    if (!this.runpodEndpointId || !this.runpodApiKey) {
      throw new Error('RunPod endpoint ID and API key required. Set RUNPOD_DEMUCS_ENDPOINT_ID and RUNPOD_API_KEY');
    }

    const runpodUrl = `https://api.runpod.ai/v2/${this.runpodEndpointId}`;

    // Submit job
    console.log(`   [Demucs] Submitting to RunPod...`);

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

    console.log(`   [Demucs] Job ${jobId} submitted, polling for completion...`);

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
        console.warn(`   [Demucs] Status check failed (${statusResponse.status}), retrying...`);
        continue;
      }

      const status = await statusResponse.json() as {
        id: string;
        status: string;
        output?: any;
        error?: string;
      };

      if (status.status === 'COMPLETED') {
        const elapsedSeconds = (attempt + 1) * (pollInterval / 1000);
        console.log(`   [Demucs] ✅ Completed in ${elapsedSeconds}s`);

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
        // Log progress every 15s
        if (attempt % 3 === 0) {
          const elapsedSeconds = (attempt + 1) * (pollInterval / 1000);
          console.log(`   [Demucs] Status: ${status.status} (${elapsedSeconds}s elapsed)`);
        }
      }
    }

    throw new Error(`RunPod job timed out after ${maxAttempts * pollInterval / 1000}s`);
  }
}

/**
 * Create a singleton instance from environment variables
 *
 * Environment variables:
 * - RUNPOD_DEMUCS_ENDPOINT_ID: RunPod endpoint ID (required)
 * - RUNPOD_API_KEY: RunPod API key (required)
 */
export function createDemucsService(): DemucsService {
  const runpodEndpointId = process.env.RUNPOD_DEMUCS_ENDPOINT_ID || '';
  const runpodApiKey = process.env.RUNPOD_API_KEY || '';

  return new DemucsService(runpodEndpointId, runpodApiKey);
}
