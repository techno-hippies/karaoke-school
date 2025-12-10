/**
 * Test TTS by speaking a line and saving to file
 */

import { ttsClient } from './clients/tts'

async function main() {
  console.log('Testing TTS...')

  // Check status
  const status = await ttsClient.status()
  console.log('TTS Status:', status)

  // Speak a line
  console.log('Speaking: "Baby, can you see, I am calling"')
  await ttsClient.speak('Baby, can you see, I am calling')

  console.log('Done! Audio was generated and sent to WebSocket clients.')
  console.log('To hear it, we need an audio player connected to ws://localhost:3031')
}

main().catch(console.error)
