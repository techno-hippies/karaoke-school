/* @refresh reload */
import { render } from 'solid-js/web'
import App from './App'
import './index.css'

// Node.js polyfills for browser
import { Buffer } from 'buffer'
globalThis.Buffer = Buffer

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element not found')
}

render(() => <App />, root)
