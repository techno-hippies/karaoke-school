#!/usr/bin/env bun

// Load and decrypt environment variables
import '@dotenvx/dotenvx/config';

import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import { chains } from "@lens-chain/sdk/viem";
import { immutable, StorageClient } from "@lens-chain/storage-client";
import { initializeWallet } from './wallet.js';
import { ElevenLabsProcessor } from './processors/elevenlabs.js';
import { MetadataGenerator } from './processors/metadata.js';
import { detectSections, normalizeClipTimestamps } from './processors/section-detector.js';
import { sliceAudio, checkFFmpeg } from './processors/audio-slicer.js';
import { analyzeLyrics, getWordsPerSecondForContract } from './processors/learning-metrics.js';
import { validateSongFolder, formatValidationErrors } from './processors/lyrics-validator.js';
import type { SongFiles, EnhancedSongMetadata, ClipSection, ClipMetadata, ClipUploadResult } from './types.js';

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
      if (stats.isDirectory() && entry !== 'sample') {
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
          songFiles.voiceStems = new File([await Bun.file(filePath).arrayBuffer()], file, {
            type: `audio/${ext.slice(1)}`
          });
        } else {
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
      console.error(`Song ${songId} missing required audio file`);
      return null;
    }

    return songFiles as SongFiles;
  } catch (error) {
    console.error(`Error loading song files for ${songId}:`, error);
    return null;
  }
}

/**
 * Process song and generate metadata with ElevenLabs
 */
async function processSongMetadata(
  songId: string,
  songFiles: SongFiles,
  apiKey: string
): Promise<EnhancedSongMetadata> {
  console.log(`🔄 Processing ${songId} with ElevenLabs...`);

  let lyrics = '';
  if (songFiles.lyrics) {
    lyrics = await songFiles.lyrics.text();
  } else {
    throw new Error(`No lyrics found for song ${songId}`);
  }

  if (!lyrics.trim()) {
    throw new Error(`Empty lyrics for song ${songId}`);
  }

  // Load translations
  const translations: Record<string, string[]> = {};
  const translationContents = new Map<string, string>();
  const translationsDir = join(SONGS_DIR, songId, 'translations');

  try {
    const translationFiles = await readdir(translationsDir);
    for (const file of translationFiles) {
      const langCode = file.replace('.txt', '');
      const filePath = join(translationsDir, file);
      const content = await Bun.file(filePath).text();
      const lines = content.split('\n').filter(line => line.trim());
      translations[langCode] = lines;
      translationContents.set(langCode, content);
      console.log(`  ✓ Loaded ${langCode} translation (${lines.length} lines)`);
    }
  } catch {
    console.log(`  No translations folder found (optional)`);
  }

  // VALIDATION: Strict format check
  console.log(`\n🔍 Validating lyrics format...`);
  const validationResult = await validateSongFolder(songId, lyrics, translationContents);

  if (!validationResult.valid) {
    console.error(formatValidationErrors(validationResult));
    throw new Error(`❌ Lyrics validation failed for ${songId}. Fix errors above before uploading.`);
  }

  if (validationResult.warnings.length > 0) {
    console.warn(formatValidationErrors(validationResult));
    console.log(`⚠️  Warnings found but continuing...`);
  } else {
    console.log(`✅ Lyrics validation passed`);
  }

  const elevenLabsProcessor = new ElevenLabsProcessor(apiKey);

  // Check for existing alignment file
  const alignmentFilePath = join(SONGS_DIR, songId, 'karaoke-alignment.json');
  let alignmentResult;

  try {
    alignmentResult = await elevenLabsProcessor.loadAlignmentFromFile(alignmentFilePath);
    console.log(`✅ Using existing alignment file`);
  } catch {
    console.log(`📞 Calling ElevenLabs API...`);
    const audioForProcessing = songFiles.voiceStems || songFiles.audio!;
    alignmentResult = await elevenLabsProcessor.callElevenLabsAPI(audioForProcessing, lyrics);
    await elevenLabsProcessor.saveAlignmentToFile(alignmentFilePath, alignmentResult);
    console.log(`✅ Saved alignment`);
  }

  // Generate metadata
  const metadataGenerator = new MetadataGenerator();
  const lyricsLines = lyrics.split('\n').filter(line => line.trim());
  const { title, artist } = metadataGenerator.extractSongInfo(lyrics, songFiles.audio!.name);

  const enhancedMetadata = metadataGenerator.generateEnhancedMetadata(
    alignmentResult.words,
    lyricsLines,
    translations,
    title,
    artist
  );

  console.log(`✅ ${songId} processed: ${enhancedMetadata.wordCount} words, ${enhancedMetadata.lineCount} lines`);
  return enhancedMetadata;
}

/**
 * Upload a single clip to Grove
 */
