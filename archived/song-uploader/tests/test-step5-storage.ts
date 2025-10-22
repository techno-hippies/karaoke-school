#!/usr/bin/env bun

/**
 * Step 5: Test Grove storage uploads
 * Tests uploading sections.json and alignment.json to Grove
 */

import { config } from '../src/config.js'
import { uploadJSON, uploadFile } from '../src/services/storage.js'
import { loadSongFiles, loadSongConfig, getAlignmentCachePath } from '../src/utils/file-loader.js'
import { loadCachedAlignment } from '../src/services/elevenlabs.js'
import { buildLinesWithWords } from '../src/utils/alignment.js'
import { parseSections } from '../src/services/section-parser.js'
import type { SectionsData, AlignmentData } from '../src/types.js'

const SONG_ID = 'genesis-again'

console.log('=== STEP 5: Testing Grove Storage ===\n')

try {
  console.log(`Testing song: ${SONG_ID}`)

  // Load all required data
  console.log('\n1. Loading song data...')
  const songConfig = await loadSongConfig(SONG_ID)
  const files = await loadSongFiles(SONG_ID)
  const lyricsText = await files.lyrics.text()
  const lyricsLines = lyricsText.split('\n').filter(l => l.trim())

  // Load alignment cache
  const cachePath = getAlignmentCachePath(SONG_ID)
  const alignment = await loadCachedAlignment(cachePath)
  console.log(`   ✓ Loaded ${alignment.words.length} words from cache`)

  // Build lines
  const linesWithWords = buildLinesWithWords(alignment.words, lyricsLines)
  console.log(`   ✓ Built ${linesWithWords.length} lines`)

  // Parse sections
  const sections = await parseSections(lyricsText, linesWithWords)
  console.log(`   ✓ Parsed ${sections.length} sections`)

  // Test 1: Upload sections.json
  console.log('\n2. Testing sections.json upload...')
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

  const sectionsUpload = await uploadJSON(sectionsData, 'sections.json')
  console.log(`   ✅ Uploaded sections.json`)
  console.log(`      URI: ${sectionsUpload.uri}`)
  console.log(`      Gateway: ${sectionsUpload.gatewayUrl}`)

  // Test 2: Upload alignment.json
  console.log('\n3. Testing alignment.json upload...')
  const audioDuration = Math.max(...linesWithWords.map(l => l.end))
  const alignmentData: AlignmentData = {
    version: 2,
    title: songConfig.title,
    artist: songConfig.artist,
    duration: Math.ceil(audioDuration),
    format: 'word-and-line-timestamps',
    lines: linesWithWords,
    availableLanguages: ['en'],
    generatedAt: new Date().toISOString(),
    elevenLabsProcessed: true,
    wordCount: alignment.words.length,
    lineCount: linesWithWords.length,
  }

  const alignmentUpload = await uploadJSON(alignmentData, 'alignment.json')
  console.log(`   ✅ Uploaded alignment.json`)
  console.log(`      URI: ${alignmentUpload.uri}`)
  console.log(`      Gateway: ${alignmentUpload.gatewayUrl}`)

  // Test 3: Upload audio file
  console.log('\n4. Testing audio file upload...')
  const audioUpload = await uploadFile(files.fullAudio, 'audio.mp3')
  console.log(`   ✅ Uploaded audio.mp3`)
  console.log(`      URI: ${audioUpload.uri}`)
  console.log(`      Gateway: ${audioUpload.gatewayUrl}`)

  // Summary
  console.log('\n5. Upload Summary:')
  console.log(`   Sections: ${sectionsUpload.uri}`)
  console.log(`   Alignment: ${alignmentUpload.uri}`)
  console.log(`   Audio: ${audioUpload.uri}`)

  console.log('\n✅ SUCCESS: Grove storage uploads work!\n')

} catch (error) {
  console.error('\n❌ FAILED:', error)
  if (error instanceof Error) {
    console.error('   Message:', error.message)
    if (error.stack) {
      console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'))
    }
  }
  process.exit(1)
}
