/**
 * fal.ai Audio Enhancement Service
 *
 * Uses Stable Audio 2.5 to enhance instrumental tracks for karaoke.
 * Migrated from master-pipeline with improvements for Cloudflare Workers.
 *
 * Key improvements:
 * - No fs operations (Workers-compatible)
 * - Fetches from Grove URLs directly
 * - Better error handling and logging
 * - TypeScript types
 */

export interface FalAudioEnhancementOptions {
  audioUrl: string;           // Grove URL or public URL to instrumental
  prompt?: string;            // Default: "instrumental"
  strength?: number;          // 0.0-1.0, default: 0.3
  numInferenceSteps?: number; // Default: 8
  guidanceScale?: number;     // Default: 1
}

export interface FalAudioEnhancementResult {
  audioUrl: string;           // fal.ai result URL (temporary)
  duration: number;           // Processing time in seconds
  cost: number;               // Estimated cost in USD
  requestId: string;          // fal.ai request ID
}

export class FalAudioService {
  private apiKey: string;
  private baseUrl = 'https://queue.fal.run/fal-ai/stable-audio-25/audio-to-audio';
  private maxPollAttempts: number;
  private pollInterval: number; // milliseconds

  constructor(apiKey: string, options?: {
    maxPollAttempts?: number;
    pollInterval?: number;
  }) {
    if (!apiKey) {
      throw new Error('FAL_API_KEY required');
    }

    this.apiKey = apiKey;
    this.maxPollAttempts = options?.maxPollAttempts || 180; // 6 minutes
    this.pollInterval = options?.pollInterval || 2000;      // 2s
  }

  /**
   * Enhance instrumental audio using Stable Audio 2.5
   *
   * @param options Enhancement options
   * @returns Enhanced audio URL and metadata
   */
  async enhanceInstrumental(
    options: FalAudioEnhancementOptions
  ): Promise<FalAudioEnhancementResult> {
    const startTime = Date.now();

    console.log(`[fal.ai] Starting audio enhancement...`);
    console.log(`[fal.ai]   Audio URL: ${options.audioUrl.slice(0, 60)}...`);
    console.log(`[fal.ai]   Prompt: ${options.prompt || 'instrumental'}`);
    console.log(`[fal.ai]   Strength: ${options.strength || 0.3}`);

    // Step 1: Submit request to fal.ai queue
    const submitResponse = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: options.prompt || 'instrumental',
        audio_url: options.audioUrl,
        strength: options.strength || 0.3,
        num_inference_steps: options.numInferenceSteps || 8,
        guidance_scale: options.guidanceScale || 1,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      throw new Error(`fal.ai submit failed (${submitResponse.status}): ${errorText}`);
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      throw new Error('No request_id returned from fal.ai');
    }

    console.log(`[fal.ai]   Request ID: ${requestId}`);
    console.log(`[fal.ai]   Polling for completion...`);

    // Step 2: Poll for completion
    let attempt = 0;
    while (attempt < this.maxPollAttempts) {
      await this.sleep(this.pollInterval);
      attempt++;

      // Check status
      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/stable-audio-25/requests/${requestId}/status`,
        {
          headers: { 'Authorization': `Key ${this.apiKey}` },
        }
      );

      if (!statusResponse.ok) {
        throw new Error(`fal.ai status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      const status = statusData.status;

      if (status === 'COMPLETED') {
        // Get result
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/stable-audio-25/requests/${requestId}`,
          {
            headers: { 'Authorization': `Key ${this.apiKey}` },
          }
        );

        if (!resultResponse.ok) {
          throw new Error(`fal.ai result fetch failed: ${resultResponse.status}`);
        }

        const resultData = await resultResponse.json();
        const audioUrl = resultData.audio?.url;

        if (!audioUrl) {
          throw new Error('No audio URL in fal.ai result');
        }

        const duration = (Date.now() - startTime) / 1000;

        console.log(`[fal.ai] ✓ Enhancement complete in ${duration.toFixed(1)}s`);
        console.log(`[fal.ai]   Output URL: ${audioUrl.slice(0, 60)}...`);

        return {
          audioUrl,
          duration,
          cost: 0.20, // Stable Audio 2.5 pricing
          requestId,
        };
      } else if (status === 'FAILED') {
        throw new Error(`fal.ai processing failed: ${JSON.stringify(statusData)}`);
      } else if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
        // Continue polling
        if (attempt % 10 === 0) {
          console.log(`[fal.ai]   Status: ${status} (${attempt * 2}s elapsed)`);
        }
      } else {
        console.log(`[fal.ai]   Unknown status: ${status}`);
      }
    }

    throw new Error(`fal.ai processing timeout after ${this.maxPollAttempts * 2}s`);
  }

  /**
   * Download enhanced audio from fal.ai result URL
   *
   * @param audioUrl fal.ai temporary result URL
   * @returns Audio file as ArrayBuffer
   */
  async downloadAudio(audioUrl: string): Promise<ArrayBuffer> {
    console.log(`[fal.ai] Downloading enhanced audio...`);

    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const sizeMB = arrayBuffer.byteLength / 1024 / 1024;

    console.log(`[fal.ai] ✓ Downloaded ${sizeMB.toFixed(2)}MB`);

    return arrayBuffer;
  }

  /**
   * Sleep helper for polling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
