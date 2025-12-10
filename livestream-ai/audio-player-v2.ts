/**
 * Audio Player V2 - Saves TTS audio to file then plays via paplay
 *
 * More reliable approach using paplay instead of ffplay stdin
 */

import WebSocket from 'ws'
import { spawn } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'

const TTS_WS = process.env.TTS_WS || 'ws://localhost:3031'
const SINK_NAME = process.env.SINK_NAME || 'TTS_Output'

let audioChunks: Buffer[] = []
let isCollecting = false

function playAudio() {
  if (audioChunks.length === 0) {
    console.log('[Player] No audio to play')
    return
  }

  const audioPath = `/tmp/tts-audio-${Date.now()}.mp3`
  const audioBuffer = Buffer.concat(audioChunks)
  writeFileSync(audioPath, audioBuffer)
  console.log(`[Player] Saved ${audioBuffer.length} bytes to ${audioPath}`)

  // Convert to WAV and play with paplay
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-i', audioPath,
    '-f', 'wav',
    '-ar', '48000',
    '-ac', '2',
    'pipe:1'
  ], { stdio: ['pipe', 'pipe', 'pipe'] })

  const paplay = spawn('paplay', [
    '--device=' + SINK_NAME,
    '--raw',
    '--rate=48000',
    '--channels=2',
    '--format=s16le'
  ], { stdio: ['pipe', 'inherit', 'inherit'] })

  ffmpeg.stdout.pipe(paplay.stdin)

  ffmpeg.stderr.on('data', () => {}) // Suppress ffmpeg output

  paplay.on('close', (code) => {
    console.log(`[Player] Playback complete (code: ${code})`)
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
console.log(`[Player] Audio Player V2 for OBS`)
console.log(`[Player] TTS WebSocket: ${TTS_WS}`)
console.log(`[Player] Output Sink: ${SINK_NAME}`)
console.log('')
connect()
