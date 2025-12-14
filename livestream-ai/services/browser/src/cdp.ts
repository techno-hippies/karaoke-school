/**
 * Raw CDP (Chrome DevTools Protocol) client
 *
 * Uses native WebSocket instead of Playwright to avoid compatibility issues.
 */

export interface CDPTarget {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl: string
}

export class CDPClient {
  private ws: WebSocket | null = null
  private msgId = 1
  private pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>()
  private cdpUrl: string

  constructor(cdpUrl: string = 'http://localhost:9222') {
    this.cdpUrl = cdpUrl
  }

  async connect(): Promise<void> {
    const targets = await this.getTargets()
    // Find actual page target (not devtools://, not empty URL)
    const pageTarget = targets.find(t =>
      t.type === 'page' &&
      t.url &&
      !t.url.startsWith('devtools://') &&
      !t.url.startsWith('chrome://') &&
      !t.url.startsWith('chrome-extension://')
    )
    if (!pageTarget) throw new Error('No page target found')

    console.log(`[CDP] Connecting to: ${pageTarget.title}`)

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(pageTarget.webSocketDebuggerUrl)

      this.ws.onopen = () => {
        console.log('[CDP] Connected')
        resolve()
      }

      this.ws.onerror = (err) => {
        console.error('[CDP] WebSocket error:', err)
        reject(err)
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)
          if (msg.id && this.pendingRequests.has(msg.id)) {
            const { resolve, reject } = this.pendingRequests.get(msg.id)!
            this.pendingRequests.delete(msg.id)
            if (msg.error) {
              reject(new Error(msg.error.message))
            } else {
              resolve(msg.result)
            }
          }
        } catch (err) {
          console.error('[CDP] Failed to parse message:', err)
        }
      }

      this.ws.onclose = () => {
        console.log('[CDP] Disconnected')
        this.ws = null
      }
    })
  }

  async getTargets(): Promise<CDPTarget[]> {
    const res = await fetch(`${this.cdpUrl}/json`)
    return res.json()
  }

  async send(method: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.ws) throw new Error('Not connected')

    const id = this.msgId++
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      this.ws!.send(JSON.stringify({ id, method, params }))

      // Timeout after 30s
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`CDP request timeout: ${method}`))
        }
      }, 30000)
    })
  }

  async navigate(url: string): Promise<void> {
    console.log(`[CDP] Navigating to ${url}`)

    // For hash-based SPA routing, use JS navigation to avoid page reload
    if (url.includes('#')) {
      await this.evaluate(`window.location.href = '${url}'`)
    } else {
      await this.send('Page.navigate', { url })
    }

    // Wait for load
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Reconnect if disconnected (navigation can break the connection)
    if (!this.isConnected()) {
      console.log(`[CDP] Reconnecting after navigation...`)
      await this.connect()
    }
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    return result?.result?.value
  }

  async click(selector: string): Promise<boolean> {
    const expression = `
      (function() {
        const el = document.querySelector('${selector}');
        if (el) {
          el.click();
          return true;
        }
        return false;
      })()
    `
    return this.evaluate<boolean>(expression)
  }

  async clickByText(text: string): Promise<boolean> {
    const expression = `
      (function() {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent && btn.textContent.includes('${text}')) {
            btn.click();
            return true;
          }
        }
        return false;
      })()
    `
    return this.evaluate<boolean>(expression)
  }

  async getUrl(): Promise<string> {
    return this.evaluate<string>('window.location.href')
  }

  async getTitle(): Promise<string> {
    return this.evaluate<string>('document.title')
  }

  async getText(selector: string): Promise<string | null> {
    const expression = `
      (function() {
        const el = document.querySelector('${selector}');
        return el ? el.textContent : null;
      })()
    `
    return this.evaluate<string | null>(expression)
  }

  async hasElement(selector: string): Promise<boolean> {
    const expression = `document.querySelector('${selector}') !== null`
    return this.evaluate<boolean>(expression)
  }

  async hasText(text: string): Promise<boolean> {
    const expression = `document.body.innerText.includes('${text}')`
    return this.evaluate<boolean>(expression)
  }

  close(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
