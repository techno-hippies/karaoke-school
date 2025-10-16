#!/usr/bin/env bun

/**
 * Step 6: Test contract read operations
 * Tests checkSongExists() function (read-only, no wallet needed)
 *
 * NOTE: Write operations (addFullSong) require PRIVATE_KEY and Base Sepolia ETH
 * For full end-to-end testing, see: bun run upload genesis-again
 */

import { config } from '../src/config.js'
import { checkSongExists } from '../src/services/contract.js'

const TEST_SONG_ID = 'genesis-again'

console.log('=== STEP 6: Testing Contract Operations ===\n')

try {
  console.log('Testing contract read operations...')
  console.log(`Contract: ${config.contract.address}`)
  console.log(`Chain: ${config.contract.chain}`)
  console.log(`RPC: ${config.contract.rpcUrl}`)

  // Test 1: Check if song exists (should not exist yet)
  console.log(`\n1. Checking if "${TEST_SONG_ID}" exists...`)
  const exists = await checkSongExists(TEST_SONG_ID)

  if (exists) {
    console.log(`   ✓ Song exists in catalog (already uploaded)`)
    console.log(`   ℹ️  To test upload, use a different song ID`)
  } else {
    console.log(`   ✓ Song does not exist (ready for upload)`)
  }

  // Test 2: Check a known Genius song (should exist)
  console.log('\n2. Checking if a known Genius song exists...')
  const knownSongId = 'test-genius-song'
  const knownExists = await checkSongExists(knownSongId)
  console.log(`   Song "${knownSongId}": ${knownExists ? 'EXISTS' : 'NOT FOUND'}`)

  // Info about write operations
  console.log('\n3. Write operations (addFullSong):')

  if (!config.wallet.privateKey) {
    console.log('   ⚠️  PRIVATE_KEY not set in .env')
    console.log('   ℹ️  Write operations require:')
    console.log('      - PRIVATE_KEY in .env (wallet with Base Sepolia ETH)')
    console.log('      - Base Sepolia ETH for gas')
    console.log('   ℹ️  Get test ETH: https://www.alchemy.com/faucets/base-sepolia')
    console.log('\n   To test full upload: bun run upload genesis-again')
  } else {
    console.log(`   ✓ PRIVATE_KEY is set`)
    console.log('   ℹ️  To test full upload: bun run upload genesis-again')
    console.log('   ⚠️  This will execute a real transaction on Base Sepolia')
  }

  console.log('\n✅ SUCCESS: Contract read operations work!\n')

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
