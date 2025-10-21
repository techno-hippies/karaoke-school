/**
 * fal.ai Image Service
 *
 * Generates derivative cover art using Bytedance's Seedream 4 model
 * Transforms images into abstract paintings to create derivative works
 */

import { BaseService, ServiceConfig } from './base.js';

export interface FalImageConfig extends ServiceConfig {
  apiKey?: string;
}

export interface FalImageInput {
  prompt: string;
  imageUrl?: string; // For image-to-image (if supported)
  imageSize?: {
    width: number;
    height: number;
  };
  seed?: number;
  enableSafetyChecker?: boolean;
}

export interface FalImageOutput {
  images: Array<{
    url: string;
    width?: number;
    height?: number;
    contentType?: string;
  }>;
  seed: number;
}

export class FalImageService extends BaseService {
  private apiKey: string;
  private baseUrl = 'https://queue.fal.run/fal-ai/bytedance/seedream/v4/text-to-image';

  constructor(config: FalImageConfig = {}) {
    super('FalImage', config);
    this.apiKey = config.apiKey || process.env.FAL_KEY || '';

    if (!this.apiKey) {
      throw new Error('FAL_KEY is required for Seedream service');
    }
  }

  /**
   * Generate derivative cover art from original image
   * Uses abstract painting transformation to create derivative work
   */
  async generateDerivativeCoverArt(
    originalImageUrl: string,
    baseSeed?: number
  ): Promise<FalImageOutput> {
    this.log(`Generating derivative cover art from: ${originalImageUrl.slice(0, 60)}...`);

    // Download the original image to get its description/style
    const prompt = `Convert this album cover into an abstract painting maintaining its shapes and overall structure but making it vague. Use vibrant colors and artistic brush strokes while preserving the general composition.`;

    const result = await this.generateImage({
      prompt,
      imageSize: {
        width: 1024,
        height: 1024,
      },
      seed: baseSeed,
      enableSafetyChecker: true,
    });

    this.log(`✓ Generated derivative cover art`);
    return result;
  }

  /**
   * Generate image using Seedream 4
   */
  async generateImage(input: FalImageInput): Promise<FalImageOutput> {
    const requestBody = {
      prompt: input.prompt,
      image_size: input.imageSize || {
        width: 1024,
        height: 1024,
      },
      num_images: 1,
      max_images: 1,
      seed: input.seed,
      enable_safety_checker: input.enableSafetyChecker ?? true,
    };

    this.log('Submitting Seedream request...');

    // Submit request
    const submitResponse = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!submitResponse.ok) {
      const error = await submitResponse.text();
      throw new Error(`Seedream submit failed: ${error}`);
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;

    if (!requestId) {
      throw new Error('No request_id returned from Seedream');
    }

    this.log(`  Request ID: ${requestId}`);
    this.log('  Waiting for generation...');

    // Poll for result
    const result = await this.pollForResult(requestId);

    return result as FalImageOutput;
  }

  /**
   * Poll for request completion
   */
  private async pollForResult(requestId: string, maxAttempts = 60): Promise<unknown> {
    const statusUrl = `https://queue.fal.run/fal-ai/bytedance/seedream/v4/requests/${requestId}/status`;
    const resultUrl = `https://queue.fal.run/fal-ai/bytedance/seedream/v4/requests/${requestId}`;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2s delay

      const statusResponse = await fetch(statusUrl, {
        headers: {
          'Authorization': `Key ${this.apiKey}`,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Status check failed: ${statusResponse.statusText}`);
      }

      const status = await statusResponse.json();

      if (status.status === 'COMPLETED') {
        this.log('  ✓ Generation complete');

        // Fetch result
        const resultResponse = await fetch(resultUrl, {
          headers: {
            'Authorization': `Key ${this.apiKey}`,
          },
        });

        if (!resultResponse.ok) {
          throw new Error(`Failed to fetch result: ${resultResponse.statusText}`);
        }

        return await resultResponse.json();
      }

      if (status.status === 'FAILED') {
        throw new Error(`Seedream generation failed: ${JSON.stringify(status)}`);
      }

      // Log progress
      if (attempt % 5 === 0) {
        this.log(`  Status: ${status.status} (${attempt * 2}s elapsed)`);
      }
    }

    throw new Error('Seedream generation timed out after 120s');
  }
}
