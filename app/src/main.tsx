// 1️⃣ polyfills FIRST - before any other imports
import './polyfills/node-globals'

// 2️⃣ React Scan - performance monitoring (localhost only)
import { scan } from 'react-scan'

if (typeof window !== 'undefined') {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  scan({
    enabled: isLocalhost,
    log: isLocalhost,
  })
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/i18n' // Initialize i18n before App
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