async function uploadClip(
  clipId: string,
  clipAudioPath: string,
  clipMetadata: ClipMetadata,
  thumbnailFile?: File
): Promise<ClipUploadResult> {
  const storage = getStorageClient();
  const acl = immutable(chains.mainnet.id);

  console.log(`  Uploading clip: ${clipId}`);

  // Read sliced audio file
  const audioFile = new File(
    [await Bun.file(clipAudioPath).arrayBuffer()],
    `${clipId}.mp3`,
    { type: 'audio/mpeg' }
  );

  // Create metadata file
  const metadataFile = new File(
    [JSON.stringify(clipMetadata, null, 2)],
    'metadata.json',
    { type: 'application/json' }
  );

  const files = [audioFile, metadataFile];
  if (thumbnailFile) {
    files.push(thumbnailFile);
  }

  const response = await storage.uploadFolder(files, { acl });

  console.log(`  ✅ Clip uploaded: ${clipId}`);

  return {
    clipId,
    folderUri: response.folder.uri,
    audioUri: response.files[0]?.uri || '',
    metadataUri: response.files[1]?.uri || '',
    thumbnailUri: files.length > 2 ? response.files[2]?.uri : undefined
  };
}

/**
 * Main clip processing and upload function
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const isProcessMode = args.includes('--process') || args.includes('--clips');

    if (!isProcessMode) {
      console.error('❌ Use --process or --clips flag for clip-based processing');
      console.log('Usage: bun run upload-clips.ts --process');
      process.exit(1);
    }

    console.log('🎵 Clip Uploader Starting...');

    // Check ffmpeg
    const hasFFmpeg = await checkFFmpeg();
    if (!hasFFmpeg) {
      throw new Error('ffmpeg not found. Please install ffmpeg to slice audio files.');
    }
    console.log('✅ ffmpeg detected');

    // Initialize wallet
    const walletClient = initializeWallet();
    console.log('Wallet connected:', walletClient.account.address);

    // Check for ElevenLabs API key
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }

    // Scan for songs
    const songFolders = await getSongFolders();
    console.log(`Found ${songFolders.length} song folders`);

    if (songFolders.length === 0) {
      console.log('No songs found in ./songs directory');
      return;
    }

    let totalClipsUploaded = 0;

    for (const songId of songFolders) {
      console.log(`\n📀 Processing ${songId}...`);

      const songFiles = await loadSongFiles(songId);
      if (!songFiles) {
        console.log(`❌ Skipping ${songId} (missing files)`);
        continue;
      }

      try {
        // Process song metadata
        const metadata = await processSongMetadata(songId, songFiles, apiKey);

        // Detect sections
        const sections = detectSections(metadata);
        console.log(`📍 Detected ${sections.length} sections`);

        for (const section of sections) {
          console.log(`\n  🎬 Processing: ${section.id} (${section.sectionType})`);
          console.log(`     Duration: ${section.duration}s (${section.startTime}s - ${section.endTime}s)`);

          // Slice audio
          const audioPath = join(SONGS_DIR, songId, songFiles.audio!.name);
          const slicedAudioPath = await sliceAudio(audioPath, section);
          console.log(`     ✂️  Audio sliced`);

          // Normalize timestamps
          const normalizedLines = normalizeClipTimestamps(section.lines, section.startTime);

          // Calculate learning metrics
          const learningMetrics = await analyzeLyrics(normalizedLines, section.duration);
          console.log(`     📊 Difficulty: ${learningMetrics.difficultyLevel}/5, WPS: ${learningMetrics.pace.wordsPerSecond}`);

          // Create clip metadata
          const clipMetadata: ClipMetadata = {
            version: 3 as 2, // Type hack for now
            id: section.id,
            title: metadata.title,
            artist: metadata.artist,
            sectionType: section.sectionType,
            sectionIndex: section.sectionIndex,
            duration: section.duration,
            format: 'word-and-line-timestamps',
            lines: normalizedLines,
            availableLanguages: metadata.availableLanguages,
            generatedAt: new Date().toISOString(),
            elevenLabsProcessed: true,
            wordCount: learningMetrics.pace.totalWords,
            lineCount: normalizedLines.length,
            learningMetrics
          };

          // Upload to Grove
          const uploadResult = await uploadClip(
            section.id,
            slicedAudioPath,
            clipMetadata,
            songFiles.thumbnail
          );

          totalClipsUploaded++;

          // TODO: Add to ClipRegistryV1 contract
          const wpsForContract = getWordsPerSecondForContract(learningMetrics.pace.wordsPerSecond);
          console.log(`\n     📝 Contract params:`);
          console.log(`        ID: ${section.id}`);
          console.log(`        Title: ${metadata.title}`);
          console.log(`        Artist: ${metadata.artist}`);
          console.log(`        Section: ${section.sectionType}`);
          console.log(`        Index: ${section.sectionIndex}`);
          console.log(`        Duration: ${section.duration}`);
          console.log(`        Audio URI: ${uploadResult.audioUri}`);
          console.log(`        Metadata URI: ${uploadResult.metadataUri}`);
          console.log(`        Languages: ${metadata.availableLanguages.join(',')}`);
          console.log(`        Difficulty: ${learningMetrics.difficultyLevel}`);
          console.log(`        WPS: ${wpsForContract} (${learningMetrics.pace.wordsPerSecond} * 10)`);
        }

        console.log(`\n✅ ${songId} complete: ${sections.length} clips created`);

      } catch (error) {
        console.error(`❌ Failed to process ${songId}:`, error);
      }
    }

    console.log(`\n🎉 Upload complete! Created ${totalClipsUploaded} clips.`);
    console.log('\n⚠️  Next steps:');
    console.log('   1. Deploy ClipRegistryV1 contract');
    console.log('   2. Add clips to contract using the params logged above');

  } catch (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
