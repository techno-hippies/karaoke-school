/**
 * fal.ai Service
 * Handles audio-to-audio transformation using Stable Audio 2.5
 * Cost: $0.20 per request
 */

export interface FalAudioToAudioOptions {
  audioUrl: string;
  prompt?: string;
  strength?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
}

export interface FalAudioToAudioResult {
  requestId: string;
  audioUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  duration?: number;
  cost: number;
  error?: string;
}

export class FalService {
  private baseUrl = 'https://queue.fal.run/fal-ai/stable-audio-25';
  private apiKey: string;
  private maxPollAttempts: number;
  private pollInterval: number;

  constructor(apiKey: string, maxPollAttempts = 180, pollInterval = 2000) {
    this.apiKey = apiKey;
    this.maxPollAttempts = maxPollAttempts;
    this.pollInterval = pollInterval;
  }

  /**
   * Submit audio-to-audio transformation request
   */
  async submitAudioToAudio(options: FalAudioToAudioOptions): Promise<{ requestId: string }> {
    const response = await fetch(`${this.baseUrl}/audio-to-audio`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: options.prompt || 'Instrumental',
        audio_url: options.audioUrl,
        strength: options.strength ?? 0.33,
        num_inference_steps: options.numInferenceSteps ?? 8,
        guidance_scale: options.guidanceScale ?? 1.0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`fal.ai submit failed: ${response.status} ${error}`);
    }

    const data = await response.json();
    return { requestId: data.request_id };
  }

  /**
   * Check status of a request
   */
  async checkStatus(requestId: string): Promise<{ status: string; completed: boolean }> {
    const response = await fetch(`${this.baseUrl}/requests/${requestId}/status`, {
      headers: {
        Authorization: `Key ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`fal.ai status check failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.status,
      completed: data.status === 'COMPLETED',
    };
  }

  /**
   * Get result of completed request
   */
  async getResult(requestId: string): Promise<FalAudioToAudioResult> {
    const response = await fetch(`${this.baseUrl}/requests/${requestId}`, {
      headers: {
        Authorization: `Key ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`fal.ai get result failed: ${response.status}`);
    }

    const data = await response.json();

    // If response has audio field, it's completed
    if (data.audio?.url) {
      return {
        requestId,
        audioUrl: data.audio.url,
        status: 'completed',
        duration: data.audio.duration,
        cost: 0.2,
      };
    }

    // Check for explicit failed status
    if (data.status === 'FAILED' || data.error) {
      return {
        requestId,
        status: 'failed',
        cost: 0.2,
        error: data.error || 'Unknown error',
      };
    }

    // Otherwise still processing
    return {
      requestId,
      status: 'processing',
      cost: 0.2,
    };
  }

  /**
   * Submit and poll for completion (WARNING: may timeout on Cloudflare Workers)
   */
  async audioToAudio(options: FalAudioToAudioOptions): Promise<FalAudioToAudioResult> {
    const { requestId } = await this.submitAudioToAudio(options);

    // Poll for completion
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));

      const { status, completed } = await this.checkStatus(requestId);

      if (completed) {
        return await this.getResult(requestId);
      }

      if (status === 'FAILED') {
        const result = await this.getResult(requestId);
        throw new Error(result.error || 'fal.ai processing failed');
      }
    }

    throw new Error('fal.ai processing timeout after 6 minutes');
  }
}
