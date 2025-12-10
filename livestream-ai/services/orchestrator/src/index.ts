/**
 * Orchestrator Service
 *
 * Central coordinator for the AI streamer.
 * Manages flows and coordinates between services.
 *
 * For now, this just exposes an HTTP API.
 * Later: state machine, event-driven flow management.
 */

import { browserClient } from './clients/browser'
import { ttsClient } from './clients/tts'
import type { OrchestratorStatus, OrchestratorState } from '@livestream-ai/types'

const PORT = parseInt(process.env.ORCHESTRATOR_PORT || '3033')

let state: OrchestratorState = 'idle'
let currentSong: string | undefined
let error: string | undefined

function getStatus(): OrchestratorStatus {
  return { state, currentSong, error }
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const cors = { 'Access-Control-Allow-Origin': '*' }

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          ...cors,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    try {
      // Status
      if (url.pathname === '/status') {
        return Response.json(getStatus(), { headers: cors })
      }

      // Health check all services
      if (url.pathname === '/health') {
        const [browser, tts] = await Promise.allSettled([
          browserClient.status(),
          ttsClient.status(),
        ])

        return Response.json({
          orchestrator: 'ok',
          browser: browser.status === 'fulfilled' ? 'ok' : 'error',
          tts: tts.status === 'fulfilled' ? 'ok' : 'error',
        }, { headers: cors })
      }

      // Start karaoke flow
      if (url.pathname === '/flow/karaoke' && req.method === 'POST') {
        const body = await req.json() as { songPath?: string }

        if (state !== 'idle') {
          return Response.json({ error: 'Already running a flow' }, { status: 400, headers: cors })
        }

        // Start flow in background
        state = 'navigating'
        currentSong = body.songPath

        // TODO: Actually run the flow here
        // For now, just return acknowledgment

        return Response.json({ ok: true, state }, { headers: cors })
      }

      // Stop current flow
      if (url.pathname === '/stop' && req.method === 'POST') {
        await ttsClient.stop()
        state = 'idle'
        currentSong = undefined
        return Response.json({ ok: true }, { headers: cors })
      }

      return new Response('Not found', { status: 404, headers: cors })
    } catch (err) {
      console.error('[Orchestrator] Error:', err)
      error = err instanceof Error ? err.message : 'Unknown error'
      return Response.json({ error }, { status: 500, headers: cors })
    }
  },
})

console.log(`[Orchestrator] Service on http://localhost:${PORT}`)
