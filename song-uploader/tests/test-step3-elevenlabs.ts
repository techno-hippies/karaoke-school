#!/usr/bin/env bun

/**
 * Step 3: Test ElevenLabs alignment
 * REQUIRES: ELEVENLABS_API_KEY in .env
 */

import { config } from '../src/config.js'
import { getAlignment, loadCachedAlignment, saveCachedAlignment } from '../src/services/elevenlabs.js'
import { loadSongFiles } from '../src/utils/file-loader.js'

const SONG_ID = 'genesis-again' // Test on real song

console.log('=== STEP 3: Testing ElevenLabs Alignment ===\n')

try {
  // Check API key
  if (!config.apis.elevenLabs) {
    console.log('❌ ELEVENLABS_API_KEY not set in .env file')
    console.log('\nSkipping test - set ELEVENLABS_API_KEY to test alignment')
    process.exit(0)
  }

  console.log(`Testing song: ${SONG_ID}`)
  console.log(`API Key: ${config.apis.elevenLabs.slice(0, 10)}...`)

  console.log('\n1. Loading song files...')
  const files = await loadSongFiles(SONG_ID)
  const lyricsText = await files.lyrics.text()
  const lyricsLines = lyricsText.split('\n').filter(l => l.trim())
  console.log(`   ✓ Audio: ${files.fullAudio.name} (${(files.fullAudio.size / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`   ✓ Lyrics: ${lyricsLines.length} lines, ${lyricsText.length} chars`)

  console.log('\n2. Calling ElevenLabs API...')
  console.log('   ⏳ This may take 15-45 seconds for a ~3 minute song...')

  const startTime = Date.now()
  const alignment = await getAlignment(files.fullAudio, lyricsText)
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`   ✅ Done in ${duration}s!`)
  console.log(`   ✓ Received ${alignment.words.length} word timestamps`)
  console.log(`   ✓ Audio hash: ${alignment.audioHash.slice(0, 16)}...`)
  console.log(`   ✓ Lyrics hash: ${alignment.lyricsHash}`)

  // Show first few words
  console.log(`\n3. Sample word timestamps:`)
  alignment.words.slice(0, 10).forEach(word => {
    console.log(`     "${word.text}" (${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s)`)
  })

  // Test caching
  console.log(`\n4. Testing cache save/load...`)
  const cachePath = `./songs/${SONG_ID}/karaoke-alignment.json`
  await saveCachedAlignment(cachePath, alignment)

  const loaded = await loadCachedAlignment(cachePath)
  console.log(`   ✓ Saved to ${cachePath}`)
  console.log(`   ✓ Loaded ${loaded.words.length} words from cache`)

  if (loaded.words.length !== alignment.words.length) {
    throw new Error('Cache mismatch!')
  }

  console.log('\n✅ SUCCESS: ElevenLabs alignment works!\n')

} catch (error) {
  console.error('\n❌ FAILED:', error)
  if (error instanceof Error && error.message.includes('401')) {
    console.error('   API key may be invalid - check ELEVENLABS_API_KEY')
  }
  process.exit(1)
}
