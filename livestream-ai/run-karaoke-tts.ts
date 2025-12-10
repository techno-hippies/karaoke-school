/**
 * Run Karaoke TTS Flow
 *
 * This script:
 * 1. Reads lyrics from the browser (already loaded)
 * 2. Clicks Start on the karaoke page
 * 3. Schedules TTS to speak each line ~800ms before it appears
 */

const TTS_HTTP = 'http://localhost:3030'
const LEAD_TIME_MS = 800 // Speak this many ms before the lyric appears

interface LyricLine {
  index: number
  text: string
  startMs: number
  endMs: number
}

interface KaraokeLyrics {
  lyrics: LyricLine[]
  title: string
  artist: string
}

// Get lyrics from file path (command line arg)
const lyricsFile = process.argv[2] || '/tmp/karaoke-lyrics.json'
const lyricsJson = await Bun.file(lyricsFile).text()
const data: KaraokeLyrics = JSON.parse(lyricsJson)
console.log(`[TTS] Loaded ${data.lyrics.length} lines for "${data.title}" by ${data.artist}`)

// Record start time
const startedAt = Date.now()
console.log(`[TTS] Started at ${startedAt}`)

// Schedule TTS for each line
for (const line of data.lyrics) {
  const speakAt = line.startMs - LEAD_TIME_MS
  const delay = speakAt - (Date.now() - startedAt)

  if (delay > 0) {
    setTimeout(async () => {
      console.log(`[TTS] Speaking line ${line.index}: "${line.text.substring(0, 40)}..."`)
      try {
        await fetch(`${TTS_HTTP}/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: line.text }),
        })
      } catch (err) {
        console.error(`[TTS] Error speaking line ${line.index}:`, err)
      }
    }, delay)
  } else {
    console.log(`[TTS] Skipping line ${line.index} (already past)`)
  }
}

// Keep process alive until all lines are done
const lastLine = data.lyrics[data.lyrics.length - 1]
const totalDuration = lastLine.endMs + 5000 // Add 5s buffer
console.log(`[TTS] Will run for ${totalDuration}ms`)

setTimeout(() => {
  console.log('[TTS] Done!')
  process.exit(0)
}, totalDuration)
