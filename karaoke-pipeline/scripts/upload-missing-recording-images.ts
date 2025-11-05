/**
 * Upload Missing Recording Images to Grove
 *
 * This script uploads images for grc20_work_recordings that don't have grove_image_url yet.
 * It gets the image_url from spotify_tracks and uploads to Grove.
 * 
 * Usage: bun scripts/upload-missing-recording-images.ts --limit=20
 */

import { query } from '../src/db/neon';

interface GroveUploadResult {
  cid: string;
  url: string;
  size: number;
}

/**
 * Download image from URL as Buffer
 */
async function downloadImage(imageUrl: string): Promise<Buffer> {
  console.log(`   Downloading image from ${imageUrl}...`);

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload image to Grove (IPFS)
 */
async function uploadImageToGrove(
  buffer: Buffer,
  fileName: string,
  contentType: string = 'image/jpeg'
): Promise<GroveUploadResult> {
  console.log(`   Uploading to Grove: ${fileName} (${(buffer.length / 1024).toFixed(2)} KB)`);

  const uploadUrl = 'https://api.grove.storage/?chain_id=37111';

  // Retry logic (3 attempts with exponential backoff)
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
        body: new Uint8Array(buffer),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grove API error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as any;
      const cid = Array.isArray(result) ? result[0].storage_key : result.storage_key;

      if (!cid) {
        throw new Error('Grove response missing storage_key');
      }

      const url = `https://api.grove.storage/${cid}`;
      console.log(`   ✓ Uploaded: ${cid}`);

      return {
        cid,
        url,
        size: buffer.length,
      };
    } catch (error: any) {
      lastError = error;
      console.warn(`   Attempt ${attempt}/3 failed: ${error.message}`);

      if (attempt < 3) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Grove upload failed after 3 attempts: ${lastError?.message}`);
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 20;

  console.log(`🔍 Finding grc20_work_recordings missing Grove images...\n`);

  // Get recordings that don't have grove_image_url but have spotify_track_id with image_url
  const recordings = await query(`
    SELECT 
      gwr.id as recording_id,
      gwr.work_id,
      gw.title as work_title,
      gwr.spotify_track_id,
      st.title as spotify_title,
      st.image_url
    FROM grc20_work_recordings gwr
    JOIN grc20_works gw ON gw.id = gwr.work_id
    JOIN spotify_tracks st ON st.spotify_track_id = gwr.spotify_track_id
    WHERE gwr.grove_image_url IS NULL
      AND st.image_url IS NOT NULL
    ORDER BY gw.title
    LIMIT $1
  `, [limit]);

  if (recordings.length === 0) {
    console.log('✅ No recordings need image upload (all caught up!)');
    return;
  }

  console.log(`📊 Found ${recordings.length} recordings needing Grove images:\n`);
  recordings.forEach((r: any) => {
    console.log(`   - Work ${r.work_id}: ${r.work_title} (${r.spotify_track_id})`);
  });

  let processed = 0;
  let failed = 0;

  for (const recording of recordings) {
    try {
      console.log(`\n🎵 Recording ${recording.recording_id}: ${recording.work_title}`);

      // Download image from Spotify
      const imageBuffer = await downloadImage(recording.image_url);

      // Detect content type
      const contentType = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
        ? 'image/jpeg'
        : imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50
        ? 'image/png'
        : 'image/jpeg';

      // Upload to Grove
      const groveResult = await uploadImageToGrove(
        imageBuffer,
        `recording-${recording.spotify_track_id}-${recording.work_title.replace(/\s+/g, '-')}.${contentType.split('/')[1]}`,
        contentType
      );

      // Update database
      await query(`
        UPDATE grc20_work_recordings
        SET
          grove_image_url = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [
        groveResult.url,
        recording.recording_id,
      ]);

      console.log(`   ✅ Database updated with Grove URL`);
      processed++;
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Summary: ${processed} uploaded, ${failed} failed`);
  console.log(`Estimated cost: ${processed} images × $0.005 = $${(processed * 0.005).toFixed(3)}`);
  console.log(`Now ready for GRC-20 minting: work ${recordings[0]?.work_id} and ${processed + failed - 1} others`);
  console.log(`${'='.repeat(70)}\n`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
