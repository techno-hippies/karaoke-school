/**
 * fal.ai Image Service
 * Generates derivative artist images using Bytedance's Seedream 4 model
 * Transforms original artist photos into abstract artistic representations
 * Cost: Variable based on image size
 */

import * as fal from '@fal-ai/serverless-client';

/**
 * Prompt template for artist image transformation
 */
export const ARTIST_IMAGE_PROMPT = (artistName: string) =>
  `Convert the artist's image to a dreamy watercolor digital illustration, maintaining layout and palette, blending soft abstract strokes into an iconic, ethereal profile evoking vintage album covers.`;

export interface FalImageOptions {
  prompt: string;
  imageUrl?: string; // Input image for image-to-image transformation
  imageSize?: {
    width: number;
    height: number;
  };
  seed?: number;
  enableSafetyChecker?: boolean;
}

export interface FalImageResult {
  requestId: string;
  images?: Array<{
    url: string;
    width?: number;
    height?: number;
    contentType?: string;
  }>;
  seed?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export class FalImageService {
  private apiKey: string;
  private maxPollAttempts: number;
  private pollInterval: number;

  constructor(apiKey: string, maxPollAttempts = 60, pollInterval = 2000) {
    this.apiKey = apiKey;
    this.maxPollAttempts = maxPollAttempts;
    this.pollInterval = pollInterval;

    // Configure fal client
    fal.config({
      credentials: apiKey,
    });
  }

  /**
   * Generate derivative artist image from original Spotify artist image
   * Transforms image into abstract artistic representation
   */
  async generateDerivativeArtistImage(
    originalImageUrl: string,
    artistName: string,
    baseSeed?: number
  ): Promise<FalImageResult> {
    const prompt = `Convert this artist photo of ${artistName} into an abstract artistic portrait maintaining the general composition and color palette but making it stylized and vague. Use vibrant colors and artistic brush strokes while preserving the overall feel.`;

    return await this.generateImage({
      prompt,
      imageUrl: originalImageUrl,
      imageSize: {
        width: 640,
        height: 640,
      },
      seed: baseSeed,
      enableSafetyChecker: true,
    });
  }

  /**
   * Submit image generation request using fal SDK
   */
  async submitImage(options: FalImageOptions): Promise<{ requestId: string }> {
    const requestBody: any = {
      prompt: options.prompt,
      image_size: options.imageSize || {
        width: 640,
        height: 640,
      },
      num_images: 1,
      max_images: 1,
      seed: options.seed,
      enable_safety_checker: options.enableSafetyChecker ?? true,
    };

    // Add image_urls array for editing (required for /edit endpoint)
    if (options.imageUrl) {
      requestBody.image_urls = [options.imageUrl];
    }

    // Use fal SDK to submit to queue
    const result = await fal.queue.submit('fal-ai/bytedance/seedream/v4/edit', {
      input: requestBody,
    });

    return { requestId: result.request_id };
  }

  /**
   * Check status of a request using fal SDK
   */
  async checkStatus(requestId: string): Promise<{ status: string; completed: boolean }> {
    const status = await fal.queue.status('fal-ai/bytedance/seedream/v4/edit', {
      requestId,
      logs: false,
    });

    return {
      status: status.status,
      completed: status.status === 'COMPLETED',
    };
  }

  /**
   * Get result of completed request using fal SDK
   */
  async getResult(requestId: string): Promise<FalImageResult> {
    try {
      const result = await fal.queue.result('fal-ai/bytedance/seedream/v4/edit', {
        requestId,
      });

      // Check for completed status with images
      if (result.images && Array.isArray(result.images)) {
        return {
          requestId,
          images: result.images,
          seed: result.seed,
          status: 'completed',
        };
      }

      // Check for explicit failed status
      if (result.error) {
        return {
          requestId,
          status: 'failed',
          error: result.error || 'Unknown error',
        };
      }

      // Otherwise still processing
      return {
        requestId,
        status: 'processing',
      };
    } catch (error: any) {
      // If request is still processing, return processing status
      if (error.message?.includes('IN_PROGRESS') || error.message?.includes('IN_QUEUE')) {
        return {
          requestId,
          status: 'processing',
        };
      }

      // Otherwise it's a real error
      return {
        requestId,
        status: 'failed',
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Submit and poll for completion (WARNING: may timeout on Cloudflare Workers)
   */
  async generateImage(options: FalImageOptions): Promise<FalImageResult> {
    const { requestId } = await this.submitImage(options);

    // Poll for completion
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, this.pollInterval));

      const { status, completed } = await this.checkStatus(requestId);

      if (completed) {
        return await this.getResult(requestId);
      }

      if (status === 'FAILED') {
        const result = await this.getResult(requestId);
        throw new Error(result.error || 'fal.ai Seedream processing failed');
      }
    }

    throw new Error('fal.ai Seedream processing timeout after 2 minutes');
  }
}
