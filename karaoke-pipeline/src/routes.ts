/**
 * Manual Trigger Routes
 * Simple HTTP endpoints to manually trigger pipeline steps
 */

import { Hono } from 'hono';
import type { Env } from './types';
import { runUnifiedPipeline } from './processors/orchestrator';

export const routes = new Hono<{ Bindings: Env }>();

/**
 * POST /trigger?step=8&limit=50
 * Manually trigger pipeline (all steps or specific step)
 */
routes.post('/trigger', async (c) => {
  const step = c.req.query('step') ? parseInt(c.req.query('step')!) : undefined;
  const limit = parseInt(c.req.query('limit') || '50');

  await runUnifiedPipeline(c.env, { step, limit });

  return c.json({
    success: true,
    message: step ? `Step ${step} completed` : 'All steps completed',
    step,
    limit,
  });
});
