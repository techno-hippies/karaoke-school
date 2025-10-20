/**
 * Demucs Service (Local Execution)
 *
 * Vocal/instrumental separation using Demucs v4
 * Runs locally via subprocess (requires demucs installed)
 *
 * Installation:
 *   pip install demucs==4.0.1
 *
 * Models:
 *   - mdx_extra: Best quality (MDX challenge 2nd place)
 *   - htdemucs: Fast, good quality
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { join, basename } from 'path';
import { BaseService, ServiceConfig } from './base.js';

const execAsync = promisify(exec);

export interface DemucsResult {
  vocalsPath: string;
  instrumentalPath: string;
  model: string;
  duration: number;
}

export interface DemucsConfig extends ServiceConfig {
  model?: 'mdx_extra' | 'htdemucs' | 'htdemucs_ft';
  outputFormat?: 'mp3' | 'wav' | 'flac';
  mp3Bitrate?: number; // For MP3 output (default: 192)
  device?: 'cpu' | 'cuda'; // GPU acceleration if available
}

export class DemucsService extends BaseService {
  private model: string;
  private outputFormat: string;
  private mp3Bitrate: number;
  private device: string;

  constructor(config: DemucsConfig = {}) {
    super('Demucs', config);

    this.model = config.model || 'mdx_extra';
    this.outputFormat = config.outputFormat || 'mp3';
    this.mp3Bitrate = config.mp3Bitrate || 192;
    this.device = config.device || 'cpu';
  }

  /**
   * Check if Demucs is installed
   */
  async checkInstalled(): Promise<boolean> {
    try {
      const venvPython = join(process.cwd(), '.venv', 'bin', 'python3');
      const pythonCmd = existsSync(venvPython) ? venvPython : 'python3';
      await execAsync(`${pythonCmd} -m demucs --help`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Separate vocals and instrumental from audio file
   *
   * @param audioPath Path to input audio file
   * @param outputDir Directory for output files (default: ./demucs_output)
   * @returns Paths to separated vocals and instrumental
   */
  async separate(
    audioPath: string,
    outputDir: string = './demucs_output'
  ): Promise<DemucsResult> {
    const startTime = Date.now();

    if (!existsSync(audioPath)) {
      throw new Error(`Input file not found: ${audioPath}`);
    }

    // Check if Demucs is installed
    const installed = await this.checkInstalled();
    if (!installed) {
      throw new Error(
        'Demucs not installed. Install with: pip install demucs==4.0.1'
      );
    }

    this.log(`Separating audio: ${audioPath}`);
    this.log(`Model: ${this.model}, Format: ${this.outputFormat}, Device: ${this.device}`);

    // Build Demucs command using venv python
    const venvPython = join(process.cwd(), '.venv', 'bin', 'python3');
    const pythonCmd = existsSync(venvPython) ? venvPython : 'python3';

    const args: string[] = [
      pythonCmd, '-m', 'demucs',
      '--two-stems=vocals', // Karaoke mode: vocals + instrumental (no_vocals)
      '-n', this.model,
      '-o', outputDir,
      '--device', this.device,
    ];

    // Output format
    if (this.outputFormat === 'mp3') {
      args.push('--mp3');
      args.push('--mp3-bitrate', this.mp3Bitrate.toString());
      args.push('--mp3-preset', '2'); // Highest quality preset
    } else if (this.outputFormat === 'flac') {
      args.push('--flac');
    } else if (this.outputFormat === 'wav') {
      args.push('--wav');
    }

    args.push(`"${audioPath}"`);

    const command = args.join(' ');
    this.log(`Command: ${command.replace(audioPath, basename(audioPath))}`);

    try {
      // Execute Demucs (this takes a while)
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer for long output
      });

      // Demucs outputs progress to stderr
      if (stderr) {
        // Log only the last line (progress)
        const lines = stderr.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        if (lastLine && !lastLine.includes('Selected model')) {
          this.log(`Progress: ${lastLine}`);
        }
      }

      // Locate output files
      // Demucs outputs to: {outputDir}/{model}/{trackname}/vocals.{ext}
      const trackName = basename(audioPath).replace(/\.[^.]+$/, '');
      const trackDir = join(outputDir, this.model, trackName);

      const ext = this.outputFormat;
      const vocalsPath = join(trackDir, `vocals.${ext}`);
      const instrumentalPath = join(trackDir, `no_vocals.${ext}`);

      if (!existsSync(vocalsPath) || !existsSync(instrumentalPath)) {
        throw new Error(`Demucs output not found in ${trackDir}`);
      }

      const duration = (Date.now() - startTime) / 1000;
      this.log(`✓ Separation complete in ${duration.toFixed(1)}s`);
      this.log(`  Vocals: ${vocalsPath}`);
      this.log(`  Instrumental: ${instrumentalPath}`);

      return {
        vocalsPath,
        instrumentalPath,
        model: this.model,
        duration,
      };
    } catch (error: any) {
      throw new Error(`Demucs separation failed: ${error.message}`);
    }
  }

  /**
   * Download model if not cached (optional pre-warming)
   */
  async downloadModel(): Promise<void> {
    this.log(`Downloading model: ${this.model}...`);

    try {
      const venvPython = join(process.cwd(), '.venv', 'bin', 'python3');
      const pythonCmd = existsSync(venvPython) ? venvPython : 'python3';
      await execAsync(
        `${pythonCmd} -c "from demucs.pretrained import get_model; get_model('${this.model}')"`
      );
      this.log(`✓ Model ${this.model} downloaded`);
    } catch (error: any) {
      throw new Error(`Model download failed: ${error.message}`);
    }
  }
}
