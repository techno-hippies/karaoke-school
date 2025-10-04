#!/usr/bin/env bun

// Load and decrypt environment variables
import '@dotenvx/dotenvx/config';

import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { chains } from "@lens-chain/sdk/viem";
import { immutable, StorageClient } from "@lens-chain/storage-client";
import { ElevenLabsProcessor } from './processors/elevenlabs.js';
import { MetadataGenerator } from './processors/metadata.js';
import {
  initializeSongCatalog,
  songExistsInCatalog,
  addSongToCatalog,
  updateSongInCatalog,
  getSongCount,
  type SongCatalogConfig
} from './contract.js';
import type { SongFiles, SongConfig, UploadResult, EnhancedSongMetadata } from './types.js';

const SONGS_DIR = './songs';

let storageClient: StorageClient | null = null;

function getStorageClient(): StorageClient {
  if (!storageClient) {
    storageClient = StorageClient.create();
  }
  return storageClient;
}

/**
 * Scan songs directory and return list of song folders
 */
async function getSongFolders(): Promise<string[]> {
  try {
    const entries = await readdir(SONGS_DIR);
    const folders: string[] = [];

    for (const entry of entries) {
      const fullPath = join(SONGS_DIR, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        folders.push(entry);
      }
    }

    return folders;
  } catch (error) {
    console.error('Error scanning songs directory:', error);
    return [];
  }
}

/**
 * Load song configuration from metadata.json
 */
async function loadSongConfig(songId: string): Promise<SongConfig | null> {
  const configPath = join(SONGS_DIR, songId, 'metadata.json');

  try {
    const configText = await Bun.file(configPath).text();
    const config = JSON.parse(configText) as SongConfig;

    // Ensure ID is set
    if (!config.id) {
      config.id = songId;
    }

    return config;
  } catch (error) {
    // If no metadata.json, use folder name as ID
    console.log(`No metadata.json for ${songId}, using folder name as ID`);
    return {
      id: songId
    };
  }
}

/**
 * Load song files from a directory
 */
async function loadSongFiles(songId: string): Promise<SongFiles | null> {
  const songDir = join(SONGS_DIR, songId);

  try {
    const files = await readdir(songDir);
    const songFiles: Partial<SongFiles> = {};

    for (const file of files) {
      const filePath = join(songDir, file);
      const ext = extname(file).toLowerCase();

      if (ext === '.mp3' || ext === '.wav' || ext === '.m4a') {
        if (file.toLowerCase().includes('vocals') || file.toLowerCase().includes('stems')) {
          // Voice stems file for ElevenLabs processing
          songFiles.voiceStems = new File([await Bun.file(filePath).arrayBuffer()], file, {
            type: `audio/${ext.slice(1)}`
          });
        } else {
          // Full song audio for Grove upload and playback
          songFiles.audio = new File([await Bun.file(filePath).arrayBuffer()], file, {
            type: `audio/${ext.slice(1)}`
          });
        }
      } else if (file === 'lyrics.txt') {
        songFiles.lyrics = new File([await Bun.file(filePath).arrayBuffer()], file, {
          type: 'text/plain'
        });
      } else if (ext === '.jpg' || ext === '.png' || ext === '.webp') {
        songFiles.thumbnail = new File([await Bun.file(filePath).arrayBuffer()], file, {
          type: `image/${ext.slice(1)}`
        });
      }
    }

    if (!songFiles.audio) {
      console.error(`Song ${songId} missing required full audio file`);
      return null;
    }

    return songFiles as SongFiles;
  } catch (error) {
    console.error(`Error loading song files for ${songId}:`, error);
    return null;
  }
}

/**
 * Upload a song folder to Grove
 */
