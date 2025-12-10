/**
 * Agent Bridge
 *
 * Connects the karaoke app to the livestream AI agent server.
 * Sends lyrics schedule, song start/end events, and scores.
 */

export interface LyricLine {
  index: number
  text: string
  startMs: number
  endMs: number
}

export interface AgentBridgeConfig {
  serverUrl?: string
  enabled?: boolean
}

type AgentEvent =
  | { type: 'lyrics_schedule'; lines: LyricLine[] }
  | { type: 'song_start'; startedAt: number }
  | { type: 'song_end' }
  | { type: 'score_received'; lineIndex: number; score: number; rating: string }

class AgentBridge {
  private ws: WebSocket | null = null
  private serverUrl: string
  private enabled: boolean
  private reconnectTimeout: number | null = null
  private messageQueue: AgentEvent[] = []

  constructor(config: AgentBridgeConfig = {}) {
    this.serverUrl = config.serverUrl ?? 'ws://localhost:3030'
    this.enabled = config.enabled ?? false
  }

  /**
   * Enable the bridge and connect to server
   */
  enable(): void {
    if (this.enabled) return
    this.enabled = true
    this.connect()
  }

  /**
   * Disable the bridge and disconnect
   */
  disable(): void {
    this.enabled = false
    this.disconnect()
  }

  /**
   * Check if bridge is connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Connect to agent server
   */
  private connect(): void {
    if (!this.enabled || this.ws) return

    try {
      this.ws = new WebSocket(this.serverUrl)

      this.ws.onopen = () => {
        console.log('[AgentBridge] Connected to', this.serverUrl)
        // Flush queued messages
        for (const event of this.messageQueue) {
          this.send(event)
        }
        this.messageQueue = []
      }

      this.ws.onclose = () => {
        console.log('[AgentBridge] Disconnected')
        this.ws = null
        // Reconnect if still enabled
        if (this.enabled) {
          this.reconnectTimeout = window.setTimeout(() => {
            this.connect()
          }, 2000)
        }
      }

      this.ws.onerror = (err) => {
        console.error('[AgentBridge] Error:', err)
      }
    } catch (err) {
      console.error('[AgentBridge] Failed to connect:', err)
    }
  }

  /**
   * Disconnect from server
   */
  private disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Send event to agent
   */
  private send(event: AgentEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    } else if (this.enabled) {
      // Queue for when connected
      this.messageQueue.push(event)
    }
  }

  /**
   * Send lyrics schedule to agent
   */
  sendLyricsSchedule(lines: LyricLine[]): void {
    this.send({ type: 'lyrics_schedule', lines })
  }

  /**
   * Notify agent that song started
   */
  sendSongStart(): void {
    this.send({ type: 'song_start', startedAt: Date.now() })
  }

  /**
   * Notify agent that song ended
   */
  sendSongEnd(): void {
    this.send({ type: 'song_end' })
  }

  /**
   * Send score to agent
   */
  sendScore(lineIndex: number, score: number, rating: string): void {
    this.send({ type: 'score_received', lineIndex, score, rating })
  }
}

// Singleton instance
export const agentBridge = new AgentBridge()

// Enable via URL param or localStorage
if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search)
  const localEnabled = localStorage.getItem('agent_bridge_enabled') === 'true'

  if (params.has('agent') || localEnabled) {
    agentBridge.enable()
    console.log('[AgentBridge] Auto-enabled')
  }
}
