/**
 * Debug Overlay - Shows console logs on screen for mobile debugging
 *
 * Add ?debug=1 to URL to enable
 */

import { createSignal, onMount, onCleanup, Show, For } from 'solid-js'

interface LogEntry {
  type: 'log' | 'warn' | 'error' | 'info'
  message: string
  timestamp: number
}

export function DebugOverlay() {
  const [logs, setLogs] = createSignal<LogEntry[]>([])
  const [isEnabled, setIsEnabled] = createSignal(false)
  const [isMinimized, setIsMinimized] = createSignal(false)

  onMount(() => {
    // Check URL for debug param
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '')

    if (params.get('debug') === '1' || hashParams.get('debug') === '1') {
      setIsEnabled(true)

      // Intercept console methods
      const originalLog = console.log
      const originalWarn = console.warn
      const originalError = console.error
      const originalInfo = console.info

      const addLog = (type: LogEntry['type'], args: unknown[]) => {
        const message = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2)
            } catch {
              return String(arg)
            }
          }
          return String(arg)
        }).join(' ')

        setLogs(prev => [...prev.slice(-50), { type, message, timestamp: Date.now() }])
      }

      console.log = (...args) => {
        originalLog(...args)
        addLog('log', args)
      }
      console.warn = (...args) => {
        originalWarn(...args)
        addLog('warn', args)
      }
      console.error = (...args) => {
        originalError(...args)
        addLog('error', args)
      }
      console.info = (...args) => {
        originalInfo(...args)
        addLog('info', args)
      }

      // Cleanup on unmount
      onCleanup(() => {
        console.log = originalLog
        console.warn = originalWarn
        console.error = originalError
        console.info = originalInfo
      })
    }
  })

  const getTypeColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      default: return 'text-green-400'
    }
  }

  return (
    <Show when={isEnabled()}>
      <div
        class="fixed bottom-16 left-0 right-0 z-[9999] pointer-events-none"
        style={{ "max-height": isMinimized() ? '40px' : '40vh' }}
      >
        <div class="bg-black/90 text-white text-xs font-mono pointer-events-auto">
          {/* Header */}
          <div
            class="flex justify-between items-center px-2 py-1 bg-gray-800 cursor-pointer"
            onClick={() => setIsMinimized(!isMinimized())}
          >
            <span>Debug Logs ({logs().length})</span>
            <div class="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); setLogs([]) }}
                class="px-2 bg-red-600 rounded"
              >
                Clear
              </button>
              <span>{isMinimized() ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Logs */}
          <Show when={!isMinimized()}>
            <div class="overflow-y-auto p-2 space-y-1" style={{ "max-height": "calc(40vh - 30px)" }}>
              <For each={logs()}>
                {(log) => (
                  <div class={`${getTypeColor(log.type)} break-all`}>
                    <span class="text-gray-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    {' '}
                    <span class="opacity-60">[{log.type}]</span>
                    {' '}
                    {log.message}
                  </div>
                )}
              </For>
              <Show when={logs().length === 0}>
                <div class="text-gray-500">No logs yet...</div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  )
}
