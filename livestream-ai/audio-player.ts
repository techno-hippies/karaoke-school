/**
 * Audio Player V2 - Saves TTS audio to file then plays via paplay
 *
 * More reliable approach using paplay instead of ffplay stdin
 */

import WebSocket from 'ws'
import { spawn, spawnSync } from 'child_process'
import type { ChildProcess } from 'child_process'
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs'

const TTS_WS = process.env.TTS_WS || 'ws://localhost:3031?mode=audio'

const PLAYER_ID = process.env.AUDIO_PLAYER_ID?.trim() || 'livestream-ai-tts'
const LOCK_PATH =
  process.env.AUDIO_PLAYER_LOCK_PATH?.trim() || `/tmp/${PLAYER_ID}.pid`

const DEFAULT_SINK_CANDIDATES = ['Stream_Audio', 'Voice_Input', 'TTS_Output', 'TTS_Sink']

const childProcesses = new Set<ChildProcess>()

function trackChild(proc: ChildProcess) {
  childProcesses.add(proc)
  proc.on('close', () => childProcesses.delete(proc))
  proc.on('exit', () => childProcesses.delete(proc))
  return proc
}

function cleanupLockFile() {
  try {
    if (!existsSync(LOCK_PATH)) return
    const existingPid = readFileSync(LOCK_PATH, 'utf8').trim()
    if (existingPid === String(process.pid)) unlinkSync(LOCK_PATH)
  } catch {
    // ignore
  }
}

function shutdown() {
  for (const proc of childProcesses) {
    try {
      proc.kill('SIGTERM')
    } catch {
      // ignore
    }
  }
  cleanupLockFile()
}

function ensureSingleInstance() {
  if (process.env.AUDIO_PLAYER_NO_LOCK === '1') return

  try {
    if (existsSync(LOCK_PATH)) {
      const existingPid = parseInt(readFileSync(LOCK_PATH, 'utf8').trim(), 10)
      if (Number.isFinite(existingPid) && existingPid > 1 && existingPid !== process.pid) {
        try {
          process.kill(existingPid, 0)
          console.log(`[Player] Found existing audio player (pid ${existingPid}), stopping it...`)
          process.kill(existingPid, 'SIGTERM')
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore
  }

  try {
    writeFileSync(LOCK_PATH, String(process.pid))
  } catch {
    // ignore
  }

  process.on('exit', shutdown)
  process.on('SIGINT', () => {
    shutdown()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    shutdown()
    process.exit(0)
  })
}

function listPulseSinks(): string[] | null {
  try {
    const res = spawnSync('pactl', ['list', 'sinks', 'short'], {
      encoding: 'utf8',
      timeout: 1000,
    })
    if (res.status !== 0) return null

    return res.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[1])
      .filter(Boolean)
  } catch {
    return null
  }
}

function resolveSinkName(): string | null {
  const configured = process.env.SINK_NAME?.trim()
  if (configured) return configured

  const sinks = listPulseSinks()
  if (!sinks) return DEFAULT_SINK_CANDIDATES[0]

  for (const candidate of DEFAULT_SINK_CANDIDATES) {
    if (sinks.includes(candidate)) return candidate
  }

  // Fall back to PulseAudio/ PipeWire default sink.
  return null
}

const SINK_NAME = resolveSinkName()

let audioChunks: Buffer[] = []
let isCollecting = false
let playbackTimeout: Timer | null = null

// Timeout to trigger playback if isFinal never arrives
const PLAYBACK_TIMEOUT_MS = 500

function schedulePlayback() {
  if (playbackTimeout) clearTimeout(playbackTimeout)
  playbackTimeout = setTimeout(() => {
    if (isCollecting && audioChunks.length > 0) {
      console.log(`\n[Player] Timeout - playing ${audioChunks.length} chunks`)
      isCollecting = false
      playAudio()
    }
  }, PLAYBACK_TIMEOUT_MS)
}

function playAudio() {
  if (playbackTimeout) {
    clearTimeout(playbackTimeout)
    playbackTimeout = null
  }
  if (audioChunks.length === 0) {
    console.log('[Player] No audio to play')
    return
  }

  const audioPath = `/tmp/tts-audio-${Date.now()}.mp3`
  const audioBuffer = Buffer.concat(audioChunks)
  writeFileSync(audioPath, audioBuffer)
  console.log(`[Player] Saved ${audioBuffer.length} bytes to ${audioPath}`)

  // Convert to raw PCM s16le and play to the configured sink.
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-i', audioPath,
    '-f', 's16le',
    '-acodec', 'pcm_s16le',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ], { stdio: ['pipe', 'pipe', 'pipe'] })

  const deviceArgs = SINK_NAME ? [`--device=${SINK_NAME}`] : []
  const paplay = spawn('paplay', [
    `--client-name=${PLAYER_ID}`,
    `--stream-name=${PLAYER_ID}`,
    ...deviceArgs,
    '--raw',
    '--rate=48000',
    '--channels=2',
    '--format=s16le',
  ], { stdio: ['pipe', 'inherit', 'inherit'] })

  trackChild(ffmpeg)
  trackChild(paplay)

  ffmpeg.stdout.pipe(paplay.stdin)

  ffmpeg.stderr.on('data', () => {}) // Suppress ffmpeg output

  paplay.on('close', (code) => {
    console.log(`[Player] Playback complete (code: ${code})`)
    try {
      ffmpeg.kill('SIGTERM')
    } catch {
      // ignore
    }
    if (existsSync(audioPath)) unlinkSync(audioPath)
  })

  paplay.on('error', (err) => {
    console.error('[Player] paplay error:', err.message)
  })

  audioChunks = []
}

function connect() {
  console.log(`[Player] Connecting to ${TTS_WS}...`)
  const ws = new WebSocket(TTS_WS)

  ws.on('open', () => {
    console.log('[Player] Connected to TTS WebSocket')
    console.log('[Player] Waiting for audio...')
  })

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'audio' && msg.audio) {
        const chunk = Buffer.from(msg.audio, 'base64')
        audioChunks.push(chunk)
        isCollecting = true
        process.stdout.write('.')
        schedulePlayback() // Reset timeout on each chunk
      }
      if (msg.isFinal && isCollecting) {
        console.log(`\n[Player] Received ${audioChunks.length} chunks`)
        isCollecting = false
        playAudio()
      }
    } catch (e) {
      // Ignore parse errors
    }
  })

  ws.on('close', () => {
    console.log('[Player] Disconnected, reconnecting in 2s...')
    setTimeout(connect, 2000)
  })

  ws.on('error', (err) => {
    console.error('[Player] Error:', err.message)
  })
}

// Start
ensureSingleInstance()
console.log(`[Player] Audio Player V2 for OBS`)
console.log(`[Player] TTS WebSocket: ${TTS_WS}`)
console.log(`[Player] Output Sink: ${SINK_NAME ?? '(default)'}`)
console.log('')
connect()
