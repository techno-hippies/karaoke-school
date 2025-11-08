/**
 * fal.ai Service - Stable Audio 2.5 Enhancement
 *
 * Uses fal.ai's audio-to-audio model to enhance instrumental quality
 * for karaoke backing tracks.
 */

export interface FalEnhancementOptions {
  audioUrl: string;           // Input audio URL (Grove or public)
  prompt?: string;            // Description (default: 'instrumental')
  strength?: number;          // Enhancement strength 0-1 (default: 0.35)
}

export interface FalEnhancementResult {
  audioUrl: string;           // Enhanced audio URL (fal.ai CDN)
  requestId: string;          // fal.ai request ID
  duration: number;           // Processing time in seconds
}

export class FalService {
  private apiKey: string;
  private baseUrl = 'https://queue.fal.run/fal-ai/stable-audio-25/audio-to-audio';
  private maxPollAttempts: number;
  private pollInterval: number;

  constructor(options?: {
    apiKey?: string;
    maxPollAttempts?: number;
    pollInterval?: number;
  }) {
    this.apiKey = options?.apiKey || process.env.FAL_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('FAL_API_KEY required (env or constructor)');
    }

    this.maxPollAttempts = options?.maxPollAttempts || 180; // 6 minutes
    this.pollInterval = options?.pollInterval || 2000;      // 2s
  }

  /**
   * Enhance instrumental audio using Stable Audio 2.5
   *
   * Process:
   * 1. Submit request to fal.ai queue
   * 2. Poll for completion (every 2s, max 6 minutes)
   * 3. Return enhanced audio URL
   */
  async enhanceInstrumental(options: FalEnhancementOptions): Promise<FalEnhancementResult> {
    const startTime = Date.now();

    console.log(`[fal.ai] Starting enhancement...`);
    console.log(`[fal.ai]   Audio: ${options.audioUrl.slice(0, 60)}...`);
    console.log(`[fal.ai]   Prompt: ${options.prompt || 'instrumental'}`);
    console.log(`[fal.ai]   Strength: ${options.strength || 0.35}`);

    // Step 1: Submit request
    const submitResponse = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: options.prompt || 'instrumental',
        audio_url: options.audioUrl,
        strength: options.strength || 0.35,
      }),
    });

    if (!submitResponse.ok) {
      const error = await submitResponse.text();
      throw new Error(`fal.ai submission failed: ${submitResponse.status} ${error}`);
    }

    const submitData = await submitResponse.json() as { request_id: string; status_url: string };
    console.log(`[fal.ai] Request submitted: ${submitData.request_id}`);

    // Step 2: Poll for completion
    let attempts = 0;
    while (attempts < this.maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
      attempts++;

      const statusResponse = await fetch(submitData.status_url, {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`fal.ai status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json() as {
        status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
        output?: { audio_url?: string; audio_file?: { url?: string } };
        response_url?: string;
        error?: string;
      };

      if (statusData.status === 'COMPLETED') {
        const duration = (Date.now() - startTime) / 1000;
        console.log(`[fal.ai] ✓ Enhanced in ${duration.toFixed(1)}s (${attempts} polls)`);

        // If no output in status response, fetch from response_url
        let audioUrl = statusData.output?.audio_url
          || statusData.output?.audio_file?.url
          || (statusData.output as any)?.url;

        if (!audioUrl && statusData.response_url) {
          console.log(`[fal.ai] Fetching output from response_url...`);
          const outputResponse = await fetch(statusData.response_url, {
            headers: {
              'Authorization': `Key ${this.apiKey}`,
            },
          });

          if (!outputResponse.ok) {
            throw new Error(`fal.ai response fetch failed: ${outputResponse.status}`);
          }

          const outputData = await outputResponse.json() as any;
          console.log('[fal.ai] Output data:', JSON.stringify(outputData, null, 2));

          audioUrl = outputData.audio?.url           // fal.ai v2+ format
            || outputData.audio_url                   // Legacy format
            || outputData.audio_file?.url
            || outputData.url
            || outputData.data?.audio_url
            || outputData.data?.audio_file?.url;
        }

        if (!audioUrl) {
          console.error('[fal.ai] Status response:', JSON.stringify(statusData, null, 2));
          throw new Error(`fal.ai returned no audio URL. Status: ${statusData.status}`);
        }

        return {
          audioUrl,
          requestId: submitData.request_id,
          duration,
        };
      }

      if (statusData.status === 'FAILED') {
        throw new Error(`fal.ai processing failed: ${statusData.error || 'Unknown error'}`);
      }

      // Still IN_PROGRESS
      if (attempts % 15 === 0) {
        console.log(`[fal.ai] Still processing... (${attempts * this.pollInterval / 1000}s)`);
      }
    }

    throw new Error(`fal.ai timeout after ${this.maxPollAttempts * this.pollInterval / 1000}s`);
  }

  /**
   * Download enhanced audio from fal.ai CDN
   */
  async downloadAudio(url: string): Promise<Buffer> {
    console.log(`[fal.ai] Downloading: ${url.slice(0, 60)}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`fal.ai download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[fal.ai] ✓ Downloaded (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`);
    return buffer;
  }
}

/**
 * Singleton instance
 */
let falServiceInstance: FalService | null = null;

export function createFalService(): FalService {
  if (!falServiceInstance) {
    falServiceInstance = new FalService();
  }
  return falServiceInstance;
}
