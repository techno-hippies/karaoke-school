/**
 * Grove Storage Service
 *
 * IPFS storage via Grove API
 * Used for uploading audio files and getting public gateway URLs
 *
 * Based on archived/demucs-modal/demucs_api.py Grove integration
 */

import { readFileSync } from 'fs';
import { BaseService, ServiceConfig } from './base.js';

export interface GroveUploadResult {
  uri: string; // lens:// URI
  cid: string; // IPFS CID
  gatewayUrl: string; // Public HTTP gateway URL
  size: number; // File size in bytes
}

export interface GroveConfig extends ServiceConfig {
  chainId?: number; // Grove chain ID (37111=testnet, 7579=mainnet, 84532=base-sepolia)
}

export class GroveService extends BaseService {
  private chainId: number;

  constructor(config: GroveConfig = {}) {
    super('Grove', {
      baseUrl: 'https://api.grove.storage',
      ...config,
    });

    // Default to Lens testnet (37111)
    this.chainId = config.chainId || 37111;
  }

  /**
   * Upload audio file to Grove storage
   *
   * @param audioPath Path to audio file
   * @param contentType MIME type (default: audio/mp3)
   * @returns Grove upload result with URI and gateway URL
   */
  async upload(
    audioPath: string,
    contentType: string = 'audio/mp3'
  ): Promise<GroveUploadResult> {
    this.log(`Uploading to Grove: ${audioPath}`);

    // Read file
    const audioData = readFileSync(audioPath);
    const sizeKB = audioData.length / 1024;
    const sizeMB = sizeKB / 1024;

    this.log(`  Size: ${sizeMB > 1 ? sizeMB.toFixed(2) + 'MB' : sizeKB.toFixed(2) + 'KB'}`);
    this.log(`  Chain ID: ${this.chainId}`);

    // Upload to Grove
    const response = await fetch(`${this.config.baseUrl}/?chain_id=${this.chainId}`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: audioData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grove upload failed (${response.status}): ${errorText}`);
    }

    // Grove returns array with single result
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Grove returned unexpected response format');
    }

    const result = results[0];

    // Extract CID from lens:// URI
    const cid = result.uri.replace('lens://', '');

    this.log(`✓ Uploaded to Grove`);
    this.log(`  CID: ${cid}`);
    this.log(`  Gateway: ${result.gateway_url}`);

    return {
      uri: result.uri,
      cid,
      gatewayUrl: result.gateway_url,
      size: audioData.length,
    };
  }

  /**
   * Upload buffer to Grove storage
   *
   * @param buffer Audio buffer
   * @param contentType MIME type (default: audio/mp3)
   * @param metadata Optional metadata (e.g., { name: 'file.png' })
   * @returns Grove upload result with URI and gateway URL
   */
  async uploadBuffer(
    buffer: Buffer,
    contentType: string = 'audio/mp3',
    metadata?: { name?: string }
  ): Promise<GroveUploadResult> {
    const sizeKB = buffer.length / 1024;
    const sizeMB = sizeKB / 1024;

    this.log(`Uploading buffer to Grove`);
    this.log(`  Size: ${sizeMB > 1 ? sizeMB.toFixed(2) + 'MB' : sizeKB.toFixed(2) + 'KB'}`);
    this.log(`  Chain ID: ${this.chainId}`);

    // Upload to Grove
    const response = await fetch(`${this.config.baseUrl}/?chain_id=${this.chainId}`, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Grove upload failed (${response.status}): ${errorText}`);
    }

    // Grove returns array with single result
    const results = await response.json();
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Grove returned unexpected response format');
    }

    const result = results[0];

    // Extract CID from lens:// URI
    const cid = result.uri.replace('lens://', '');

    this.log(`✓ Uploaded to Grove`);
    this.log(`  CID: ${cid}`);
    this.log(`  Gateway: ${result.gateway_url}`);

    return {
      uri: result.uri,
      cid,
      gatewayUrl: result.gateway_url,
      size: buffer.length,
    };
  }

  /**
   * Upload JSON metadata to Grove storage
   *
   * @param params Object containing json data and optional access control
   * @returns Grove upload result with URI and gateway URL
   */
  async uploadJson(params: {
    json: any;
    accessControl?: string;
  }): Promise<GroveUploadResult> {
    this.log('Uploading JSON metadata to Grove');

    // Convert JSON to buffer (compact format to match hash computation)
    const jsonString = JSON.stringify(params.json);
    const buffer = Buffer.from(jsonString, 'utf-8');

    // Upload to Grove
    const result = await this.uploadBuffer(buffer, 'application/json');

    return result;
  }
}
