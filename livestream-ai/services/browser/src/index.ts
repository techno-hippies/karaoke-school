/**
 * Browser Service
 *
 * HTTP server for browser automation via CDP.
 *
 * Endpoints:
 * - POST /launch       - Launch browser
 * - POST /close        - Close browser
 * - POST /navigate     - Navigate to URL
 * - POST /click        - Click element
 * - GET  /status       - Browser status
 * - GET  /screenshot   - Take screenshot
 * - GET  /session      - Check login status
 * - POST /session      - Inject session data
 * - GET  /lyrics       - Read lyrics from page
 * - POST /karaoke/start - Start karaoke
 */

import { BrowserController } from './browser'
import { isLoggedIn, injectSession, exportSession } from './actions/auth'
import { readLyricsFromPage, interceptLyricsMetadata } from './actions/read-lyrics'
import { startKaraoke, isRecording, canStartKaraoke } from './actions/karaoke'
import type { BrowserNavigateRequest } from '@livestream-ai/types'

const PORT = parseInt(process.env.BROWSER_PORT || '3032')
const CDP_URL = process.env.CDP_URL // Optional: connect to existing Chrome

const browser = new BrowserController({
  headless: process.env.HEADLESS === 'true',
  cdpUrl: CDP_URL,
})

let isLaunched = false

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

    const cors = { 'Access-Control-Allow-Origin': '*' }

    try {
      // Launch browser
      if (url.pathname === '/launch' && req.method === 'POST') {
        if (!isLaunched) {
          await browser.launch()
          isLaunched = true
        }
        return Response.json({ ok: true }, { headers: cors })
      }

      // Close browser
      if (url.pathname === '/close' && req.method === 'POST') {
        await browser.close()
        isLaunched = false
        return Response.json({ ok: true }, { headers: cors })
      }

      // Status
      if (url.pathname === '/status' && req.method === 'GET') {
        return Response.json({ ok: true, launched: isLaunched }, { headers: cors })
      }

      // All other routes require browser to be launched
      if (!isLaunched) {
        return Response.json({ error: 'Browser not launched' }, { status: 400, headers: cors })
      }

      const page = browser.getPage()

      // Navigate
      if (url.pathname === '/navigate' && req.method === 'POST') {
        const body = await req.json() as BrowserNavigateRequest
        await browser.navigate(body.url)
        return Response.json({ ok: true, url: page.url() }, { headers: cors })
      }

      // Click
      if (url.pathname === '/click' && req.method === 'POST') {
        const body = await req.json() as { selector: string }
        await browser.click(body.selector)
        return Response.json({ ok: true }, { headers: cors })
      }

      // Screenshot
      if (url.pathname === '/screenshot' && req.method === 'GET') {
        const path = `/tmp/screenshot-${Date.now()}.png`
        await browser.screenshot(path)
        const file = Bun.file(path)
        return new Response(file, {
          headers: { ...cors, 'Content-Type': 'image/png' },
        })
      }

      // Session status
      if (url.pathname === '/session' && req.method === 'GET') {
        const loggedIn = await isLoggedIn(page)
        const sessionData = loggedIn ? await exportSession(page) : null
        return Response.json({ loggedIn, session: sessionData }, { headers: cors })
      }

      // Inject session
      if (url.pathname === '/session' && req.method === 'POST') {
        const body = await req.json() as { session: Record<string, string> }
        await injectSession(page, body.session)
        const loggedIn = await isLoggedIn(page)
        return Response.json({ ok: true, loggedIn }, { headers: cors })
      }

      // Read lyrics
      if (url.pathname === '/lyrics' && req.method === 'GET') {
        const lyrics = await readLyricsFromPage(page)
        return Response.json({ ok: true, data: lyrics }, { headers: cors })
      }

      // Start karaoke
      if (url.pathname === '/karaoke/start' && req.method === 'POST') {
        const canStart = await canStartKaraoke(page)
        if (!canStart) {
          return Response.json({ ok: false, error: 'Cannot start karaoke' }, { headers: cors })
        }
        const started = await startKaraoke(page)
        return Response.json({ ok: started, recording: await isRecording(page) }, { headers: cors })
      }

      // Karaoke status
      if (url.pathname === '/karaoke/status' && req.method === 'GET') {
        const recording = await isRecording(page)
        const canStart = await canStartKaraoke(page)
        return Response.json({ recording, canStart }, { headers: cors })
      }

      return new Response('Not found', { status: 404, headers: cors })
    } catch (err) {
      console.error('[Browser] Error:', err)
      return Response.json(
        { error: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500, headers: cors }
      )
    }
  },
})

console.log(`[Browser] Service on http://localhost:${PORT}`)