async function uploadSong(songId: string, songFiles: SongFiles, metadata: EnhancedSongMetadata): Promise<UploadResult> {
  const storage = getStorageClient();
  const acl = immutable(chains.mainnet.id);

  console.log(`Uploading song: ${songId}`);

  // Create metadata file from enhanced data
  const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: 'application/json'
  });
  const metadataFile = new File([metadataBlob], 'metadata.json', {
    type: 'application/json'
  });

  // Prepare files array - only upload audio, metadata, and thumbnail to Grove
  const files = [songFiles.audio, metadataFile];
  if (songFiles.thumbnail) {
    files.push(songFiles.thumbnail);
  }

  console.log(`Uploading to Grove: ${files.map(f => f.name).join(', ')}`);
  if (songFiles.voiceStems) {
    console.log(`Voice stems (${songFiles.voiceStems.name}) used for processing but NOT uploaded to Grove`);
  }

  // Create dynamic index for the folder
  const index = (resources: any[]) => {
    console.log('Resources received:', resources.length);

    const audioResource = resources[0]; // First file is audio
    const metadataResource = resources[1]; // Second file is metadata
    const thumbnailResource = resources.length > 2 ? resources[2] : null;

    return {
      id: songId,
      type: 'karaoke-song',
      audio: audioResource ? {
        uri: audioResource.uri,
        gatewayUrl: audioResource.gatewayUrl,
        storageKey: audioResource.storageKey
      } : null,
      metadata: metadataResource ? {
        uri: metadataResource.uri,
        gatewayUrl: metadataResource.gatewayUrl,
        storageKey: metadataResource.storageKey
      } : null,
      thumbnail: thumbnailResource ? {
        uri: thumbnailResource.uri,
        gatewayUrl: thumbnailResource.gatewayUrl,
        storageKey: thumbnailResource.storageKey
      } : null,
      uploadedAt: new Date().toISOString()
    };
  };

  const response = await storage.uploadFolder(files, { acl, index });

  console.log(`✅ Song ${songId} uploaded to Grove`);

  return {
    songId,
    folderUri: response.folder.uri,
    audioUri: response.files[0]?.uri || '',
    metadataUri: response.files[1]?.uri || '',
    thumbnailUri: response.files.length > 2 ? response.files[2]?.uri : undefined
  };
}

/**
 * Process song with ElevenLabs to generate enhanced metadata
 */
async function processSongWithElevenLabs(
  songId: string,
  songFiles: SongFiles,
  apiKey: string,
  config: SongConfig
): Promise<EnhancedSongMetadata> {
  console.log(`🔄 Processing ${songId} with ElevenLabs...`);

  // Must have lyrics file
  if (!songFiles.lyrics) {
    throw new Error(`Song ${songId} requires lyrics.txt file`);
  }

  const lyrics = await songFiles.lyrics.text();
  if (!lyrics.trim()) {
    throw new Error(`Empty lyrics for song ${songId}`);
  }

  // Load all translations from translations/ folder
  const translations: Record<string, string[]> = {};
  const translationsDir = join(SONGS_DIR, songId, 'translations');

  try {
    const translationFiles = await readdir(translationsDir);
    for (const file of translationFiles) {
      const langCode = file.replace('.txt', ''); // cn.txt -> cn
      const filePath = join(translationsDir, file);
      const content = await Bun.file(filePath).text();
      const lines = content.split('\n').filter(line => line.trim());
      translations[langCode] = lines;
      console.log(`  ✓ Loaded ${langCode} translation (${lines.length} lines)`);
    }
  } catch (error) {
    console.log(`  No translations folder found (optional)`);
  }

  const elevenLabsProcessor = new ElevenLabsProcessor(apiKey);

  // Check if karaoke-alignment.json already exists
  const alignmentFilePath = join(SONGS_DIR, songId, 'karaoke-alignment.json');
  let alignmentResult;

  try {
    alignmentResult = await elevenLabsProcessor.loadAlignmentFromFile(alignmentFilePath);
    console.log(`✅ Using existing alignment file: ${alignmentFilePath}`);
  } catch {
    console.log(`📞 No alignment file found, calling ElevenLabs API...`);

    // Use voice stems for ElevenLabs processing if available
    const audioForProcessing = songFiles.voiceStems || songFiles.audio!;
    console.log(`Using ${songFiles.voiceStems ? 'voice stems' : 'full audio'} for ElevenLabs processing: ${audioForProcessing.name}`);

    // Call ElevenLabs API
    alignmentResult = await elevenLabsProcessor.callElevenLabsAPI(audioForProcessing, lyrics);

    // Save the result
    await elevenLabsProcessor.saveAlignmentToFile(alignmentFilePath, alignmentResult);
    console.log(`✅ Saved alignment to: ${alignmentFilePath}`);
  }

  // Generate metadata
  const metadataGenerator = new MetadataGenerator();
  const lyricsLines = lyrics.split('\n').filter(line => line.trim());

  // Extract song info (use config overrides if available)
  const extracted = metadataGenerator.extractSongInfo(lyrics, songFiles.audio!.name);
  const title = config.title || extracted.title;
  const artist = config.artist || extracted.artist;

  const enhancedMetadata = metadataGenerator.generateEnhancedMetadata(
    alignmentResult.words,
    lyricsLines,
    translations,
    title,
    artist
  );

  // Validate the generated metadata
  const validation = metadataGenerator.validateMetadata(enhancedMetadata);
  if (!validation.valid) {
    console.warn(`⚠️ Metadata validation warnings for ${songId}:`, validation.errors);
  }

  console.log(`✅ ${songId} processed: ${enhancedMetadata.wordCount} words, ${enhancedMetadata.lineCount} lines`);
  return enhancedMetadata;
}

