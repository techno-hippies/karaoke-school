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
 */

import { WebSocketServer, WebSocket } from 'ws'
import { ElevenLabsEngine } from './engines/elevenlabs'
import type { LyricLine, TTSSpeakRequest, TTSScheduleRequest } from '@livestream-ai/types'

const PORT = parseInt(process.env.TTS_PORT || '3030')
const API_KEY = process.env.ELEVENLABS_API_KEY
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'USMKuKI6F4jqsrCpgOAE'
const TTS_LEAD_TIME_MS = 800

if (!API_KEY) {
  console.error('ELEVENLABS_API_KEY required')
  process.exit(1)
}

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

// TTS Engine
const engine = new ElevenLabsEngine({ apiKey: API_KEY, voiceId: VOICE_ID })
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

  console.log(`[TTS] Scheduled ${lines.length} lines`)
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
      return Response.json({ ok: true, engine: 'elevenlabs', voiceId: VOICE_ID }, { headers: corsHeaders })
    }

    if (url.pathname === '/speak' && req.method === 'POST') {
      const body = await req.json() as TTSSpeakRequest
      await engine.speak(body.text)
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
console.log(`[TTS] Voice: ${VOICE_ID}`)
