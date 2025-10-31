/**
 * Step 12: Generate Derivative Images for Karaoke Assets
 *
 * Generates watercolor-style derivative images using Seedream (FAL AI).
 * Creates app-owned derivatives of Spotify/Genius source images.
 * NOT related to GRC-20 (which comes later as a separate minting step).
 *
 * Cost: ~$0.03 per image
 * Purpose: Create artistic derivative images for the karaoke platform
 *
 * Processes:
 * - Karaoke tracks (from spotify_tracks with images)
 * - Karaoke artists (unique artists from spotify_tracks with images)
 */

import { neon } from '@neondatabase/serverless';
import { FalImageService } from '../services/fal-image';
import {
  getArtistsNeedingDerivativeImages,
  getTracksNeedingDerivativeImages,
  saveArtistDerivativeImage,
  saveTrackDerivativeImage,
  getDerivativeImageStats,
  getExistingDerivativeForImageUrl
} from '../db/derivative-images';
import type { Env } from '../types';

/**
 * Upload image buffer to Grove
 * Simplified version that handles image content types
 */
async function uploadImageToGrove(
  buffer: Buffer,
  fileName: string,
  contentType: string = 'image/png'
): Promise<{ cid: string; url: string }> {
  const fileSizeKb = (buffer.length / 1024).toFixed(2);
  console.log(`   Uploading to Grove: ${fileName} (${fileSizeKb} KB)`);

  // Convert buffer to base64
  const base64Data = buffer.toString('base64');

  const uploadUrl = 'https://api.grove.storage/?chain_id=37111';

  // Upload to Grove with retry logic
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
      return { cid, url };
    } catch (error: any) {
      lastError = error;
      console.warn(`   Attempt ${attempt}/3 failed: ${error.message}`);

      if (attempt < 3) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Grove upload failed: ${lastError?.message}`);
}

/**
 * Download image from FAL response URL
 */
async function downloadImageFromUrl(imageUrl: string): Promise<Buffer> {
  console.log(`   Downloading image from FAL...`);

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Convert string ID to numeric seed for deterministic image generation
 */
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 2147483647; // Keep within positive 32-bit range
}

export async function processGenerateImages(env: Env, limit: number = 10): Promise<void> {
  console.log(`\n[Step 12] Generate Derivative Images (limit: ${limit})`);

  if (!env.FAL_API_KEY) {
    console.log('⚠️ FAL_API_KEY not configured, skipping image generation');
    return;
  }

  const falService = new FalImageService(env.FAL_API_KEY);

  try {
    // Show stats before processing
    const statsBefore = await getDerivativeImageStats(env.DATABASE_URL);
    console.log(`\nImage Generation Statistics (before):`);
    console.log(`  Artists with derivatives: ${statsBefore.artists_with_derivatives}`);
    console.log(`  Tracks with derivatives: ${statsBefore.tracks_with_derivatives}`);

    let artistsProcessed = 0;
    let artistsFailed = 0;
    let worksProcessed = 0;
    let worksFailed = 0;

    // ==================== PROCESS ARTISTS ====================
    try {
      const artists = await getArtistsNeedingDerivativeImages(env.DATABASE_URL, limit);

      if (artists.length === 0) {
        console.log('\n✓ No artists need derivative images (all caught up!)');
      } else {
        console.log(`\nProcessing ${artists.length} artists:`);

        for (const artist of artists) {
          try {
            console.log(`\n🎨 Artist: ${artist.artist_name}`);

            // Check if we already have a derivative for this image URL
            const existing = await getExistingDerivativeForImageUrl(env.DATABASE_URL, artist.image_url);
            if (existing) {
              console.log(`   ♻️  Reusing existing derivative (${existing.cid})`);

              // Still save to database for this artist
              await saveArtistDerivativeImage(
                env.DATABASE_URL,
                artist.artist_name,
                artist.spotify_artist_id,
                {
                  cid: existing.cid,
                  url: existing.url,
                },
                'spotify',
                existing.thumbnail_cid && existing.thumbnail_url ? {
                  cid: existing.thumbnail_cid,
                  url: existing.thumbnail_url,
                } : undefined,
                artist.image_url  // Track source image URL for deduplication
              );

              console.log(`   ✓ Database updated (reused)`);
              artistsProcessed++;
              continue;
            }

            // Generate both full-size and thumbnail versions
            const imageData = await falService.generateArtistDerivativeImage(
              artist.artist_name,
              artist.image_url,
              artist.spotify_artist_id ? stringToSeed(artist.spotify_artist_id) : undefined
            );

            // Upload full-size image to Grove
            const fullGroveResult = await uploadImageToGrove(
              imageData.full.buffer,
              `artist-${artist.artist_name.replace(/\s+/g, '-')}-full.png`,
              'image/png'
            );

            // Upload thumbnail to Grove
            const thumbnailGroveResult = await uploadImageToGrove(
              imageData.thumbnail.buffer,
              `artist-${artist.artist_name.replace(/\s+/g, '-')}-thumb.png`,
              'image/png'
            );

            // Update database with both URLs
            await saveArtistDerivativeImage(
              env.DATABASE_URL,
              artist.artist_name,
              artist.spotify_artist_id,
              {
                cid: fullGroveResult.cid,
                url: fullGroveResult.url,
              },
              'spotify',
              {
                cid: thumbnailGroveResult.cid,
                url: thumbnailGroveResult.url,
              },
              artist.image_url  // Track source image URL for deduplication
            );

            console.log(`   ✓ Database updated (full + thumbnail)`);
            artistsProcessed++;
          } catch (error: any) {
            console.error(`   ✗ Failed: ${error.message}`);
            artistsFailed++;
            // Continue to next artist on error
          }
        }
      }
    } catch (error: any) {
      console.error(`[Step 12] Artists processing error: ${error.message}`);
      // Continue to tracks processing
    }

    // ==================== PROCESS TRACKS ====================
    try {
      const tracks = await getTracksNeedingDerivativeImages(env.DATABASE_URL, limit);

      if (tracks.length === 0) {
        console.log('\n✓ No tracks need derivative images (all caught up!)');
      } else {
        console.log(`\nProcessing ${tracks.length} tracks:`);

        for (const track of tracks) {
          try {
            console.log(`\n🎵 Track: ${track.title} by ${track.artist_name}`);

            if (!track.image_url) {
              console.warn(`   ⚠️  No image available from ${track.image_source || 'any source'}, skipping`);
              worksFailed++;
              continue;
            }

            console.log(`   Image source: ${track.image_source} (Spotify)`);

            // Check if we already have a derivative for this image URL
            const existing = await getExistingDerivativeForImageUrl(env.DATABASE_URL, track.image_url);
            if (existing) {
              console.log(`   ♻️  Reusing existing derivative (${existing.cid})`);

              // Still save to database for this track
              await saveTrackDerivativeImage(
                env.DATABASE_URL,
                track.spotify_track_id,
                {
                  cid: existing.cid,
                  url: existing.url,
                },
                'spotify',
                existing.thumbnail_cid && existing.thumbnail_url ? {
                  cid: existing.thumbnail_cid,
                  url: existing.thumbnail_url,
                } : undefined,
                track.image_url  // Track source image URL for deduplication
              );

              console.log(`   ✓ Database updated (reused)`);
              worksProcessed++;
              continue;
            }

            // Generate both full-size and thumbnail versions
            const imageData = await falService.generateAlbumDerivativeImage(
              track.title,
              track.artist_name,
              track.image_url,
              stringToSeed(track.spotify_track_id) // Use track ID as seed for deterministic generation
            );

            // Upload full-size image to Grove
            const fullGroveResult = await uploadImageToGrove(
              imageData.full.buffer,
              `track-${track.spotify_track_id}-${track.title.replace(/\s+/g, '-')}-full.png`,
              'image/png'
            );

            // Upload thumbnail to Grove
            const thumbnailGroveResult = await uploadImageToGrove(
              imageData.thumbnail.buffer,
              `track-${track.spotify_track_id}-${track.title.replace(/\s+/g, '-')}-thumb.png`,
              'image/png'
            );

            // Update database with both URLs
            await saveTrackDerivativeImage(
              env.DATABASE_URL,
              track.spotify_track_id,
              {
                cid: fullGroveResult.cid,
                url: fullGroveResult.url,
              },
              'spotify',
              {
                cid: thumbnailGroveResult.cid,
                url: thumbnailGroveResult.url,
              },
              track.image_url  // Track source image URL for deduplication
            );

            console.log(`   ✓ Database updated (full + thumbnail)`);
            worksProcessed++;
          } catch (error: any) {
            console.error(`   ✗ Failed: ${error.message}`);
            worksFailed++;
            // Continue to next track on error
          }
        }
      }
    } catch (error: any) {
      console.error(`[Step 12] Tracks processing error: ${error.message}`);
    }

    // ==================== SUMMARY ====================
    const statsAfter = await getDerivativeImageStats(env.DATABASE_URL);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`Step 12 Summary:`);
    console.log(`  Artists: ${artistsProcessed} generated, ${artistsFailed} failed`);
    console.log(`  Tracks: ${worksProcessed} generated, ${worksFailed} failed`);
    console.log(`\nImage Generation Progress:`);
    console.log(`  Artists: ${statsAfter.artists_with_derivatives} with derivatives`);
    console.log(`  Tracks: ${statsAfter.tracks_with_derivatives} with derivatives`);
    console.log(`\nEstimated Cost:`);
    const totalImages = artistsProcessed + worksProcessed;
    const estimatedCost = (totalImages * 0.03).toFixed(2);
    console.log(`  ${totalImages} images × $0.03 = $${estimatedCost}`);
    console.log(`${'='.repeat(70)}\n`);

  } catch (error: any) {
    console.error(`[Step 12] Fatal error: ${error.message}`);
    throw error;
  }
}
