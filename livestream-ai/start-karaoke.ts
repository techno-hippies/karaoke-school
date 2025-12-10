/**
 * Start karaoke and TTS in sync
 * Clicks the browser Start button via CDP and immediately starts TTS scheduler
 */

const TTS_HTTP = 'http://localhost:3030'
const LEAD_TIME_MS = 550

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

// Load lyrics
const lyricsFile = process.argv[2] || '/tmp/karaoke-lyrics.json'
const lyricsJson = await Bun.file(lyricsFile).text()
const data: KaraokeLyrics = JSON.parse(lyricsJson)
console.log(`[SYNC] Loaded ${data.lyrics.length} lines for "${data.title}" by ${data.artist}`)

// Get CDP targets
const targetsRes = await fetch('http://localhost:9222/json')
const targets = await targetsRes.json()
const pageTarget = targets.find((t: any) => t.type === 'page')

if (!pageTarget) {
  console.error('[SYNC] No page found')
  process.exit(1)
}

console.log(`[SYNC] Found page: ${pageTarget.title}`)

// Connect via WebSocket
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)

await new Promise<void>((resolve) => {
  ws.onopen = () => resolve()
})

let msgId = 1
function sendCDP(method: string, params: any = {}): Promise<any> {
  return new Promise((resolve) => {
    const id = msgId++
    const handler = (event: MessageEvent) => {
      const msg = JSON.parse(event.data)
      if (msg.id === id) {
        ws.removeEventListener('message', handler)
        resolve(msg.result)
      }
    }
    ws.addEventListener('message', handler)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

// Click the Start button using JavaScript evaluation
// Handle multiple languages: English "Start", Japanese "スタート"
console.log('[SYNC] Clicking Start button...')
const clickResult = await sendCDP('Runtime.evaluate', {
  expression: `
    (function() {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent || '';
        if (text.includes('Start') || text.includes('スタート')) {
          btn.click();
          return 'clicked: ' + text;
        }
      }
      return 'not found, buttons: ' + Array.from(buttons).map(b => b.textContent).join(', ');
    })()
  `,
  returnByValue: true
})
console.log('[SYNC] Click result:', clickResult?.result?.value || clickResult)

// Record start time IMMEDIATELY after click
const startedAt = Date.now()
console.log(`[SYNC] Started at ${startedAt}`)

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

// Keep process alive
const lastLine = data.lyrics[data.lyrics.length - 1]
const totalDuration = lastLine.endMs + 5000
console.log(`[SYNC] Will run for ${totalDuration}ms`)

setTimeout(() => {
  console.log('[SYNC] Done!')
  ws.close()
  process.exit(0)
}, totalDuration)
