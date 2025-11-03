#!/usr/bin/env bun
/**
 * Test: Transaction Block Fix
 * Verifies that transactionBlock() uses proper postgres transactions
 * and doesn't throw UNSAFE_TRANSACTION errors
 */

import { query, transactionBlock, close } from '../src/db/neon';

async function testTransactionFix() {
  console.log('🧪 Testing Transaction Fix\n');

  // Get a test track from the pipeline
  const tracks = await query<{ id: number; spotify_track_id: string; status: string }>(`
    SELECT id, spotify_track_id, status
    FROM song_pipeline
    WHERE status = 'clips_cropped'
    LIMIT 1
  `);

  if (tracks.length === 0) {
    console.log('⚠️  No test tracks found. Skipping test.');
    return;
  }

  const testTrack = tracks[0];
  console.log(`📝 Test track: ${testTrack.spotify_track_id} (ID: ${testTrack.id})`);
  console.log(`   Current status: ${testTrack.status}`);
  console.log('');

  // Test 1: Simple transaction with multiple operations
  console.log('Test 1: Multi-statement transaction');
  try {
    await transactionBlock(async (tx) => {
      // Simulate what Step 8 does: update multiple tables atomically
      await tx(`
        UPDATE song_audio
        SET updated_at = NOW()
        WHERE spotify_track_id = $1
      `, [testTrack.spotify_track_id]);

      await tx(`
        UPDATE song_pipeline
        SET updated_at = NOW()
        WHERE id = $1
      `, [testTrack.id]);
    });

    console.log('✅ Transaction succeeded - no UNSAFE_TRANSACTION error!\n');
  } catch (error: any) {
    console.error('❌ Transaction failed:', error.message);
    if (error.message.includes('UNSAFE_TRANSACTION')) {
      console.error('⚠️  UNSAFE_TRANSACTION error still occurring!\n');
      return false;
    }
    throw error;
  }

  // Test 2: Transaction rollback on error
  console.log('Test 2: Transaction rollback on error');
  const beforeUpdate = await query<{ retry_count: number | null }>(`
    SELECT retry_count FROM song_pipeline WHERE id = $1
  `, [testTrack.id]);

  try {
    await transactionBlock(async (tx) => {
      // First update should succeed
      await tx(`
        UPDATE song_pipeline
        SET retry_count = 999
        WHERE id = $1
      `, [testTrack.id]);

      // This should cause the transaction to fail
      throw new Error('Intentional test error');
    });

    console.error('❌ Transaction should have failed but succeeded!\n');
    return false;
  } catch (error: any) {
    if (error.message === 'Intentional test error') {
      console.log('✅ Transaction correctly threw error');

      // Verify rollback worked
      const afterRollback = await query<{ retry_count: number | null }>(`
        SELECT retry_count FROM song_pipeline WHERE id = $1
      `, [testTrack.id]);

      if (afterRollback[0].retry_count === beforeUpdate[0].retry_count) {
        console.log('✅ Rollback succeeded - retry_count unchanged\n');
      } else {
        console.error(`❌ Rollback failed - retry_count changed from ${beforeUpdate[0].retry_count} to ${afterRollback[0].retry_count}\n`);
        return false;
      }
    } else {
      throw error;
    }
  }

  // Test 3: Concurrent transactions (stress test)
  console.log('Test 3: Concurrent transactions (10 parallel)');
  const startTime = Date.now();

  try {
    await Promise.all(
      Array.from({ length: 10 }, async (_, i) => {
        await transactionBlock(async (tx) => {
          await tx(`
            UPDATE song_pipeline
            SET updated_at = NOW()
            WHERE id = $1
          `, [testTrack.id]);

          // Small delay to increase contention
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      })
    );

    const duration = Date.now() - startTime;
    console.log(`✅ All 10 concurrent transactions succeeded in ${duration}ms\n`);
  } catch (error: any) {
    console.error('❌ Concurrent transactions failed:', error.message);
    if (error.message.includes('UNSAFE_TRANSACTION')) {
      console.error('⚠️  UNSAFE_TRANSACTION error under concurrent load!\n');
      return false;
    }
    throw error;
  }

  console.log('✅ All transaction tests passed!');
  return true;
}

// Run test
testTransactionFix()
  .then((success) => {
    if (success === false) {
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Fatal test error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await close();
  });
