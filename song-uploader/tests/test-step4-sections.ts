#!/usr/bin/env bun

/**
 * Step 4: Test OpenRouter section parser
 * REQUIRES: OPENROUTER_API_KEY in .env
 */

import { config } from '../src/config.js'
import { parseSections, validateSections } from '../src/services/section-parser.js'
import { loadSongFiles, getAlignmentCachePath } from '../src/utils/file-loader.js'
import { loadCachedAlignment } from '../src/services/elevenlabs.js'
import { buildLinesWithWords } from '../src/utils/alignment.js'

const SONG_ID = 'genesis-again'

console.log('=== STEP 4: Testing Section Parser ===\n')

try {
  // Check API key
  if (!config.apis.openRouter) {
    console.log('❌ OPENROUTER_API_KEY not set in .env file')
    console.log('\nSkipping test - set OPENROUTER_API_KEY to test section parsing')
    process.exit(0)
  }

  console.log(`Testing song: ${SONG_ID}`)
  console.log(`API Key: ${config.apis.openRouter.slice(0, 10)}...`)

  // Load alignment cache (must exist from step 3)
  console.log('\n1. Loading alignment cache...')
  const cachePath = getAlignmentCachePath(SONG_ID)
  const alignment = await loadCachedAlignment(cachePath)
  console.log(`   ✓ Loaded ${alignment.words.length} words from cache`)

  // Load lyrics
  const files = await loadSongFiles(SONG_ID)
  const lyricsText = await files.lyrics.text()
  const lyricsLines = lyricsText.split('\n').filter(l => l.trim())

  // Build lines with words (REAL timestamps from alignment)
  console.log('\n2. Building lines with word timestamps...')
  const linesWithWords = buildLinesWithWords(alignment.words, lyricsLines)
  console.log(`   ✓ Built ${linesWithWords.length} lines with real timestamps`)

  // Parse sections
  console.log('\n3. Calling OpenRouter AI to parse sections...')
  console.log('   (This may take 5-15 seconds)')

  const startTime = Date.now()
  const sections = await parseSections(lyricsText, linesWithWords)
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`   ✅ Done in ${duration}s!`)
  console.log(`   ✓ Identified ${sections.length} sections`)

  // Show sections
  console.log('\n4. Parsed sections:')
  sections.forEach(section => {
    console.log(`     - ${section.type} (${section.id})`)
    console.log(`       Lines: ${section.lyricsStart}-${section.lyricsEnd}`)
    console.log(`       Time: ${section.startTime.toFixed(1)}s - ${section.endTime.toFixed(1)}s (${section.duration.toFixed(1)}s)`)
  })

  // Validate sections
  console.log('\n5. Validating sections...')
  const validation = validateSections(sections)

  if (validation.valid) {
    console.log('   ✓ All sections valid')
  } else {
    console.log('   ⚠️  Validation warnings:')
    validation.errors.forEach(err => console.log(`       - ${err}`))
  }

  console.log('\n✅ SUCCESS: Section parser works!\n')

} catch (error) {
  console.error('\n❌ FAILED:', error)
  if (error instanceof Error && error.message.includes('401')) {
    console.error('   API key may be invalid - check OPENROUTER_API_KEY')
  }
  process.exit(1)
}
