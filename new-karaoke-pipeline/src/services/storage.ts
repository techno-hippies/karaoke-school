/**
 * Storage Service - Unified storage abstraction
 *
 * Strategy:
 * - Grove: All audio files + temporary processing files
 * - load.network: Small metadata only (<100KB) - alignments, translations, segment metadata
 *
 * load.network uses EVM blockchain transactions to store data
 * Based on: ../turbo-test/load-network-uploader.js (EVM implementation, lines 187-266)
 *
 * IMPORTANT: Audio files (even final enhanced) should use Grove due to size limits.
 * load.network blockchain calldata is only suitable for small JSON metadata.
 */

import { ethers } from 'ethers';
import { createGroveService } from './grove';

// Load Network Configuration (EVM)
const LOAD_NETWORK_CONFIG = {
  rpcUrl: 'https://alphanet.load.network',
  chainId: 9496,
  explorer: 'https://explorer.load.network',
  faucet: 'https://load.network/faucet',
};

export interface StorageUploadResult {
  cid: string;         // Content identifier (tx hash or Grove storage_key)
  url: string;         // Public URL to access content
  provider: 'grove' | 'loadnetwork';
  size: number;        // File size in bytes
  timestamp: Date;
  txHash?: string;     // Transaction hash (load.network only)
  explorer?: string;   // Block explorer URL (load.network only)
}

export class StorageService {
  private loadNetworkWallet: ethers.Wallet | null = null;
  private loadNetworkProvider: ethers.JsonRpcProvider | null = null;
  private groveService = createGroveService();

  constructor() {
    // Lazy initialization - only initialize load.network when needed
  }

  /**
   * Initialize load.network EVM connection using PRIVATE_KEY from env
   * Based on: turbo-test/load-network-uploader.js:77-120
   */
  private async initLoadNetwork(): Promise<void> {
    if (this.loadNetworkWallet && this.loadNetworkProvider) {
      return; // Already initialized
    }

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY not found in environment variables');
    }

    // Initialize provider and wallet
    this.loadNetworkProvider = new ethers.JsonRpcProvider(LOAD_NETWORK_CONFIG.rpcUrl);
    this.loadNetworkWallet = new ethers.Wallet(privateKey, this.loadNetworkProvider);

    // Get network info
    const network = await this.loadNetworkProvider.getNetwork();
    console.log(`[load.network] 🔗 Connected to Chain ID: ${network.chainId}`);

    // Check balance
    const balance = await this.loadNetworkProvider.getBalance(this.loadNetworkWallet.address);
    const balanceEth = ethers.formatEther(balance);
    console.log(`[load.network] 💰 Balance: ${balanceEth} tLOAD`);

