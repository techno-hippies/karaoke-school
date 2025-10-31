/**
 * FAL AI Image Generation Service
 *
 * Generates watercolor-style derivative images using Seedream 4
 * Creates artistic album covers and artist images for GRC-20 assets
 *
 * Cost: ~$0.03 per image
 * Style: Watercolor painting effect for derivative copyright purposes
 *
 * Workflow:
 *   1. Generate full-size image (1024x1024) via FAL API
 *   2. Download image locally
 *   3. Resize to create thumbnail (256x256)
 *   4. Both versions ready for Grove upload
 */

import * as falModule from '@fal-ai/client';
const fal = falModule.fal;

import sharp from 'sharp';
import https from 'https';
import http from 'http';
import { createWriteStream, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export interface FalImageInput {
  prompt: string;
  imageUrl?: string; // Input image for image-to-image transformation
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

export interface DualImageOutput {
  full: {
    buffer: Buffer;
    width: number;
    height: number;
  };
  thumbnail: {
    buffer: Buffer;
    width: number;
    height: number;
  };
  seed: number;
}

export class FalImageService {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FAL_API_KEY || '';

    if (!this.apiKey) {
      throw new Error('FAL_API_KEY is required for Seedream service');
    }

    // Configure FAL client with API key
    fal.config({
      credentials: this.apiKey,
    });
  }

  /**
   * Generate derivative artist image from original Spotify artist image
   * Transforms image into abstract artistic representation
   * Returns both full-size (1024x1024) and thumbnail (256x256) versions
   */
  async generateArtistDerivativeImage(
    artistName: string,
    originalImageUrl?: string,
    baseSeed?: number
  ): Promise<DualImageOutput> {
    console.log(`Generating derivative artist image: ${artistName}`);

    const prompt = `Convert ${artistName}'s image to a dreamy watercolor digital illustration, maintaining layout and palette, blending soft abstract strokes into an iconic, ethereal profile evoking vintage album covers`;

    const result = await this.generateImageWithThumbnail({
      prompt,
      imageUrl: originalImageUrl,
      seed: baseSeed,
      enableSafetyChecker: true,
    });

    console.log(`✓ Generated derivative artist image (full: ${result.full.width}x${result.full.height}, thumbnail: ${result.thumbnail.width}x${result.thumbnail.height})`);
    return result;
  }

  /**
   * Generate derivative album cover from original cover art
   * Transforms cover into abstract artistic representation
   * Returns both full-size (1024x1024) and thumbnail (256x256) versions
   */
  async generateAlbumDerivativeImage(
    title: string,
    artistName: string,
    originalImageUrl?: string,
    baseSeed?: number
  ): Promise<DualImageOutput> {
    console.log(`Generating derivative album cover: ${title} by ${artistName}`);

    const prompt = `Convert the album cover to a dreamy watercolor digital illustration, maintaining layout and palette, blending soft abstract strokes into an iconic, ethereal composition evoking vintage album covers`;

    const result = await this.generateImageWithThumbnail({
      prompt,
      imageUrl: originalImageUrl,
      seed: baseSeed,
      enableSafetyChecker: true,
    });

    console.log(`✓ Generated derivative album cover (full: ${result.full.width}x${result.full.height}, thumbnail: ${result.thumbnail.width}x${result.thumbnail.height})`);
    return result;
  }

  /**
   * Generate image using Seedream 4 image-to-image (edit) endpoint
   * Uses FAL client library for automatic request handling and polling
   */
  async generateImage(input: FalImageInput): Promise<FalImageOutput> {
    console.log('  Submitting Seedream request...');

    try {
      // Build request body with full-size resolution (1024x1024)
      const requestBody: any = {
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

      // Add image_urls array for image-to-image transformation (edit endpoint)
      if (input.imageUrl) {
        requestBody.image_urls = [input.imageUrl];
      }

      // Use fal.subscribe for the Seedream edit endpoint (image-to-image transformation)
      // Credentials already configured in constructor
      const result = await fal.subscribe('fal-ai/bytedance/seedream/v4/edit', {
        input: requestBody,
      });

      console.log('  ✓ Generation complete');

      // Handle FAL response format - images can be nested in data.images or at root level
      const images = result.data?.images || result.images || (result.image ? [result.image] : []) || (result.output || []);

      if (!images || images.length === 0) {
        throw new Error('No images in response');
      }

      // Transform FAL response to our expected format
      return {
        images: images,
        seed: result.seed || input.seed || 0,
      };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`  API Error: ${errorMsg}`);

      if (errorMsg.includes('401') || errorMsg.includes('Unauthorized') || errorMsg.includes('credentials')) {
        throw new Error(`Seedream authentication failed - check FAL_API_KEY`);
      }
      if (errorMsg.includes('timeout')) {
        throw new Error('Seedream generation timed out');
      }
      throw new Error(`Seedream generation failed: ${errorMsg}`);
    }
  }

  /**
   * Download image from URL to buffer
   */
  private downloadImage(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const chunks: Buffer[] = [];

      protocol.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Failed to download image: HTTP ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Resize image to create thumbnail
   */
  private async resizeImage(buffer: Buffer, width: number, height: number): Promise<Buffer> {
    return sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .toBuffer();
  }

  /**
   * Generate full-size image and thumbnail in one operation
   * Downloads the generated image and creates both versions locally
   */
  async generateImageWithThumbnail(input: FalImageInput): Promise<DualImageOutput> {
    console.log('  Submitting Seedream request (full-size)...');

    try {
      // Generate full-size image (1024x1024)
      const falResult = await this.generateImage(input);

      if (!falResult.images || falResult.images.length === 0) {
        throw new Error('No images returned from FAL');
      }

      const imageUrl = falResult.images[0].url;
      console.log('  ✓ Downloading generated image...');

      // Download the image
      const fullBuffer = await this.downloadImage(imageUrl);

      // Get image metadata
      const metadata = await sharp(fullBuffer).metadata();

      console.log(`  ✓ Downloaded (${fullBuffer.length} bytes, ${metadata.width}x${metadata.height})`);

      // Create thumbnail locally
      console.log('  ✓ Generating thumbnail...');
      const thumbnailBuffer = await this.resizeImage(fullBuffer, 256, 256);

      console.log(`  ✓ Thumbnail ready (${thumbnailBuffer.length} bytes, 256x256)`);

      return {
        full: {
          buffer: fullBuffer,
          width: metadata.width || 1024,
          height: metadata.height || 1024,
        },
        thumbnail: {
          buffer: thumbnailBuffer,
          width: 256,
          height: 256,
        },
        seed: falResult.seed,
      };
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.error(`  Error: ${errorMsg}`);
      throw new Error(`Image generation with thumbnail failed: ${errorMsg}`);
    }
  }
}
