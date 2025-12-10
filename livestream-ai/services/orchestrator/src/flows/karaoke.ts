/**
 * Karaoke Flow
 *
 * Scripted flow that:
 * 1. Launches browser
 * 2. Navigates to karaoke page
 * 3. Checks/injects session
 * 4. Reads lyrics
 * 5. Starts karaoke + schedules TTS
 * 6. Waits for completion
 *
 * Run with: bun src/flows/karaoke.ts [song-url]
 */

import { browserClient } from '../clients/browser'
import { ttsClient } from '../clients/tts'

const APP_URL = process.env.APP_URL || 'http://localhost:5173'
const DEFAULT_SONG = '/#/britney-spears/toxic/karaoke'

// Session data (export once after manual login, then paste here)
const SAVED_SESSION: Record<string, string> = {}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function runKaraokeFlow(songPath: string) {
  console.log('=== Karaoke Flow ===\n')

  // Step 1: Check services
  console.log('[1] Checking services...')

  try {
    const ttsStatus = await ttsClient.status()
    console.log(`    TTS: ${ttsStatus.engine} (${ttsStatus.voiceId})`)
  } catch {
    console.error('    TTS service not running! Start with: cd services/tts && bun dev')
    process.exit(1)
  }

  // Step 2: Launch browser
  console.log('[2] Launching browser...')
  await browserClient.launch()
  console.log('    Browser launched')

  // Step 3: Navigate to app
  const url = `${APP_URL}${songPath}`
  console.log(`[3] Navigating to ${url}`)
  await browserClient.navigate(url)
  await sleep(2000) // Wait for page load

  // Step 4: Check session
  console.log('[4] Checking session...')
  const { loggedIn } = await browserClient.getSession()

  if (!loggedIn) {
    if (Object.keys(SAVED_SESSION).length > 0) {
      console.log('    Not logged in, injecting saved session...')
      await browserClient.injectSession(SAVED_SESSION)
      await sleep(2000)
    } else {
      console.log('    Not logged in and no saved session.')
      console.log('    Please log in manually, then export session.')
      console.log('    (The browser window should be open)')

      // Wait for manual login
      console.log('\n    Press Enter when logged in...')
      for await (const _ of console) { break }

      // Export session for next time
      const { session } = await browserClient.getSession()
      if (session) {
        console.log('\n    Session exported! Add this to SAVED_SESSION:')
        console.log(JSON.stringify(session, null, 2))
      }
    }
  } else {
    console.log('    Already logged in')
  }

  // Step 5: Wait for page to be ready
  console.log('[5] Waiting for karaoke page...')
  await sleep(3000)

  // Step 6: Read lyrics
  console.log('[6] Reading lyrics...')
  const { data: lyricsData } = await browserClient.getLyrics()

  if (!lyricsData || lyricsData.lyrics.length === 0) {
    console.log('    No lyrics found. Trying network intercept...')
    // Could add a retry or alternative method here
    console.log('    Lyrics may load after song starts.')
  } else {
    console.log(`    Found ${lyricsData.lyrics.length} lines`)
    console.log(`    "${lyricsData.title}" by ${lyricsData.artist}`)
  }

  // Step 7: Check if we can start
  console.log('[7] Checking karaoke status...')
  const { canStart } = await browserClient.getKaraokeStatus()

  if (!canStart) {
    console.log('    Cannot start karaoke (need to log in or button not visible)')
    console.log('    Press Enter to try starting anyway...')
    for await (const _ of console) { break }
  }

  // Step 8: Start karaoke
  console.log('[8] Starting karaoke...')
  const startedAt = Date.now()
  const { ok, recording } = await browserClient.startKaraoke()

  if (!ok) {
    console.log('    Failed to start karaoke')
    return
  }

  console.log(`    Started! Recording: ${recording}`)

  // Step 9: Schedule TTS
  if (lyricsData && lyricsData.lyrics.length > 0) {
    console.log('[9] Scheduling TTS...')
    const { scheduled } = await ttsClient.schedule(lyricsData.lyrics, startedAt)
    console.log(`    Scheduled ${scheduled} lines`)
  } else {
    console.log('[9] Skipping TTS (no lyrics)')
  }

  // Step 10: Wait for completion
  console.log('[10] Waiting for song to finish...')
  console.log('     (Press Ctrl+C to stop early)\n')

  // Poll for recording status
  let stillRecording = true
  while (stillRecording) {
    await sleep(2000)
    const status = await browserClient.getKaraokeStatus()
    stillRecording = status.recording

    if (!stillRecording) {
      console.log('\n    Recording finished!')
    }
  }

  // Step 11: Read results
  console.log('[11] Reading results...')
  // Could add result reading here

  console.log('\n=== Flow Complete ===')
}

// Run the flow
const songPath = process.argv[2] || DEFAULT_SONG
runKaraokeFlow(songPath).catch(console.error)
