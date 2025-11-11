#!/usr/bin/env node

/**
 * Load Network Testnet Uploader - Multi-Chain Support
 * 
 * Supports both:
 * 1. Arweave uploads via Turbo SDK (hot storage)
 * 2. Load Network blockchain transactions (EVM)
 * 
 * Usage:
 *   node load-network-uploader.js --file song.mp3 --type turbo
 *   node load-network-uploader.js --file metadata.json --type evm
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TurboFactory, ArweaveSigner, developmentTurboConfiguration } from '@ardrive/turbo-sdk';
import Arweave from 'arweave';
import { ethers } from 'ethers';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Network Configuration
const LOAD_NETWORK_CONFIG = {
  rpcUrl: 'https://alphanet.load.network',
  chainId: 9496,
  explorer: 'https://explorer.load.network',
  faucet: 'https://load.network/faucet'
};

// Turbo SDK Configuration for Load Network
const LOAD_TURBO_CONFIG = {
  ...developmentTurboConfiguration,
  uploadServiceConfig: {
    url: 'https://loaded-turbo-api.load.network', // Load's Turbo endpoint
  },
};

class LoadNetworkUploader {
  constructor() {
    this.arweave = new Arweave({});
    this.loadNetworkInitialized = false;
  }

  /**
   * Initialize Arweave wallet for Turbo uploads
   */
  async initArweaveWallet(walletPath = './turbo-wallet.json') {
    try {
      let jwk;
      if (fs.existsSync(walletPath)) {
        jwk = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
        const address = await this.arweave.wallets.jwkToAddress(jwk);
        console.log(`✅ Arweave wallet loaded: ${address}`);
        return jwk;
      } else {
        console.log('⚠️  Arweave wallet not found. Creating new wallet...');
        jwk = await this.arweave.wallets.generate();
        fs.writeFileSync(walletPath, JSON.stringify(jwk, null, 2));
        const address = await this.arweave.wallets.jwkToAddress(jwk);
        console.log(`✅ New Arweave wallet created: ${address}`);
        console.log(`💾 Wallet saved to: ${walletPath}`);
        return jwk;
      }
    } catch (error) {
      console.error('❌ Failed to initialize Arweave wallet:', error.message);
      throw error;
    }
  }

  /**
   * Initialize EVM wallet for Load Network
   */
  async initEvmWallet(privateKeyPath = './load-network-wallet.json') {
    try {
      let privateKey;
      
      if (fs.existsSync(privateKeyPath)) {
        const walletData = JSON.parse(fs.readFileSync(privateKeyPath, 'utf-8'));
        privateKey = walletData.privateKey || walletData;
        console.log(`✅ EVM wallet loaded from ${privateKeyPath}`);
      } else {
        // Generate new EVM wallet for testing
        const wallet = ethers.Wallet.createRandom();
        privateKey = wallet.privateKey;
        fs.writeFileSync(privateKeyPath, JSON.stringify({ 
          address: wallet.address, 
          privateKey: wallet.privateKey 
        }, null, 2));
        console.log(`✅ New EVM wallet created: ${wallet.address}`);
        console.log(`💾 Wallet saved to: ${privateKeyPath}`);
      }

      // Initialize Load Network connection
      this.provider = new ethers.JsonRpcProvider(LOAD_NETWORK_CONFIG.rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      
      // Get network info
      const network = await this.provider.getNetwork();
      console.log(`🔗 Connected to Load Network (Chain ID: ${network.chainId})`);
      
      // Check balance
      const balance = await this.provider.getBalance(this.wallet.address);
      const balanceEth = ethers.formatEther(balance);
      console.log(`💰 Balance: ${balanceEth} tLOAD`);
      
      if (balanceEth === '0.0') {
        console.log(`⚠️  No tLOAD tokens. Get them from faucet: ${LOAD_NETWORK_CONFIG.faucet}`);
      }
      
      this.loadNetworkInitialized = true;
      return this.wallet;
    } catch (error) {
      console.error('❌ Failed to initialize EVM wallet:', error.message);
      throw error;
    }
  }

  /**
   * Upload file to Arweave via Turbo SDK (hot storage)
   */
  async uploadToArweaveTurbo(filePath, options = {}) {
    try {
      console.log(`🚀 Starting Turbo upload to Arweave...`);
      
      // Initialize Arweave wallet
      const jwk = await this.initArweaveWallet(options.walletPath);
      const signer = new ArweaveSigner(jwk);
      
      // Create Turbo client
      const turbo = TurboFactory.authenticated({ 
        signer, 
        ...LOAD_TURBO_CONFIG 
      });
      
      // Read file
      const fileStats = fs.statSync(filePath);
      const fileName = path.basename(filePath);
      const mimeType = this.getMimeType(fileName);
      
      console.log(`📁 File: ${fileName} (${fileStats.size} bytes)`);
      
      // Upload with progress tracking
      const uploadResult = await turbo.uploadFile({
        fileStreamFactory: () => fs.createReadStream(filePath),
        fileSizeFactory: () => fileStats.size,
        dataItemOpts: {
          tags: [
            { name: 'Content-Type', value: mimeType },
            { name: 'App-Name', value: 'LoadNetworkUploader' },
            { name: 'Network', value: 'Load-Alphanet' },
            { name: 'Timestamp', value: new Date().toISOString() },
            ...options.additionalTags || []
          ],
        },
        signal: AbortSignal.timeout(300000), // 5 minute timeout
      });
      
      console.log('✅ Turbo upload successful!');
      console.log(`🆔 DataItem ID: ${uploadResult.id}`);
      console.log(`👤 Owner: ${uploadResult.owner}`);
      console.log(`🔗 Arweave URL: https://arweave.net/${uploadResult.id}`);
      console.log(`⚡ Fast Gateway: https://gateway.s3-node-1.load.network/resolve/${uploadResult.id}`);
      
      return {
        id: uploadResult.id,
        owner: uploadResult.owner,
        network: 'arweave-turbo',
        url: `https://arweave.net/${uploadResult.id}`,
        fastUrl: `https://gateway.s3-node-1.load.network/resolve/${uploadResult.id}`,
        size: fileStats.size,
        type: mimeType
      };
      
    } catch (error) {
      console.error('❌ Turbo upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Upload data to Load Network blockchain (EVM)
   */
  async uploadToLoadNetwork(data, options = {}) {
    try {
      if (!this.loadNetworkInitialized) {
        await this.initEvmWallet(options.walletPath);
      }
      
      console.log(`⛓️  Starting Load Network upload...`);
      
      // Convert data to bytes
      let dataBytes;
      if (typeof data === 'string') {
        dataBytes = ethers.toUtf8Bytes(data);
      } else {
        dataBytes = ethers.toUtf8Bytes(JSON.stringify(data));
      }
      
      // Get fee data for transaction
      const feeData = await this.provider.getFeeData();
      
      // Use a much more conservative gas limit calculation
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
      
      console.log(`📊 Gas calculation: base=${baseGas}, data=${dataBytes.length} bytes * 68 = ${dataGas}, buffer=${safetyBuffer}`);
      console.log(`💰 Total estimated gas: ${gasLimit}`);
      
      // Try to estimate gas using the provider as a fallback check
      try {
        const estimatedGas = await this.provider.estimateGas({
          to: tx.to,
          data: tx.data
        });
        console.log(`🔍 Provider estimate: ${estimatedGas} gas`);
        
        // Convert BigInt to number for comparison (ethers v6 returns BigInt)
        const estimatedGasNum = Number(estimatedGas);
        if (estimatedGasNum > tx.gasLimit) {
          console.log(`⚠️  Increasing gas limit to provider estimate`);
          tx.gasLimit = estimatedGasNum + 10000; // Add 10k buffer
        }
      } catch (estimateError) {
        console.log(`⚠️  Gas estimation failed, using calculated: ${estimateError.message}`);
      }
      
      console.log(`📝 Transaction data size: ${dataBytes.length} bytes`);
      console.log(`💰 Estimated gas: ${tx.gasLimit}`);
      
      // Send transaction
      const sentTx = await this.wallet.sendTransaction(tx);
      console.log(`📤 Transaction sent: ${sentTx.hash}`);
      console.log(`🔍 Explorer: ${LOAD_NETWORK_CONFIG.explorer}/tx/${sentTx.hash}`);
      
      // Wait for confirmation
      const receipt = await sentTx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
      
      return {
        hash: sentTx.hash,
        blockNumber: receipt.blockNumber,
        network: 'load-network',
        explorer: `${LOAD_NETWORK_CONFIG.explorer}/tx/${sentTx.hash}`,
        dataSize: dataBytes.length,
        gasUsed: receipt.gasUsed.toString()
      };
      
    } catch (error) {
      console.error('❌ Load Network upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Upload file with anchoring support (Turbo + Load Network metadata)
   */
  async uploadWithAnchoring(filePath, options = {}) {
    try {
      console.log(`🎯 Starting comprehensive upload with anchoring...`);
      
      // Step 1: Upload to Arweave via Turbo (hot storage)
      const turboResult = await this.uploadToArweaveTurbo(filePath, options);
      
      // Step 2: Store metadata on Load Network blockchain
      const metadata = {
        filename: path.basename(filePath),
        size: turboResult.size,
        mimeType: turboResult.type,
        turboId: turboResult.id,
        arweaveUrl: turboResult.url,
        uploadedAt: new Date().toISOString(),
        network: 'load-network'
      };
      
      const chainResult = await this.uploadToLoadNetwork(metadata, options);
      
      console.log(`🎉 Comprehensive upload complete!`);
      console.log(`📊 Results:`);
      console.log(`   • Hot Storage (Turbo): ${turboResult.id}`);
      console.log(`   • Blockchain Record: ${chainResult.hash}`);
      console.log(`   • Explorer: ${chainResult.explorer}`);
      
      return {
        success: true,
        turbo: turboResult,
        blockchain: chainResult,
        metadata
      };
      
    } catch (error) {
      console.error('❌ Comprehensive upload failed:', error.message);
      throw error;
    }
  }

  /**
   * Test Load Network connectivity and balances
   */
  async testLoadNetworkConnection() {
    try {
      console.log(`🧪 Testing Load Network connection...`);
      
      await this.initEvmWallet();
      
      // Test RPC connectivity
      const blockNumber = await this.provider.getBlockNumber();
      console.log(`✅ RPC connected. Current block: ${blockNumber}`);
      
      // Test gas estimation
      const gasPrice = await this.provider.getFeeData();
      console.log(`⛽ Gas price: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`);
      
      return true;
    } catch (error) {
      console.error('❌ Load Network test failed:', error.message);
      return false;
    }
  }

  /**
   * Get MIME type from file extension
   */
  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const config = {
    file: null,
    type: 'turbo', // 'turbo', 'evm', or 'both'
    walletPath: './test-wallet.json',
    evmWalletPath: './load-network-wallet.json',
    ...Object.fromEntries(
      args.filter(arg => arg.startsWith('--')).map(arg => {
        const [key, value] = arg.slice(2).split('=');
        return [key, value || true];
      })
    )
  };
  
  if (!config.file) {
    console.log(`
🚀 Load Network Testnet Uploader

Usage:
  node load-network-uploader.js --file=path/to/file --type=turbo
  node load-network-uploader.js --file=path/to/file --type=evm
  node load-network-uploader.js --file=path/to/file --type=both

Options:
  --file=path          File to upload
  --type=turbo         Upload to Arweave via Turbo (hot storage)
  --type=evm           Upload to Load Network blockchain
  --type=both          Upload to both (comprehensive)
  --wallet=path        Custom Arweave wallet path
  --evm-wallet=path    Custom EVM wallet path
  --test-only          Only test connectivity

Examples:
  node load-network-uploader.js --file=song.mp3 --type=turbo
  node load-network-uploader.js --file=data.json --type=evm
  node load-network-uploader.js --file=metadata.json --type=both
  node load-network-uploader.js --test-only
    `);
    process.exit(1);
  }
  
  const uploader = new LoadNetworkUploader();
  
  try {
    if (config.testOnly) {
      await uploader.testLoadNetworkConnection();
      return;
    }
    
    if (!fs.existsSync(config.file)) {
      throw new Error(`File not found: ${config.file}`);
    }
    
    switch (config.type.toLowerCase()) {
      case 'turbo':
        const turboResult = await uploader.uploadToArweaveTurbo(config.file, {
          walletPath: config.wallet
        });
        console.log('\n🎉 Turbo upload completed successfully!');
        break;
        
      case 'evm':
        const fileContent = fs.readFileSync(config.file);
        const evmResult = await uploader.uploadToLoadNetwork(fileContent, {
          walletPath: config.evmWallet
        });
        console.log('\n🎉 Load Network upload completed successfully!');
        break;
        
      case 'both':
        const bothResult = await uploader.uploadWithAnchoring(config.file, {
          walletPath: config.wallet,
          evmWalletPath: config.evmWallet
        });
        console.log('\n🎉 Comprehensive upload completed successfully!');
        break;
        
      default:
        throw new Error(`Unknown upload type: ${config.type}`);
    }
    
  } catch (error) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { LoadNetworkUploader };
