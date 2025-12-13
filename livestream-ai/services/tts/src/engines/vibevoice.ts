/**
 * VibeVoice TTS Engine
 *
 * Connects to the local VibeVoice Python server for TTS.
 * Drop-in replacement for ElevenLabsEngine.
 */

import type { AudioChunk, AudioChunkCallback } from './elevenlabs'

export interface VibeVoiceConfig {
  serverUrl?: string  // Default: http://localhost:3030
  voiceId?: string    // For future use
}

export class VibeVoiceEngine {
  private config: VibeVoiceConfig
  private ws: WebSocket | null = null
  private isConnected = false
  private onChunk: AudioChunkCallback | null = null
  private speakQueue: Array<{ text: string; resolve: () => void }> = []
  private isSpeaking = false

  constructor(config: VibeVoiceConfig = {}) {
    this.config = {
      serverUrl: 'http://localhost:3030',
      ...config,
    }
  }

  setOnChunk(callback: AudioChunkCallback): void {
    this.onChunk = callback
  }

  async connect(): Promise<void> {
    if (this.isConnected) return

    const wsUrl = this.config.serverUrl!.replace('http', 'ws') + '/ws/audio'

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log('[VibeVoice] WebSocket connected')
        this.isConnected = true
        resolve()
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'audio' && msg.audio) {
            this.onChunk?.({ audio: msg.audio })
          }
          if (msg.type === 'audio' && msg.isFinal) {
            this.onChunk?.({ audio: '', isFinal: true })
            this.onSpeakComplete()
          }
          // Ignore ping messages
        } catch (err) {
          console.error('[VibeVoice] Parse error:', err)
        }
      }

      this.ws.onerror = (err) => {
        console.error('[VibeVoice] WebSocket error:', err)
        reject(err)
      }

      this.ws.onclose = () => {
        console.log('[VibeVoice] WebSocket disconnected')
        this.isConnected = false
        this.ws = null
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  private onSpeakComplete(): void {
    this.isSpeaking = false
    // Resolve current speak promise
    const current = this.speakQueue.shift()
    current?.resolve()
    // Process next in queue
    this.processQueue()
  }

  private async processQueue(): Promise<void> {
    if (this.isSpeaking || this.speakQueue.length === 0) return

    const { text } = this.speakQueue[0]
    this.isSpeaking = true

    try {
      const res = await fetch(`${this.config.serverUrl}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!res.ok) {
        console.error('[VibeVoice] Speak request failed:', res.status)
        this.onSpeakComplete()
      }
      // Audio will come through WebSocket, onSpeakComplete called when isFinal received
    } catch (err) {
      console.error('[VibeVoice] Speak error:', err)
      this.onSpeakComplete()
    }
  }

  async speak(text: string): Promise<void> {
    if (!this.isConnected) await this.connect()

    console.log(`[VibeVoice] Speaking: "${text}"`)

    return new Promise((resolve) => {
      this.speakQueue.push({ text, resolve })
      this.processQueue()
    })
  }
}