/**
 * Main upload function
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const isAddMode = args.includes('--add');
    const isProcessMode = args.includes('--process');

    console.log('🎵 Song Uploader for SongCatalogV1');

    // Check environment variables
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.SONG_CATALOG_ADDRESS;

    if (!privateKey) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }

    if (!contractAddress || !contractAddress.startsWith('0x')) {
      throw new Error('SONG_CATALOG_ADDRESS environment variable is required');
    }

    if (isProcessMode && !process.env.ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required for --process mode');
    }

    // Initialize contract
    console.log('Initializing SongCatalogV1 contract...');
    const catalog = initializeSongCatalog(privateKey, contractAddress as `0x${string}`);
    console.log('Contract address:', catalog.contractAddress);
    console.log('Wallet address:', catalog.walletClient.account.address);

    // Get current song count
    const songCount = await getSongCount(catalog);
    console.log(`Current catalog has ${songCount} songs\n`);

    // Scan for songs
    const songFolders = await getSongFolders();
    console.log(`Found ${songFolders.length} song folders`);

    if (songFolders.length === 0) {
      console.log('No songs found in ./songs directory');
      return;
    }

    let uploadCount = 0;

    for (const songFolder of songFolders) {
      // Load song configuration
      const config = await loadSongConfig(songFolder);
      if (!config) {
        console.log(`❌ Skipping ${songFolder} (invalid config)`);
        continue;
      }

      const songId = config.id;

      // Check if song already exists in catalog
      const songExists = await songExistsInCatalog(catalog, songId);

      const songFiles = await loadSongFiles(songFolder);
      if (!songFiles) {
        console.log(`❌ Skipping ${songId} (missing files)`);
        continue;
      }

      try {
        let metadata: EnhancedSongMetadata;

        if (isProcessMode) {
          // Processing mode: Generate enhanced metadata with ElevenLabs
          const apiKey = process.env.ELEVENLABS_API_KEY!;

          if (!songFiles.voiceStems) {
            console.warn(`⚠️ No voice stems found for ${songId}, using full audio for ElevenLabs processing`);
            console.warn(`   For better results, include a file with "vocals" or "stems" in the name`);
          }

          metadata = await processSongWithElevenLabs(songId, songFiles, apiKey, config);
        } else {
          throw new Error(`Song ${songId} requires --process mode to generate metadata`);
        }

        // Upload to Grove
        const uploadResult = await uploadSong(songId, songFiles, metadata);

        if (songExists) {
          // Update existing song in catalog
          console.log(`🔄 ${songId} already exists, updating...`);
          await updateSongInCatalog(
            catalog,
            uploadResult,
            metadata,
            config.geniusId || 0,
            config.geniusArtistId || 0,
            config.segmentIds || [],
            '', // coverUri (not yet implemented)
            '',  // musicVideoUri (not yet implemented)
            true // enabled
          );
          console.log(`✅ ${songId} successfully updated in catalog!\n`);
        } else {
          // Add new song to catalog
          await addSongToCatalog(
            catalog,
            uploadResult,
            metadata,
            config.geniusId || 0,
            config.geniusArtistId || 0,
            config.segmentIds || [],
            '', // coverUri (not yet implemented)
            ''  // musicVideoUri (not yet implemented)
          );
          uploadCount++;
          console.log(`✅ ${songId} successfully added to catalog!\n`);
        }
      } catch (error) {
        console.error(`❌ Failed to process ${songId}:`, error);
      }
    }

    console.log(`\n🎉 Upload complete! Added ${uploadCount} songs to SongCatalogV1.`);
    console.log(`Total songs in catalog: ${await getSongCount(catalog)}`);

  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
