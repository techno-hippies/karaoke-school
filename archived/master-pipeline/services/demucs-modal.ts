/**
 * Demucs Modal Service
 *
 * GPU-accelerated vocal separation using Modal deployment
 * Faster than local execution, uses H100 GPU
 *
 * Deployment:
 *   cd modal-demucs
 *   modal deploy demucs_service.py
 */

import { readFileSync } from 'fs';
import { BaseService, ServiceConfig } from './base.js';

export interface DemucsModalResult {
  vocalsBase64: string;
  instrumentalBase64: string;
  vocalsSize: number;
  instrumentalSize: number;
  model: string;
  format: string;
  duration: number;
}

export interface DemucsModalConfig extends ServiceConfig {
  model?: 'mdx_extra' | 'htdemucs' | 'htdemucs_ft';
  outputFormat?: 'mp3' | 'wav' | 'flac';
  mp3Bitrate?: number;
}

export class DemucsModalService extends BaseService {
  private model: string;
  private outputFormat: string;
  private mp3Bitrate: number;
  private modalEndpoint: string;

  constructor(config: DemucsModalConfig = {}) {
    super('Demucs (Modal)', config);

    this.model = config.model || 'mdx_extra';
    this.outputFormat = config.outputFormat || 'mp3';
    this.mp3Bitrate = config.mp3Bitrate || 192;

    // Modal endpoint (will be set after deployment)
    // Format: https://your-username--demucs-karaoke-separate-audio.modal.run
    this.modalEndpoint = process.env.MODAL_DEMUCS_ENDPOINT || '';
  }

  /**
   * Separate audio using Modal deployment
   *
   * @param audioPath Path to local audio file (will be base64 encoded)
   * @returns Base64-encoded vocals and instrumental
   */
  async separate(audioPath: string): Promise<DemucsModalResult> {
    if (!this.modalEndpoint) {
      throw new Error(
        'MODAL_DEMUCS_ENDPOINT environment variable not set. Deploy with: cd modal-demucs && modal deploy demucs_service.py'
      );
    }

    const startTime = Date.now();

    this.log(`Separating audio (Modal): ${audioPath}`);
    this.log(`Model: ${this.model}, Format: ${this.outputFormat}, GPU: H100`);

    // Read and encode audio as base64
    const audioData = readFileSync(audioPath);
    const audioBase64 = audioData.toString('base64');
    const sizeMB = audioData.length / 1024 / 1024;

    this.log(`  Encoded ${sizeMB.toFixed(2)}MB as base64`);

    // Determine MIME type
    let mimeType = 'audio/mpeg';
    if (audioPath.endsWith('.wav')) mimeType = 'audio/wav';
    if (audioPath.endsWith('.flac')) mimeType = 'audio/flac';

    const dataUri = `data:${mimeType};base64,${audioBase64}`;

    // Call Modal HTTP endpoint (using JSON for large payloads)
    this.log(`  Calling Modal endpoint: ${this.modalEndpoint}/separate`);
    this.log(`  Request payload size: ${(JSON.stringify({audio_base64: dataUri, model: this.model}).length / 1024 / 1024).toFixed(2)}MB`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout

    let result: any;
    try {
      const response = await fetch(`${this.modalEndpoint}/separate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio_base64: dataUri,
          model: this.model,
          output_format: this.outputFormat,
          mp3_bitrate: this.mp3Bitrate,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Modal API error (${response.status}): ${errorText}`);
      }

      result = await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Modal request timed out after 120s');
      }
      throw error;
    }

    const duration = (Date.now() - startTime) / 1000;
    this.log(`✓ Separation complete in ${duration.toFixed(1)}s`);
    this.log(`  Vocals: ${(result.vocals_size / 1024 / 1024).toFixed(2)}MB`);
    this.log(`  Instrumental: ${(result.instrumental_size / 1024 / 1024).toFixed(2)}MB`);

    return {
      vocalsBase64: result.vocals_base64,
      instrumentalBase64: result.instrumental_base64,
      vocalsSize: result.vocals_size,
      instrumentalSize: result.instrumental_size,
      model: result.model,
      format: result.format,
      duration,
    };
  }

  /**
   * Write separated audio to files
   *
   * @param result Demucs separation result
   * @param outputDir Output directory
   * @returns Paths to vocals and instrumental files
   */
  async writeToFiles(
    result: DemucsModalResult,
    outputDir: string
  ): Promise<{ vocalsPath: string; instrumentalPath: string }> {
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    const { mkdirSync, existsSync } = await import('fs');

    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const ext = result.format;
    const vocalsPath = join(outputDir, `vocals.${ext}`);
    const instrumentalPath = join(outputDir, `instrumental.${ext}`);

    // Decode base64 and write
    const vocalsBuffer = Buffer.from(result.vocalsBase64, 'base64');
    const instrumentalBuffer = Buffer.from(result.instrumentalBase64, 'base64');

    writeFileSync(vocalsPath, vocalsBuffer);
    writeFileSync(instrumentalPath, instrumentalBuffer);

    this.log(`  Saved vocals: ${vocalsPath}`);
    this.log(`  Saved instrumental: ${instrumentalPath}`);

    return { vocalsPath, instrumentalPath };
  }
}
