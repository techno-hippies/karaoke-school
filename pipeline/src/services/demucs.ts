/**
 * Demucs Service
 *
 * Audio separation via RunPod serverless endpoint.
 * Requires audio to be uploaded to a public URL first (Grove).
 */

import { RUNPOD_API_KEY, RUNPOD_DEMUCS_ENDPOINT_ID } from '../config';

export interface DemucsResult {
  vocals_grove_url: string;
  instrumental_grove_url: string;
  vocals_grove_cid: string;
  instrumental_grove_cid: string;
}

interface RunPodResponse {
  id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  output?: DemucsResult;
  error?: string;
}

const RUNPOD_API_URL = 'https://api.runpod.ai/v2';

/**
 * Separate audio using Demucs via RunPod
 *
 * @param jobId - Unique job identifier (e.g., spotify track ID or ISWC)
 * @param audioUrl - Public URL to audio file (must be accessible by RunPod)
 * @returns Grove URLs for vocals and instrumental
 */
export async function separateAudio(
  jobId: string,
  audioUrl: string
): Promise<DemucsResult> {
  if (!RUNPOD_API_KEY || !RUNPOD_DEMUCS_ENDPOINT_ID) {
    throw new Error('RUNPOD_API_KEY or RUNPOD_DEMUCS_ENDPOINT_ID not configured');
  }

  // Submit job
  console.log('   Submitting to Demucs...');
  const submitResponse = await fetch(
    `${RUNPOD_API_URL}/${RUNPOD_DEMUCS_ENDPOINT_ID}/run`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({
        input: {
          job_id: jobId,
          audio_url: audioUrl,
          webhook_url: 'https://placeholder.invalid', // Not used but required
          model: 'htdemucs',
          output_format: 'mp3',
          mp3_bitrate: 192,
          spotify_track_id: jobId, // Used by worker for Grove upload naming
        },
      }),
    }
  );

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`RunPod submit failed: ${submitResponse.status} - ${error}`);
  }

  const submitResult = await submitResponse.json();
  const runpodJobId = submitResult.id;
  console.log(`   Job ID: ${runpodJobId}`);

  // Poll for completion
  console.log('   Processing (this may take a few minutes)...');
  const maxAttempts = 60; // 5 minutes max
  const pollInterval = 5000; // 5 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const statusResponse = await fetch(
      `${RUNPOD_API_URL}/${RUNPOD_DEMUCS_ENDPOINT_ID}/status/${runpodJobId}`,
      {
        headers: {
          Authorization: `Bearer ${RUNPOD_API_KEY}`,
        },
      }
    );

    if (!statusResponse.ok) {
      console.warn(`   Status check failed (${statusResponse.status}), retrying...`);
      continue;
    }

    const status: RunPodResponse = await statusResponse.json();

    if (status.status === 'COMPLETED') {
      console.log('   ✅ Separation complete');
      console.log('   Output:', JSON.stringify(status.output, null, 2));

      if (!status.output || !status.output.vocals_grove_url || !status.output.instrumental_grove_url) {
        throw new Error('RunPod job completed but missing Grove URLs in output');
      }

      return status.output;
    }

    if (status.status === 'FAILED') {
      throw new Error(`Demucs job failed: ${status.error || 'Unknown error'}`);
    }

    // Progress indicator
    if (attempt % 6 === 0) {
      console.log(`   ... still processing (${Math.round((attempt * pollInterval) / 1000)}s)`);
    }
  }

  throw new Error('Demucs job timed out after 5 minutes');
}
