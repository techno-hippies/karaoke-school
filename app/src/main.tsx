// 1️⃣ polyfills FIRST - before any other imports
import './polyfills/node-globals'

// 2️⃣ React Scan - performance monitoring
import { scan } from 'react-scan'

if (typeof window !== 'undefined') {
  scan({
    enabled: true,
    log: true, // logs render info to console (optional)
  })
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
