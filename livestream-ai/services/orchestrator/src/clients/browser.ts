/**
 * Browser service client
 */

import type { LyricLine } from '@livestream-ai/types'

const BROWSER_URL = process.env.BROWSER_URL || 'http://localhost:3032'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BROWSER_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  return res.json()
}

export const browserClient = {
  async launch(): Promise<void> {
    await request('/launch', { method: 'POST' })
  },

  async close(): Promise<void> {
    await request('/close', { method: 'POST' })
  },

  async status(): Promise<{ ok: boolean; launched: boolean }> {
    return request('/status')
  },

  async navigate(url: string): Promise<void> {
    await request('/navigate', {
      method: 'POST',
      body: JSON.stringify({ url }),
    })
  },

  async click(selector: string): Promise<void> {
    await request('/click', {
      method: 'POST',
      body: JSON.stringify({ selector }),
    })
  },

  async getSession(): Promise<{ loggedIn: boolean; session: Record<string, string> | null }> {
    return request('/session')
  },

  async injectSession(session: Record<string, string>): Promise<{ ok: boolean; loggedIn: boolean }> {
    return request('/session', {
      method: 'POST',
      body: JSON.stringify({ session }),
    })
  },

  async getLyrics(): Promise<{ ok: boolean; data: { lyrics: LyricLine[]; title: string; artist: string } | null }> {
    return request('/lyrics')
  },

  async startKaraoke(): Promise<{ ok: boolean; recording: boolean }> {
    return request('/karaoke/start', { method: 'POST' })
  },

  async getKaraokeStatus(): Promise<{ recording: boolean; canStart: boolean }> {
    return request('/karaoke/status')
  },

  async screenshot(): Promise<Blob> {
    const res = await fetch(`${BROWSER_URL}/screenshot`)
    return res.blob()
  },
}
