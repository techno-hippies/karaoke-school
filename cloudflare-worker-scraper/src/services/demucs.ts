/**
 * Demucs Service
 * GPU-accelerated vocal/instrumental separation via Modal
 */

export interface DemucsResult {
  jobId: string;
  status: 'processing';
  message: string;
}

export interface DemucsWebhookPayload {
  job_id: string;
  status: 'completed' | 'failed';
  vocals_base64?: string;
  instrumental_base64?: string;
  vocals_size?: number;
  instrumental_size?: number;
  model?: string;
  format?: string;
  duration?: number;
  error?: string;
}

export class DemucsService {
  private modalEndpoint: string;

  constructor(modalEndpoint: string) {
    this.modalEndpoint = modalEndpoint;
  }

  /**
   * Submit async Demucs separation job
   *
   * @param audioUrl Public URL to audio file (Grove, freyr, etc.)
   * @param webhookUrl URL to POST results when complete
   * @param jobId Optional job ID (generated if not provided)
   * @returns Job ID and status
   */
  async separateAsync(
    audioUrl: string,
    webhookUrl: string,
    jobId?: string
  ): Promise<DemucsResult> {
    const id = jobId || crypto.randomUUID();

    const formData = new FormData();
    formData.append('job_id', id);
    formData.append('audio_url', audioUrl);
    formData.append('webhook_url', webhookUrl);
    formData.append('model', 'mdx_extra');
    formData.append('output_format', 'mp3');
    formData.append('mp3_bitrate', '192');

    const response = await fetch(`${this.modalEndpoint}/separate-async`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Modal submission failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    return {
      jobId: result.job_id,
      status: result.status,
      message: result.message
    };
  }
}