    if (balanceEth === '0.0') {
      console.warn(`[load.network] ⚠️  No tLOAD tokens. Get them from faucet: ${LOAD_NETWORK_CONFIG.faucet}`);
    }
  }

  /**
   * Upload temporary file to Grove (for processing intermediates)
   *
   * Use this for:
   * - Downloaded audio from yt-dlp/Soulseek
   * - Demucs separation outputs (temporary)
   * - Any intermediate processing files
   *
   * @param buffer File data as Buffer
   * @param contentType MIME type
   * @param fileName Descriptive name for logging
   * @returns Upload result with Grove URL
   */
  async uploadToGrove(
    buffer: Buffer,
    contentType: string,
    fileName: string
  ): Promise<StorageUploadResult> {
    console.log(`[Storage] Uploading to Grove (temp): ${fileName} (${(buffer.length / 1024).toFixed(2)} KB)`);

    const result = await this.groveService.uploadAudio(
      buffer.toString('base64'),
      fileName,
      'instrumental'
    );

    return {
      cid: result.cid,
      url: result.url,
      provider: 'grove',
      size: result.size,
      timestamp: result.timestamp,
    };
  }

  /**
   * Upload final immutable content to load.network via EVM blockchain transaction
   *
   * Use this for:
   * - ElevenLabs alignment data (word/character timing)
   * - Gemini translations (multi-language lyrics)
   * - Final enhanced audio (full song + clips)
   * - Karaoke segments metadata
   * - Any final immutable content
   *
   * Implementation based on: ../turbo-test/load-network-uploader.js:187-266
   *
   * @param buffer File data as Buffer
   * @param contentType MIME type
   * @param fileName Descriptive name for logging
   * @returns Upload result with transaction hash and explorer URL
   */
  async uploadToLoadNetwork(
    buffer: Buffer,
    contentType: string,
    fileName: string
  ): Promise<StorageUploadResult> {
    await this.initLoadNetwork();

    if (!this.loadNetworkWallet || !this.loadNetworkProvider) {
      throw new Error('load.network not initialized');
    }

    const sizeMB = buffer.length / (1024 * 1024);
    console.log(`[load.network] ⛓️  Uploading to blockchain: ${fileName} (${sizeMB.toFixed(2)} MB)`);

    try {
      // Convert buffer to bytes
      const dataBytes = buffer;

      // Get fee data for transaction
      const feeData = await this.loadNetworkProvider.getFeeData();

      // Conservative gas limit calculation (from turbo-test/load-network-uploader.js:207-210)
      const baseGas = 21000;
      const dataGas = dataBytes.length * 68; // Each byte costs 68 gas
      const safetyBuffer = 50000; // Large safety buffer
      const gasLimit = baseGas + dataGas + safetyBuffer;

      const tx = {
        to: '0x000000000000000000000000000000000000dEaD', // Burn/dummy address
        data: ethers.hexlify(dataBytes),
        gasLimit: Math.min(gasLimit, 5000000), // Cap at 5M
        maxFeePerGas: feeData.maxFeePerGas || ethers.parseUnits('2', 'gwei'),
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas || ethers.parseUnits('1', 'gwei')
      };

      console.log(`[load.network] 📊 Gas calculation: base=${baseGas}, data=${dataBytes.length} bytes * 68 = ${dataGas}, buffer=${safetyBuffer}`);
      console.log(`[load.network] 💰 Total estimated gas: ${gasLimit}`);

      // Try to estimate gas using provider as fallback check
      try {
        const estimatedGas = await this.loadNetworkProvider.estimateGas({
          to: tx.to,
          data: tx.data
        });
        console.log(`[load.network] 🔍 Provider estimate: ${estimatedGas} gas`);

        const estimatedGasNum = Number(estimatedGas);
        if (estimatedGasNum > tx.gasLimit) {
          console.log(`[load.network] ⚠️  Increasing gas limit to provider estimate`);
          tx.gasLimit = estimatedGasNum + 10000; // Add 10k buffer
        }
      } catch (estimateError: any) {
        console.log(`[load.network] ⚠️  Gas estimation failed, using calculated: ${estimateError.message}`);
      }

      console.log(`[load.network] 📝 Transaction data size: ${dataBytes.length} bytes`);
      console.log(`[load.network] 💰 Final gas limit: ${tx.gasLimit}`);

      // Send transaction
      const sentTx = await this.loadNetworkWallet.sendTransaction(tx);
      console.log(`[load.network] 📤 Transaction sent: ${sentTx.hash}`);

      const explorerUrl = `${LOAD_NETWORK_CONFIG.explorer}/tx/${sentTx.hash}`;
      console.log(`[load.network] 🔍 Explorer: ${explorerUrl}`);

      // Wait for confirmation
      const receipt = await sentTx.wait();
      console.log(`[load.network] ✅ Transaction confirmed in block ${receipt!.blockNumber}`);

      return {
        cid: sentTx.hash,           // Use tx hash as CID
        url: explorerUrl,            // Block explorer URL
        provider: 'loadnetwork',
        size: buffer.length,
        timestamp: new Date(),
        txHash: sentTx.hash,
        explorer: explorerUrl,
      };

    } catch (error: any) {
      console.error(`[load.network] ❌ Upload failed:`, error.message);
      if (error.code) {
        console.error(`[load.network] Error code: ${error.code}`);
      }
      throw new Error(`load.network upload failed: ${error.message}`);
    }
  }

  /**
   * Download file from Grove
   */
  async downloadFromGrove(cid: string): Promise<Buffer> {
    return this.groveService.downloadAudio(cid);
  }

  /**
   * Download file from load.network (from blockchain transaction data)
   */
  async downloadFromLoadNetwork(txHash: string): Promise<Buffer> {
    if (!this.loadNetworkProvider) {
      await this.initLoadNetwork();
    }

    console.log(`[load.network] Downloading from tx: ${txHash}`);

    const tx = await this.loadNetworkProvider!.getTransaction(txHash);
    if (!tx || !tx.data) {
      throw new Error(`load.network transaction not found: ${txHash}`);
    }

    // Extract data from transaction
    return Buffer.from(tx.data.slice(2), 'hex'); // Remove '0x' prefix
  }
}

/**
 * Create singleton storage service instance
 */
let storageServiceInstance: StorageService | null = null;

export function createStorageService(): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService();
  }
  return storageServiceInstance;
}

/**
 * Helper: Upload to Grove (temporary processing files)
 */
export async function uploadToGrove(
  buffer: Buffer,
  contentType: string,
  fileName: string
): Promise<StorageUploadResult> {
  const storage = createStorageService();
  return storage.uploadToGrove(buffer, contentType, fileName);
}

/**
 * Helper: Upload to load.network (final immutable content)
 */
export async function uploadToLoadNetwork(
  buffer: Buffer,
  contentType: string,
  fileName: string
): Promise<StorageUploadResult> {
  const storage = createStorageService();
  return storage.uploadToLoadNetwork(buffer, contentType, fileName);
}
