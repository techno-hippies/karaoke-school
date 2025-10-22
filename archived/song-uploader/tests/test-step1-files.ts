#!/usr/bin/env bun

/**
 * Step 1: Test file loading only
 */

import { getSongFolders, loadSongConfig, loadSongFiles } from '../src/utils/file-loader.js'

console.log('=== STEP 1: Testing File Loader ===\n')

try {
  // Test 1: Get song folders
  console.log('1. Getting song folders...')
  const folders = await getSongFolders()
  console.log(`   Found ${folders.length} folders:`, folders)

  if (folders.length === 0) {
    throw new Error('No song folders found!')
  }

  // Test 2: Load config for first song
  const testSong = folders[0]
  console.log(`\n2. Loading config for: ${testSong}`)
  const config = await loadSongConfig(testSong)
  console.log(`   ✓ ID: ${config.id}`)
  console.log(`   ✓ Title: ${config.title}`)
  console.log(`   ✓ Artist: ${config.artist}`)

  // Test 3: Load files
  console.log(`\n3. Loading files for: ${testSong}`)
  const files = await loadSongFiles(testSong)
  console.log(`   ✓ Audio: ${files.fullAudio.name} (${(files.fullAudio.size / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`   ✓ Lyrics: ${files.lyrics.name} (${files.lyrics.size} bytes)`)

  if (files.vocalsOnly) {
    console.log(`   ✓ Vocals: ${files.vocalsOnly.name}`)
  }

  if (files.thumbnail) {
    console.log(`   ✓ Thumbnail: ${files.thumbnail.name}`)
  }

  const translationKeys = Object.keys(files.translations)
  if (translationKeys.length > 0) {
    console.log(`   ✓ Translations: ${translationKeys.join(', ')}`)
  }

  // Test 4: Read lyrics
  console.log(`\n4. Reading lyrics content...`)
  const lyricsText = await files.lyrics.text()
  const lines = lyricsText.split('\n').filter(l => l.trim())
  console.log(`   ✓ ${lines.length} lines`)
  console.log(`   ✓ First line: "${lines[0]}"`)

  console.log('\n✅ SUCCESS: All file operations work!\n')

} catch (error) {
  console.error('\n❌ FAILED:', error)
  process.exit(1)
}
