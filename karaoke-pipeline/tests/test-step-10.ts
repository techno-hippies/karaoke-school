/**
 * Test Step 10: fal.ai Audio Enhancement
 */
import { processFalEnhancement } from './src/processors/10-enhance-audio';
import type { Env } from './src/types';

async function main() {
  const env: Env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    FAL_API_KEY: process.env.FAL_API_KEY || '',
  };

  if (!env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not configured');
    process.exit(1);
  }

  if (!env.FAL_API_KEY) {
    console.error('❌ FAL_API_KEY not configured');
    process.exit(1);
  }

  console.log('Testing Step 10: fal.ai Audio Enhancement');
  console.log('Processing 1 track for testing...');
  console.log('Cost: ~$0.20 + Grove upload\n');

  try {
    await processFalEnhancement(env, 1);
    console.log('\n✅ Test complete!');
  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
