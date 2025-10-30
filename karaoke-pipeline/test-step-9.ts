/**
 * Test Step 9: AI Segment Selection
 */
import { processSegmentSelection } from './src/processors/09-select-segments';
import type { Env } from './src/types';

async function main() {
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

  console.log('Testing Step 9: AI Segment Selection');
  console.log('Processing 2 tracks...\n');

  try {
    await processSegmentSelection(env, 2);
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
