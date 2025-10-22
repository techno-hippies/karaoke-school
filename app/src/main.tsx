import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Web3Provider } from './providers/Web3Provider'
import { Buffer } from 'buffer'

// Make Buffer globally available for Lit Protocol
window.Buffer = Buffer

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Web3Provider>
      <App />
    </Web3Provider>
  </StrictMode>,
)
