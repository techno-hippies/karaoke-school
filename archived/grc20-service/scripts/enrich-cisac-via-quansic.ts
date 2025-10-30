/**
 * Enrich CISAC Works via Quansic
 * 
 * Takes all ISWCs from CISAC works and enriches them via Quansic service
 * to get clean contributor data with IPI/ISNI for proper artist linkage.
 */

import postgres from 'postgres';
import { config } from '../config';

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || 'https://tiktok-scraper.deletion-backup782.workers.dev';
const BATCH_SIZE = 50;
const DELAY_MS = 200; // Rate limit

async function main() {
  if (!config.neonConnectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  const sql = postgres(config.neonConnectionString);

  try {
    console.log('🔍 Fetching CISAC ISWCs to enrich via Quansic...\n');

    // Get all ISWCs from CISAC that aren't in quansic_works yet
    const cisacIswcs = await sql`
      SELECT DISTINCT cw.iswc
      FROM cisac_works cw
      WHERE NOT EXISTS (
        SELECT 1 FROM quansic_works qw WHERE qw.iswc = cw.iswc
      )
      LIMIT 1000
    `;

    console.log(`📊 Found ${cisacIswcs.length} ISWCs to enrich via Quansic\n`);

    if (cisacIswcs.length === 0) {
      console.log('✅ All CISAC works already enriched via Quansic');
      await sql.end();
      return;
    }

    // Send to Cloudflare Worker enrichment endpoint
    console.log(`📤 Sending enrichment request to Cloudflare Worker...`);
    console.log(`   This will queue ${cisacIswcs.length} works for Quansic enrichment\n`);

    const response = await fetch(`${CLOUDFLARE_WORKER_URL}/enrich-quansic-works`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        limit: cisacIswcs.length
      })
    });

    if (!response.ok) {
      throw new Error(`Enrichment request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Enrichment queued successfully\n');
    console.log('📊 Response:');
    console.log(JSON.stringify(result, null, 2));

    console.log('\n⏳ Enrichment is running in the background...');
    console.log('   Check progress with: GET /enrichment-queue');
    console.log('   Or monitor quansic_works table for new entries');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch(console.error);
