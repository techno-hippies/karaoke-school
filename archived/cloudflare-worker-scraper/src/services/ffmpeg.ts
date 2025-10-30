/**
 * FFmpeg Service
 * Audio cropping via Akash
 */

export interface FFmpegCropResult {
  jobId: string;
  status: 'processing';
  message: string;
}

export interface FFmpegWebhookPayload {
  job_id: string;
  status: 'completed' | 'failed';
  cropped_base64?: string;
  cropped_size?: number;
  start_ms?: number;
  end_ms?: number;
  duration_ms?: number;
  error?: string;
}

export class FFmpegService {
  private akashEndpoint: string;

  constructor(akashEndpoint: string) {
    this.akashEndpoint = akashEndpoint;
  }

  /**
   * Submit async FFmpeg crop job
   *
   * @param audioUrl Public URL to audio file (Grove gateway)
   * @param startMs Start time in milliseconds
   * @param endMs End time in milliseconds
   * @param webhookUrl URL to POST results when complete
   * @param jobId Optional job ID (generated if not provided)
   * @returns Job ID and status
   */
  async cropAsync(
    audioUrl: string,
    startMs: number,
    endMs: number,
    webhookUrl: string,
    jobId?: string
  ): Promise<FFmpegCropResult> {
    const id = jobId || crypto.randomUUID();

    const formData = new FormData();
    formData.append('job_id', id);
    formData.append('audio_url', audioUrl);
    formData.append('start_ms', startMs.toString());
    formData.append('end_ms', endMs.toString());
    formData.append('webhook_url', webhookUrl);
    formData.append('output_format', 'mp3');
    formData.append('mp3_bitrate', '192');

    const response = await fetch(`${this.akashEndpoint}/crop-async`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Akash ffmpeg submission failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    return {
      jobId: result.job_id,
      status: result.status,
      message: result.message
    };
  }
}
