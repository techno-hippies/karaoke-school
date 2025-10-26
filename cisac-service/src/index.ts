/**
 * CISAC ISWC Scraper Service
 *
 * Provides HTTP API for:
 * - Searching CISAC ISWC Network by ISWC code
 * - Extracting comprehensive work metadata (title, parties, publishers, IPIs)
 * - OAuth2 JWT token caching (~59 minutes)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { CISACService } from './cisac-service.js';

const app = new Hono();

// Global CISAC service instance
let cisacService: CISACService | null = null;
const startTime = Date.now();
let isWarmingUp = false;
let warmupComplete = false;

interface SearchByISWCRequest {
  iswc: string;
}

/**
 * Get or initialize CISAC service
 */
function getCISACService(): CISACService {
  if (!cisacService) {
    const apiKey = process.env.TWOCAPTCHA_API_KEY;
    if (!apiKey) {
      throw new Error('TWOCAPTCHA_API_KEY environment variable is required');
    }

    console.log('🌐 Initializing CISAC service...');
    cisacService = new CISACService({
      apiKey,
      headless: true, // Always headless in production
      slowMo: 0,
    });
  }
  return cisacService;
}

/**
 * Pre-warm token cache on startup (runs in background)
 */
async function warmupTokenCache() {
  if (isWarmingUp || warmupComplete) return;
  isWarmingUp = true;

  try {
    console.log('🔥 Starting token warmup (solving captcha in background)...');
    const service = getCISACService();

    // Use a dummy ISWC to trigger auth flow and cache token
    await service.searchByIswc('T0000000001').catch(() => {
      // Ignore errors - we just want to cache the token
    });

    warmupComplete = true;
    console.log('✅ Token warmup complete - ready to serve requests!');
  } catch (error) {
    console.error('❌ Token warmup failed:', error);
    isWarmingUp = false;
  }
}

// Start warmup immediately on startup
setTimeout(() => {
  warmupTokenCache();
}, 1000); // 1 second delay to let server start

// Middleware
app.use('*', cors());

// Routes
app.get('/health', (c) => {
  const service = getCISACService();
  const uptime = (Date.now() - startTime) / 1000;

  return c.json({
    status: 'healthy',
    uptime,
    token_cached: service.isTokenCached(),
    token_expires_in: service.getTokenExpiresIn(),
    service: 'cisac-iswc-service',
    version: '1.0.0'
  });
});

app.post('/search/iswc', async (c) => {
  try {
    const body = await c.req.json<SearchByISWCRequest>();
    const { iswc } = body;

    if (!iswc) {
      return c.json({ error: 'iswc is required' }, 400);
    }

    console.log(`🔍 Searching CISAC for ISWC: ${iswc}`);

    const service = getCISACService();
    const result = await service.searchByIswc(iswc);

    if (!result) {
      return c.json({ error: 'ISWC not found in CISAC database' }, 404);
    }

    return c.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('CISAC search error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down CISAC service...');
  if (cisacService) {
    await cisacService.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down CISAC service...');
  if (cisacService) {
    await cisacService.close();
  }
  process.exit(0);
});

// Start server
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 CISAC ISWC Service running on port ${port}`);
console.log(`🔑 Token caching enabled (~59 minute validity)`);

export default {
  port,
  fetch: app.fetch,
};
