/**
 * fal.ai Service
 *
 * Audio-to-audio transformation using Stable Audio 2.5
 * Used for instrumental enhancement in karaoke pipeline
 */

import { readFileSync } from 'fs';
import { BaseService, ServiceConfig } from './base.js';

export interface FalAudioToAudioResult {
  audioUrl: string;
  duration: number;
  cost: number;
}

export interface FalAudioToAudioOptions {
  prompt: string; // Must be "instrumental" for karaoke
  audioUrl?: string; // Public URL to source audio (or use audioPath for Base64)
  audioPath?: string; // Local file path (will be encoded as Base64 data URI)
  strength?: number; // Transformation strength (0.0-1.0, default: 0.3)
  numInferenceSteps?: number; // Default: 8
  guidanceScale?: number; // Default: 1
}

export interface FalConfig extends ServiceConfig {
  maxPollAttempts?: number;
  pollInterval?: number; // milliseconds
}

export class FalAIService extends BaseService {
  private maxPollAttempts: number;
  private pollInterval: number;

  constructor(config: FalConfig = {}) {
    super('fal.ai', {
      baseUrl: 'https://queue.fal.run/fal-ai/stable-audio-25',
      apiKey: process.env.FAL_API_KEY || process.env.FAL_KEY,
      ...config,
    });

    this.maxPollAttempts = config.maxPollAttempts || 180; // 6 minutes
    this.pollInterval = config.pollInterval || 2000;
  }

  /**
   * Transform audio using Stable Audio 2.5 (audio-to-audio)
   *
   * @param options Audio transformation options
   * @returns Enhanced audio URL and metadata
   */
  async audioToAudio(options: FalAudioToAudioOptions): Promise<FalAudioToAudioResult> {
    const apiKey = this.requireApiKey();
    const startTime = Date.now();

    // Determine audio URL (either provided or encode from file)
    let audioUrl: string;

    if (options.audioPath) {
      // Read file and encode as Base64 data URI
      this.log(`Reading audio file: ${options.audioPath}`);
      const audioData = readFileSync(options.audioPath);
      const base64 = audioData.toString('base64');
      const mimeType = options.audioPath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
      audioUrl = `data:${mimeType};base64,${base64}`;

      const sizeMB = audioData.length / 1024 / 1024;
      this.log(`  Encoded ${sizeMB.toFixed(2)}MB as Base64 data URI`);
    } else if (options.audioUrl) {
      audioUrl = options.audioUrl;
      this.log(`Using provided URL: ${audioUrl}`);
    } else {
      throw new Error('Either audioUrl or audioPath must be provided');
    }

    this.log(`Starting audio-to-audio transformation...`);
    this.log(`  Prompt: "${options.prompt}"`);
    this.log(`  Strength: ${options.strength || 0.3}`);

    // Step 1: Submit request to fal.ai queue
    const submitResponse = await fetch(`${this.config.baseUrl}/audio-to-audio`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: options.prompt,
        audio_url: audioUrl,
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

    this.log(`  Request ID: ${requestId}`);
    this.log(`  Polling for completion...`);

    // Step 2: Poll for completion
    let attempt = 0;
    while (attempt < this.maxPollAttempts) {
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));
      attempt++;

      // Check status
      const statusResponse = await fetch(
        `${this.config.baseUrl}/requests/${requestId}/status`,
        {
          headers: { Authorization: `Key ${apiKey}` },
        }
      );

      if (!statusResponse.ok) {
        throw new Error(`fal.ai status check failed: ${statusResponse.status}`);
      }

      const statusData = await statusResponse.json();
      const status = statusData.status;

      if (status === 'COMPLETED') {
        // Get result
        const resultResponse = await fetch(`${this.config.baseUrl}/requests/${requestId}`, {
          headers: { Authorization: `Key ${apiKey}` },
        });

        if (!resultResponse.ok) {
          throw new Error(`fal.ai result fetch failed: ${resultResponse.status}`);
        }

        const resultData = await resultResponse.json();
        const audioUrl = resultData.audio.url;

        const duration = (Date.now() - startTime) / 1000;
        this.log(`✓ Audio transformation complete in ${duration.toFixed(1)}s`);
        this.log(`  Output URL: ${audioUrl}`);

        return {
          audioUrl,
          duration,
          cost: 0.2, // Stable Audio 2.5 pricing
        };
      } else if (status === 'FAILED') {
        throw new Error(`fal.ai processing failed: ${JSON.stringify(statusData)}`);
      } else if (status === 'IN_QUEUE' || status === 'IN_PROGRESS') {
        // Continue polling
        if (attempt % 5 === 0) {
          this.log(`  Still processing... (${attempt}/${this.maxPollAttempts})`);
        }
      } else {
        this.log(`  Unknown status: ${status}`);
      }
    }

    throw new Error(`fal.ai processing timeout after ${this.maxPollAttempts} attempts`);
  }

  /**
   * Download enhanced audio from fal.ai result URL
   *
   * @param audioUrl fal.ai result URL
   * @returns Audio file buffer
   */
  async downloadAudio(audioUrl: string): Promise<Buffer> {
    this.log(`Downloading audio from fal.ai: ${audioUrl}`);

    const response = await fetch(audioUrl);

    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    this.log(`✓ Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);

    return buffer;
  }
}
