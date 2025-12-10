/**
 * ElevenLabs TTS Engine
 */

import WebSocket from 'ws'

export interface ElevenLabsConfig {
  apiKey: string
  voiceId: string
  modelId?: string
  outputFormat?: string
}

export interface AudioChunk {
  audio: string // base64
  isFinal?: boolean
  alignment?: {
    chars: string[]
    charStartTimesMs: number[]
    charDurationsMs: number[]
  }
}

export type AudioChunkCallback = (chunk: AudioChunk) => void

export class ElevenLabsEngine {
  private config: ElevenLabsConfig
  private ws: WebSocket | null = null
  private isConnected = false
  private pendingResolve: (() => void) | null = null
  private onChunk: AudioChunkCallback | null = null

  constructor(config: ElevenLabsConfig) {
    this.config = {
      modelId: 'eleven_turbo_v2_5',
      outputFormat: 'mp3_44100_128',
      ...config,
    }
  }

  setOnChunk(callback: AudioChunkCallback): void {
    this.onChunk = callback
  }

  async connect(): Promise<void> {
    if (this.isConnected) return

    const { voiceId, modelId, outputFormat, apiKey } = this.config

    const url = new URL(`wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input`)
    url.searchParams.set('model_id', modelId!)
    url.searchParams.set('output_format', outputFormat!)

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url.toString(), {
        headers: { 'xi-api-key': apiKey },
      })

      this.ws.on('open', () => {
        console.log('[ElevenLabs] Connected')
        this.ws!.send(JSON.stringify({
          text: ' ',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          generation_config: { chunk_length_schedule: [120, 160, 250, 290] },
        }))
        this.isConnected = true
        resolve()
      })

      this.ws.on('message', (data: Buffer) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.audio) {
            this.onChunk?.({ audio: msg.audio, alignment: msg.alignment })
          }
          if (msg.isFinal) {
            this.onChunk?.({ audio: '', isFinal: true })
            this.pendingResolve?.()
            this.pendingResolve = null
          }
        } catch (err) {
          console.error('[ElevenLabs] Parse error:', err)
        }
      })

      this.ws.on('error', reject)
      this.ws.on('close', () => {
        console.log('[ElevenLabs] Disconnected')
        this.isConnected = false
        this.ws = null
      })
    })
  }

  disconnect(): void {
    if (this.ws) {
      try { this.ws.send(JSON.stringify({ text: '' })) } catch {}
      this.ws.close()
      this.ws = null
      this.isConnected = false
    }
  }

  async speak(text: string): Promise<void> {
    if (!this.isConnected) await this.connect()
    if (!this.ws) throw new Error('Not connected')

    return new Promise((resolve) => {
      this.pendingResolve = resolve
      this.ws!.send(JSON.stringify({
        text: text + ' ',
        try_trigger_generation: true,
        flush: true,
      }))
      console.log(`[ElevenLabs] Speaking: "${text}"`)
    })
  }
}
