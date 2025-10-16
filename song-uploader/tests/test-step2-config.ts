#!/usr/bin/env bun

/**
 * Step 2: Test config validation
 */

import { config, validateConfig } from '../src/config.js'

console.log('=== STEP 2: Testing Config Validation ===\n')

try {
  console.log('1. Checking configuration...')
  console.log(`   Contract address: ${config.contract.address}`)
  console.log(`   Chain: ${config.contract.chain}`)
  console.log(`   Songs directory: ${config.upload.songsDir}`)

  console.log('\n2. Validating required environment variables...')
  const validation = validateConfig()

  console.log(`   Valid: ${validation.valid}`)

  if (!validation.valid) {
    console.log(`   Missing variables:`)
    validation.errors.forEach(err => console.log(`     - ${err}`))
    console.log('\n⚠️  This is expected - set these in .env file:')
    console.log('     PRIVATE_KEY=0x...')
    console.log('     ELEVENLABS_API_KEY=...')
    console.log('     OPENROUTER_API_KEY=...')
  } else {
    console.log('   ✓ All required variables set')
  }

  console.log('\n✅ SUCCESS: Config system works!\n')

} catch (error) {
  console.error('\n❌ FAILED:', error)
  process.exit(1)
}
