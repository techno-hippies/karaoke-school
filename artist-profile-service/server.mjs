/**
 * Artist Profile Generator Service
 *
 * On-demand artist profile generation service that:
 * 1. Fetches artist metadata from Genius API
 * 2. Mints a PKP for the artist
 * 3. Creates a Lens account
 * 4. Uploads metadata to Grove storage
 * 5. Registers in ArtistRegistryV2 contract
 *
 * Designed to run on Render or any Node.js 20+ environment
 */

import express from 'express';
import { createLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, parseAbiItem } from 'viem';
import { baseSepolia } from 'viem/chains';
import { PublicClient, evmAddress } from '@lens-protocol/client';
import { createAccountWithUsername, fetchAccount, post as createPost } from '@lens-protocol/client/actions';
import { testnet } from '@lens-protocol/env';
import { chains } from '@lens-chain/sdk/viem';
import { signMessageWith, handleOperationWith } from '@lens-protocol/client/viem';
import { StorageClient, immutable, lensAccountOnly } from '@lens-chain/storage-client';
import { account as accountMetadata, textOnly } from '@lens-protocol/metadata';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));

// CORS - allow frontend to call this service
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY?.trim();
const ARTIST_REGISTRY_ADDRESS = (process.env.ARTIST_REGISTRY_ADDRESS || '0x81cE49c16D2Bf384017C2bCA7FDdACb8A15DECC7').trim();
const LENS_APP_ADDRESS = (process.env.LENS_APP_ADDRESS || '0x77fc7265c6a52E7A9dB1D887fB0F9A3d898Ae5a0').trim();

// Genius API key (exposed, free tier)
const GENIUS_API_KEY = 'z0-uHScJhlvY7rB_HwThSEZhjpmSzlWMnBhaby3tPtqJpfOeQwZ1cc5OG1bdegV7';

// Chronicle Yellowstone chain config (for PKP minting)
const chronicleChain = {
  id: 175188,
  name: 'Chronicle Yellowstone',
  nativeCurrency: { name: 'Chronicle Yellowstone', symbol: 'tstLPX', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://yellowstone-rpc.litprotocol.com/'] },
    public: { http: ['https://yellowstone-rpc.litprotocol.com/'] },
  },
  blockExplorers: {
    default: {
      name: 'Yellowstone Explorer',
      url: 'https://yellowstone-explorer.litprotocol.com/',
    },
  },
};

// ArtistRegistryV2 ABI
const REGISTRY_ABI = [
  parseAbiItem('function registerArtist(uint32 geniusArtistId, address pkpAddress, string calldata lensHandle, address lensAccountAddress, uint8 source) external'),
  parseAbiItem('function artistExists(uint32 geniusArtistId) external view returns (bool)'),
  parseAbiItem('function setHasContent(uint32 geniusArtistId, bool hasContent) external'),
  parseAbiItem('event ContentFlagUpdated(uint32 indexed geniusArtistId, bool hasContent)'),
];

// Profile source enum (for ArtistRegistryV2)
const ProfileSource = {
  MANUAL: 0,
  GENERATED: 1,
};

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Artist Profile Generator',
    status: 'running',
    version: '1.0',
    endpoints: {
      health: '/health',
      generateProfile: '/generate-artist-profile (POST)'
    },
    environment: {
      PRIVATE_KEY: PRIVATE_KEY ? 'configured' : 'missing',
      ARTIST_REGISTRY_ADDRESS: ARTIST_REGISTRY_ADDRESS || 'missing',
      LENS_APP_ADDRESS: LENS_APP_ADDRESS || 'missing'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const healthy = PRIVATE_KEY && ARTIST_REGISTRY_ADDRESS && LENS_APP_ADDRESS;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    environment: {
      PRIVATE_KEY: PRIVATE_KEY ? '✅' : '❌',
      ARTIST_REGISTRY_ADDRESS: ARTIST_REGISTRY_ADDRESS ? '✅' : '❌',
      LENS_APP_ADDRESS: LENS_APP_ADDRESS ? '✅' : '❌'
    }
  });
});

/**
 * Helper to run a pipeline script
 */
