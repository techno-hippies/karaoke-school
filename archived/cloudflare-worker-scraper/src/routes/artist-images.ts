/**
 * Artist Images Routes
 * Endpoints for generating derivative artist images using fal.ai
 */

import { Hono } from 'hono';
import { NeonDB } from '../neon';
import { ArtistImagesDB } from '../db/artist-images';
import { FalImageService, ARTIST_IMAGE_PROMPT } from '../services/fal-image';
import { GroveService } from '../services/grove';
import type { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

/**
 * POST /generate-artist-images
 * Generate derivative images for artists with Spotify images
 */
app.post('/generate-artist-images', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');
  const db = new NeonDB(c.env.NEON_DATABASE_URL);
  const artistImagesDB = new ArtistImagesDB(c.env.NEON_DATABASE_URL);
  const falService = new FalImageService(c.env.FAL_API_KEY);

  try {
    // Get artists that need image generation
    const artists = await artistImagesDB.getArtistsNeedingImages(limit);

    if (artists.length === 0) {
      return c.json({
        success: true,
        message: 'No artists need image generation',
        processed: 0,
      });
    }

    console.log(`🎨 Generating images for ${artists.length} artists`);

    let processed = 0;
    const results = [];

    for (const artist of artists) {
      try {
        console.log(`  Processing: ${artist.name} (${artist.spotify_artist_id})`);

        // Submit to fal.ai (non-blocking)
        const { requestId } = await falService.submitImage({
          prompt: ARTIST_IMAGE_PROMPT(artist.name),
          imageUrl: artist.image_url,
          imageSize: { width: 640, height: 640 },
          enableSafetyChecker: true,
        });

        // Store pending request
        await artistImagesDB.upsertArtistImage({
          spotify_artist_id: artist.spotify_artist_id,
          original_image_url: artist.image_url,
          fal_request_id: requestId,
          status: 'pending',
        });

        results.push({
          spotify_artist_id: artist.spotify_artist_id,
          name: artist.name,
          request_id: requestId,
          status: 'submitted',
        });

        processed++;
      } catch (error: any) {
        console.error(`  ❌ Failed to process ${artist.name}:`, error.message);
        results.push({
          spotify_artist_id: artist.spotify_artist_id,
          name: artist.name,
          error: error.message,
          status: 'error',
        });

        // Store failed request
        await artistImagesDB.upsertArtistImage({
          spotify_artist_id: artist.spotify_artist_id,
          original_image_url: artist.image_url,
          fal_request_id: `error-${Date.now()}`,
          status: 'failed',
          error: error.message,
        });
      }
    }

    return c.json({
      success: true,
      message: `Submitted ${processed} artist images for generation`,
      processed,
      results,
    });
  } catch (error: any) {
    console.error('❌ Artist image generation failed:', error);
    return c.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      500
    );
  }
});

/**
 * POST /poll-artist-images
 * Poll pending fal.ai requests and update results
 */
app.post('/poll-artist-images', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');
  const artistImagesDB = new ArtistImagesDB(c.env.NEON_DATABASE_URL);
  const falService = new FalImageService(c.env.FAL_API_KEY);
  const groveService = new GroveService();

  try {
    // Get pending requests
    const pending = await artistImagesDB.getPendingImageRequests(limit);

    if (pending.length === 0) {
      return c.json({
        success: true,
        message: 'No pending image requests',
        completed: 0,
      });
    }

    console.log(`🔄 Polling ${pending.length} pending image requests`);

    let completed = 0;
    let failed = 0;
    const results = [];

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

          results.push({
            spotify_artist_id: request.spotify_artist_id,
            status: 'completed',
            image_url: groveResult.gatewayUrl,
            cid: groveResult.cid,
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

          results.push({
            spotify_artist_id: request.spotify_artist_id,
            status: 'failed',
            error: result.error,
          });

          failed++;
          console.log(`  ❌ Failed: ${request.spotify_artist_id}`);
        } else {
          // Still processing, update status
          await artistImagesDB.upsertArtistImage({
            spotify_artist_id: request.spotify_artist_id,
            original_image_url: request.original_image_url,
            fal_request_id: request.fal_request_id,
            status: 'processing',
          });

          results.push({
            spotify_artist_id: request.spotify_artist_id,
            status: 'processing',
          });

          console.log(`  ⏳ Still processing: ${request.spotify_artist_id}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error polling ${request.spotify_artist_id}:`, error.message);
        results.push({
          spotify_artist_id: request.spotify_artist_id,
          status: 'error',
          error: error.message,
        });
      }
    }

    return c.json({
      success: true,
      message: `Polled ${pending.length} requests: ${completed} completed, ${failed} failed`,
      completed,
      failed,
      results,
    });
  } catch (error: any) {
    console.error('❌ Artist image polling failed:', error);
    return c.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      500
    );
  }
});

/**
 * GET /artist-images/stats
 * Get artist image generation statistics
 */
app.get('/artist-images/stats', async (c) => {
  const artistImagesDB = new ArtistImagesDB(c.env.NEON_DATABASE_URL);

  try {
    const stats = await artistImagesDB.getImageStats();

    return c.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    console.error('❌ Failed to get artist image stats:', error);
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

/**
 * GET /artist-images/:spotify_artist_id
 * Get generated image for a specific artist
 */
app.get('/artist-images/:spotify_artist_id', async (c) => {
  const spotifyArtistId = c.req.param('spotify_artist_id');
  const artistImagesDB = new ArtistImagesDB(c.env.NEON_DATABASE_URL);

  try {
    const image = await artistImagesDB.getArtistImage(spotifyArtistId);

    if (!image) {
      return c.json(
        {
          success: false,
          error: 'Artist image not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      image,
    });
  } catch (error: any) {
    console.error('❌ Failed to get artist image:', error);
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

export default app;
