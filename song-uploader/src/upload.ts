#!/usr/bin/env bun

// Load and decrypt environment variables
import '@dotenvx/dotenvx/config';

import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { chains } from "@lens-chain/sdk/viem";
import { immutable, StorageClient } from "@lens-chain/storage-client";
import { initializeWallet } from './wallet.js';
import {
  createRegistry,
  loadRegistry,
  addSongToRegistry,
  updateRegistry,
  saveRegistryUri,
  songExists
} from './registry.js';
import { ElevenLabsProcessor } from './processors/elevenlabs.js';
import { MetadataGenerator } from './processors/metadata.js';
import type { SongFiles, SongMetadata, EnhancedSongMetadata, UploadResult } from './types.js';

const SONGS_DIR = './songs';
const REGISTRY_URI_FILE = './output/registry-uri.txt';

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
      } else if (file === 'translation.txt') {
        songFiles.translation = new File([await Bun.file(filePath).arrayBuffer()], file, {
          type: 'text/plain'
        });
      } else if (file === 'metadata.json') {
        // Legacy metadata file
        songFiles.metadata = new File([await Bun.file(filePath).arrayBuffer()], file, {
          type: 'application/json'
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
async function uploadSong(songId: string, songFiles: SongFiles): Promise<UploadResult> {
  const storage = getStorageClient();

  const acl = immutable(chains.mainnet.id);

  console.log(`Uploading song: ${songId}`);

  // Prepare files array - only upload audio (full song), metadata, and thumbnail to Grove
  // Voice stems are NOT uploaded to Grove (only used for ElevenLabs processing)
  const files = [songFiles.audio, songFiles.metadata];
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

    // Since Grove doesn't provide filenames, match by file order
    // Files are uploaded in order: audio, metadata, thumbnail (if present)
    const audioResource = resources[0]; // First file is audio
    const metadataResource = resources[1]; // Second file is metadata
    const thumbnailResource = resources.length > 2 ? resources[2] : null; // Third file is thumbnail if present

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

  console.log(`✅ Song ${songId} uploaded successfully`);

  return {
    songId,
    folderUri: response.folder.uri,
    audioUri: response.files[0]?.uri || '', // First file is audio
    metadataUri: response.files[1]?.uri || '', // Second file is metadata
    thumbnailUri: response.files.length > 2 ? response.files[2]?.uri : undefined // Third file is thumbnail if present
  };
}

/**
 * Process song with ElevenLabs to generate enhanced metadata
 */
async function processSongWithElevenLabs(
  songId: string,
  songFiles: SongFiles,
  apiKey: string
): Promise<EnhancedSongMetadata> {
  console.log(`🔄 Processing ${songId} with ElevenLabs...`);

  // Check if we have lyrics file or need to extract from legacy metadata
  let lyrics = '';

  if (songFiles.lyrics) {
    lyrics = await songFiles.lyrics.text();
  } else if (songFiles.metadata) {
    // Try to extract from legacy metadata
    const legacyText = await songFiles.metadata.text();
    const legacyData = JSON.parse(legacyText);
    if (legacyData.lineTimestamps) {
      lyrics = legacyData.lineTimestamps.map((line: any) => line.originalText || line.text).join('\n');
    }
  } else {
    throw new Error(`No lyrics found for song ${songId}. Need either lyrics.txt or legacy metadata.json`);
  }

  if (!lyrics.trim()) {
    throw new Error(`Empty lyrics for song ${songId}`);
  }

  // Load all translations from translations/ folder
  const translations: Record<string, string[]> = {}; // { "cn": ["line1", "line2"], "vi": [...] }
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
    // Try to load existing alignment file
    alignmentResult = await elevenLabsProcessor.loadAlignmentFromFile(alignmentFilePath);
    console.log(`✅ Using existing alignment file: ${alignmentFilePath}`);
  } catch {
    // No existing file, need to call ElevenLabs API
    console.log(`📞 No alignment file found, calling ElevenLabs API...`);

    // Use voice stems for ElevenLabs processing if available, otherwise fall back to full audio
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

  // Extract song info
  const { title, artist } = metadataGenerator.extractSongInfo(lyrics, songFiles.audio!.name);

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

  // Save metadata.json to song folder
  const metadataFilePath = join(SONGS_DIR, songId, 'metadata.json');
  await Bun.write(metadataFilePath, JSON.stringify(enhancedMetadata, null, 2));
  console.log(`✅ Saved metadata to: ${metadataFilePath}`);

  console.log(`✅ ${songId} processed: ${enhancedMetadata.wordCount} words, ${enhancedMetadata.lineCount} lines`);
  return enhancedMetadata;
}

/**
 * Parse metadata from uploaded file (legacy support)
 */
async function parseMetadata(metadataFile: File): Promise<{ title: string; artist: string; duration: number }> {
  const text = await metadataFile.text();
  const metadata = JSON.parse(text) as SongMetadata;

  // Handle enhanced metadata
  if ('version' in metadata && metadata.version === 2) {
    return {
      title: metadata.title,
      artist: metadata.artist,
      duration: metadata.duration
    };
  }

  // Handle legacy metadata
  const legacyMetadata = metadata as any;
  let duration = legacyMetadata.duration || 0;
  if (!duration && legacyMetadata.lineTimestamps?.length > 0) {
    const lastLine = legacyMetadata.lineTimestamps[legacyMetadata.lineTimestamps.length - 1];
    duration = Math.ceil(lastLine.end || 0);
  }

  return {
    title: legacyMetadata.title || 'Unknown Title',
    artist: legacyMetadata.artist || 'Unknown Artist',
    duration
  };
}

/**
 * Get existing registry URI or create new one
 */
async function getOrCreateRegistryUri(walletClient: any): Promise<string> {
  // First check .env for REGISTRY_URI
  const envRegistryUri = process.env.REGISTRY_URI?.trim();
  if (envRegistryUri) {
    console.log('Using registry from .env:', envRegistryUri);
    return envRegistryUri;
  }

  // Fallback: Try to load from file (legacy support)
  try {
    const existingUri = await Bun.file(REGISTRY_URI_FILE).text();
    if (existingUri.trim()) {
      console.log('⚠️  Using registry from file (consider moving to .env):', existingUri.trim());
      return existingUri.trim();
    }
  } catch {
    // File doesn't exist
  }

  // Create new registry only if none exists
  console.log('No registry found. Creating new registry...');
  const registryUri = await createRegistry();
  console.log('✅ Registry created:', registryUri);
  console.log('⚠️  IMPORTANT: Add this to your .env file as REGISTRY_URI:');
  console.log(`   REGISTRY_URI="${registryUri}"`);
  await saveRegistryUri(registryUri);
  return registryUri;
}

/**
 * Main upload function
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const isAddMode = args.includes('--add');
    const isInitMode = args.includes('--init');
    const isSyncMode = args.includes('--sync');
    const isProcessMode = args.includes('--process');

    console.log('🎵 Song Uploader Starting...');

    // Initialize wallet
    const walletClient = initializeWallet();
    console.log('Wallet connected:', walletClient.account.address);

    // Get or create registry
    const registryUri = await getOrCreateRegistryUri(walletClient);

    if (isInitMode) {
      console.log('✅ Registry initialized:', registryUri);
      return;
    }

    if (isSyncMode) {
      console.log('🔄 Sync mode: Will add missing songs to registry without re-uploading');
    }

    if (isProcessMode) {
      console.log('🎵 Process mode: Will generate enhanced metadata using ElevenLabs');

      // Check for ElevenLabs API key
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY environment variable is required for processing mode');
      }
    }

    // Load current registry
    const registry = await loadRegistry(registryUri);

    // Scan for songs
    const songFolders = await getSongFolders();
    console.log(`Found ${songFolders.length} song folders`);

    if (songFolders.length === 0) {
      console.log('No songs found in ./songs directory');
      return;
    }

    let updatedRegistry = registry;
    let uploadCount = 0;

    for (const songId of songFolders) {
      // Check if song is actually in the registry (not just uploaded before)
      if (songExists(updatedRegistry, songId)) {
        console.log(`⏭️  Skipping ${songId} (already in registry)`);
        continue;
      }

      const songFiles = await loadSongFiles(songId);
      if (!songFiles) {
        console.log(`❌ Skipping ${songId} (missing files)`);
        continue;
      }

      try {
        let uploadResult: UploadResult;
        let metadata: { title: string; artist: string; duration: number };

        if (isProcessMode) {
          // Processing mode: Generate enhanced metadata with ElevenLabs
          const apiKey = process.env.ELEVENLABS_API_KEY!;

          // Check if we have voice stems for better processing
          if (!songFiles.voiceStems) {
            console.warn(`⚠️ No voice stems found for ${songId}, using full audio for ElevenLabs processing`);
            console.warn(`   For better results, include a file with "vocals" or "stems" in the name`);
          }

          const enhancedMetadata = await processSongWithElevenLabs(songId, songFiles, apiKey);

          // Create metadata file from enhanced data
          const metadataBlob = new Blob([JSON.stringify(enhancedMetadata, null, 2)], {
            type: 'application/json'
          });
          const metadataFile = new File([metadataBlob], 'metadata.json', {
            type: 'application/json'
          });

          // Update song files with generated metadata
          const processedSongFiles = {
            ...songFiles,
            metadata: metadataFile
          };

          uploadResult = await uploadSong(songId, processedSongFiles);
          metadata = {
            title: enhancedMetadata.title,
            artist: enhancedMetadata.artist,
            duration: enhancedMetadata.duration
          };
        } else {
          // Normal mode: Use existing metadata or generate basic metadata
          if (!songFiles.metadata) {
            throw new Error(`Song ${songId} requires metadata.json or use --process mode for auto-generation`);
          }

          uploadResult = await uploadSong(songId, songFiles);
          metadata = await parseMetadata(songFiles.metadata);
        }

        // Add to registry
        updatedRegistry = addSongToRegistry(updatedRegistry, uploadResult, metadata);
        uploadCount++;

        console.log(`✅ Added ${songId} to registry`);
      } catch (error) {
        console.error(`❌ Failed to process ${songId}:`, error);
      }
    }

    if (uploadCount > 0) {
      // Create new registry with updated songs (immutable)
      const newRegistryUri = await updateRegistry(registryUri, updatedRegistry);
      await saveRegistryUri(newRegistryUri);

      console.log(`🎉 Upload complete! Added ${uploadCount} songs.`);
      console.log(`New Registry URI: ${newRegistryUri}`);
      console.log('⚠️  IMPORTANT: Update your .env file with the new REGISTRY_URI:');
      console.log(`   REGISTRY_URI="${newRegistryUri}"`);
    } else {
      console.log('No new songs to upload.');
    }

  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}