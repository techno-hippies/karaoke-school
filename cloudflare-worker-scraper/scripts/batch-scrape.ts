/**
 * Batch TikTok Scraper
 * Scrapes ALL videos from creators (from CSV or database)
 * Usage: bun run scripts/batch-scrape.ts [--csv path/to/file.csv] [--rescrape-existing]
 */

import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';

const WORKER_URL = process.env.WORKER_URL || 'https://tiktok-scraper.deletion-backup782.workers.dev';
const BATCH_DELAY_MS = 2000; // 2 seconds between scrapes to avoid rate limiting

interface Creator {
  handle: string;
  source: 'csv' | 'database';
}

async function scrapeCreator(handle: string): Promise<void> {
  console.log(`\n🎯 Scraping @${handle} (ALL videos)...`);

  try {
    const response = await fetch(`${WORKER_URL}/scrape/${handle}`);

    if (!response.ok) {
      console.error(`  ❌ Failed: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    console.log(`  ✅ ${data.scraped.inserted}/${data.scraped.videos} videos inserted`);
    console.log(`  📊 Creator: ${data.creator.name} (${data.creator.followers.toLocaleString()} followers)`);
    console.log(`  🎵 Stats: ${data.stats.total_videos} videos, ${data.stats.unique_spotify_tracks} unique tracks`);
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }
}

async function getExistingCreators(): Promise<string[]> {
  console.log('📋 Fetching existing creators from database...');

  const NEON_DATABASE_URL = process.env.NEON_DATABASE_URL;
  if (!NEON_DATABASE_URL) {
    console.error('NEON_DATABASE_URL not set');
    return [];
  }

  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(NEON_DATABASE_URL);

  const creators = await sql`
    SELECT tiktok_handle
    FROM tiktok_creators
    ORDER BY tiktok_handle
  `;

  console.log(`  Found ${creators.length} existing creators`);
  return creators.map((c: any) => c.tiktok_handle);
}

async function getCreatorsFromCSV(csvPath: string): Promise<string[]> {
  console.log(`📄 Reading creators from ${csvPath}...`);

  const content = readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  // Check if first line looks like a header
  const firstLine = lines[0]?.toLowerCase();
  const hasHeader = firstLine === 'handle' || firstLine === 'tiktok_handle' || firstLine === 'username';

  const handles = (hasHeader ? lines.slice(1) : lines)
    .map(line => {
      // Extract handle (remove comments after spaces)
      const handle = line.split(/\s+/)[0];
      return handle.replace('@', '').trim();
    })
    .filter(Boolean);

  console.log(`  Found ${handles.length} creators in CSV`);
  return handles;
}

async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find(arg => arg.startsWith('--csv='))?.split('=')[1];
  const rescrapeExisting = args.includes('--rescrape-existing');

  const creators: Creator[] = [];

  // Load from CSV if provided
  if (csvPath) {
    const csvHandles = await getCreatorsFromCSV(csvPath);
    creators.push(...csvHandles.map(handle => ({ handle, source: 'csv' as const })));
  }

  // Load existing creators if requested
  if (rescrapeExisting) {
    const existingHandles = await getExistingCreators();
    creators.push(...existingHandles.map(handle => ({ handle, source: 'database' as const })));
  }

  if (creators.length === 0) {
    console.log('❌ No creators to scrape. Use --csv=path/to/file.csv or --rescrape-existing');
    console.log('\nExamples:');
    console.log('  bun run scripts/batch-scrape.ts --csv=tiktoks_to_scrape.csv');
    console.log('  bun run scripts/batch-scrape.ts --rescrape-existing');
    console.log('  bun run scripts/batch-scrape.ts --csv=tiktoks_to_scrape.csv --rescrape-existing');
    process.exit(1);
  }

  // Deduplicate
  const uniqueHandles = [...new Set(creators.map(c => c.handle))];
  console.log(`\n🚀 Starting batch scrape for ${uniqueHandles.length} creators...`);
  console.log(`   Worker: ${WORKER_URL}`);
  console.log(`   Delay between scrapes: ${BATCH_DELAY_MS}ms\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < uniqueHandles.length; i++) {
    const handle = uniqueHandles[i];
    console.log(`[${i + 1}/${uniqueHandles.length}] @${handle}`);

    try {
      await scrapeCreator(handle);
      successCount++;
    } catch (error) {
      failCount++;
    }

    // Delay between requests to avoid rate limiting
    if (i < uniqueHandles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  console.log(`\n✅ Batch scrape complete!`);
  console.log(`   Success: ${successCount}`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Total: ${uniqueHandles.length}`);
}

main().catch(console.error);
