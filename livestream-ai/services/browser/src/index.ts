/**
 * Browser Service
 *
 * HTTP server for browser automation via CDP.
 *
 * Endpoints:
 * - POST /launch         - Connect to browser via CDP
 * - POST /close          - Disconnect
 * - POST /navigate       - Navigate to URL
 * - GET  /status         - Connection status
 * - GET  /page           - Current page info
 * - GET  /lyrics         - Read lyrics from page (window.__KARAOKE_LYRICS__)
 * - POST /karaoke/start  - Start karaoke (clicks Start button)
 * - GET  /karaoke/status - Recording status (canStart, recording)
 * - GET  /karaoke/results - Full results from window.__KARAOKE_RESULTS__
 *                          { stillGrading, grade, averageScore, completed, total, skipped, timedOut }
 * - GET  /karaoke/score  - Legacy: just score/grade (uses __KARAOKE_RESULTS__ or fallback)
 */

import { CDPClient } from './cdp'

const PORT = parseInt(process.env.BROWSER_PORT || '3032')
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222'

const cdp = new CDPClient(CDP_URL)

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
      // Connect to browser
      if (url.pathname === '/launch' && req.method === 'POST') {
        if (!cdp.isConnected()) {
          await cdp.connect()
        }
        return Response.json({ ok: true }, { headers: cors })
      }

      // Disconnect
      if (url.pathname === '/close' && req.method === 'POST') {
        cdp.close()
        return Response.json({ ok: true }, { headers: cors })
      }

      // Status
      if (url.pathname === '/status' && req.method === 'GET') {
        return Response.json({ ok: true, launched: cdp.isConnected() }, { headers: cors })
      }

      // All other routes require connection
      if (!cdp.isConnected()) {
        return Response.json({ error: 'Browser not connected' }, { status: 400, headers: cors })
      }

      // Navigate
      if (url.pathname === '/navigate' && req.method === 'POST') {
        const body = await req.json() as { url: string }
        await cdp.navigate(body.url)
        const currentUrl = await cdp.getUrl()
        return Response.json({ ok: true, url: currentUrl }, { headers: cors })
      }

      // Current page info
      if (url.pathname === '/page' && req.method === 'GET') {
        const currentUrl = await cdp.getUrl()
        const title = await cdp.getTitle()
        return Response.json({ url: currentUrl, title }, { headers: cors })
      }

      // Read lyrics from window.__KARAOKE_LYRICS__
      if (url.pathname === '/lyrics' && req.method === 'GET') {
        const lyrics = await cdp.evaluate<any>('window.__KARAOKE_LYRICS__')
        return Response.json({ ok: true, data: lyrics }, { headers: cors })
      }

      // Click Karaoke button on song page (navigates to karaoke page)
      if (url.pathname === '/click-karaoke' && req.method === 'POST') {
        const clicked = await cdp.evaluate<string>(`
          (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              const text = btn.textContent || '';
              if (text.includes('Karaoke') || text.includes('カラオケ')) {
                btn.click();
                return 'clicked: ' + text;
              }
            }
            return 'not found';
          })()
        `)
        const ok = clicked.startsWith('clicked')
        return Response.json({ ok, result: clicked }, { headers: cors })
      }

      // Start karaoke
      if (url.pathname === '/karaoke/start' && req.method === 'POST') {
        // Try clicking Start button (English or Japanese)
        const clicked = await cdp.evaluate<string>(`
          (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              const text = btn.textContent || '';
              if (text.includes('Start') || text.includes('スタート')) {
                btn.click();
                return 'clicked: ' + text;
              }
            }
            return 'not found';
          })()
        `)
        const ok = clicked.startsWith('clicked')
        return Response.json({ ok, result: clicked }, { headers: cors })
      }

      // Karaoke status
      if (url.pathname === '/karaoke/status' && req.method === 'GET') {
        const canStart = await cdp.evaluate<boolean>(`
          (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
              const text = btn.textContent || '';
              if (text.includes('Start') || text.includes('スタート')) {
                return true;
              }
            }
            return false;
          })()
        `)
        const recording = await cdp.hasText('Recording')
        return Response.json({ canStart, recording }, { headers: cors })
      }

      // Read results from window.__KARAOKE_RESULTS__ (robust API from app)
      if (url.pathname === '/karaoke/results' && req.method === 'GET') {
        const results = await cdp.evaluate<{
          stillGrading: boolean
          grade: string | null
          completed: number
          total: number
          skipped: number
          averageScore: number | null
          timedOut: boolean
        } | null>('window.__KARAOKE_RESULTS__')
        return Response.json({ ok: true, results }, { headers: cors })
      }

      // Legacy: Read score from results (kept for backwards compatibility)
      if (url.pathname === '/karaoke/score' && req.method === 'GET') {
        // First try the proper API
        const results = await cdp.evaluate<{
          stillGrading: boolean
          grade: string | null
          averageScore: number | null
        } | null>('window.__KARAOKE_RESULTS__')

        if (results && !results.stillGrading) {
          return Response.json({
            score: results.averageScore,
            grade: results.grade,
          }, { headers: cors })
        }

        // Fallback to regex scraping
        const score = await cdp.evaluate<number | null>(`
          (function() {
            const text = document.body.innerText;
            const match = text.match(/(\\d+)%/);
            if (match) return parseInt(match[1]);
            return null;
          })()
        `)
        return Response.json({ score, grade: null }, { headers: cors })
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
