#!/usr/bin/env bun
/**
 * Creator Module 10: Auto-Create Artist
 *
 * Workflow orchestrator that checks if an artist exists in The Graph subgraph.
 * If the artist doesn't exist, automatically creates them using the unified account system.
 *
 * This maintains single-responsibility principle:
 * - This script orchestrates the check + create workflow
 * - modules/artists/create-artist.ts handles actual artist creation
 * - The Graph subgraph is queried for existence check
 *
 * Usage:
 *   bun modules/creators/10-auto-create-artist.ts --genius-id 498 --genius-artist-name "Taylor Swift"
 *   bun modules/creators/10-auto-create-artist.ts --genius-id 12417 --genius-artist-name "A$AP Rocky"
 */

import { parseArgs } from 'util';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../lib/logger.js';
import { requireEnv } from '../../lib/config.js';

const execAsync = promisify(exec);

interface ArtistQueryResult {
  data?: {
    artist?: {
      id: string;
      geniusId: string;
      lensHandle: string;
      pkpAddress: string;
      createdAt: string;
    };
  };
}

/**
 * Query The Graph subgraph to check if artist exists
 */
async function checkArtistExists(geniusId: number): Promise<boolean> {
  const subgraphUrl = requireEnv('SUBGRAPH_URL');

  const query = `
    query GetArtist($geniusId: String!) {
      artist(id: $geniusId) {
        id
        geniusId
        lensHandle
        pkpAddress
        createdAt
      }
    }
  `;

  const variables = {
    geniusId: geniusId.toString(),
  };

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Subgraph request failed: ${response.statusText}`);
    }

    const result: ArtistQueryResult = await response.json();

    if (result.data?.artist) {
      return true;
    }

    return false;
  } catch (error: any) {
    logger.warn(`Failed to query subgraph: ${error.message}`);
    logger.warn('Assuming artist does not exist and will attempt creation');
    return false;
  }
}

/**
 * Normalize artist name to Lens handle format
 * - Convert to lowercase
 * - Remove special characters except hyphens
 * - Replace spaces and underscores with hyphens
 * - Handle special cases like "$" -> "s"
 */
function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\$/g, 's') // $ -> s (e.g., A$AP -> asap)
    .replace(/[^a-z0-9\s_-]/g, '') // Remove special chars except space, underscore, hyphen
    .replace(/[\s_]+/g, '') // Remove spaces and underscores
    .trim();
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'genius-id': { type: 'string' },
      'genius-artist-name': { type: 'string' },
      'isni': { type: 'string' }, // Optional ISNI code
    },
  });

  const geniusIdStr = values['genius-id'];
  const geniusArtistName = values['genius-artist-name'];
  const isni = values['isni'];

  if (!geniusIdStr || !geniusArtistName) {
    logger.error('Missing required parameters');
    console.log('\nUsage:');
    console.log('  bun modules/creators/10-auto-create-artist.ts --genius-id 498 --genius-artist-name "Taylor Swift"');
    console.log('  bun modules/creators/10-auto-create-artist.ts --genius-id 12417 --genius-artist-name "A$AP Rocky" --isni 0000000078519858\n');
    console.log('Options:');
    console.log('  --genius-id            Genius artist ID (required)');
    console.log('  --genius-artist-name   Genius artist name (required)');
    console.log('  --isni                 ISNI code (optional)\n');
    process.exit(1);
  }

  const geniusId = parseInt(geniusIdStr);

  logger.header(`Auto-Create Artist: ${geniusArtistName}`);
  console.log(`Genius ID: ${geniusId}`);

  try {
    // Step 1: Check if artist exists in The Graph
    console.log('\n🔍 Checking if artist exists in The Graph subgraph...');
    const exists = await checkArtistExists(geniusId);

    if (exists) {
      console.log('✅ Artist already exists in subgraph');
      console.log(`   View at: http://localhost:5173/u/${normalizeArtistName(geniusArtistName)}`);
      console.log('\n✓ No action needed - artist is already registered\n');
      return;
    }

    console.log('❌ Artist not found in subgraph');
    console.log('🎨 Creating artist account...\n');

    // Step 2: Create artist using the unified account system
    const artistHandle = normalizeArtistName(geniusArtistName);
    const isniArg = isni ? `--isni ${isni}` : '';

    const createCmd = `bun modules/artists/create-artist.ts --username ${artistHandle} --genius-artist-id ${geniusId} ${isniArg}`;

    console.log(`→ Running: ${createCmd}\n`);
    const { stdout, stderr } = await execAsync(createCmd);

    // Check for errors
    if (stderr && stderr.includes('Error')) {
      throw new Error(`Artist creation failed: ${stderr}`);
    }

    console.log(stdout);

    console.log('\n✅ Artist auto-creation complete!');
    console.log(`   Artist: ${geniusArtistName}`);
    console.log(`   Genius ID: ${geniusId}`);
    console.log(`   Lens Handle: @${artistHandle}`);
    console.log(`   View at: http://localhost:5173/u/${artistHandle}\n`);

  } catch (error: any) {
    logger.error(`Failed to auto-create artist: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
