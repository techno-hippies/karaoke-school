#!/usr/bin/env bun
/**
 * Storage Speed Comparison Test
 *
 * Tests download speeds across all storage layers and gateways.
 * Uses existing content from emitted clips.
 *
 * Usage:
 *   bun src/scripts/test-storage-speeds.ts
 */

// Known content hashes from our emitted clips
const TEST_CONTENT = {
  // Toxic metadata (75KB) - exists on all 3 layers
  metadata: {
    grove: 'https://api.grove.storage/853582ea21741c5104222a38f7ade9917917639de37d834c488d09faa7375d08',
    arweave: {
      // From backfill - need to get actual txId
      'arweave.net': '',
      'ar-io.net': '',
      'ar-io.dev': '',
      'g8way.io': '',
    },
    lighthouse: {
      'gateway.lighthouse.storage': '',
      'ipfs.io': '',
      'dweb.link': '',
      'w3s.link': '',
      'cloudflare-ipfs.com': '',
    },
  },
  // Clip audio (~1-2MB) - exists on Grove + Lighthouse
  audio: {
    grove: '',
    lighthouse: {
      'gateway.lighthouse.storage': '',
    },
  },
};

interface SpeedResult {
  gateway: string;
  layer: string;
  url: string;
  sizeBytes: number;
  timeMs: number;
  speedMbps: number;
  status: 'success' | 'failed' | 'timeout';
  error?: string;
}

