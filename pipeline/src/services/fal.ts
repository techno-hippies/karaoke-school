/**
 * FAL.ai Service
 *
 * Audio enhancement for karaoke instrumental tracks using Stable Audio 2.5.
 */

import { FAL_API_KEY } from '../config';

const FAL_API_URL = 'https://queue.fal.run/fal-ai/stable-audio-25/audio-to-audio';

export interface FalEnhanceResult {
  audioUrl: string; // FAL CDN URL (temporary)
  requestId: string;
}

/**
 * Enhance instrumental audio using FAL.ai Stable Audio 2.5
 *
 * This improves the quality of the instrumental track after Demucs separation,
 * making it sound fuller and more suitable for karaoke playback.
 *
 * NOTE: FAL returns .wav files. The caller should download and re-upload to Grove.
 *
 * @param audioUrl - URL to the instrumental audio
 * @returns FAL CDN URL (temporary) and request ID
 */
export async function enhanceInstrumental(audioUrl: string): Promise<FalEnhanceResult> {
  if (!FAL_API_KEY) {
    throw new Error('FAL_API_KEY not configured');
  }

  console.log('   Submitting to FAL.ai...');

  // Submit enhancement job
  const submitResponse = await fetch(FAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${FAL_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: 'instrumental',
      audio_url: audioUrl,
      strength: 0.45, // Moderate enhancement
    }),
  });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`FAL enhance submit failed: ${submitResponse.status} - ${error}`);
  }

  const submitData = (await submitResponse.json()) as { request_id: string; status_url: string };
  console.log(`   Request ID: ${submitData.request_id}`);

  // Poll for completion
  const maxAttempts = 180; // 6 minutes max
  const pollInterval = 2000; // 2 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(submitData.status_url, {
      headers: {
        Authorization: `Key ${FAL_API_KEY}`,
      },
    });

    if (!statusResponse.ok) {
      throw new Error(`FAL status check failed: ${statusResponse.status}`);
    }

    const statusData = (await statusResponse.json()) as {
      status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
      output?: { audio_url?: string; audio_file?: { url?: string } };
      response_url?: string;
      error?: string;
    };

    if (statusData.status === 'COMPLETED') {
      // Try to get audio URL from various possible locations
      let audioUrl =
        statusData.output?.audio_url ||
        statusData.output?.audio_file?.url ||
        (statusData.output as any)?.url;

      // If not in status response, fetch from response_url
      if (!audioUrl && statusData.response_url) {
        const outputResponse = await fetch(statusData.response_url, {
          headers: {
            Authorization: `Key ${FAL_API_KEY}`,
          },
        });

        if (!outputResponse.ok) {
          throw new Error(`FAL response fetch failed: ${outputResponse.status}`);
        }

        const outputData = (await outputResponse.json()) as any;
        audioUrl =
          outputData.audio?.url ||
          outputData.audio_url ||
          outputData.audio_file?.url ||
          outputData.url;
      }

      if (!audioUrl) {
        throw new Error('FAL returned no audio URL');
      }

      return {
        audioUrl,
        requestId: submitData.request_id,
      };
    }

    if (statusData.status === 'FAILED') {
      throw new Error(`FAL processing failed: ${statusData.error || 'Unknown error'}`);
    }

    // Progress indicator
    if (attempt % 15 === 0) {
      console.log(`   ... still enhancing (${(attempt * pollInterval) / 1000}s)`);
    }
  }

  throw new Error(`FAL enhancement timed out after ${(maxAttempts * pollInterval) / 1000}s`);
}

/**
 * Enhance audio from buffer
 *
 * @param audioBuffer - Audio file buffer
 * @param uploadFn - Function to upload buffer and get URL
 * @returns Enhanced audio URL
 */
export async function enhanceInstrumentalFromBuffer(
  audioBuffer: Buffer,
  uploadFn: (buffer: Buffer, filename: string) => Promise<{ url: string }>
): Promise<string> {
  // Upload original to get URL
  const { url: inputUrl } = await uploadFn(audioBuffer, 'instrumental.mp3');

  // Enhance and return just the audio URL
  const result = await enhanceInstrumental(inputUrl);
  return result.audioUrl;
}
