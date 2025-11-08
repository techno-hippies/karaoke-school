/**
 * Karaoke Pipeline Worker
 * Main entry point for the 19-step GRC20 minting pipeline
 */

import { Hono } from 'hono';
import type { Env } from './types';
import { routes } from './routes';
import { runUnifiedPipeline } from './processors/orchestrator';

const app = new Hono<{ Bindings: Env }>();

// Health check
app.get('/', (c) => {
  return c.json({
    service: 'Karaoke Pipeline',
    status: 'online',
    version: '1.0.0'
  });
});

// Manual trigger routes
app.route('/', routes);

/**
 * Scheduled cron handler
 * Runs every 5 minutes
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return app.fetch(request, env);
  },

  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log('⏰ Cron triggered:', new Date().toISOString());

    try {
      // Run all enabled pipeline steps
      await runUnifiedPipeline(env, { limit: 50 });
    } catch (error: any) {
      console.error('❌ Cron failed:', error.message);
    }
  }
};