async function testUrl(url: string, layer: string, gateway: string, timeoutMs = 30000): Promise<SpeedResult> {
  const start = performance.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        gateway,
        layer,
        url,
        sizeBytes: 0,
        timeMs: performance.now() - start,
        speedMbps: 0,
        status: 'failed',
        error: `HTTP ${response.status}`,
      };
    }

    const buffer = await response.arrayBuffer();
    const timeMs = performance.now() - start;
    const sizeBytes = buffer.byteLength;
    const speedMbps = (sizeBytes * 8) / (timeMs * 1000); // Mbps

    return {
      gateway,
      layer,
      url,
      sizeBytes,
      timeMs,
      speedMbps,
      status: 'success',
    };
  } catch (error) {
    return {
      gateway,
      layer,
      url,
      sizeBytes: 0,
      timeMs: performance.now() - start,
      speedMbps: 0,
      status: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function main() {
  console.log('\n⚡ Storage Speed Comparison Test');
  console.log('═'.repeat(70));

  // First, get actual URLs from our database
  const { query } = await import('../db/connection');

  // Get a clip with all layers populated
  const clips = await query<{
    title: string;
    metadata_uri: string;
    metadata_arweave_uri: string;
    metadata_lighthouse_uri: string;
    clip_instrumental_url: string;
    storage_manifest: any;
  }>(`
    SELECT
      s.title,
      c.metadata_arweave_uri,
      c.metadata_lighthouse_uri,
      s.clip_instrumental_url,
      s.storage_manifest
    FROM clips c
    JOIN songs s ON c.song_id = s.id
    WHERE c.metadata_arweave_uri IS NOT NULL
    LIMIT 1
  `);

  if (clips.length === 0) {
    console.log('❌ No clips with Arweave metadata found');
    return;
  }

  const clip = clips[0];
  console.log(`\nUsing: ${clip.title}`);

  // Extract IDs for gateway testing
  const arweaveTxId = clip.metadata_arweave_uri?.split('/').pop();
  const lighthouseCid = clip.metadata_lighthouse_uri?.split('/ipfs/').pop();
  const groveHash = clip.storage_manifest?.grove?.cid;
  const audioLighthouseCid = clip.storage_manifest?.lighthouse?.cid;

  console.log(`\nArweave TX: ${arweaveTxId}`);
  console.log(`Lighthouse CID: ${lighthouseCid}`);
  console.log(`Grove Hash: ${groveHash}`);
  console.log(`Audio Lighthouse CID: ${audioLighthouseCid}`);

  // Build test URLs
  const testUrls: { url: string; layer: string; gateway: string }[] = [];

  // Grove (single gateway)
  if (groveHash) {
    testUrls.push({
      url: `https://api.grove.storage/${groveHash}`,
      layer: 'Grove',
      gateway: 'api.grove.storage',
    });
  }

  // Arweave gateways
  if (arweaveTxId) {
    const arweaveGateways = [
      'arweave.net',
      'ar-io.net',
      'ar-io.dev',
      'g8way.io',
      'arweave.dev',
    ];
    for (const gw of arweaveGateways) {
      testUrls.push({
        url: `https://${gw}/${arweaveTxId}`,
        layer: 'Arweave',
        gateway: gw,
      });
    }
  }

  // IPFS gateways (Lighthouse CID)
  if (lighthouseCid) {
    const ipfsGateways = [
      { host: 'gateway.lighthouse.storage', path: `/ipfs/${lighthouseCid}` },
      { host: 'ipfs.io', path: `/ipfs/${lighthouseCid}` },
      { host: 'dweb.link', path: `/ipfs/${lighthouseCid}` },
      { host: 'w3s.link', path: `/ipfs/${lighthouseCid}` },
      { host: 'cloudflare-ipfs.com', path: `/ipfs/${lighthouseCid}` },
      { host: 'nftstorage.link', path: `/ipfs/${lighthouseCid}` },
      { host: '4everland.io', path: `/ipfs/${lighthouseCid}` },
    ];
    for (const gw of ipfsGateways) {
      testUrls.push({
        url: `https://${gw.host}${gw.path}`,
        layer: 'IPFS/Lighthouse',
        gateway: gw.host,
      });
    }
  }

  console.log(`\n📊 Testing ${testUrls.length} endpoints (30s timeout each)...`);
  console.log('─'.repeat(70));

  const results: SpeedResult[] = [];

  // Test sequentially to avoid network contention affecting results
  for (const test of testUrls) {
    process.stdout.write(`Testing ${test.gateway}... `);
    const result = await testUrl(test.url, test.layer, test.gateway);
    results.push(result);

    if (result.status === 'success') {
      console.log(`✅ ${result.timeMs.toFixed(0)}ms (${result.speedMbps.toFixed(2)} Mbps)`);
    } else if (result.status === 'timeout') {
      console.log(`⏱️ Timeout`);
    } else {
      console.log(`❌ ${result.error}`);
    }
  }

  // Summary by layer
  console.log('\n' + '═'.repeat(70));
  console.log('📈 RESULTS BY LAYER');
  console.log('═'.repeat(70));

  const layers = ['Grove', 'Arweave', 'IPFS/Lighthouse'];

  for (const layer of layers) {
    const layerResults = results.filter(r => r.layer === layer && r.status === 'success');
    if (layerResults.length === 0) {
      console.log(`\n${layer}: No successful results`);
      continue;
    }

    const sorted = layerResults.sort((a, b) => a.timeMs - b.timeMs);
    const fastest = sorted[0];
    const avgTime = layerResults.reduce((sum, r) => sum + r.timeMs, 0) / layerResults.length;

    console.log(`\n${layer}:`);
    console.log(`  Fastest: ${fastest.gateway} (${fastest.timeMs.toFixed(0)}ms)`);
    console.log(`  Average: ${avgTime.toFixed(0)}ms`);
    console.log(`  Working gateways: ${layerResults.length}/${results.filter(r => r.layer === layer).length}`);
  }

  // Overall ranking
  console.log('\n' + '═'.repeat(70));
  console.log('🏆 OVERALL RANKING (by speed)');
  console.log('═'.repeat(70));

  const successfulResults = results
    .filter(r => r.status === 'success')
    .sort((a, b) => a.timeMs - b.timeMs);

  successfulResults.forEach((r, i) => {
    const sizeKB = (r.sizeBytes / 1024).toFixed(1);
    console.log(`${i + 1}. ${r.gateway.padEnd(30)} ${r.timeMs.toFixed(0).padStart(6)}ms  ${r.speedMbps.toFixed(2).padStart(6)} Mbps  (${sizeKB} KB)`);
  });

  // Failed gateways
  const failed = results.filter(r => r.status !== 'success');
  if (failed.length > 0) {
    console.log('\n❌ Failed/Timeout:');
    failed.forEach(r => {
      console.log(`   ${r.gateway}: ${r.status} ${r.error || ''}`);
    });
  }

  console.log('\n');
}

main().catch(console.error);
