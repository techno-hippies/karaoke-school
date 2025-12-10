/**
 * TTS service client
 */

import type { LyricLine } from '@livestream-ai/types'

const TTS_URL = process.env.TTS_URL || 'http://localhost:3030'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${TTS_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  return res.json()
}

export const ttsClient = {
  async status(): Promise<{ ok: boolean; engine: string; voiceId: string }> {
    return request('/status')
  },

  async speak(text: string): Promise<void> {
    await request('/speak', {
      method: 'POST',
      body: JSON.stringify({ text }),
    })
  },

  async schedule(lines: LyricLine[], startedAt: number): Promise<{ ok: boolean; scheduled: number }> {
    return request('/schedule', {
      method: 'POST',
      body: JSON.stringify({ lines, startedAt }),
    })
  },

  async stop(): Promise<void> {
    await request('/stop', { method: 'POST' })
  },
}
