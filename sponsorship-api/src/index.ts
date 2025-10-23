import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import type { Env } from './types'
import { validateLensBearerToken } from './middleware/auth'
import { handleLensAuth } from './routes/lens-auth'
import { handleSubmitTx } from './routes/submit-tx'

/**
 * Karaoke School Sponsorship API
 *
 * Cloudflare Workers API for Lens Protocol transaction sponsorship
 * Implements anti-spam protection, PKP verification, and quota management
 *
 * Endpoints:
 * - POST /api/lens-auth - Lens authorization endpoint (bearer token required)
 * - POST /api/submit-tx - Transaction submission from frontend (CORS enabled)
 *
 * Architecture:
 * - Hono for routing and middleware
 * - Neon DB for sponsorship tracking
 * - Viem for blockchain interactions
 * - Cloudflare Workers for edge deployment
 */

const app = new Hono<{ Bindings: Env }>()

// Global middleware
app.use('*', logger())

// CORS for all API endpoints (frontend + Lens Dashboard)
app.use(
  '/api/*',
  cors({
    origin: '*', // Allow Lens Dashboard and frontend
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

/**
 * Health check endpoint
 */
app.get('/', (c) => {
  return c.json({
    name: 'Karaoke School Sponsorship API',
    status: 'healthy',
    version: '1.0.0',
  })
})

/**
 * Lens Authorization Endpoint
 * Called by Lens API to check if user should be sponsored
 *
 * Security: Bearer token authentication required
 * Performance: Must respond within 500ms
 */
app.post('/api/lens-auth', validateLensBearerToken, handleLensAuth)

/**
 * Transaction Submission Endpoint
 * Called by frontend when REQUIRES_SIGNATURE is returned
 *
 * Security: CORS enabled, validate account ownership in handler
 * Performance: Submits tx with funded admin wallet
 */
app.post('/api/submit-tx', handleSubmitTx)

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

/**
 * Global error handler
 */
app.onError((err, c) => {
  console.error('[Global Error]', err)
  return c.json(
    {
      error: 'Internal Server Error',
      message: err.message,
    },
    500
  )
})

export default app
