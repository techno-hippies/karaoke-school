/**
 * Standalone Pipeline Server
 * Runs the same Cloudflare Worker code locally
 * Easy migration to Workers - just change the server setup
 */

import { Hono } from 'hono';
import type { Env } from './src/types';
import { routes } from './src/routes';
import { runUnifiedPipeline } from './src/processors/orchestrator';

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/', (c) => {
  return c.json({
    service: 'Karaoke Pipeline (Standalone)',
    status: 'online',
    version: '1.0.0',
    mode: 'local'
  });
});

// Manual trigger endpoints (Worker-compatible)
app.post('/trigger', async (c) => {
  const step = c.req.query('step') ? parseInt(c.req.query('step')!) : undefined;
  const limit = parseInt(c.req.query('limit') || '50');

  // Mock environment for local execution
  const mockEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    PIPELINE_WEBHOOK_DOMAIN: `http://localhost:${process.env.PORT || 8787}`,
    DEMUCS_LOCAL_ENDPOINT: process.env.DEMUCS_LOCAL_ENDPOINT || 'http://localhost:8001',
    AUDIO_DOWNLOAD_SERVICE_URL: process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001',
  } as Env;

  await runUnifiedPipeline(mockEnv, { step, limit });

  return c.json({
    success: true,
    message: step ? `Step ${step} completed` : 'All steps completed',
    step,
    limit,
  });
});

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', service: 'pipeline-standalone' });
});

// All Worker routes (triggers, webhooks, etc.)
app.route('/', routes);

// Start server using Bun (faster than Node.js)
const PORT = parseInt(process.env.PORT || '8787');

if (typeof Bun !== 'undefined' && Bun.serve) {
  console.log(`🚀 Starting Karaoke Pipeline Server (Bun)`);
  
  Bun.serve({
    port: PORT,
    fetch: (request: Request) => app.fetch(request, {
      DATABASE_URL: process.env.DATABASE_URL,
      PIPELINE_WEBHOOK_DOMAIN: `http://localhost:${PORT}`,
      DEMUCS_LOCAL_ENDPOINT: process.env.DEMUCS_LOCAL_ENDPOINT || 'http://localhost:8001',
      AUDIO_DOWNLOAD_SERVICE_URL: process.env.AUDIO_DOWNLOAD_SERVICE_URL || 'http://localhost:3001',
    } as Env),
    error: (error: Error) => {
      console.error('Server error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });
  
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Trigger: POST http://localhost:${PORT}/trigger?step=8&limit=10`);
  console.log(`   Webhooks: POST http://localhost:${PORT}/webhooks/demucs-complete`);
  console.log(`🔄 Worker migration: Change port to 0 for Workers deployment`);
} else {
  console.log('❌ Bun runtime not available. Install Bun or use Node.js fallback.');
  process.exit(1);
}

// Export default for potential Worker deployment
export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  }
};
