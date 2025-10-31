/**
 * Test Step 11: Viral Clip Cropping
 *
 * Tests the clip cropping processor on all 13 tracks that have completed fal.ai enhancement
 */

import { processClipCropping } from './src/processors/11-crop-clips';

const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  FAL_API_KEY: process.env.FAL_API_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!
};

console.log('🎬 Testing Step 11: Viral Clip Cropping');
console.log('========================================\n');

try {
  await processClipCropping(env as any, 13);
  console.log('\n✅ Step 11 test completed');
  process.exit(0);
} catch (error) {
  console.error('❌ Step 11 test failed:', error);
  process.exit(1);
}
