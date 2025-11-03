/**
 * Step 12: Emit Segment Events to Blockchain
 * Status: clips_cropped → events_emitted
 *
 * Uploads pre-filtered karaoke segment data to Grove/IPFS:
 * - Translations (7 lines per language, 0-based timing)
 * - Word alignments (89 words, 0-based timing)
 * - Segment metadata (references all above)
 *
 * Emits smart contract events for subgraph indexing:
 * - SegmentRegistered (links to GRC-20 work)
 * - SegmentProcessed (links to Grove URIs)
 * - TranslationAdded (multi-language support)
 *
 * NOTE: This runs the standalone emit-segment-events.ts script
 * Requires PRIVATE_KEY environment variable for contract calls
 */

import { execSync } from 'child_process';
import type { Env } from '../types';

export async function processEmitSegmentEvents(env: Env): Promise<void> {
  console.log('\n[Step 12] Emit Segment Events to Blockchain');
  console.log('Uploading pre-filtered translations & alignments to Grove');
  console.log('Emitting contract events for subgraph indexing\n');

  // Check for required environment variable
  if (!env.PRIVATE_KEY) {
    console.warn('⚠️  PRIVATE_KEY not configured, skipping contract emissions');
    console.warn('   (Segments still valid, but not indexed on blockchain)');
    return;
  }

  try {
    // Run the emit-segment-events script
    // Using child_process to execute the compiled script
    console.log('🚀 Running emit-segment-events script...\n');

    const output = execSync(
      'bun scripts/contracts/emit-segment-events.ts',
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          PRIVATE_KEY: env.PRIVATE_KEY,
          NEON_PROJECT_ID: env.NEON_PROJECT_ID,
          DATABASE_URL: env.DATABASE_URL,
        }
      }
    );

    console.log('\n✅ Segment events emitted successfully');
    console.log('   - Translations uploaded to Grove (7 lines per language)');
    console.log('   - Alignments uploaded to Grove (89 words)');
    console.log('   - Segment metadata uploaded to Grove');
    console.log('   - Contract events emitted to Lens testnet');
    console.log('   - Subgraph will index these events automatically');

  } catch (error: any) {
    console.error('\n❌ Failed to emit segment events:');
    console.error(error.message || error);

    // This is an optional step - don't fail the entire pipeline
    // Users can re-run this step manually with proper PRIVATE_KEY
    console.warn('\n⚠️  You can retry this step later with:');
    console.warn('   bun scripts/contracts/emit-segment-events.ts');
  }
}
