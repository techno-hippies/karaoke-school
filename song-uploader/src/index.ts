#!/usr/bin/env bun

/**
 * Song Uploader V2 - CLI Entry Point
 * Upload copyright-free songs to KaraokeCatalogV2
 */

import '@dotenvx/dotenvx/config'
import { config, validateConfig } from './config.js'
import { getSongFolders, loadSongConfig, loadSongFiles } from './utils/file-loader.js'
import { processSong } from './processors/song-processor.js'

/**
 * Main CLI function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  🎵 Song Uploader V2 - KaraokeCatalogV2 (Base Sepolia)   ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  // Validate configuration
  const configValidation = validateConfig()
  if (!configValidation.valid) {
    console.error('❌ Configuration errors:')
    configValidation.errors.forEach(err => console.error(`   - ${err}`))
    process.exit(1)
  }

  console.log('✓ Configuration validated\n')

  // Parse CLI arguments
  const args = process.argv.slice(2)
  const songIdArg = args.find(arg => !arg.startsWith('--'))
  const flags = {
    dryRun: args.includes('--dry-run'),
    skipGenius: args.includes('--skip-genius'),
    force: args.includes('--force'),
  }

  console.log(`📁 Songs directory: ${config.upload.songsDir}`)
  console.log(`📝 Contract: ${config.contract.address}`)
  console.log(`🌐 Network: ${config.contract.chain}\n`)

  // Get song folders
  const songFolders = await getSongFolders()

  if (songFolders.length === 0) {
    console.error('❌ No song folders found in ./songs/')
    console.log('\nCreate a song folder with:')
    console.log('  - metadata.json (required)')
    console.log('  - audio.mp3 (required)')
    console.log('  - lyrics.txt (required)')
    console.log('  - thumbnail.jpg (optional)')
    console.log('  - vocals.mp3 (optional, for better alignment)')
    console.log('  - translations/zh.txt, translations/vi.txt (optional)\n')
    process.exit(1)
  }

  console.log(`Found ${songFolders.length} song folder(s):\n`)
  songFolders.forEach((folder, i) => console.log(`  ${i + 1}. ${folder}`))
  console.log()

  // Filter to specific song if provided
  let songsToProcess = songFolders
  if (songIdArg) {
    if (!songFolders.includes(songIdArg)) {
      console.error(`❌ Song folder not found: ${songIdArg}`)
      process.exit(1)
    }
    songsToProcess = [songIdArg]
  }

  // Process each song
  let successCount = 0
  let failCount = 0

  for (const songId of songsToProcess) {
    try {
      console.log(`\n${'─'.repeat(60)}`)
      console.log(`Processing: ${songId}`)
      console.log('─'.repeat(60))

      // Load song configuration
      const songConfig = await loadSongConfig(songId)
      console.log(`✓ Loaded metadata.json`)
      console.log(`   Title: ${songConfig.title}`)
      console.log(`   Artist: ${songConfig.artist}`)

      // Load song files
      const songFiles = await loadSongFiles(songId)
      console.log(`✓ Loaded song files`)
      console.log(`   Audio: ${songFiles.fullAudio.name}`)
      console.log(`   Lyrics: ${songFiles.lyrics.name}`)
      if (songFiles.vocalsOnly) console.log(`   Vocals: ${songFiles.vocalsOnly.name}`)
      if (songFiles.thumbnail) console.log(`   Thumbnail: ${songFiles.thumbnail.name}`)

      const translationCount = Object.keys(songFiles.translations).length
      if (translationCount > 0) {
        console.log(`   Translations: ${Object.keys(songFiles.translations).join(', ')}`)
      }

      if (flags.dryRun) {
        console.log('\n🔍 DRY RUN - Skipping upload')
        continue
      }

      // Process and upload
      const result = await processSong(songConfig, songFiles)

      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    } catch (error) {
      console.error(`\n❌ Failed to process ${songId}:`)
      console.error(`   ${error instanceof Error ? error.message : error}`)
      failCount++
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('UPLOAD SUMMARY')
  console.log('═'.repeat(60))
  console.log(`✅ Successful: ${successCount}`)
  if (failCount > 0) console.log(`❌ Failed: ${failCount}`)
  console.log('═'.repeat(60) + '\n')

  if (failCount > 0) {
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.main) {
  main().catch(error => {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  })
}
