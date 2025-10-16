#!/usr/bin/env bun

/**
 * Test 1: File Loader
 * Tests loading song files from the filesystem
 */

import { runTest, assert, assertExists, assertNotEmpty, printTestSummary, checkTestSongExists } from './test-utils.js'
import { getSongFolders, loadSongConfig, loadSongFiles, checkAlignmentCache } from '../src/utils/file-loader.js'

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  TEST SUITE 1: File Loader                                ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  const results = []

  // Test 1.1: Get song folders
  results.push(
    await runTest('Get song folders', async () => {
      const folders = await getSongFolders()

      console.log(`   Found ${folders.length} folders:`)
      folders.forEach(f => console.log(`     - ${f}`))

      assertNotEmpty(folders, 'Song folders list')

      // Check test song exists
      const hasTestSong = folders.includes('heat-of-the-night-scarlett-x')
      assert(hasTestSong, 'Test song "heat-of-the-night-scarlett-x" exists')
    })
  )

  // Test 1.2: Load song config
  results.push(
    await runTest('Load song config (metadata.json)', async () => {
      const config = await loadSongConfig('heat-of-the-night-scarlett-x')

      console.log(`   Config loaded:`)
      console.log(`     ID: ${config.id}`)
      console.log(`     Title: ${config.title}`)
      console.log(`     Artist: ${config.artist}`)

      assertExists(config.id, 'Song ID')
      assertExists(config.title, 'Song title')
      assertExists(config.artist, 'Song artist')

      assert(config.id === 'heat-of-the-night-scarlett-x', 'Song ID matches folder name')
      assert(config.title === 'Heat of the Night', 'Title matches expected')
      assert(config.artist === 'Scarlett X', 'Artist matches expected')
    })
  )

  // Test 1.3: Load song files
  results.push(
    await runTest('Load song files', async () => {
      const files = await loadSongFiles('heat-of-the-night-scarlett-x')

      console.log(`   Files loaded:`)
      console.log(`     Full audio: ${files.fullAudio.name} (${(files.fullAudio.size / 1024 / 1024).toFixed(2)} MB)`)
      console.log(`     Lyrics: ${files.lyrics.name} (${files.lyrics.size} bytes)`)

      if (files.vocalsOnly) {
        console.log(`     Vocals: ${files.vocalsOnly.name} (${(files.vocalsOnly.size / 1024 / 1024).toFixed(2)} MB)`)
      }

      if (files.thumbnail) {
        console.log(`     Thumbnail: ${files.thumbnail.name} (${(files.thumbnail.size / 1024).toFixed(2)} KB)`)
      }

      const translationCount = Object.keys(files.translations).length
      if (translationCount > 0) {
        console.log(`     Translations: ${Object.keys(files.translations).join(', ')}`)
      }

      assertExists(files.fullAudio, 'Full audio file')
      assertExists(files.lyrics, 'Lyrics file')

      assert(files.fullAudio.size > 100000, 'Audio file has reasonable size')
      assert(files.lyrics.size > 0, 'Lyrics file is not empty')
    })
  )

  // Test 1.4: Read lyrics content
  results.push(
    await runTest('Read lyrics content', async () => {
      const files = await loadSongFiles('heat-of-the-night-scarlett-x')
      const lyricsText = await files.lyrics.text()
      const lines = lyricsText.split('\n').filter(l => l.trim())

      console.log(`   Lyrics:`)
      console.log(`     Total characters: ${lyricsText.length}`)
      console.log(`     Total lines: ${lines.length}`)
      console.log(`     First line: "${lines[0]}"`)
      console.log(`     Last line: "${lines[lines.length - 1]}"`)

      assertNotEmpty(lines, 'Lyrics lines')
      assert(lyricsText.length > 100, 'Lyrics has reasonable length')
    })
  )

  // Test 1.5: Check alignment cache
  results.push(
    await runTest('Check alignment cache', async () => {
      const hasCache = await checkAlignmentCache('heat-of-the-night-scarlett-x')

      console.log(`   Alignment cache exists: ${hasCache}`)

      if (hasCache) {
        const cachePath = './songs/heat-of-the-night-scarlett-x/karaoke-alignment.json'
        const cacheFile = Bun.file(cachePath)
        const cacheData = await cacheFile.json()

        console.log(`     Words in cache: ${cacheData.words?.length || 0}`)

        assert(cacheData.words?.length > 0, 'Cache has word data')
      } else {
        console.log(`     ⚠️  No cache found (will be created on first run)`)
      }

      // This test always passes (cache is optional)
      assert(true, 'Cache check completed')
    })
  )

  // Test 1.6: Validate file structure
  results.push(
    await runTest('Validate complete file structure', async () => {
      const testSongExists = await checkTestSongExists()

      assert(testSongExists, 'Test song has all required files (metadata.json, audio.mp3, lyrics.txt)')

      console.log('   ✓ Test song structure is valid')
    })
  )

  printTestSummary(results)

  const failedCount = results.filter(r => !r.passed).length
  process.exit(failedCount > 0 ? 1 : 0)
}

main().catch(error => {
  console.error('\n💥 Fatal error:', error)
  process.exit(1)
})