function runScript(scriptPath, args, label) {
  return new Promise((resolve, reject) => {
    const isPython = scriptPath.endsWith('.py');
    const command = isPython ? 'python3' : 'bun';

    // Adjust script path - scripts are in ../pkp-lens-flow
    const pkpLensFlowDir = path.resolve(__dirname, '../pkp-lens-flow');
    const fullScriptPath = path.join(pkpLensFlowDir, scriptPath);

    const scriptArgs = isPython ? [fullScriptPath, ...args] : ['run', fullScriptPath, ...args];

    console.log(`[Content]    Running: ${command} ${scriptArgs.join(' ')}`);

    const proc = spawn(command, scriptArgs, {
      stdio: 'pipe',
      cwd: pkpLensFlowDir,
      env: {
        ...process.env,
        DOTENV_PRIVATE_KEY: process.env.DOTENV_PRIVATE_KEY || '1dd71ccca43764a4d9b571829a6ec8be3ffdf46b8c0468880c7b821ddf17cf94',
      }
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('exit', (code) => {
      if (code === 0) {
        console.log(`[Content]    ✅ ${label} - Complete`);
        resolve({ stdout, stderr });
      } else {
        console.error(`[Content]    ❌ ${label} - Failed (code ${code})`);
        if (stderr) console.error(`[Content]    Error: ${stderr.slice(0, 500)}`);
        reject(new Error(`${label} failed with code ${code}`));
      }
    });

    proc.on('error', (error) => {
      console.error(`[Content]    ❌ ${label} - Error:`, error.message);
      reject(error);
    });
  });
}

/**
 * Background content generation job
 * Runs full pkp-lens-flow pipeline after profile is created
 */
async function generateContent(geniusArtistId, artistData, pkpData, lensData) {
  console.log(`[Content] Starting background video pipeline for ${artistData.name} (${geniusArtistId})`);

  const creator = lensData.handle.startsWith('@') ? lensData.handle : `@${lensData.handle}`; // Ensure @ prefix

  try {
    // Step 2: Crawl TikTok (top 3 videos)
    console.log(`[Content] Step 2: Crawling TikTok for top 3 videos...`);
    console.log(`[Content]    Attempting to find TikTok account: ${creator}`);

    try {
      await runScript(
        'services/crawler/tiktok_crawler.py',
        ['--creator', creator, '--copyrighted', '3', '--copyright-free', '0'],
        'Crawl TikTok'
      );
    } catch (crawlError) {
      console.log(`[Content] ⚠️  TikTok account not found or crawler failed`);
      console.log(`[Content]    This is expected for artists without TikTok presence`);
      console.log(`[Content]    Profile created but no content will be generated`);
      console.log(`[Content]    hasContent will remain false\n`);
      return; // Exit early - profile exists but no content
    }

    // Step 3: Convert Videos
    console.log(`[Content] Step 3: Converting videos...`);
    await runScript(
      'local/03-convert-videos.ts',
      ['--creator', creator],
      'Convert Videos'
    );

    // Parallel chains: Video processing (9→10→12) and Metadata enrichment (13→14→15→16)
    console.log(`[Content] Running parallel chains: Video processing + Metadata enrichment...`);

    await Promise.all([
      // Chain A: Video processing
      (async () => {
        // Step 9: Transcribe Audio
        console.log(`[Content] Chain A: Step 9 - Transcribing audio...`);
        await runScript(
          'local/09-transcribe-audio.ts',
          ['--creator', creator],
          'Transcribe Audio'
        );

        // Step 10: Translate Transcriptions
        console.log(`[Content] Chain A: Step 10 - Translating transcriptions...`);
        await runScript(
          'local/10-translate-transcriptions.ts',
          ['--creator', creator],
          'Translate Transcriptions'
        );

        // Step 12: Upload to Grove
        console.log(`[Content] Chain A: Step 12 - Uploading to Grove...`);
        await runScript(
          'local/12-upload-grove.ts',
          ['--creator', creator],
          'Upload Grove'
        );
      })(),

      // Chain B: Metadata enrichment
      (async () => {
        // Step 13: Fetch ISRC
        console.log(`[Content] Chain B: Step 13 - Fetching ISRC data...`);
        await runScript(
          'local/13-fetch-isrc.ts',
          ['--creator', creator],
          'Fetch ISRC'
        );

        // Step 14: Map Spotify→Genius
        console.log(`[Content] Chain B: Step 14 - Mapping Spotify to Genius...`);
        await runScript(
          'local/14-map-spotify-genius.ts',
          ['--creator', creator],
          'Map Spotify→Genius'
        );

        // Step 15: Fetch MLC
        console.log(`[Content] Chain B: Step 15 - Fetching MLC data...`);
        await runScript(
          'local/15-fetch-mlc.ts',
          ['--creator', creator],
          'Fetch MLC'
        );

        // Step 16: Reupload Metadata
        console.log(`[Content] Chain B: Step 16 - Reuploading metadata...`);
        await runScript(
          'local/16-reupload-metadata.ts',
          ['--creator', creator],
          'Reupload Metadata'
        );
      })()
    ]);

    // Step 18: Create Lens Posts (VIDEO content)
    console.log(`[Content] Step 18: Creating Lens video posts...`);
    await runScript(
      'local/18-create-lens-posts.ts',
      ['--creator', creator],
      'Create Lens Posts'
    );

    // Update contract hasContent = true
    console.log(`[Content] Updating contract hasContent flag...`);

    const formattedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    const account = privateKeyToAccount(formattedKey);

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    const updateTxHash = await walletClient.writeContract({
      address: ARTIST_REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'setHasContent',
      args: [geniusArtistId, true],
    });

    console.log(`[Content] ✅ Content flag updated, tx: ${updateTxHash}`);

    await publicClient.waitForTransactionReceipt({ hash: updateTxHash });

    console.log(`[Content] 🎉 Video pipeline complete for ${artistData.name}!`);

  } catch (error) {
    console.error(`[Content] ❌ Video pipeline failed for ${geniusArtistId}:`, error.message);
    console.error(`[Content] Stack:`, error.stack);
  }
}

/**
 * POST /generate-artist-profile
 *
 * FAST TRACK: Returns immediately after profile creation
 * Background: Continues generating content async
 *
 * Body: { geniusArtistId: number }
 *
 * Returns: {
 *   success: true,
 *   profileReady: true,
 *   contentGenerating: true,  // Frontend should listen for ContentFlagUpdated event
 *   geniusArtistId: number,
 *   artistName: string,
 *   pkpAddress: string,
 *   pkpTokenId: string,
 *   lensHandle: string,
 *   lensAccountAddress: string,
 *   registryTxHash: string
 * }
 */
app.post('/generate-artist-profile', async (req, res) => {
  const { geniusArtistId } = req.body;

  if (!geniusArtistId || typeof geniusArtistId !== 'number') {
    return res.status(400).json({
      error: 'Invalid request: geniusArtistId (number) required'
    });
  }

  console.log(`[Generate] Starting profile generation for Genius artist ${geniusArtistId}`);

  // Validate environment
  if (!PRIVATE_KEY || !ARTIST_REGISTRY_ADDRESS || !LENS_APP_ADDRESS) {
    console.error('[Generate] Missing environment variables');
    return res.status(500).json({
      error: 'Server misconfigured: missing environment variables'
    });
  }

  try {
    // Setup account
    if (!PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not found in environment');
    }
    const formattedKey = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`;
    const account = privateKeyToAccount(formattedKey);
    console.log(`[Generate] Using EOA: ${account.address}`);

    // STEP 1: Fetch Genius artist metadata
    console.log('[Generate] Step 1/5: Fetching Genius artist data...');
    const artistUrl = `https://api.genius.com/artists/${geniusArtistId}?text_format=plain`;

    const geniusResponse = await fetch(artistUrl, {
      headers: {
        'Authorization': `Bearer ${GENIUS_API_KEY}`
      }
    });

    if (!geniusResponse.ok) {
      if (geniusResponse.status === 404) {
        return res.status(404).json({
          error: `Artist not found: Genius ID ${geniusArtistId}`
        });
      }
      throw new Error(`Genius API error: ${geniusResponse.status}`);
    }

    const geniusData = await geniusResponse.json();
    const artist = geniusData.response?.artist;

    if (!artist) {
      throw new Error('Invalid response from Genius API');
    }

    const artistName = artist.name;
    const artistBio = artist.description?.plain || `${artistName} - Artist profile`;
    const artistImageUrl = artist.image_url;
    const artistInstagram = artist.instagram_name;
    const artistTwitter = artist.twitter_name;

    console.log(`[Generate] ✅ Found artist: ${artistName}`);
    console.log(`[Generate]    Followers: ${artist.followers_count?.toLocaleString() || 'N/A'}`);
    console.log(`[Generate]    Verified: ${artist.is_verified ? 'Yes' : 'No'}`);

    // STEP 2: Mint PKP
    console.log('[Generate] Step 2/5: Minting PKP...');

    const litClient = await createLitClient({
      network: nagaDev,
    });

    const chronicleWalletClient = createWalletClient({
      account,
      chain: chronicleChain,
      transport: http('https://yellowstone-rpc.litprotocol.com/'),
    });

    const mintResult = await litClient.mintWithEoa({
      account: chronicleWalletClient.account,
    });

    const pkpPublicKey = mintResult.data.pubkey;
    const pkpAddress = mintResult.data.ethAddress;
    const pkpTokenId = mintResult.data.tokenId.toString();
    const pkpMintTxHash = mintResult.txHash;

    console.log(`[Generate] ✅ PKP minted: ${pkpAddress}`);
    console.log(`[Generate]    Token ID: ${pkpTokenId}`);
    console.log(`[Generate]    Tx: ${pkpMintTxHash}`);

    // STEP 3: Create Lens account
    console.log('[Generate] Step 3/5: Creating Lens account...');

    // Generate Lens handle from artist name
    const lensHandle = artistName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 26); // Lens handle max length

    console.log(`[Generate]    Desired handle: @${lensHandle}`);

    // Create Lens client
    const lensClient = PublicClient.create({
      environment: testnet,
      origin: 'https://artist-profile-service.render.com',
    });

    // Create wallet client for Lens
    const lensWalletClient = createWalletClient({
      account,
      chain: chains.testnet,
      transport: http(),
    });

    // Login as onboarding user
    const authenticated = await lensClient.login({
      onboardingUser: {
        app: evmAddress(LENS_APP_ADDRESS),
        wallet: evmAddress(account.address),
      },
      signMessage: signMessageWith(lensWalletClient),
    });

    if (authenticated.isErr()) {
      throw new Error(`Lens login failed: ${authenticated.error.message}`);
    }

    const sessionClient = authenticated.value;
    console.log(`[Generate] ✅ Authenticated with Lens`);

    // Create account metadata
    const metadata = accountMetadata({
      name: artistName,
      bio: artistBio,
      picture: artistImageUrl || undefined,
      attributes: [
        {
          type: 'String',
          key: 'source',
          value: 'generated'
        },
        {
          type: 'Number',
          key: 'genius_artist_id',
          value: String(geniusArtistId)
        },
        {
          type: 'String',
          key: 'pkp_address',
          value: pkpAddress
        },
        ...(artistInstagram ? [{
          type: 'String',
          key: 'instagram',
          value: artistInstagram
        }] : []),
        ...(artistTwitter ? [{
          type: 'String',
          key: 'twitter',
          value: artistTwitter
        }] : [])
      ]
    });

    // STEP 4: Upload metadata to Grove
    console.log('[Generate] Step 4/5: Uploading metadata to Grove...');

    const storageClient = StorageClient.create();
    const uploadResult = await storageClient.uploadAsJson(metadata, {
      name: `${lensHandle}-account-metadata.json`,
      acl: immutable(chains.testnet.id),
    });

    console.log(`[Generate] ✅ Metadata uploaded: ${uploadResult.uri}`);

    // Create Lens account with username
    console.log(`[Generate]    Creating account @${lensHandle}...`);

    const createResult = await createAccountWithUsername(sessionClient, {
      username: {
        localName: lensHandle,
      },
      metadataUri: uploadResult.uri,
    })
      .andThen(handleOperationWith(lensWalletClient))
      .andThen(sessionClient.waitForTransaction);

    if (createResult.isErr()) {
      throw new Error(`Account creation failed: ${createResult.error.message}`);
    }

    const lensTxHash = createResult.value;
    console.log(`[Generate] ✅ Lens account created, tx: ${lensTxHash}`);

    // Fetch account to get address (with retries for indexing)
    console.log(`[Generate]    Waiting for Lens indexer...`);
    let lensAccountAddress = null;
    let retries = 0;
    const maxRetries = 20;
    const retryDelay = 5000; // 5 seconds

    while (retries < maxRetries && !lensAccountAddress) {
      const accountResult = await fetchAccount(lensClient, {
        username: {
          localName: lensHandle,
        },
      });

      if (accountResult.isOk() && accountResult.value) {
        lensAccountAddress = accountResult.value.address;
        break;
      }

      retries++;
      if (retries < maxRetries) {
        console.log(`[Generate]    Retry ${retries}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!lensAccountAddress) {
      throw new Error(`Could not fetch Lens account address after ${maxRetries} retries`);
    }

    console.log(`[Generate] ✅ Lens account address: ${lensAccountAddress}`);

    // STEP 5: Register in ArtistRegistryV2
    console.log('[Generate] Step 5/5: Registering in contract...');

    const baseSepoliaPublicClient = createPublicClient({
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    const baseSepoliaWalletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http('https://sepolia.base.org'),
    });

    // Check if already registered
    const exists = await baseSepoliaPublicClient.readContract({
      address: ARTIST_REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'artistExists',
      args: [geniusArtistId],
    });

    if (exists) {
      console.log(`[Generate] ⚠️  Artist already registered in contract`);
      // Still return success with existing data
      return res.status(200).json({
        success: true,
        alreadyRegistered: true,
        geniusArtistId,
        artistName,
        pkpAddress,
        pkpTokenId,
        lensHandle: `@${lensHandle}`,
        lensAccountAddress,
      });
    }

    // Register artist
    const registerTxHash = await baseSepoliaWalletClient.writeContract({
      address: ARTIST_REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: 'registerArtist',
      args: [
        geniusArtistId,
        pkpAddress,
        `@${lensHandle}`,
        lensAccountAddress,
        ProfileSource.GENERATED
      ],
    });

    console.log(`[Generate] ✅ Registered in contract, tx: ${registerTxHash}`);

    // Wait for transaction
    await baseSepoliaPublicClient.waitForTransactionReceipt({
      hash: registerTxHash,
    });

    console.log(`[Generate] ✅ Transaction confirmed`);
    console.log(`[Generate] 🎉 Profile registration complete!`);
    console.log(`[Generate] 📦 Starting background content generation...`);

    // Prepare artist data for background job
    const artistDataForBg = {
      name: artistName,
      bio: artistBio,
      imageUrl: artistImageUrl,
      instagram: artistInstagram,
      twitter: artistTwitter,
      geniusArtistId
    };

    const pkpDataForBg = {
      address: pkpAddress,
      tokenId: pkpTokenId
    };

    const lensDataForBg = {
      handle: lensHandle,
      address: lensAccountAddress,
      sessionClient  // Keep session for posting
    };

    // Start background content generation (don't await)
    setImmediate(() => {
      generateContent(geniusArtistId, artistDataForBg, pkpDataForBg, lensDataForBg)
        .catch(error => {
          console.error(`[Generate] Background job failed for ${geniusArtistId}:`, error);
        });
    });

    // Return success IMMEDIATELY
    return res.status(200).json({
      success: true,
      profileReady: true,
      contentGenerating: true,  // Frontend should listen for ContentFlagUpdated event
      geniusArtistId,
      artistName,
      pkpAddress,
      pkpTokenId,
      pkpMintTxHash,
      lensHandle: `@${lensHandle}`,
      lensAccountAddress,
      lensTxHash,
      registryTxHash: registerTxHash,
      source: 'GENERATED',
      message: 'Profile created! Content generation in progress. Listen for ContentFlagUpdated event.'
    });

  } catch (error) {
    console.error('[Generate] Error:', error.message);
    console.error('[Generate] Stack:', error.stack);

    return res.status(500).json({
      error: error.message,
      geniusArtistId
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Artist Profile Generator running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Generate:     POST http://localhost:${PORT}/generate-artist-profile`);
  console.log('');
  console.log('Environment check:');
  console.log(`   PRIVATE_KEY: ${PRIVATE_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   ARTIST_REGISTRY_ADDRESS: ${ARTIST_REGISTRY_ADDRESS ? '✅ Set' : '❌ Missing'}`);
  console.log(`   LENS_APP_ADDRESS: ${LENS_APP_ADDRESS ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  if (!PRIVATE_KEY || !ARTIST_REGISTRY_ADDRESS || !LENS_APP_ADDRESS) {
    console.warn('⚠️  WARNING: Missing required environment variables!');
    console.warn('   Server will return 503 on /health until configured');
  }
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
