/**
 * Run Steps 9-10: Segment Selection & fal.ai Enhancement
 *
 * These steps are separate from the main orchestrator (steps 2-7.5).
 * Run them after:
 * - Step 8 (Demucs separation) completes → song_audio.instrumental_grove_url
 * - Step 6.5 (ElevenLabs alignment) completes → elevenlabs_word_alignments.words
 *
 * Usage:
 *   NEON_PROJECT_ID=frosty-smoke-70266868 \
 *   dotenvx run -f .env -- bun run run-steps-9-10.ts
 *
 * Options (edit script):
 *   - runStep9: Enable/disable segment selection
 *   - runStep10: Enable/disable fal.ai enhancement
 *   - step9Limit: How many tracks to process for segment selection
 *   - step10Limit: How many tracks to enhance with fal.ai
 */

import { processSegmentSelection } from './src/processors/09-select-segments';
import { processFalEnhancement } from './src/processors/10-enhance-audio';
import type { Env } from './src/types';

// Configuration
const CONFIG = {
  runStep9: true,   // AI segment selection
  runStep10: true,  // fal.ai enhancement
  step9Limit: 10,   // Process 10 tracks for segment selection
  step10Limit: 5,   // Enhance 5 tracks with fal.ai (costs ~$1)
};

async function main() {
  console.log('🎵 Steps 9-10: Segment Selection & fal.ai Enhancement\n');

  // Validate environment
  const env: Env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    FAL_API_KEY: process.env.FAL_API_KEY || '',
    IRYS_PRIVATE_KEY: process.env.IRYS_PRIVATE_KEY || '',
  };

  if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }

  const startTime = Date.now();
  const results: Array<{ step: string; success: boolean; error?: string }> = [];

  // Step 9: AI Segment Selection
  if (CONFIG.runStep9) {
    console.log('=' .repeat(70));
    console.log('Step 9: AI Segment Selection');
    console.log('Using Gemini 2.5 Flash-lite to select optimal segments');
    console.log('=' .repeat(70));

    try {
      await processSegmentSelection(env, CONFIG.step9Limit);
      results.push({ step: 'Step 9', success: true });
      console.log(`\n✅ Step 9 completed\n`);
    } catch (error: any) {
      console.error(`\n❌ Step 9 failed: ${error.message}\n`);
      results.push({ step: 'Step 9', success: false, error: error.message });
      // Don't continue to Step 10 if Step 9 fails
      if (CONFIG.runStep10) {
        console.log('⚠️  Skipping Step 10 due to Step 9 failure\n');
      }
      return;
    }
  }

  // Step 10: fal.ai Enhancement
  if (CONFIG.runStep10) {
    console.log('=' .repeat(70));
    console.log('Step 10: fal.ai Audio Enhancement');
    console.log('Enhancing instrumentals with Stable Audio 2.5');
    console.log('=' .repeat(70));

    try {
      await processFalEnhancement(env, CONFIG.step10Limit);
      results.push({ step: 'Step 10', success: true });
      console.log(`\n✅ Step 10 completed\n`);
    } catch (error: any) {
      console.error(`\n❌ Step 10 failed: ${error.message}\n`);
      results.push({ step: 'Step 10', success: false, error: error.message });
    }
  }

  // Summary
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log('=' .repeat(70));
  console.log(`🏁 Steps 9-10 Complete (${totalDuration}s)`);
  console.log(`   ✅ Succeeded: ${succeeded}/${results.length}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}/${results.length}`);
  }
  console.log('=' .repeat(70));

  if (failed > 0) {
    console.log('\nFailed steps:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.step}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    });
  }
}

main().catch(console.error);
