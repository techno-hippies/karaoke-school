/**
 * Song Processor
 * Main orchestration for uploading a copyright-free song
 */

import { config } from '../config.js'
import type {
  SongConfig,
  SongFiles,
  SongUploadResult,
  AlignmentData,
  SectionsData,
  LineWithWords,
  SongSection,
  WordTimestamp,
  AddFullSongParams,
  ProcessSegmentsBatchParams,
} from '../types.js'

import * as elevenlabs from '../services/elevenlabs.js'
import * as sectionParser from '../services/section-parser.js'
import * as storage from '../services/storage.js'
import * as contract from '../services/contract.js'
import * as genius from '../services/genius.js'
import * as stems from '../services/stems.js'
import { checkAlignmentCache, getAlignmentCachePath } from '../utils/file-loader.js'
import { buildLinesWithWords } from '../utils/alignment.js'

/**
 * Process and upload a song to KaraokeCatalogV2
 */
export async function processSong(
  songConfig: SongConfig,
  songFiles: SongFiles
): Promise<SongUploadResult> {
  console.log('\n' + '='.repeat(60))
  console.log(`🎵 Processing: ${songConfig.title} - ${songConfig.artist}`)
  console.log('='.repeat(60) + '\n')

  try {
    // Step 1: Check if song already exists
    console.log('[1/8] Checking if song exists...')
    const exists = await contract.checkSongExists(songConfig.id)
    if (exists) {
      throw new Error(
        `Song "${songConfig.id}" already exists in catalog. Use update command or choose a different ID.`
      )
    }
    console.log('✓ Song ID available\n')

    // Step 2: Get Genius ID from metadata.json
    console.log('[2/8] Checking Genius...')
    const geniusId = songConfig.geniusId || 0

    if (geniusId > 0) {
      console.log(`   ✓ Using geniusId from metadata.json: ${geniusId}`)
    } else {
      console.log('   ℹ️  No geniusId provided (using geniusId = 0)')
      console.log('   ℹ️  To link with Genius, add "geniusId" to metadata.json')
    }

    console.log(`   Using geniusId: ${geniusId}\n`)

    // Step 3: Get word-level alignment from ElevenLabs
    console.log('[3/8] Getting word-level alignment...')
    const alignmentCachePath = getAlignmentCachePath(songConfig.id)
    const hasCache = await checkAlignmentCache(songConfig.id)

    let alignmentResult
    if (hasCache) {
      alignmentResult = await elevenlabs.loadCachedAlignment(alignmentCachePath)
    } else {
      const lyricsText = await songFiles.lyrics.text()
      const audioForAlignment = config.processing.useVocalsForAlignment && songFiles.vocalsOnly
        ? songFiles.vocalsOnly
        : songFiles.fullAudio

      console.log(`   Using ${songFiles.vocalsOnly ? 'vocals-only' : 'full audio'} for alignment`)

      alignmentResult = await elevenlabs.getAlignment(audioForAlignment, lyricsText)
      await elevenlabs.saveCachedAlignment(alignmentCachePath, alignmentResult)
    }

    console.log(`✓ Alignment complete: ${alignmentResult.words.length} words\n`)

    // Step 4: Build lines with translations
    console.log('[4/8] Building line data...')
    const lyricsText = await songFiles.lyrics.text()
    const lyricsLines = lyricsText.split('\n').filter(line => line.trim())

    // Load translations
    const translations: Record<string, string[]> = {}
    for (const [langCode, file] of Object.entries(songFiles.translations)) {
      const content = await file.text()
      translations[langCode] = content.split('\n').filter(line => line.trim())
      console.log(`   ✓ Loaded ${langCode} translation (${translations[langCode].length} lines)`)
    }

    // Build lines with word timestamps
    const linesWithWords = buildLinesWithWords(alignmentResult.words, lyricsLines, translations)
    console.log(`✓ Built ${linesWithWords.length} lines with word timestamps\n`)

    // Step 5: Parse sections using AI
    console.log('[5/8] Parsing song sections...')
    const sections = await sectionParser.parseSections(lyricsText, linesWithWords)

    const validation = sectionParser.validateSections(sections)
    if (!validation.valid) {
      console.warn('⚠️  Section validation warnings:', validation.errors)
    }

    console.log(`✓ Parsed ${sections.length} sections\n`)

    // Step 6: Upload to Grove
    console.log('[6/8] Uploading to Grove storage...')

    // Upload full audio
    console.log('   Uploading audio...')
    const audioUpload = await storage.uploadFile(songFiles.fullAudio, 'audio.mp3')

    // Upload thumbnail (optional)
    let thumbnailUpload
    if (songFiles.thumbnail) {
      console.log('   Uploading thumbnail...')
      thumbnailUpload = await storage.uploadFile(songFiles.thumbnail, 'thumbnail.jpg')
    }

    // Upload sections.json
    const sectionsData: SectionsData = {
      sections: sections.map(s => ({
        id: s.id,
        type: s.type,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
      })),
      generatedAt: new Date().toISOString(),
    }
    console.log('   Uploading sections.json...')
    const sectionsUpload = await storage.uploadJSON(sectionsData, 'sections.json')

    // Upload alignment.json
    const audioDuration = Math.max(...linesWithWords.map(l => l.end))
    const alignmentData: AlignmentData = {
      version: 2,
      title: songConfig.title,
      artist: songConfig.artist,
      duration: Math.ceil(audioDuration),
      format: 'word-and-line-timestamps',
      lines: linesWithWords,
      availableLanguages: ['en', ...Object.keys(translations)],
      generatedAt: new Date().toISOString(),
      elevenLabsProcessed: true,
      wordCount: alignmentResult.words.length,
      lineCount: linesWithWords.length,
    }
    console.log('   Uploading alignment.json...')
    const alignmentUpload = await storage.uploadJSON(alignmentData, 'alignment.json')

    console.log('✅ All files uploaded to Grove\n')

    // Step 7: Add song to contract
    console.log('[7/8] Adding song to contract...')

    const addSongParams: AddFullSongParams = {
      id: songConfig.id,
      geniusId: geniusId,
      title: songConfig.title,
      artist: songConfig.artist,
      duration: Math.ceil(audioDuration),
      soundcloudPath: songConfig.soundcloudUrl || '',
      hasFullAudio: true,
      requiresPayment: false,
      audioUri: audioUpload.uri,
      metadataUri: '', // DEPRECATED
      coverUri: '',
      thumbnailUri: thumbnailUpload?.uri || '',
      musicVideoUri: '',
      sectionsUri: sectionsUpload.uri,
      alignmentUri: alignmentUpload.uri,
    }

    const txHash = await contract.addFullSong(addSongParams)
    console.log(`✅ Song added! TX: ${txHash}\n`)

    // Step 8: Process segments (optional - requires stems)
    console.log('[8/8] Processing segments...')

    if (config.processing.separateStems) {
      console.log('   ⚠️  Stem separation not yet implemented, skipping segments')
      console.log('   To add segments later: provide pre-separated stems or implement Demucs integration\n')
    } else {
      console.log('   Skipped (stem separation disabled)\n')
    }

    // Success!
    console.log('='.repeat(60))
    console.log('✅ UPLOAD COMPLETE!')
    console.log('='.repeat(60))
    console.log(`Song ID: ${songConfig.id}`)
    console.log(`Genius ID: ${geniusId || 'N/A'}`)
    console.log(`TX Hash: ${txHash}`)
    console.log(`View on Base Sepolia: https://sepolia.basescan.org/tx/${txHash}`)
    console.log('='.repeat(60) + '\n')

    return {
      success: true,
      songId: songConfig.id,
      geniusId: geniusId,
      txHash,
      groveUris: {
        audio: audioUpload.uri,
        sections: sectionsUpload.uri,
        alignment: alignmentUpload.uri,
        thumbnail: thumbnailUpload?.uri,
      },
      segmentCount: 0,
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error instanceof Error ? error.message : error)

    return {
      success: false,
      songId: songConfig.id,
      geniusId: songConfig.geniusId || 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      groveUris: {
        audio: '',
        sections: '',
        alignment: '',
      },
      segmentCount: 0,
    }
  }
}

// buildLinesWithWords moved to src/utils/alignment.ts
