/**
 * TTS Service
 *
 * HTTP + WebSocket server for text-to-speech.
 *
 * Endpoints:
 * - POST /speak        - Speak text immediately
 * - POST /schedule     - Schedule lyrics with timing
 * - POST /stop         - Stop current speech
 * - GET  /status       - Service status
 *
 * WebSocket /audio:
 * - Streams audio chunks to connected clients
 *
 * Environment:
 * - TTS_ENGINE: 'elevenlabs' (default) or 'vibevoice'
 * - TTS_LEAD_TIME_MS: Lead time for scheduling (default: 0 for elevenlabs, 400 for vibevoice)
 *
 * For ElevenLabs:
 * - ELEVENLABS_API_KEY: Required
 * - ELEVENLABS_VOICE_ID: Voice ID (default: USMKuKI6F4jqsrCpgOAE)
 *
 * For VibeVoice:
 * - VIBEVOICE_SERVER_URL: Python server URL (default: http://localhost:3033)
 *   Note: Run vibevoice_server.py on a different port first!
 */

import { WebSocketServer, WebSocket } from 'ws'
import { ElevenLabsEngine } from './engines/elevenlabs'
import { VibeVoiceEngine } from './engines/vibevoice'
import type { LyricLine, TTSSpeakRequest, TTSScheduleRequest } from '@livestream-ai/types'

const PORT = parseInt(process.env.TTS_PORT || '3030')
const TTS_ENGINE = process.env.TTS_ENGINE || 'elevenlabs'

// Engine-specific defaults
const DEFAULT_LEAD_TIME = TTS_ENGINE === 'vibevoice' ? 400 : 0
const TTS_LEAD_TIME_MS = parseInt(process.env.TTS_LEAD_TIME_MS || String(DEFAULT_LEAD_TIME))

// Audio clients
const audioClients = new Set<WebSocket>()

function broadcastAudio(audio: string, isFinal = false) {
  const msg = JSON.stringify({ type: 'audio', audio, isFinal })
  for (const client of audioClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  }
}

// Create engine based on config
interface TTSEngine {
  connect(): Promise<void>
  speak(text: string): Promise<void>
  setOnChunk(callback: (chunk: { audio: string; isFinal?: boolean }) => void): void
}

let engine: TTSEngine
let engineName: string
let engineInfo: string

if (TTS_ENGINE === 'vibevoice') {
  const serverUrl = process.env.VIBEVOICE_SERVER_URL || 'http://localhost:3033'
  engine = new VibeVoiceEngine({ serverUrl })
  engineName = 'vibevoice'
  engineInfo = serverUrl
  console.log(`[TTS] Using VibeVoice engine at ${serverUrl}`)
} else {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'USMKuKI6F4jqsrCpgOAE'

  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY required for elevenlabs engine')
    console.error('Set TTS_ENGINE=vibevoice to use local VibeVoice instead')
    process.exit(1)
  }

  engine = new ElevenLabsEngine({ apiKey, voiceId })
  engineName = 'elevenlabs'
  engineInfo = voiceId
  console.log(`[TTS] Using ElevenLabs engine with voice ${voiceId}`)
}

engine.setOnChunk((chunk) => {
  if (chunk.audio) broadcastAudio(chunk.audio)
  if (chunk.isFinal) broadcastAudio('', true)
})

// Scheduling
let scheduledTimeouts: Timer[] = []
let scheduleStartTime: number | null = null

function clearSchedule() {
  for (const t of scheduledTimeouts) clearTimeout(t)
  scheduledTimeouts = []
  scheduleStartTime = null
}

function scheduleLyrics(lines: LyricLine[], startedAt: number) {
  clearSchedule()
  scheduleStartTime = startedAt
  const now = Date.now()

  for (const line of lines) {
    const speakAt = startedAt + line.startMs - TTS_LEAD_TIME_MS
    const delay = speakAt - now

    if (delay < 0) {
      console.log(`[TTS] Line ${line.index} in past, skipping`)
      continue
    }

    const timeout = setTimeout(() => {
      engine.speak(line.text)
    }, delay)
    scheduledTimeouts.push(timeout)
  }

  console.log(`[TTS] Scheduled ${lines.length} lines (lead time: ${TTS_LEAD_TIME_MS}ms)`)
}

// HTTP Server
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

    // Routes
    if (url.pathname === '/status' && req.method === 'GET') {
      return Response.json({
        ok: true,
        engine: engineName,
        info: engineInfo,
        leadTimeMs: TTS_LEAD_TIME_MS,
      }, { headers: corsHeaders })
    }

    if (url.pathname === '/speak' && req.method === 'POST') {
      const body = await req.json() as TTSSpeakRequest
      // Don't await - return immediately and let speech happen in background
      engine.speak(body.text).catch(err => console.error('[TTS] Speak error:', err))
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    if (url.pathname === '/schedule' && req.method === 'POST') {
      const body = await req.json() as TTSScheduleRequest
      scheduleLyrics(body.lines, body.startedAt)
      return Response.json({ ok: true, scheduled: body.lines.length }, { headers: corsHeaders })
    }

    if (url.pathname === '/stop' && req.method === 'POST') {
      clearSchedule()
      return Response.json({ ok: true }, { headers: corsHeaders })
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  },
})

// WebSocket for audio streaming
const wss = new WebSocketServer({ port: PORT + 1 })

wss.on('connection', (ws) => {
  console.log('[TTS] Audio client connected')
  audioClients.add(ws)
  ws.on('close', () => {
    audioClients.delete(ws)
    console.log('[TTS] Audio client disconnected')
  })
})

// Startup
await engine.connect()
console.log(`[TTS] HTTP server on http://localhost:${PORT}`)
console.log(`[TTS] WebSocket on ws://localhost:${PORT + 1}`)
console.log(`[TTS] Engine: ${engineName} (${engineInfo})`)
console.log(`[TTS] Lead time: ${TTS_LEAD_TIME_MS}ms`)
