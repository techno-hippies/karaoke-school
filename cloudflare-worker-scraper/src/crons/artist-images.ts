/**
 * Artist Image Generation Cron
 * Processes pending artist image generation requests
 * Runs every hour to submit new requests and poll existing ones
 */

import type { Env } from '../types';
import { ArtistImagesDB } from '../db/artist-images';
import { FalImageService, ARTIST_IMAGE_PROMPT } from '../services/fal-image';
import { GroveService } from '../services/grove';

export default async function runArtistImageGeneration(env: Env): Promise<void> {
  console.log('🎨 === Artist Image Generation Cron Started ===');

  const artistImagesDB = new ArtistImagesDB(env.NEON_DATABASE_URL);
  const falService = new FalImageService(env.FAL_API_KEY);
  const groveService = new GroveService();

  try {
    // Step 1: Poll existing pending requests (higher priority)
    console.log('📊 Step 1: Polling pending requests...');
    const pending = await artistImagesDB.getPendingImageRequests(20);

    let completed = 0;
    let stillPending = 0;

    for (const request of pending) {
      try {
        const result = await falService.getResult(request.fal_request_id);

        if (result.status === 'completed' && result.images && result.images.length > 0) {
          // Upload fal.ai image to Grove for permanent storage
          console.log(`  📤 Uploading to Grove: ${request.spotify_artist_id}`);
          const groveResult = await groveService.uploadFromUrl(result.images[0].url, 'image/png');

          await artistImagesDB.upsertArtistImage({
            spotify_artist_id: request.spotify_artist_id,
            original_image_url: request.original_image_url,
            fal_request_id: request.fal_request_id,
            generated_image_url: groveResult.gatewayUrl,
            seed: result.seed,
            status: 'completed',
          });
          completed++;
          console.log(`  ✓ Completed: ${request.spotify_artist_id} -> ${groveResult.cid}`);
        } else if (result.status === 'failed') {
          await artistImagesDB.upsertArtistImage({
            spotify_artist_id: request.spotify_artist_id,
            original_image_url: request.original_image_url,
            fal_request_id: request.fal_request_id,
            status: 'failed',
            error: result.error || 'Unknown error',
          });
          console.log(`  ❌ Failed: ${request.spotify_artist_id}`);
        } else {
          stillPending++;
          console.log(`  ⏳ Still processing: ${request.spotify_artist_id}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error polling ${request.spotify_artist_id}:`, error.message);
      }
    }

    console.log(`✅ Polling complete: ${completed} completed, ${stillPending} still pending`);

    // Step 2: Submit new requests (if capacity available)
    console.log('📊 Step 2: Submitting new requests...');
    const artists = await artistImagesDB.getArtistsNeedingImages(10);

    let submitted = 0;

    for (const artist of artists) {
      try {
        console.log(`  Processing: ${artist.name} (${artist.spotify_artist_id})`);

        const { requestId } = await falService.submitImage({
          prompt: ARTIST_IMAGE_PROMPT(artist.name),
          imageUrl: artist.image_url,
          imageSize: { width: 640, height: 640 },
          enableSafetyChecker: true,
        });

        await artistImagesDB.upsertArtistImage({
          spotify_artist_id: artist.spotify_artist_id,
          original_image_url: artist.image_url,
          fal_request_id: requestId,
          status: 'pending',
        });

        submitted++;
        console.log(`  ✓ Submitted: ${artist.name}`);
      } catch (error: any) {
        console.error(`  ❌ Failed to submit ${artist.name}:`, error.message);

        // Store failed submission
        await artistImagesDB.upsertArtistImage({
          spotify_artist_id: artist.spotify_artist_id,
          original_image_url: artist.image_url,
          fal_request_id: `error-${Date.now()}`,
          status: 'failed',
          error: error.message,
        });
      }
    }

    console.log(`✅ Submission complete: ${submitted} new requests submitted`);

    // Step 3: Print statistics
    const stats = await artistImagesDB.getImageStats();
    console.log('📊 Statistics:', {
      total_artists: stats.total_artists,
      needs_generation: stats.needs_generation,
      pending: stats.pending,
      processing: stats.processing,
      completed: stats.completed,
      failed: stats.failed,
    });

    console.log('✅ === Artist Image Generation Cron Completed ===');
  } catch (error: any) {
    console.error('❌ Artist Image Generation Cron failed:', error.message);
    throw error;
  }
}
