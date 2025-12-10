import type { Context, Next } from 'hono'
import type { Env } from '../types'

/**
 * Middleware to validate Lens Authorization Bearer Token
 * Lens API sends requests to /api/lens-auth with this token
 */
export async function validateLensBearerToken(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return c.json({ error: 'Missing Authorization header' }, 401)
  }

  const [scheme, token] = authHeader.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return c.json({ error: 'Invalid Authorization format' }, 401)
  }

  // Validate token matches configured secret
  if (token !== c.env.LENS_AUTH_BEARER_TOKEN) {
    return c.json({ error: 'Invalid bearer token' }, 401)
  }

  // Token valid, proceed to handler
  await next()
}

/**
 * Middleware for CORS (frontend will call /api/submit-tx)
 * Already handled by hono/cors in main app
 */
