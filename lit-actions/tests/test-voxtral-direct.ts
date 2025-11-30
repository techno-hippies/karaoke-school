/**
 * Direct test of Voxtral STT API
 */

import { readFile } from 'fs/promises'
import { join } from 'path'

const DEEPINFRA_API_KEY = process.env.DEEPINFRA_API_KEY || 'eHeuqOVuKlbKdDhgn9ao9RWrM8tAuExF'
const VOXTRAL_SMALL_URL = 'https://api.deepinfra.com/v1/inference/mistralai/Voxtral-Small-24B-2507'

async function testVoxtral(audioPath: string, contentType: string, filename: string) {
  console.log(`\n--- Testing: ${filename} (${contentType}) ---`)

  try {
    const audioBuffer = await readFile(audioPath)
    console.log(`Audio size: ${audioBuffer.length} bytes`)

    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: contentType })
    formData.append('audio', blob, filename)

    const response = await fetch(VOXTRAL_SMALL_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DEEPINFRA_API_KEY}` },
      body: formData,
    })

    const responseText = await response.text()
    console.log(`Status: ${response.status}`)
    console.log(`Response: ${responseText.substring(0, 200)}`)

    if (response.ok) {
      const result = JSON.parse(responseText)
      console.log(`✅ SUCCESS: "${result.text}"`)
      return true
    }
    return false
  } catch (error) {
    console.error(`❌ ERROR:`, error)
    return false
  }
}

async function main() {
  const fixturesDir = join(import.meta.dir, 'fixtures')
  const webmPath = join(fixturesDir, 'test-audio.webm')

  // Test webm with different content types and filenames
  const tests = [
    { contentType: 'audio/webm', filename: 'audio.webm' },
    { contentType: 'audio/ogg', filename: 'audio.ogg' },
    { contentType: 'audio/opus', filename: 'audio.opus' },
    { contentType: 'audio/ogg; codecs=opus', filename: 'audio.ogg' },
    { contentType: 'application/octet-stream', filename: 'audio.ogg' },
  ]

  for (const test of tests) {
    const success = await testVoxtral(webmPath, test.contentType, test.filename)
    if (success) {
      console.log('\n🎉 Found working format!')
      break
    }
  }
}

main().catch(console.error)
