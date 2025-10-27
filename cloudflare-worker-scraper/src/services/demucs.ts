/**
 * Demucs Service
 * GPU-accelerated vocal/instrumental separation
 *
 * Supports two modes:
 * - 'modal': Cloud GPU (H200) via Modal.com (rate limited)
 * - 'local': Local GPU (RTX 3080) via local FastAPI server (unlimited)
 *
 * Falls back to modal if local is unavailable.
 */

export type DemucsMode = 'local' | 'modal';

export interface DemucsResult {
  jobId: string;
  status: 'processing';
  message: string;
  mode: DemucsMode; // Track which backend was used
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
  private mode: DemucsMode;
  private localEndpoint: string;
  private modalEndpoint: string;

  constructor(
    mode: DemucsMode = 'local',
    localEndpoint?: string,
    modalEndpoint?: string
  ) {
    this.mode = mode;
    this.localEndpoint = localEndpoint || 'http://localhost:8001';
    this.modalEndpoint = modalEndpoint || '';
  }

  /**
   * Check if local endpoint is available
   * @returns true if local service is healthy
   */
  private async isLocalAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.localEndpoint}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2s timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Submit async Demucs separation job
   *
   * Tries local GPU first (if mode=local), falls back to Modal if unavailable.
   *
   * @param audioUrl Public URL to audio file (Grove, freyr, etc.)
   * @param webhookUrl URL to POST results when complete
   * @param jobId Optional job ID (generated if not provided)
   * @returns Job ID, status, and mode used
   */
  async separateAsync(
    audioUrl: string,
    webhookUrl: string,
    jobId?: string
  ): Promise<DemucsResult> {
    const id = jobId || crypto.randomUUID();

    // Determine which backend to use
    let useMode = this.mode;
    let endpoint = '';

    if (this.mode === 'local') {
      const localAvailable = await this.isLocalAvailable();
      if (localAvailable) {
        useMode = 'local';
        endpoint = this.localEndpoint;
        console.log(`[Demucs] Using local GPU (RTX 3080) at ${endpoint}`);
      } else {
        // Fallback to Modal
        if (!this.modalEndpoint) {
          throw new Error('Local Demucs unavailable and MODAL_DEMUCS_ENDPOINT not configured');
        }
        useMode = 'modal';
        endpoint = this.modalEndpoint;
        console.log('[Demucs] Local GPU unavailable, falling back to Modal');
      }
    } else {
      // Mode is 'modal'
      if (!this.modalEndpoint) {
        throw new Error('MODAL_DEMUCS_ENDPOINT not configured');
      }
      useMode = 'modal';
      endpoint = this.modalEndpoint;
      console.log(`[Demucs] Using Modal (H200) at ${endpoint}`);
    }

    // Submit to selected endpoint
    const formData = new FormData();
    formData.append('job_id', id);
    formData.append('audio_url', audioUrl);
    formData.append('webhook_url', webhookUrl);
    formData.append('model', 'mdx_extra');
    formData.append('output_format', 'mp3');
    formData.append('mp3_bitrate', '192');

    const response = await fetch(`${endpoint}/separate-async`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Demucs ${useMode} submission failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();

    return {
      jobId: result.job_id,
      status: result.status,
      message: result.message || `Demucs separation started on ${useMode}`,
      mode: useMode
    };
  }
}
