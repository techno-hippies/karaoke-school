/**
 * Utility: Upload Original Images to Grove
 *
 * REPLACES the expensive Step 12 (AI derivative generation) with simple direct upload.
 * Downloads original images from Spotify/Genius and uploads to Grove without AI processing.
 *
 * Cost: ~$0.005 per image (500KB average) vs $0.03 for AI derivatives = 83% cheaper
 *
 * Usage:
 *   bun run scripts/utils/upload-original-images-to-grove.ts --type=artists --limit=10
 *   bun run scripts/utils/upload-original-images-to-grove.ts --type=works --limit=10
 */

import { query } from '../db/neon';

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
 * No AI processing - direct upload
 */
async function uploadImageToGrove(
  buffer: Buffer,
  fileName: string,
  contentType: string = 'image/jpeg'
): Promise<GroveUploadResult> {
  const fileSizeKb = (buffer.length / 1024).toFixed(2);
  console.log(`   Uploading to Grove: ${fileName} (${fileSizeKb} KB)`);

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

/**
 * Process artists: Upload original images to Grove
 */
async function processArtists(limit: number = 50): Promise<void> {
  console.log(`\n[Upload Artists] Processing ${limit} artists...`);

  // Get artists that have images but no Grove CID yet
  const artists = await query(`
    SELECT
      id,
      name,
      image_url,
      header_image_url,
      image_source,
      spotify_artist_id,
      genius_artist_id
    FROM grc20_artists
    WHERE image_url IS NOT NULL
      AND grove_image_cid IS NULL
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  if (artists.length === 0) {
    console.log('✓ No artists need image upload (all caught up!)');
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const artist of artists) {
    try {
      console.log(`\n🎨 Artist: ${artist.name} (source: ${artist.image_source})`);

      // Download original image
      const imageBuffer = await downloadImage(artist.image_url);

      // Detect content type from buffer
      const contentType = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
        ? 'image/jpeg'
        : imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50
        ? 'image/png'
        : 'image/jpeg'; // default

      // Upload to Grove (no AI processing!)
      const groveResult = await uploadImageToGrove(
        imageBuffer,
        `artist-${artist.name.replace(/\s+/g, '-')}.${contentType.split('/')[1]}`,
        contentType
      );

      // Upload header image if available
      let headerGroveResult: GroveUploadResult | null = null;
      if (artist.header_image_url) {
        try {
          console.log(`   Uploading header image...`);
          const headerBuffer = await downloadImage(artist.header_image_url);
          const headerContentType = headerBuffer[0] === 0xFF && headerBuffer[1] === 0xD8
            ? 'image/jpeg'
            : 'image/png';

          headerGroveResult = await uploadImageToGrove(
            headerBuffer,
            `artist-${artist.name.replace(/\s+/g, '-')}-header.${headerContentType.split('/')[1]}`,
            headerContentType
          );
        } catch (error: any) {
          console.warn(`   Header image upload failed: ${error.message}`);
          // Continue - header image is optional
        }
      }

      // Update database with Grove URLs
      await query(`
        UPDATE grc20_artists
        SET
          grove_image_cid = $1,
          grove_image_url = $2,
          grove_header_image_cid = $3,
          grove_header_image_url = $4,
          updated_at = NOW()
        WHERE id = $5
      `, [
        groveResult.cid,
        groveResult.url,
        headerGroveResult?.cid || null,
        headerGroveResult?.url || null,
        artist.id,
      ]);

      console.log(`   ✓ Database updated`);
      processed++;
    } catch (error: any) {
      console.error(`   ✗ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Summary: ${processed} uploaded, ${failed} failed`);
  console.log(`Estimated cost: ${processed} images × $0.005 = $${(processed * 0.005).toFixed(3)}`);
  console.log(`${'='.repeat(70)}\n`);
}

/**
 * Process works: Upload original cover art to Grove
 */
async function processWorks(limit: number = 50): Promise<void> {
  console.log(`\n[Upload Works] Processing ${limit} works...`);

  // Get works that have images but no Grove CID yet
  const works = await query(`
    SELECT
      id,
      title,
      primary_artist_name,
      image_url,
      image_source,
      spotify_track_id,
      genius_song_id
    FROM grc20_works
    WHERE image_url IS NOT NULL
      AND grove_image_cid IS NULL
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);

  if (works.length === 0) {
    console.log('✓ No works need image upload (all caught up!)');
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const work of works) {
    try {
      console.log(`\n🎵 Work: ${work.title} by ${work.primary_artist_name} (source: ${work.image_source})`);

      // Download original cover art
      const imageBuffer = await downloadImage(work.image_url);

      // Detect content type
      const contentType = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8
        ? 'image/jpeg'
        : imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50
        ? 'image/png'
        : 'image/jpeg';

      // Upload to Grove (no AI processing!)
      const groveResult = await uploadImageToGrove(
        imageBuffer,
        `work-${work.spotify_track_id}-${work.title.replace(/\s+/g, '-')}.${contentType.split('/')[1]}`,
        contentType
      );

      // Update database with Grove URL
      await query(`
        UPDATE grc20_works
        SET
          grove_image_cid = $1,
          grove_image_url = $2,
          updated_at = NOW()
        WHERE id = $3
      `, [
        groveResult.cid,
        groveResult.url,
        work.id,
      ]);

      console.log(`   ✓ Database updated`);
      processed++;
    } catch (error: any) {
      console.error(`   ✗ Failed: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Summary: ${processed} uploaded, ${failed} failed`);
  console.log(`Estimated cost: ${processed} images × $0.005 = $${(processed * 0.005).toFixed(3)}`);
  console.log(`${'='.repeat(70)}\n`);
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const typeArg = args.find(arg => arg.startsWith('--type='));
  const limitArg = args.find(arg => arg.startsWith('--limit='));

  const type = typeArg?.split('=')[1] || 'artists';
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;

  if (type === 'artists') {
    await processArtists(limit);
  } else if (type === 'works') {
    await processWorks(limit);
  } else {
    console.error('Usage: bun run upload-original-images-to-grove.ts --type=artists|works --limit=50');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
