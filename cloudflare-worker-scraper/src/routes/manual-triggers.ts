/**
 * Manual Trigger Routes
 *
 * Endpoints to manually invoke cron handlers for testing and bulk population.
 * Use these when you need immediate results instead of waiting for scheduled crons.
 */

import { Hono } from 'hono';
import type { Env } from '../types';

const manualTriggers = new Hono<{ Bindings: Env }>();

/**
 * POST /trigger/audio-download?limit=10
 * Manually trigger audio download (Freyr + Grove + AcoustID)
 */
manualTriggers.post('/trigger/audio-download', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10');

  console.log(`🎧 Manual trigger: Audio Download (limit: ${limit})`);

  try {
    const { default: runAudioDownload } = await import('../crons/audio-download');
    await runAudioDownload(c.env);

    return c.json({
      success: true,
      handler: 'Audio Download',
      message: 'Audio download completed',
    });
  } catch (error: any) {
    console.error('Audio download failed:', error);
    return c.json({
      success: false,
      handler: 'Audio Download',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/iswc-discovery?limit=30
 * Manually trigger ISWC discovery (BMI/CISAC/MusicBrainz/Quansic/MLC)
 */
manualTriggers.post('/trigger/iswc-discovery', async (c) => {
  console.log('🔍 Manual trigger: ISWC Discovery');

  try {
    const { default: runISWCDiscovery } = await import('../crons/iswc-discovery');
    await runISWCDiscovery(c.env);

    return c.json({
      success: true,
      handler: 'ISWC Discovery',
      message: 'ISWC discovery completed',
    });
  } catch (error: any) {
    console.error('ISWC discovery failed:', error);
    return c.json({
      success: false,
      handler: 'ISWC Discovery',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/spotify-enrichment?limit=100
 * Manually trigger Spotify enrichment (tracks + artists)
 */
manualTriggers.post('/trigger/spotify-enrichment', async (c) => {
  console.log('🎵 Manual trigger: Spotify Enrichment');

  try {
    const { default: runSpotifyEnrichment } = await import('../crons/spotify-enrichment');
    await runSpotifyEnrichment(c.env);

    return c.json({
      success: true,
      handler: 'Spotify Enrichment',
      message: 'Spotify enrichment completed',
    });
  } catch (error: any) {
    console.error('Spotify enrichment failed:', error);
    return c.json({
      success: false,
      handler: 'Spotify Enrichment',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/genius-enrichment
 * Manually trigger Genius enrichment (songs + artists + referents)
 */
manualTriggers.post('/trigger/genius-enrichment', async (c) => {
  console.log('🎤 Manual trigger: Genius Enrichment');

  try {
    const { default: runGeniusEnrichment } = await import('../crons/genius-enrichment');
    await runGeniusEnrichment(c.env);

    return c.json({
      success: true,
      handler: 'Genius Enrichment',
      message: 'Genius enrichment completed',
    });
  } catch (error: any) {
    console.error('Genius enrichment failed:', error);
    return c.json({
      success: false,
      handler: 'Genius Enrichment',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/musicbrainz-enrichment
 * Manually trigger MusicBrainz enrichment (artists)
 */
manualTriggers.post('/trigger/musicbrainz-enrichment', async (c) => {
  console.log('🎼 Manual trigger: MusicBrainz Enrichment');

  try {
    const { default: runMusicBrainzEnrichment } = await import('../crons/musicbrainz-enrichment');
    await runMusicBrainzEnrichment(c.env);

    return c.json({
      success: true,
      handler: 'MusicBrainz Enrichment',
      message: 'MusicBrainz enrichment completed',
    });
  } catch (error: any) {
    console.error('MusicBrainz enrichment failed:', error);
    return c.json({
      success: false,
      handler: 'MusicBrainz Enrichment',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/quansic-enrichment
 * Manually trigger Quansic enrichment (artists + works)
 */
manualTriggers.post('/trigger/quansic-enrichment', async (c) => {
  console.log('🔮 Manual trigger: Quansic Enrichment');

  try {
    const { default: runQuansicEnrichment } = await import('../crons/quansic-enrichment');
    await runQuansicEnrichment(c.env);

    return c.json({
      success: true,
      handler: 'Quansic Enrichment',
      message: 'Quansic enrichment completed',
    });
  } catch (error: any) {
    console.error('Quansic enrichment failed:', error);
    return c.json({
      success: false,
      handler: 'Quansic Enrichment',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/licensing-enrichment
 * Manually trigger licensing enrichment (MLC + BMI)
 */
manualTriggers.post('/trigger/licensing-enrichment', async (c) => {
  console.log('📜 Manual trigger: Licensing Enrichment');

  try {
    const { default: runLicensingEnrichment } = await import('../crons/licensing-enrichment');
    await runLicensingEnrichment(c.env);

    return c.json({
      success: true,
      handler: 'Licensing Enrichment',
      message: 'Licensing enrichment completed',
    });
  } catch (error: any) {
    console.error('Licensing enrichment failed:', error);
    return c.json({
      success: false,
      handler: 'Licensing Enrichment',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/cisac-ipi-discovery
 * Manually trigger CISAC IPI discovery (catalog vacuum)
 */
manualTriggers.post('/trigger/cisac-ipi-discovery', async (c) => {
  console.log('🔢 Manual trigger: CISAC IPI Discovery');

  try {
    const { default: runCISACIPIDiscovery } = await import('../crons/cisac-ipi-discovery');
    await runCISACIPIDiscovery(c.env);

    return c.json({
      success: true,
      handler: 'CISAC IPI Discovery',
      message: 'CISAC IPI discovery completed',
    });
  } catch (error: any) {
    console.error('CISAC IPI discovery failed:', error);
    return c.json({
      success: false,
      handler: 'CISAC IPI Discovery',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/lyrics-enrichment
 * Manually trigger lyrics enrichment (multi-source + AI)
 */
manualTriggers.post('/trigger/lyrics-enrichment', async (c) => {
  console.log('🎵 Manual trigger: Lyrics Enrichment');

  try {
    const { default: runLyricsEnrichment } = await import('../crons/lyrics-enrichment');
    await runLyricsEnrichment(c.env);

    return c.json({
      success: true,
      handler: 'Lyrics Enrichment',
      message: 'Lyrics enrichment completed',
    });
  } catch (error: any) {
    console.error('Lyrics enrichment failed:', error);
    return c.json({
      success: false,
      handler: 'Lyrics Enrichment',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/elevenlabs-alignment?limit=10
 * Manually trigger ElevenLabs word alignment (forced alignment)
 */
manualTriggers.post('/trigger/elevenlabs-alignment', async (c) => {
  console.log('🎤 Manual trigger: ElevenLabs Alignment');

  try {
    const { default: runElevenLabsAlignment } = await import('../crons/elevenlabs-alignment');
    await runElevenLabsAlignment(c.env);

    return c.json({
      success: true,
      handler: 'ElevenLabs Alignment',
      message: 'ElevenLabs alignment completed',
    });
  } catch (error: any) {
    console.error('ElevenLabs alignment failed:', error);
    return c.json({
      success: false,
      handler: 'ElevenLabs Alignment',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/demucs-separation?limit=10
 * Manually trigger Demucs vocal/instrumental separation (Modal)
 */
manualTriggers.post('/trigger/demucs-separation', async (c) => {
  console.log('🎵 Manual trigger: Demucs Separation');

  try {
    const { default: runDemucsSeparation } = await import('../crons/demucs-separation');
    await runDemucsSeparation(c.env);

    return c.json({
      success: true,
      handler: 'Demucs Separation',
      message: 'Demucs separation completed',
    });
  } catch (error: any) {
    console.error('Demucs separation failed:', error);
    return c.json({
      success: false,
      handler: 'Demucs Separation',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/segment-selection?limit=20
 * Manually trigger karaoke segment selection (Gemini Flash)
 */
manualTriggers.post('/trigger/segment-selection', async (c) => {
  console.log('🎯 Manual trigger: Segment Selection');

  try {
    const { default: runSegmentSelection } = await import('../crons/segment-selection');
    await runSegmentSelection(c.env);

    return c.json({
      success: true,
      handler: 'Segment Selection',
      message: 'Segment selection completed',
    });
  } catch (error: any) {
    console.error('Segment selection failed:', error);
    return c.json({
      success: false,
      handler: 'Segment Selection',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/ffmpeg-crop?limit=10
 * Manually trigger FFmpeg instrumental cropping
 */
manualTriggers.post('/trigger/ffmpeg-crop', async (c) => {
  console.log('✂️ Manual trigger: FFmpeg Crop');

  try {
    const { default: runFFmpegCrop } = await import('../crons/ffmpeg-crop');
    await runFFmpegCrop(c.env);

    return c.json({
      success: true,
      handler: 'FFmpeg Crop',
      message: 'FFmpeg crop completed',
    });
  } catch (error: any) {
    console.error('FFmpeg crop failed:', error);
    return c.json({
      success: false,
      handler: 'FFmpeg Crop',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/fal-enhancement
 * Manually trigger fal.ai audio enhancement (test with specific track)
 * Body: { spotify_track_id: "6K4t31amVTZDgR3sKmwUJJ" }
 */
manualTriggers.post('/trigger/fal-enhancement', async (c) => {
  console.log('✨ Manual trigger: fal.ai Enhancement');

  try {
    const { spotify_track_id } = await c.req.json();

    if (!spotify_track_id) {
      return c.json({
        success: false,
        error: 'spotify_track_id required in request body',
      }, 400);
    }

    const { NeonDB } = await import('../neon');
    const { FalService } = await import('../services/fal');

    if (!c.env.FAL_API_KEY) {
      return c.json({
        success: false,
        error: 'FAL_API_KEY not configured',
      }, 500);
    }

    const db = new NeonDB(c.env.NEON_DATABASE_URL);
    const fal = new FalService(c.env.FAL_API_KEY, 90, 2000); // 3 min max (90 attempts × 2s)

    // Get track info and cropped instrumental CID
    const tracks = await db.sql`
      SELECT
        st.spotify_track_id,
        st.title,
        st.artists[1] as primary_artist,
        ks.fal_segment_grove_cid as cropped_instrumental_cid
      FROM spotify_tracks st
      JOIN karaoke_segments ks ON st.spotify_track_id = ks.spotify_track_id
      LEFT JOIN karaoke_enhanced_audio kea ON st.spotify_track_id = kea.spotify_track_id
      WHERE st.spotify_track_id = ${spotify_track_id}
        AND ks.fal_segment_grove_cid IS NOT NULL
        AND kea.spotify_track_id IS NULL
    `;

    if (tracks.length === 0) {
      return c.json({
        success: false,
        error: 'Track not found, not ready for fal.ai, or already enhanced',
      }, 404);
    }

    const track = tracks[0];
    console.log(`Enhancing: ${track.title} - ${track.primary_artist}`);

    // Construct Grove storage URL (fal.ai format)
    const audioUrl = `https://api.grove.storage/${track.cropped_instrumental_cid}`;

    // Insert pending record
    await db.sql`
      INSERT INTO karaoke_enhanced_audio (
        spotify_track_id,
        input_grove_cid,
        input_grove_url,
        fal_status
      ) VALUES (
        ${spotify_track_id},
        ${track.cropped_instrumental_cid},
        ${audioUrl},
        'pending'
      )
    `;

    console.log(`Submitting to fal.ai: ${audioUrl}`);

    // Submit and poll (WARNING: may timeout if >3 minutes)
    const result = await fal.audioToAudio({
      audioUrl,
      prompt: 'Instrumental',
      strength: 0.33,
      numInferenceSteps: 8,
      guidanceScale: 1.0,
    });

    // Update with result
    await db.sql`
      UPDATE karaoke_enhanced_audio
      SET
        fal_request_id = ${result.requestId},
        fal_status = ${result.status},
        enhanced_grove_url = ${result.audioUrl || null},
        processing_duration_seconds = ${result.duration || null},
        error_message = ${result.error || null},
        completed_at = ${result.status === 'completed' ? new Date().toISOString() : null},
        updated_at = NOW()
      WHERE spotify_track_id = ${spotify_track_id}
    `;

    console.log(`✅ fal.ai enhancement ${result.status}: ${track.title}`);

    return c.json({
      success: result.status === 'completed',
      handler: 'fal.ai Enhancement',
      track: {
        spotify_track_id,
        title: track.title,
        artist: track.primary_artist,
      },
      result: {
        status: result.status,
        request_id: result.requestId,
        enhanced_url: result.audioUrl,
        duration: result.duration,
        cost: result.cost,
        error: result.error,
      },
    });
  } catch (error: any) {
    console.error('fal.ai enhancement failed:', error);
    return c.json({
      success: false,
      handler: 'fal.ai Enhancement',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/fal-poll
 * Poll pending fal.ai requests and update their status
 */
manualTriggers.post('/trigger/fal-poll', async (c) => {
  console.log('🔄 Manual trigger: fal.ai Poll');

  try {
    const { NeonDB } = await import('../neon');
    const { FalService } = await import('../services/fal');

    if (!c.env.FAL_API_KEY) {
      return c.json({
        success: false,
        error: 'FAL_API_KEY not configured',
      }, 500);
    }

    const db = new NeonDB(c.env.NEON_DATABASE_URL);
    const fal = new FalService(c.env.FAL_API_KEY);

    // Get pending/processing requests
    const pending = await db.sql`
      SELECT
        spotify_track_id,
        fal_request_id,
        fal_status,
        input_grove_cid,
        submitted_at
      FROM karaoke_enhanced_audio
      WHERE fal_status IN ('pending', 'processing')
      ORDER BY submitted_at ASC
      LIMIT 10
    `;

    if (pending.length === 0) {
      return c.json({
        success: true,
        message: 'No pending requests',
        checked: 0,
      });
    }

    console.log(`Polling ${pending.length} pending requests...`);
    let completed = 0;
    let failed = 0;
    let stillProcessing = 0;

    for (const req of pending) {
      try {
        const result = await fal.getResult(req.fal_request_id);

        if (result.status === 'completed') {
          await db.sql`
            UPDATE karaoke_enhanced_audio
            SET
              fal_status = 'completed',
              enhanced_grove_url = ${result.audioUrl},
              processing_duration_seconds = ${result.duration || null},
              completed_at = NOW(),
              updated_at = NOW()
            WHERE spotify_track_id = ${req.spotify_track_id}
          `;
          completed++;
          console.log(`✅ Completed: ${req.spotify_track_id}`);
        } else if (result.status === 'failed') {
          await db.sql`
            UPDATE karaoke_enhanced_audio
            SET
              fal_status = 'failed',
              error_message = ${result.error || 'Unknown error'},
              updated_at = NOW()
            WHERE spotify_track_id = ${req.spotify_track_id}
          `;
          failed++;
          console.log(`❌ Failed: ${req.spotify_track_id} - ${result.error}`);
        } else {
          stillProcessing++;
          console.log(`⏳ Still processing: ${req.spotify_track_id}`);
        }
      } catch (error: any) {
        console.error(`Error polling ${req.spotify_track_id}:`, error);
      }
    }

    return c.json({
      success: true,
      handler: 'fal.ai Poll',
      checked: pending.length,
      completed,
      failed,
      stillProcessing,
    });
  } catch (error: any) {
    console.error('fal.ai poll failed:', error);
    return c.json({
      success: false,
      handler: 'fal.ai Poll',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/fal-grove-upload
 * Download fal.ai enhanced audio and upload to Grove
 * Body: { spotify_track_id: "6K4t31amVTZDgR3sKmwUJJ" }
 */
manualTriggers.post('/trigger/fal-grove-upload', async (c) => {
  console.log('📤 Manual trigger: fal.ai Grove Upload');

  try {
    const { spotify_track_id } = await c.req.json();

    if (!spotify_track_id) {
      return c.json({
        success: false,
        error: 'spotify_track_id required in request body',
      }, 400);
    }

    const { NeonDB } = await import('../neon');
    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    // Get completed enhancement with fal.ai URL
    const enhancements = await db.sql`
      SELECT
        kea.spotify_track_id,
        kea.enhanced_grove_url,
        st.title,
        st.artists[1] as primary_artist
      FROM karaoke_enhanced_audio kea
      JOIN spotify_tracks st ON kea.spotify_track_id = st.spotify_track_id
      WHERE kea.spotify_track_id = ${spotify_track_id}
        AND kea.fal_status = 'completed'
        AND kea.enhanced_grove_url IS NOT NULL
        AND kea.enhanced_grove_cid IS NULL
    `;

    if (enhancements.length === 0) {
      return c.json({
        success: false,
        error: 'Track not found, not completed, or already uploaded to Grove',
      }, 404);
    }

    const enhancement = enhancements[0];
    console.log(`Uploading to Grove: ${enhancement.title} - ${enhancement.primary_artist}`);

    // Download from fal.ai
    const audioResponse = await fetch(enhancement.enhanced_grove_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download from fal.ai: ${audioResponse.status}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    console.log(`Downloaded ${audioBuffer.byteLength} bytes from fal.ai`);

    // Upload to Grove IPFS (Lens Network chain ID: 37111)
    // NO wallet/auth needed - raw POST with binary body
    const groveResponse = await fetch('https://api.grove.storage/?chain_id=37111', {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    });

    if (!groveResponse.ok) {
      const errorText = await groveResponse.text();
      throw new Error(`Grove upload failed: ${groveResponse.status} ${errorText}`);
    }

    const groveData = await groveResponse.json();
    // Grove returns object with storage_key field
    const groveCid = Array.isArray(groveData) ? groveData[0].storage_key : groveData.storage_key;
    const groveUrl = `https://api.grove.storage/${groveCid}`;

    console.log(`✅ Uploaded to Grove: ${groveCid}`);

    // Update database with Grove CID
    await db.sql`
      UPDATE karaoke_enhanced_audio
      SET
        enhanced_grove_cid = ${groveCid},
        enhanced_grove_url = ${groveUrl},
        enhanced_file_size_bytes = ${audioBuffer.byteLength},
        updated_at = NOW()
      WHERE spotify_track_id = ${spotify_track_id}
    `;

    return c.json({
      success: true,
      handler: 'fal.ai Grove Upload',
      track: {
        spotify_track_id,
        title: enhancement.title,
        artist: enhancement.primary_artist,
      },
      grove: {
        cid: groveCid,
        url: groveUrl,
        size: audioBuffer.byteLength,
      },
    });
  } catch (error: any) {
    console.error('Grove upload failed:', error);
    return c.json({
      success: false,
      handler: 'fal.ai Grove Upload',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/tiktok-crop
 * Crop TikTok clip from fal.ai-enhanced audio (20-50s iconic clip)
 * Timings are relative to original song, so we calculate offset within the enhanced 190s file
 */
manualTriggers.post('/trigger/tiktok-crop', async (c) => {
  try {
    const { spotify_track_id } = await c.req.json();

    const { NeonDB } = await import('../neon');
    const db = new NeonDB(c.env.NEON_DATABASE_URL);

    // Get enhanced audio and TikTok clip timings
    const tracks = await db.sql`
      SELECT
        kea.spotify_track_id,
        kea.enhanced_grove_cid,
        kea.enhanced_grove_url,
        ks.fal_segment_start_ms,
        ks.tiktok_clip_start_ms,
        ks.tiktok_clip_end_ms,
        st.title,
        st.artists[1] as primary_artist
      FROM karaoke_enhanced_audio kea
      JOIN karaoke_segments ks ON kea.spotify_track_id = ks.spotify_track_id
      JOIN spotify_tracks st ON kea.spotify_track_id = st.spotify_track_id
      WHERE kea.spotify_track_id = ${spotify_track_id}
        AND kea.fal_status = 'completed'
        AND kea.enhanced_grove_cid IS NOT NULL
        AND ks.tiktok_clip_start_ms IS NOT NULL
        AND ks.tiktok_clip_end_ms IS NOT NULL
    `;

    if (tracks.length === 0) {
      return c.json({
        success: false,
        error: 'Track not found, enhancement not completed, or TikTok clip timings missing',
      }, 404);
    }

    const track = tracks[0];

    // Calculate offset within the enhanced 190s file
    // All timings in DB are relative to original song, not the 190s segment
    const offsetStartMs = track.tiktok_clip_start_ms - track.fal_segment_start_ms;
    const offsetEndMs = track.tiktok_clip_end_ms - track.fal_segment_start_ms;

    console.log(`🎵 Cropping TikTok clip: ${track.title} - ${track.primary_artist}`);
    console.log(`   Original song TikTok: ${track.tiktok_clip_start_ms}ms - ${track.tiktok_clip_end_ms}ms`);
    console.log(`   Enhanced file offset: ${offsetStartMs}ms - ${offsetEndMs}ms (${offsetEndMs - offsetStartMs}ms)`);

    // Submit FFmpeg crop job with offset timings
    const { FFmpegService } = await import('../services/ffmpeg');
    const ffmpeg = new FFmpegService(c.env.MODAL_FFMPEG_ENDPOINT);

    const webhookUrl = `${c.env.WORKER_URL}/webhook/tiktok-crop`;

    const result = await ffmpeg.cropAsync(
      track.enhanced_grove_url,
      offsetStartMs,
      offsetEndMs,
      webhookUrl,
      spotify_track_id // Use spotify_track_id as job_id for webhook lookup
    );

    console.log(`✅ FFmpeg job submitted: ${result.jobId}`);

    return c.json({
      success: true,
      handler: 'TikTok Clip Crop',
      track: {
        spotify_track_id: track.spotify_track_id,
        title: track.title,
        artist: track.primary_artist,
      },
      tiktok_clip: {
        original_start_ms: track.tiktok_clip_start_ms,
        original_end_ms: track.tiktok_clip_end_ms,
        enhanced_offset_start_ms: offsetStartMs,
        enhanced_offset_end_ms: offsetEndMs,
        duration_ms: offsetEndMs - offsetStartMs,
      },
      ffmpeg: {
        job_id: result.jobId,
        status: result.status,
        message: result.message,
      },
    });
  } catch (error: any) {
    console.error('TikTok crop error:', error);
    return c.json({
      success: false,
      handler: 'TikTok Clip Crop',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/lyrics-translation?limit=10
 * Manually trigger lyrics translation (Mandarin, Vietnamese, Indonesian)
 */
manualTriggers.post('/trigger/lyrics-translation', async (c) => {
  console.log('🌐 Manual trigger: Lyrics Translation');

  try {
    const { default: runLyricsTranslation } = await import('../crons/lyrics-translation');
    await runLyricsTranslation(c.env);

    return c.json({
      success: true,
      handler: 'Lyrics Translation',
      message: 'Lyrics translation completed',
    });
  } catch (error: any) {
    console.error('Lyrics translation failed:', error);
    return c.json({
      success: false,
      handler: 'Lyrics Translation',
      error: error.message,
    }, 500);
  }
});

/**
 * POST /trigger/all
 * Manually trigger ALL enrichment handlers in sequence
 */
manualTriggers.post('/trigger/all', async (c) => {
  console.log('🚀 Manual trigger: ALL handlers');

  const results: any[] = [];

  const handlers = [
    { name: 'Spotify Enrichment', path: '../crons/spotify-enrichment' },
    { name: 'ISWC Discovery', path: '../crons/iswc-discovery' },
    { name: 'Genius Enrichment', path: '../crons/genius-enrichment' },
    { name: 'MusicBrainz Enrichment', path: '../crons/musicbrainz-enrichment' },
    { name: 'Quansic Enrichment', path: '../crons/quansic-enrichment' },
    { name: 'Licensing Enrichment', path: '../crons/licensing-enrichment' },
    { name: 'Lyrics Enrichment', path: '../crons/lyrics-enrichment' },
    { name: 'Audio Download', path: '../crons/audio-download' },
    { name: 'Segment Selection', path: '../crons/segment-selection' },
    { name: 'ElevenLabs Alignment', path: '../crons/elevenlabs-alignment' },
  ];

  for (const handler of handlers) {
    try {
      console.log(`▶️ Starting: ${handler.name}`);
      const { default: runHandler } = await import(handler.path);
      await runHandler(c.env);
      console.log(`✅ Completed: ${handler.name}`);
      results.push({ handler: handler.name, success: true });
    } catch (error: any) {
      console.error(`❌ Failed: ${handler.name}`, error);
      results.push({ handler: handler.name, success: false, error: error.message });
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return c.json({
    success: failed === 0,
    message: `Completed ${succeeded}/${handlers.length} handlers`,
    results,
    summary: {
      total: handlers.length,
      succeeded,
      failed,
    },
  });
});

export default manualTriggers;
